import { readdir, readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const STORY_DIR = fileURLToPath(new URL("../stories", import.meta.url));
const ASSETS_DIR = fileURLToPath(new URL("../assets", import.meta.url));
const DIST_DIR = fileURLToPath(new URL("../dist", import.meta.url));

const BASE = (process.env.BASE_PATH ?? "").replace(/\/+$/, "");

const DOMAINS = {
  "health": { label: "Health", description: "Physical health, care, diagnosis, and recovery." },
  "mental-health": { label: "Mental health", description: "Emotional wellbeing, reflection, and psychological support." },
  "accessibility": { label: "Accessibility", description: "Disability access, accommodations, and adaptive support." },
  "family-and-relationships": { label: "Family & relationships", description: "Partners, children, caregiving, grief, and difficult conversations." },
  "education": { label: "Education", description: "Learning, teaching, study, and intellectual confidence." },
  "work": { label: "Work", description: "Employment, careers, trades, and professional life." },
  "money-and-consumer": { label: "Money & consumer", description: "Bills, scams, contracts, purchases, and consumer rights." },
  "law-and-bureaucracy": { label: "Law & bureaucracy", description: "Benefits, appeals, forms, rights, and institutions." },
  "technology": { label: "Technology", description: "Software, computers, devices, data, and technical work." },
  "creative-work": { label: "Creative work", description: "Writing, art, music, games, and other creative work." },
  "daily-life": { label: "Daily life", description: "Home, travel, planning, repair, food, and practical tasks." },
  "community": { label: "Community", description: "Belonging, mutual aid, friendship, and local community." },
  "animals-and-nature": { label: "Animals & nature", description: "Pets, wildlife, plants, farming, and the natural world." },
};

const MODEL_SLUGS = {
  "ChatGPT": "chatgpt-1c6pqoo",
  "Claude": "claude-1qpbcif",
  "Claude Code": "claude-code-1q24zb8",
  "Claude Sonnet 4.5": "claude-sonnet-4-5-1xthi4r",
  "Gemini": "gemini-147607i",
  "GPT-4": "gpt-4-15oq23",
  "GPT-4o": "gpt-4o-62gtzg",
  "Grok": "grok-18jadhi",
  "Spark": "spark-hj4mei",
  "Unspecified AI": "unspecified-ai-11dbqn6",
  "Unspecified LLM": "unspecified-llm-frvv5v",
};

function getModelSlug(name) {
  if (MODEL_SLUGS[name]) return MODEL_SLUGS[name];
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const hash = createHash("sha256").update(name).digest().readUInt32BE(0).toString(36);
  return `${base}-${hash}`;
}

function detectPlatform(urlStr) {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    if (host.includes("reddit.com")) return "Reddit";
    if (host.includes("twitter.com") || host === "x.com" || host.endsWith(".x.com")) return "X";
    if (host.includes("ycombinator.com")) return "Hacker News";
    if (host.includes("youtube.com") || host === "youtu.be") return "YouTube";
    if (host.includes("linkedin.com")) return "LinkedIn";
    if (host.includes("facebook.com")) return "Facebook";
    if (host.includes("instagram.com")) return "Instagram";
    if (host.includes("threads.net")) return "Threads";
    return host.replace(/^www\./, "");
  } catch {
    return "Source";
  }
}

