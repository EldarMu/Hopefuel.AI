import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const STORY_DIR = fileURLToPath(new URL("../stories/", import.meta.url));
const DOMAINS = new Set([
  "health",
  "mental-health",
  "accessibility",
  "family-and-relationships",
  "education",
  "work",
  "money-and-consumer",
  "law-and-bureaucracy",
  "technology",
  "creative-work",
  "daily-life",
  "community",
  "animals-and-nature",
]);

function fail(file, message) {
  throw new Error(`${file}: ${message}`);
}

function canonicalUrl(raw, file) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(file, "first line must be a valid URL");
  }
  if (url.protocol !== "https:") fail(file, "source URL must use https");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || ["share_id", "context"].includes(key)) {
      url.searchParams.delete(key);
    }
  }
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function parse(file, raw) {
  if (raw.includes("\r")) fail(file, "use LF line endings");
  if (!raw.endsWith("\n")) fail(file, "file must end with a newline");

  const lines = raw.slice(0, -1).split("\n");
  const dateMarkers = lines.reduce((n, line) => n + (line === "#date" ? 1 : 0), 0);
  const tagMarkers = lines.reduce((n, line) => n + (line === "#tags" ? 1 : 0), 0);
  if (dateMarkers !== 1 || tagMarkers !== 1) fail(file, "must contain exactly one #date and one #tags marker");

  const dateIndex = lines.indexOf("#date");
  const tagsIndex = lines.indexOf("#tags");
  if (dateIndex < 3) fail(file, "story text is missing");
  if (tagsIndex !== dateIndex + 2) fail(file, "#tags must immediately follow the date value");
  if (tagsIndex !== lines.length - 2) fail(file, "unexpected content after the tags line");

  const sourceUrl = lines[0].trim();
  const author = lines[1].trim();
  const text = lines.slice(2, dateIndex).join("\n");
  const date = lines[dateIndex + 1].trim();
  const tags = lines[tagsIndex + 1].split(",").map((tag) => tag.trim()).filter(Boolean);

  if (!author.startsWith("@") || author.length < 2) fail(file, "second line must be the original @handle");
  if (text.trim().length < 40) fail(file, "story text is too short");
  if (text !== text.trim()) fail(file, "story text has leading or trailing blank lines");
  if (!/^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(date)) fail(file, "date must be YYYY-MM or YYYY");
  if (tags.length < 2) fail(file, "supply at least one domain tag and one model tag");
  if (new Set(tags).size !== tags.length) fail(file, "tags must not repeat");

  const domains = tags.filter((tag) => DOMAINS.has(tag));
  const models = tags.filter((tag) => !DOMAINS.has(tag));
  if (domains.length === 0) fail(file, "no allowed domain tag found");
  if (models.length === 0) fail(file, "no model tag found");

  return { file, sourceUrl: canonicalUrl(sourceUrl, file), text };
}

const names = (await readdir(STORY_DIR)).filter((name) => !name.startsWith(".")).sort();
if (names.length === 0) throw new Error("stories/ is empty");

const records = [];
for (const name of names) {
  if (!name.endsWith(".txt")) fail(name, "stories/ may contain only .txt files");
  records.push(parse(name, await readFile(join(STORY_DIR, name), "utf8")));
}

const urls = new Map();
const texts = new Map();
for (const record of records) {
  if (urls.has(record.sourceUrl)) fail(record.file, `duplicate source URL also found in ${urls.get(record.sourceUrl)}`);
  urls.set(record.sourceUrl, record.file);

  const normalizedText = record.text.replace(/\s+/g, " ").trim().toLowerCase();
  if (texts.has(normalizedText)) fail(record.file, `duplicate story text also found in ${texts.get(normalizedText)}`);
  texts.set(normalizedText, record.file);
}

console.log(`Validated ${records.length} stories.`);

