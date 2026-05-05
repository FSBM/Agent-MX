import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { GoogleGenAI } from "@google/genai";
import { tool_map } from "./tools.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { checkPolicy } from "./policy.js";
import { printBanner, drawDivider, spinner, logStep, userPrompt, policyBlock, c, hex } from "./ui.js";
import { ensureApiKey, ensureModel, pickModel } from "./setup.js";

const MAX_STEPS_PER_TURN = 40;

let MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
let ai = null;

function safeParseJson(text) {
  if (!text) return null;
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callModel(history) {
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0.4,
      maxOutputTokens: 65536,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  return response.text ?? "";
}

async function runAgentTurn(history) {
  let parseFailures = 0;
  for (let step = 0; step < MAX_STEPS_PER_TURN; step++) {
    const spin = spinner("agent-mx is thinking…");
    let raw;
    try {
      raw = await callModel(history);
      spin.stop();
    } catch (err) {
      spin.stop();
      logStep("error", err.message);
      return;
    }

    const parsed = safeParseJson(raw);

    if (!parsed || !parsed.step) {
      parseFailures++;
      logStep("warn", `couldn't parse reply (attempt ${parseFailures}/3) — asking agent to retry`);
      if (parseFailures >= 3) {
        logStep("error", "giving up after 3 parse failures this turn.");
        return;
      }
      history.push({
        role: "user",
        content: JSON.stringify({
          step: "OBSERVE",
          content:
            "Your previous reply was not valid JSON (likely truncated). Reply with ONE small JSON object. " +
            "If you were writing a large file, split it: write the first half with writeFile, then the rest with appendFile.",
        }),
      });
      continue;
    }
    parseFailures = 0;

    history.push({ role: "assistant", content: JSON.stringify(parsed) });

    switch (parsed.step) {
      case "START":
        logStep("start", parsed.content || "");
        break;

      case "THINK":
        logStep("think", parsed.content || "");
        break;

      case "TOOL": {
        const name = parsed.tool_name;
        const args = parsed.tool_args ?? {};
        const argPreview = JSON.stringify(args).slice(0, 120);
        logStep("tool", `${c.bold}${name}${c.reset} ${c.dim}${argPreview}${argPreview.length >= 120 ? "…" : ""}${c.reset}`);

        const toolSpin = spinner(`running ${name}…`);
        let observation;
        if (!tool_map[name]) {
          observation = `Tool '${name}' is not available. Available: ${Object.keys(tool_map).join(", ")}`;
        } else {
          try {
            const result = await tool_map[name](args);
            observation = typeof result === "string" ? result : JSON.stringify(result);
          } catch (err) {
            observation = `ERROR running ${name}: ${err.message}`;
          }
        }
        toolSpin.stop();

        const preview = observation.length > 200 ? observation.slice(0, 200) + "…" : observation;
        logStep("obs", preview);

        history.push({
          role: "user",
          content: JSON.stringify({ step: "OBSERVE", content: observation }),
        });
        break;
      }

      case "OUTPUT":
        logStep("done", parsed.content || "");
        return;

      default:
        logStep("warn", `unknown step '${parsed.step}'. treating as think.`);
    }
  }
  logStep("error", `reached max steps (${MAX_STEPS_PER_TURN}) without output.`);
}

function printHelp() {
  console.log(`  ${hex("#7c818f")}commands${c.reset}`);
  console.log(`    ${hex("#d6d8df")}/model${c.reset}   ${hex("#7c818f")}list & switch gemini models${c.reset}`);
  console.log(`    ${hex("#d6d8df")}/key${c.reset}     ${hex("#7c818f")}re-enter your gemini api key${c.reset}`);
  console.log(`    ${hex("#d6d8df")}/help${c.reset}    ${hex("#7c818f")}show this help${c.reset}`);
  console.log(`    ${hex("#d6d8df")}exit${c.reset}     ${hex("#7c818f")}quit${c.reset}\n`);
}

async function main() {
  const rl = readline.createInterface({ input, output });

  await printBanner({ animate: true, model: MODEL });

  const key = await ensureApiKey(rl);
  MODEL = await ensureModel(rl, MODEL);
  ai = new GoogleGenAI({ apiKey: key });

  console.log(`\n  ${hex("#7c818f")}try${c.reset} ${hex("#8aa9ff")}clone the scaler academy website${c.reset}`);
  printHelp();
  await drawDivider();
  console.log();

  const history = [];

  while (true) {
    const userInput = (await rl.question(userPrompt())).trim();
    if (!userInput) continue;
    const lower = userInput.toLowerCase();

    if (["exit", "quit", ":q"].includes(lower)) {
      console.log(`\n  ${hex("#8aa9ff")}agent-mx${c.reset} ${hex("#7c818f")}signing off.${c.reset}\n`);
      rl.close();
      return;
    }

    if (lower === "/help") {
      printHelp();
      continue;
    }

    if (lower === "/key") {
      delete process.env.GEMINI_API_KEY;
      const newKey = await ensureApiKey(rl);
      ai = new GoogleGenAI({ apiKey: newKey });
      continue;
    }

    if (lower === "/model" || lower === "/models") {
      MODEL = await pickModel(rl, process.env.GEMINI_API_KEY, MODEL);
      continue;
    }

    const verdict = checkPolicy(userInput);
    if (!verdict.ok) {
      policyBlock(verdict.reason);
      continue;
    }

    history.push({ role: "user", content: userInput });

    try {
      await runAgentTurn(history);
    } catch (err) {
      logStep("error", err.message);
    }
    await drawDivider();
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