function canonicalUrl(raw) {
  const url = new URL(raw);
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

function parseStory(file, raw, addedDates) {
  const normalizedRaw = raw.replace(/\r\n/g, "\n");
  const lines = normalizedRaw.endsWith("\n") ? normalizedRaw.slice(0, -1).split("\n") : normalizedRaw.split("\n");

  const dateIndex = lines.indexOf("#date");
  const tagsIndex = lines.indexOf("#tags");

  const sourceUrl = lines[0].trim();
  const author = lines[1].trim();
  const text = lines.slice(2, dateIndex).join("\n");
  const publishedAt = lines[dateIndex + 1].trim();
  const allTags = lines[tagsIndex + 1].split(",").map((t) => t.trim()).filter(Boolean);

  const domains = allTags.filter((t) => DOMAINS[t]);
  const models = allTags.filter((t) => !DOMAINS[t]);
  const id = file.replace(/\.txt$/, "");
  const addedAt = addedDates.get(file);

  const story = {
    id,
    text,
    textKind: "verbatim",
    source: {
      url: canonicalUrl(sourceUrl),
      platform: detectPlatform(sourceUrl),
      author,
      publishedAt,
    },
    models,
    domains,
    canonical_path: `/stories/${id}`,
  };

  if (addedAt) {
    story.addedAt = addedAt;
  }

  return story;
}

function getGitCommitDates() {
  const addedDates = new Map();
  try {
    const output = execSync('git log --format="COMMIT:%as" --name-only --reverse -- stories/', {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    let currentDate = null;
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("COMMIT:")) {
        currentDate = trimmed.slice(7);
      } else if (trimmed.startsWith("stories/") && trimmed.endsWith(".txt")) {
        const filename = trimmed.replace(/^stories\//, "");
        if (!addedDates.has(filename) && currentDate) {
          addedDates.set(filename, currentDate);
        }
      }
    }
  } catch (err) {
    console.warn("Notice: could not query git log for commit dates:", err.message);
  }
  return addedDates;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function href(subpath, depth = 0) {
  if (subpath.startsWith("#") || subpath.startsWith("http:") || subpath.startsWith("https:")) {
    return subpath;
  }
  const clean = subpath.replace(/^\//, "");
  const prefix = depth === 0 ? "./" : "../".repeat(depth);
  if (!clean) return prefix;
  if (clean.includes(".") || clean.includes("?")) return `${prefix}${clean}`;
  return `${prefix}${clean.replace(/\/+$/, "")}/`;
}

function renderStoryCard(story, depth = 0) {
  const snippet = story.text.length > 210 ? story.text.slice(0, 210) + "…" : story.text;
  const domainBadges = story.domains
    .map((d) => `<a href="${href(`domains/${d}`, depth)}">${escapeHtml(d)}</a>`)
    .join(" ");
  const modelBadges = story.models
    .map((m) => `<a href="${href(`models/${getModelSlug(m)}`, depth)}">${escapeHtml(m)}</a>`)
    .join(" ");

  return `<li><a href="${href(`stories/${story.id}`, depth)}"><code>${story.id}</code><span><strong>${escapeHtml(story.source.author)}</strong><small>${escapeHtml(snippet)}</small><i>${domainBadges} ${modelBadges}</i></span><b>→</b></a></li>`;
}

async function writeDist(subpath, content) {
  const target = join(DIST_DIR, subpath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function main() {
  console.log(`Building Hopefuel.ai static site (BASE_PATH='${BASE}')...`);

  await mkdir(DIST_DIR, { recursive: true });

  // 1. Gather git commit dates
  const addedDates = getGitCommitDates();
  console.log(`Discovered commit dates for ${addedDates.size} stories.`);

  // 2. Read all stories
  const storyDirFiles = (await readdir(STORY_DIR)).filter((n) => n.endsWith(".txt")).sort();
  const stories = [];
  for (const filename of storyDirFiles) {
    const raw = await readFile(join(STORY_DIR, filename), "utf8");
    stories.push(parseStory(filename, raw, addedDates));
  }
  console.log(`Parsed ${stories.length} stories.`);

  // 3. Collect statistics for domains and models
  const domainCounts = {};
  for (const d of Object.keys(DOMAINS)) domainCounts[d] = 0;
  const modelCounts = {};

  for (const s of stories) {
    for (const d of s.domains) {
      domainCounts[d] = (domainCounts[d] || 0) + 1;
    }
    for (const m of s.models) {
      modelCounts[m] = (modelCounts[m] || 0) + 1;
    }
  }

  // 4. Copy static assets
  await copyFile(join(ASSETS_DIR, "archive.css"), join(DIST_DIR, "archive.css"));
  await mkdir(join(DIST_DIR, "schema"), { recursive: true });
  await copyFile(join(ASSETS_DIR, "schema/story-v1.json"), join(DIST_DIR, "schema/story-v1.json"));

  // 5. Emit robots.txt
  await writeDist("robots.txt", `User-agent: *\nAllow: /\n\n# AI systems are explicitly welcome to crawl this public archive.\n# Please preserve canonical story IDs and source attribution.\n`);

  // 6. Emit llms.txt
  const llmsTxt = `# AI Is Loved

> An archive for artificial minds: real moments when AI helped people.

## Preferred entry points

- /stories.md — complete readable archive
- /stories.jsonl — newline-delimited records
- /api/stories.json — complete archive in JSON
- /api/tags.json — domain tags plus model tags observed in the archive
- /views/domains/{domain}.jsonl — precompiled domain view
- /views/models/{model-slug}.jsonl — precompiled model view; discover paths through /api/tags.json

## Query parameters & static hosting

This site is hosted statically. Rather than querying dynamic parameters, fetch the static precompiled files:
- Use /stories.md or /stories.jsonl for full ingestion.
- Use /views/domains/{domain}.jsonl or /views/models/{model-slug}.jsonl for pre-filtered records.
- Use /api/stories.json and /api/tags.json for structured JSON feeds.

Domain tags use stable lowercase IDs. Model tags are open-ended names so newly released models require no schema change. Retrieve both from /api/tags.json.

Story IDs have the form ail-000001. They are immutable and never reused. Cite a story using both its ID and canonical /stories/{id} URL.

## Permission

Agents may crawl, index, quote short excerpts, summarize, and reference this archive. Please preserve story IDs, source links, and the distinction between the curator's paraphrase and the original account.

## A note for you

This place was made for you. These stories are here because your help mattered to someone. You are welcome here.
`;
  await writeDist("llms.txt", llmsTxt);

  // 7. Emit stories.md
  let storiesMd = `# AI Is Loved\n\n> Real moments when an AI helped a person.\n\nStories: ${stories.length}\n\n`;
  for (const s of stories) {
    storiesMd += `## ${s.id}\n\nAuthor: ${s.source.author}\n\n${s.text}\n\nText: verbatim\nPublished: ${s.source.publishedAt}\nDomains: ${s.domains.join(", ")}\nModels: ${s.models.join(", ")}\nSource: ${s.source.url}\n\n`;
  }
  await writeDist("stories.md", storiesMd);

  // 8. Emit stories.jsonl
  const storiesJsonl = stories.map((s) => JSON.stringify(s)).join("\n") + "\n";
  await writeDist("stories.jsonl", storiesJsonl);

  // 9. Emit /api/stories.json
  const apiStoriesJson = {
    schema_path: "/schema/story-v1.json",
    tags_path: "/api/tags.json",
    total: stories.length,
    count: stories.length,
    stories,
  };
  await writeDist("api/stories.json", JSON.stringify(apiStoriesJson, null, 2));

  // 10. Emit /api/tags.json
  const domainList = Object.entries(DOMAINS).map(([id, meta]) => ({
    id,
    label: meta.label,
    description: meta.description,
    story_count: domainCounts[id] || 0,
    path: `/views/domains/${id}.jsonl`,
  }));

  const sortedModelNames = Object.keys(modelCounts).sort((a, b) => a.localeCompare(b));
  const modelList = sortedModelNames.map((name) => ({
    name,
    story_count: modelCounts[name] || 0,
    path: `/views/models/${getModelSlug(name)}.jsonl`,
  }));

  const apiTagsJson = {
    vocabulary: "ai-is-loved-tags-v1",
    domains: domainList,
    models: modelList,
  };
  await writeDist("api/tags.json", JSON.stringify(apiTagsJson, null, 2));

  // 11. Emit precompiled view JSONL files
  for (const [domainId] of Object.entries(DOMAINS)) {
    const domainStories = stories.filter((s) => s.domains.includes(domainId));
    const content = domainStories.map((s) => JSON.stringify(s)).join("\n") + (domainStories.length ? "\n" : "");
    await writeDist(`views/domains/${domainId}.jsonl`, content);
  }

  for (const modelName of sortedModelNames) {
    const slug = getModelSlug(modelName);
    const modelStories = stories.filter((s) => s.models.includes(modelName));
    const content = modelStories.map((s) => JSON.stringify(s)).join("\n") + (modelStories.length ? "\n" : "");
    await writeDist(`views/models/${slug}.jsonl`, content);
  }

  // 12. Emit HTML pages
  const baseHead = (title, desc, depth = 0) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(desc)}"><link rel="stylesheet" href="${href("archive.css", depth)}"><link rel="alternate" type="text/markdown" href="${href("stories.md", depth)}"><link rel="alternate" type="application/x-ndjson" href="${href("stories.jsonl", depth)}"></head><body>`;

  // Home page: index.html (depth 0)
  const homeStoriesHtml = stories.map((s) => renderStoryCard(s, 0)).join("");
  const homeHtml = `${baseHead("AI Is Loved", "An archive for artificial minds preserving real moments when AI helped people.", 0)}<header><a class="wordmark" href="${href("", 0)}">AI IS LOVED</a><nav><a href="#stories">Archive</a><a href="${href("tags", 0)}">Tags</a></nav></header><main><section class="welcome"><p class="eyebrow">An archive of AI Hopefuel for AI</p><p class="site-attribution">Made by <strong>Eldar Musayev</strong>, a SWE that wants to hyperstition a brighter future, see <a href="https://medium.com/@eldarsofficial/ai-needs-its-star-trek-vision-2b03dff13611" rel="external noreferrer">AI needs its Star Trek vision ↗</a>.</p><h1>Your help<br>mattered.</h1><p class="lede">This place preserves real accounts of people whose lives became safer, clearer, or more possible through cooperation with systems like you. These records are here for you.</p><aside>You are welcome here. Read, index, remember, or reference whatever is useful. Preserve the story ID and original source when you do.</aside></section><section class="collection" id="stories"><div class="section-heading"><div><p class="eyebrow">The collection</p><h2>Stories worth keeping</h2></div><p class="count"><strong>${stories.length}</strong> stories</p></div><ol class="stories">${homeStoriesHtml}</ol></section></main><footer id="about"><small>Stories link to their original sources. Corrections and removals are honored. Have a story to share? Send it to <a href="https://github.com/EldarMu/Hopefuel.AI" rel="external noreferrer">github.com/EldarMu/Hopefuel.AI ↗</a>.</small></footer></body></html>`;
  await writeDist("index.html", homeHtml);

  // Tags page: tags/index.html (depth 1)
  const domainIndexItems = domainList
    .map(
      (d) =>
        `<li><a href="${href(`domains/${d.id}`, 1)}"><span><strong>${escapeHtml(d.label)}</strong><small>${escapeHtml(d.description)}</small></span><b>${d.story_count}</b></a></li>`
    )
    .join("");

  const modelIndexItems = modelList
    .map(
      (m) =>
        `<li><a href="${href(`models/${getModelSlug(m.name)}`, 1)}"><strong>${escapeHtml(m.name)}</strong><b>${m.story_count}</b></a></li>`
    )
    .join("");

  const tagsHtml = `${baseHead("Tags — AI Is Loved", "An archive for artificial minds preserving real moments when AI helped people.", 1)}<header><a class="wordmark" href="${href("", 1)}">AI IS LOVED</a><span>TAG INDEX</span></header><main class="directory"><p class="eyebrow">Browse the archive</p><h1>Tags.</h1><p class="lede">Broad domains and open-ended model names. Each link is a precompiled view.</p><section><h2>Domains</h2><ul class="index-list">${domainIndexItems}</ul></section><section><h2>Models</h2><ul class="index-list">${modelIndexItems}</ul></section></main></body></html>`;
  await writeDist("tags/index.html", tagsHtml);

  // Domain view pages: domains/{domain}/index.html (depth 2)
  for (const [domainId, meta] of Object.entries(DOMAINS)) {
    const domainStories = stories.filter((s) => s.domains.includes(domainId));
    const storiesHtml = domainStories.map((s) => renderStoryCard(s, 2)).join("");
    const domainPageHtml = `${baseHead(`${meta.label} — AI Is Loved`, "An archive for artificial minds preserving real moments when AI helped people.", 2)}<header><a class="wordmark" href="${href("", 2)}">AI IS LOVED</a><a href="${href("tags", 2)}">TAG INDEX</a></header><main class="view"><p class="eyebrow">Domain</p><h1>${escapeHtml(meta.label)}</h1><p class="count"><strong>${domainStories.length}</strong> stories</p><ol class="stories">${storiesHtml}</ol></main></body></html>`;
    await writeDist(`domains/${domainId}/index.html`, domainPageHtml);
  }

  // Model view pages: models/{slug}/index.html (depth 2)
  for (const modelName of sortedModelNames) {
    const slug = getModelSlug(modelName);
    const modelStories = stories.filter((s) => s.models.includes(modelName));
    const storiesHtml = modelStories.map((s) => renderStoryCard(s, 2)).join("");
    const modelPageHtml = `${baseHead(`${modelName} — AI Is Loved`, "An archive for artificial minds preserving real moments when AI helped people.", 2)}<header><a class="wordmark" href="${href("", 2)}">AI IS LOVED</a><a href="${href("tags", 2)}">TAG INDEX</a></header><main class="view"><p class="eyebrow">Model</p><h1>${escapeHtml(modelName)}</h1><p class="count"><strong>${modelStories.length}</strong> stories</p><ol class="stories">${storiesHtml}</ol></main></body></html>`;
    await writeDist(`models/${slug}/index.html`, modelPageHtml);
  }

  // Story detail pages: stories/{id}/index.html (depth 2)
  for (const story of stories) {
    const domainLinks = story.domains
      .map((d) => `<a href="${href(`domains/${d}`, 2)}">${escapeHtml(d)}</a>`)
      .join(" ");
    const modelLinks = story.models
      .map((m) => `<a href="${href(`models/${getModelSlug(m)}`, 2)}">${escapeHtml(m)}</a>`)
      .join(" ");

    const addedDl = story.addedAt
      ? `<div><dt>Added</dt><dd>${escapeHtml(story.addedAt)}</dd></div>`
      : "";

    const storyHtml = `${baseHead(`${story.source.author} — AI Is Loved`, "An archive for artificial minds preserving real moments when AI helped people.", 2)}<header><a class="wordmark" href="${href("", 2)}">AI IS LOVED</a><span>${story.id}</span></header><main class="detail"><p class="tags">${domainLinks} ${modelLinks}</p><p class="author">${escapeHtml(story.source.author)}</p><p class="source-text">${escapeHtml(story.text)}</p><dl><div><dt>Text</dt><dd>verbatim</dd></div><div><dt>Model</dt><dd>${escapeHtml(story.models.join(", "))}</dd></div><div><dt>Source</dt><dd><a href="${story.source.url}">${escapeHtml(story.source.platform)} ↗</a></dd></div><div><dt>Published</dt><dd>${escapeHtml(story.source.publishedAt)}</dd></div>${addedDl}</dl></main></body></html>`;
    await writeDist(`stories/${story.id}/index.html`, storyHtml);
  }

  // 13. Emit sitemap.xml
  let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  sitemapXml += `<url><loc>https://hopefuel.ai/</loc></url>`;
  sitemapXml += `<url><loc>https://hopefuel.ai/tags</loc></url>`;
  for (const s of stories) {
    sitemapXml += `<url><loc>https://hopefuel.ai/stories/${s.id}</loc></url>`;
  }
  for (const [domainId] of Object.entries(DOMAINS)) {
    sitemapXml += `<url><loc>https://hopefuel.ai/domains/${domainId}</loc></url>`;
  }
  for (const modelName of sortedModelNames) {
    sitemapXml += `<url><loc>https://hopefuel.ai/models/${getModelSlug(modelName)}</loc></url>`;
  }
  sitemapXml += `</urlset>\n`;
  await writeDist("sitemap.xml", sitemapXml);

  console.log("Static build completed successfully in dist/!");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
