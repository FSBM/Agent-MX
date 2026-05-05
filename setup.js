import { promises as fs } from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { c, hex } from "./ui.js";

const TONE = {
  text: hex("#d6d8df"),
  mute: hex("#7c818f"),
  faint: hex("#5b6070"),
  rule: hex("#3a3f4d"),
  accent: hex("#8aa9ff"),
  ok: hex("#9bd1a6"),
  err: hex("#d98a8a"),
};

const ENV_PATH = path.resolve(process.cwd(), ".env");

const KNOWN_MODELS = [
  { id: "gemini-2.5-flash",      label: "gemini 2.5 flash       fast, balanced (default)" },
  { id: "gemini-2.5-pro",        label: "gemini 2.5 pro         deep reasoning, slower" },
  { id: "gemini-2.5-flash-lite", label: "gemini 2.5 flash-lite  cheapest, very fast" },
  { id: "gemini-2.0-flash",      label: "gemini 2.0 flash       previous-gen flash" },
  { id: "gemini-2.0-flash-lite", label: "gemini 2.0 flash-lite  previous-gen lite" },
];

const KEY_RE = /^GEMINI_API_KEY\s*=.*$/m;
const MODEL_RE = /^GEMINI_MODEL\s*=.*$/m;

async function readEnv() {
  try {
    return await fs.readFile(ENV_PATH, "utf8");
  } catch {
    return "";
  }
}

async function writeEnvLine(key, value) {
  let body = await readEnv();
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}\\s*=.*$`, "m");
  if (re.test(body)) {
    body = body.replace(re, line);
  } else {
    if (body && !body.endsWith("\n")) body += "\n";
    body += line + "\n";
  }
  await fs.writeFile(ENV_PATH, body, "utf8");
}

function looksLikeGeminiKey(k) {
  return typeof k === "string" && /^AIza[0-9A-Za-z_\-]{20,}$/.test(k.trim());
}

async function verifyKey(key) {
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const r = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "ping" }] }],
      config: { maxOutputTokens: 4, thinkingConfig: { thinkingBudget: 0 } },
    });
    return { ok: true, sample: (r.text || "").slice(0, 40) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function listAvailableModels(key) {
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const list = await ai.models.list();
    const ids = [];
    for await (const m of list) {
      const id = (m.name || "").replace(/^models\//, "");
      if (!id) continue;
      const supports = m.supportedActions || m.supportedGenerationMethods || [];
      const can = Array.isArray(supports) && supports.length > 0
        ? supports.some((a) => /generateContent/i.test(a))
        : true;
      if (can && /^gemini-/.test(id) && !/embedding|aqa|imagen|veo|tts|live/i.test(id)) {
        ids.push(id);
      }
    }
    return ids.sort();
  } catch {
    return null;
  }
}

export async function ensureApiKey(rl) {
  let key = (process.env.GEMINI_API_KEY || "").trim();

  if (!key) {
    console.log(`\n  ${TONE.err}api not given${c.reset} ${TONE.rule}│${c.reset} ${TONE.text}paste your Gemini API key below.${c.reset}`);
    console.log(`  ${TONE.faint}get one at https://aistudio.google.com/apikey${c.reset}\n`);
    while (!key) {
      const input = (await rl.question(`  ${TONE.accent}❯${c.reset} ${TONE.text}gemini api key${c.reset} ${TONE.faint}›${c.reset} `)).trim();
      if (!input) continue;
      if (!looksLikeGeminiKey(input)) {
        console.log(`  ${TONE.err}that doesn't look like a Gemini key (expected to start with "AIza…"). try again.${c.reset}`);
        continue;
      }
      key = input;
    }
  }

  process.stdout.write(`  ${TONE.mute}verifying key…${c.reset}`);
  const v = await verifyKey(key);
  process.stdout.write("\r" + " ".repeat(40) + "\r");
  if (!v.ok) {
    console.log(`  ${TONE.err}key rejected${c.reset} ${TONE.rule}│${c.reset} ${TONE.text}${v.error}${c.reset}`);
    process.exit(1);
  }
  console.log(`  ${TONE.ok}key verified${c.reset} ${TONE.rule}│${c.reset} ${TONE.mute}saved to .env${c.reset}`);
  await writeEnvLine("GEMINI_API_KEY", key);
  process.env.GEMINI_API_KEY = key;
  return key;
}

export async function ensureModel(rl, currentModel) {
  if (currentModel) return currentModel;
  const def = "gemini-2.5-flash";
  await writeEnvLine("GEMINI_MODEL", def);
  process.env.GEMINI_MODEL = def;
  return def;
}

export async function pickModel(rl, key, currentModel) {
  console.log(`\n  ${TONE.text}available gemini models${c.reset} ${TONE.faint}(current: ${currentModel})${c.reset}\n`);

  process.stdout.write(`  ${TONE.mute}fetching live model list…${c.reset}`);
  const live = await listAvailableModels(key);
  process.stdout.write("\r" + " ".repeat(40) + "\r");

  const ids = live && live.length ? live : KNOWN_MODELS.map((m) => m.id);
  const labelFor = (id) => {
    const k = KNOWN_MODELS.find((m) => m.id === id);
    return k ? k.label : id;
  };

  ids.forEach((id, i) => {
    const marker = id === currentModel ? `${TONE.ok}●${c.reset}` : `${TONE.faint}○${c.reset}`;
    const num = `${TONE.faint}${String(i + 1).padStart(2, " ")}${c.reset}`;
    console.log(`  ${marker} ${num} ${TONE.text}${labelFor(id)}${c.reset}`);
  });
  console.log();

  const ans = (await rl.question(`  ${TONE.accent}❯${c.reset} ${TONE.text}pick a number${c.reset} ${TONE.faint}(or enter to keep ${currentModel})${c.reset} ${TONE.faint}›${c.reset} `)).trim();
  if (!ans) return currentModel;

  const n = parseInt(ans, 10);
  if (Number.isNaN(n) || n < 1 || n > ids.length) {
    console.log(`  ${TONE.err}invalid choice — keeping ${currentModel}${c.reset}`);
    return currentModel;
  }

  const next = ids[n - 1];
  console.log(`  ${TONE.mute}verifying ${next}…${c.reset}`);
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    await ai.models.generateContent({
      model: next,
      contents: [{ role: "user", parts: [{ text: "ping" }] }],
      config: { maxOutputTokens: 4, thinkingConfig: { thinkingBudget: 0 } },
    });
  } catch (err) {
    console.log(`  ${TONE.err}${next} unavailable for this key: ${err.message}${c.reset}`);
    return currentModel;
  }

  await writeEnvLine("GEMINI_MODEL", next);
  process.env.GEMINI_MODEL = next;
  console.log(`  ${TONE.ok}switched to ${next}${c.reset} ${TONE.mute}(saved to .env)${c.reset}\n`);
  return next;
}
