const ALLOWED_HOSTS = new Set([
  "scaler.com",
  "www.scaler.com",
]);

const BLOCKED_KEYWORDS = [
  "nsfw", "porn", "pornhub", "xvideos", "xnxx", "redtube", "youporn",
  "onlyfans", "hentai", "rule34", "erotic", "adult site", "adult website",
  "phishing", "malware", "ransomware", "cracked", "warez", "torrent site",
  "credit card dump", "carding", "darkweb", "dark web market", "silk road",
  "stalk", "doxx", "doxing", "harass",
  "facebook clone", "instagram clone", "twitter clone", "x.com clone",
  "linkedin clone", "youtube clone", "amazon clone", "netflix clone",
  "google clone", "gmail clone", "whatsapp clone", "tiktok clone",
  "reddit clone", "discord clone", "spotify clone", "apple clone",
  "microsoft clone", "github clone", "claude clone", "chatgpt clone",
  "openai clone",
];

const URL_RE = /\bhttps?:\/\/([^\s/?#]+)/gi;
const CLONE_INTENT_RE = /\b(clone|copy|replicate|recreate|rip|mirror|duplicate|scrape)\b/i;

export function checkPolicy(userInput) {
  const text = (userInput || "").toLowerCase();

  for (const kw of BLOCKED_KEYWORDS) {
    if (text.includes(kw)) {
      return {
        ok: false,
        reason: `Sorry, our policies restrict that — I can't help build or clone "${kw}"-style content.`,
      };
    }
  }

  const hosts = [];
  let match;
  while ((match = URL_RE.exec(userInput || "")) !== null) {
    hosts.push(match[1].toLowerCase());
  }

  if (hosts.length > 0) {
    const allAllowed = hosts.every((h) => ALLOWED_HOSTS.has(h) || ALLOWED_HOSTS.has(h.replace(/^www\./, "")));
    if (!allAllowed) {
      return {
        ok: false,
        reason: `Sorry, our policies restrict that — Agent-MX only clones the Scaler Academy website (scaler.com). The URL "${hosts.find((h) => !ALLOWED_HOSTS.has(h))}" is not on the allowlist.`,
      };
    }
  }

  if (CLONE_INTENT_RE.test(text)) {
    const mentionsScaler = text.includes("scaler");
    const mentionsAllowedHost = hosts.some((h) => ALLOWED_HOSTS.has(h));
    const mentionsOtherSite = /\b(facebook|instagram|twitter|x\.com|linkedin|youtube|amazon|netflix|google|gmail|whatsapp|tiktok|reddit|discord|spotify|apple|microsoft|github|claude|chatgpt|openai|leetcode|hackerrank|coursera|udemy|byju|unacademy|upgrad)\b/i.test(text);

    if (mentionsOtherSite && !mentionsScaler) {
      return {
        ok: false,
        reason: "Sorry, our policies restrict that — Agent-MX is only authorized to clone the Scaler Academy website. Other websites are out of scope.",
      };
    }

    if (!mentionsScaler && !mentionsAllowedHost && hosts.length === 0) {
      // Generic "clone X" with no target — let the agent ask, don't block.
      return { ok: true };
    }
  }

  return { ok: true };
}
