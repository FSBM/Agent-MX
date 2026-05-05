import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import axios from "axios";

const ROOT = process.cwd();

function safeResolve(targetPath) {
  const resolved = path.resolve(ROOT, targetPath);
  if (!resolved.startsWith(ROOT)) {
    throw new Error(`Path escapes project root: ${targetPath}`);
  }
  return resolved;
}

export async function writeFile({ path: filePath, content }) {
  if (!filePath) throw new Error("writeFile requires 'path'");
  if (typeof content !== "string") throw new Error("writeFile requires string 'content'");
  const abs = safeResolve(filePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  return `Wrote ${content.length} bytes to ${filePath}`;
}

export async function appendFile({ path: filePath, content }) {
  if (!filePath) throw new Error("appendFile requires 'path'");
  if (typeof content !== "string") throw new Error("appendFile requires string 'content'");
  const abs = safeResolve(filePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.appendFile(abs, content, "utf8");
  return `Appended ${content.length} bytes to ${filePath}`;
}

export async function readFile({ path: filePath }) {
  const abs = safeResolve(filePath);
  const data = await fs.readFile(abs, "utf8");
  return data;
}

export async function listFiles({ path: dirPath = "." } = {}) {
  const abs = safeResolve(dirPath);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
}

export async function makeDirectory({ path: dirPath }) {
  const abs = safeResolve(dirPath);
  await fs.mkdir(abs, { recursive: true });
  return `Created directory ${dirPath}`;
}

export async function executeCommand({ cmd }) {
  if (!cmd) throw new Error("executeCommand requires 'cmd'");
  return new Promise((resolve) => {
    exec(cmd, { cwd: ROOT, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        resolve(`ERROR: ${error.message}\nSTDERR: ${stderr}`);
      } else {
        resolve(stdout.trim() || stderr.trim() || `OK (no output) for: ${cmd}`);
      }
    });
  });
}

export async function getTheWeatherOfCity({ cityname }) {
  const url = `https://wttr.in/${cityname.toLowerCase()}?format=%C+%t`;
  const { data } = await axios.get(url, { responseType: "text" });
  return `The weather of ${cityname} is ${data}`;
}

export async function getGithubDetailsAboutUser({ username }) {
  const url = `https://api.github.com/users/${username}`;
  const { data } = await axios.get(url);
  return {
    login: data.login,
    name: data.name,
    blog: data.blog,
    public_repos: data.public_repos,
  };
}

export const tool_map = {
  writeFile,
  appendFile,
  readFile,
  listFiles,
  makeDirectory,
  executeCommand,
  getTheWeatherOfCity,
  getGithubDetailsAboutUser,
};
