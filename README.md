# Agent-MX


<img width="1261" height="513" alt="Screenshot 2026-05-06 at 3 04 41 AM" src="https://github.com/user-attachments/assets/67864d1f-eec3-4625-a888-e5b15f922315" />



A small CLI agent I built for the AI Agent assignment. You chat with it in the
terminal (similar to Cursor / Windsurf), tell it to clone the Scaler Academy
website, and it actually writes the HTML/CSS/JS to disk and opens the page in
your browser.

It's a loop — the model thinks, picks a tool, the runtime runs the tool, the
result gets fed back, and that repeats until the model says it's done. So one
big task gets broken into a bunch of small steps you can watch happen live.

## What it does

- Conversational CLI you can keep chatting with after each task.
- First-run setup: if there's no Gemini key in `.env`, it asks for one and saves it.
- `/model` lists the Gemini models your key has access to and lets you switch.
- Will only clone Scaler — anything else (Facebook clone, NSFW, sketchy stuff) gets refused before the API is even called.
- Banner, spinners, dim monochrome step log so you can see what the agent is doing.

## Setup

## POINT TO NOTE:
As of now the scaler_clone directory is genreated by the agent while testing, but you can also create by deleting the existing one yourself if you want to peek at the files as they're being written



You need Node 18+ and a Gemini API key (free one from
https://aistudio.google.com/apikey works fine).

    npm install
    npm start

On first launch it'll say "api not given" and ask you to paste the key. It
pings Gemini with a tiny request to make sure the key actually works, then
writes it to `.env`. Next time you run it, it just picks up the key from there.

If you'd rather set it up by hand:

    cp .env.example .env
    # open .env and paste your key into GEMINI_API_KEY=
    npm start

## Using it

    you > clone the scaler academy website

That's the main one. The agent will plan, write `scaler_clone/index.html`,
`styles.css`, `script.js`, and `open` the page. After it's done you can keep
going in the same session — ask it to tweak colors, add a section, whatever.

Slash commands inside the chat:

| command  | what it does                                                |
| -------- | ----------------------------------------------------------- |
| `/model` | pick a different Gemini model (live list from your account) |
| `/key`   | replace the saved API key                                   |
| `/help`  | show the commands                                           |
| `exit`   | quit                                                        |

Default model is `gemini-2.5-flash`. I tried `2.5-pro` too — slower but the
copy it writes is noticeably better.

## What's in the repo

    .
    ├── index.js       chat loop, runs the START → THINK → TOOL → OBSERVE → OUTPUT cycle
    ├── tools.js       the tools the agent can call (writeFile, appendFile, executeCommand, ...)
    ├── prompt.js      the system prompt — also where the Scaler design spec lives
    ├── policy.js      the "only Scaler" guard (runs before the API call so blocked prompts are free)
    ├── setup.js       first-run key prompt + the /model picker
    ├── ui.js          ASCII banner, spinner, step log
    ├── package.json
    ├── .env.example
    └── scaler_clone/  ← this gets created by the agent on first run
        ├── index.html
        ├── styles.css
        └── script.js

## Tools the agent has

| tool                        | args                | use                                                   |
| --------------------------- | ------------------- | ----------------------------------------------------- |
| `writeFile`                 | `{ path, content }` | create / overwrite a file                             |
| `appendFile`                | `{ path, content }` | append (used when a file is too big for one response) |
| `readFile`                  | `{ path }`          | read a file back                                      |
| `listFiles`                 | `{ path }`          | list a directory                                      |
| `makeDirectory`             | `{ path }`          | mkdir -p                                              |
| `executeCommand`            | `{ cmd }`           | run a shell command (mostly used to `open` the page)  |
| `getTheWeatherOfCity`       | `{ cityname }`      | wttr.in lookup — left in from the starter             |
| `getGithubDetailsAboutUser` | `{ username }`      | same idea                                             |

All file paths are forced inside the project root so the agent can't write outside it.

## Notes & sharp edges

- I capped each turn at 40 steps so a confused model can't run away with your tokens.
- If Gemini truncates a big file mid-string the runtime catches the parse failure, tells the agent it was probably truncated, and asks it to retry by splitting into `writeFile` + `appendFile`. After 3 failed parses in a row the turn aborts.
- `executeCommand` is sandboxed to the project cwd but it's still a shell — don't paste anything you wouldn't run yourself.
- Refused prompts (non-Scaler clones, NSFW, etc.) print a "policy" block locally and never hit Gemini.
