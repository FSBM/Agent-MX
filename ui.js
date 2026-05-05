import { stdout } from "node:process";

export const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  ul: "\x1b[4m",
};

export function hex(hexColor) {
  const h = hexColor.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

const TONE = {
  text: hex("#d6d8df"),
  mute: hex("#7c818f"),
  faint: hex("#5b6070"),
  rule: hex("#3a3f4d"),
  accent: hex("#8aa9ff"),
  ok: hex("#9bd1a6"),
  warn: hex("#d9c27a"),
  err: hex("#d98a8a"),
};

const BANNER = [
  "    █████╗  ██████╗ ███████╗███╗   ██╗████████╗      ███╗   ███╗██╗  ██╗",
  "   ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝      ████╗ ████║╚██╗██╔╝",
  "   ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   █████╗██╔████╔██║ ╚███╔╝ ",
  "   ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ╚════╝██║╚██╔╝██║ ██╔██╗ ",
  "   ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║         ██║ ╚═╝ ██║██╔╝ ██╗",
  "   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝         ╚═╝     ╚═╝╚═╝  ╚═╝",
];

const GRADIENT = ["#9aa5c4", "#a8b1cf", "#b6bdda", "#c4cae5", "#d2d7f0", "#e0e3f8"];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function repeat(s, n) {
  return new Array(Math.max(0, n) + 1).join(s);
}

export async function printBanner({ animate = true, model = "" } = {}) {
  stdout.write("\n");
  for (let i = 0; i < BANNER.length; i++) {
    const color = hex(GRADIENT[i % GRADIENT.length]);
    stdout.write(`  ${color}${BANNER[i]}${c.reset}\n`);
    if (animate) await sleep(38);
  }
  stdout.write("\n");
  stdout.write(`  ${TONE.mute}conversational coding agent  ·  reasons → acts → ships files${c.reset}\n`);
  if (model) stdout.write(`  ${TONE.faint}model${c.reset} ${TONE.mute}${model}${c.reset}\n`);
  stdout.write("\n");
  await drawDivider();
}

export async function drawDivider() {
  const cols = Math.min(stdout.columns || 80, 90);
  const bar = repeat("─", cols - 2);
  stdout.write(`  ${TONE.rule}${bar}${c.reset}\n`);
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function spinner(label) {
  let i = 0;
  let active = true;
  const startTs = Date.now();
  const render = () => {
    if (!active) return;
    const frame = SPINNER_FRAMES[i % SPINNER_FRAMES.length];
    const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);
    stdout.write(`\r  ${TONE.accent}${frame}${c.reset} ${TONE.mute}${label}${c.reset} ${TONE.faint}${elapsed}s${c.reset}     `);
    i++;
  };
  const handle = setInterval(render, 80);
  render();
  return {
    stop(finalLabel) {
      active = false;
      clearInterval(handle);
      stdout.write("\r" + repeat(" ", (label.length + 24)) + "\r");
      if (finalLabel) stdout.write(finalLabel + "\n");
    },
  };
}

const STEP_STYLE = {
  start: { tag: "start ", color: TONE.mute },
  think: { tag: "think ", color: TONE.mute },
  tool:  { tag: "tool  ", color: TONE.accent },
  obs:   { tag: "obs   ", color: TONE.faint },
  done:  { tag: "done  ", color: TONE.ok },
  error: { tag: "error ", color: TONE.err },
  warn:  { tag: "warn  ", color: TONE.warn },
  policy:{ tag: "policy", color: TONE.err },
};

export function logStep(kind, message) {
  const style = STEP_STYLE[kind] || { tag: kind.padEnd(6), color: TONE.text };
  const text = (message ?? "").toString();
  const cols = Math.min(stdout.columns || 80, 100);
  const wrapWidth = Math.max(40, cols - 14);
  const lines = wrap(text, wrapWidth);
  const head = `  ${style.color}${style.tag}${c.reset} ${TONE.rule}│${c.reset} `;
  const cont = `         ${TONE.rule}│${c.reset} `;
  if (lines.length === 0) lines.push("");
  stdout.write(`${head}${TONE.text}${lines[0]}${c.reset}\n`);
  for (let i = 1; i < lines.length; i++) {
    stdout.write(`${cont}${TONE.mute}${lines[i]}${c.reset}\n`);
  }
}

function wrap(text, width) {
  if (!text) return [""];
  const result = [];
  for (const para of text.split("\n")) {
    if (para.length <= width) {
      result.push(para);
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      if ((line + " " + w).trim().length > width) {
        if (line) result.push(line);
        line = w;
      } else {
        line = line ? line + " " + w : w;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

export function userPrompt() {
  return `  ${TONE.accent}❯${c.reset} ${TONE.text}you${c.reset} ${TONE.faint}›${c.reset} `;
}

export function policyBlock(message) {
  const cols = Math.min(stdout.columns || 80, 90);
  const bar = repeat("─", cols - 2);
  stdout.write(`\n  ${TONE.err}${bar}${c.reset}\n`);
  stdout.write(`  ${TONE.err}policy${c.reset} ${TONE.rule}│${c.reset} ${TONE.text}${message}${c.reset}\n`);
  stdout.write(`  ${TONE.err}${bar}${c.reset}\n\n`);
}
