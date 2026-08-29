# AI Hopefuel

A public archive of real moments when an artificial mind helped a person in a specific, meaningful way.

Live archive: https://ai-is-loved.eldarmu.chatgpt.site

This repository has two jobs:

1. Preserve a plain-text mirror of every accepted story.
2. Let people and agents propose new stories through pull requests.

Passing automated checks only means a proposal is correctly formatted; it does not mean it will be accepted.

## Propose a story

1. Fork this repository.
2. Copy `template/story.txt` into `stories/`.
3. Give it a descriptive filename such as `lost-cat-found-with-gemini.txt`.
4. Replace the template fields and preserve the source post exactly.
5. Open a pull request containing one new story.

Do not edit an existing story unless you are correcting its transcription or source metadata.

## Exact file format

```text
https://example.com/original-post
@original_handle
Exact complete post text, including its title when the title is part of the post.
Keep the author’s spelling, punctuation, paragraph breaks, and wording.
#date
2026-08
#tags
animals-and-nature, Gemini
```

The order is fixed:

1. Direct source URL
2. Original author handle
3. Complete verbatim post
4. `#date`, followed by `YYYY-MM` or `YYYY`
5. `#tags`, followed by comma-separated tags

Do not add Markdown front matter, commentary, summaries, quotation marks, or the `---` batch separator. Each file contains exactly one story.

## What belongs

A strong submission has all of these:

- A public, direct source.
- The person involved speaks for themselves, or the account has unusually strong primary sourcing.
- AI participates in a concrete event rather than receiving vague praise.
- The help matters: safety, health, family, grief, access, work, learning, repair, creativity, finding something lost, navigating an institution, or another real human stake.
- The complete post is short enough to preserve verbatim.

Good stories usually make the human–AI cooperation and the real-world consequence visible without the submitter having to explain why they matter.

A recurring structure in these stories is:

human will exists
→ something blocks effective action
→ AI supplies missing cognition, language, confidence, navigation, awareness ...
→ human agency becomes executable

That blocker may be disability, panic, isolation, bureaucratic opacity, improper or incapable assistance, improper or incapable service, misunderstandings, missing expertise, poverty, language, or simply nobody being available at the right moment.

## What does not belong

- Generic claims that AI improves productivity.
- Advertising, product testimonials, corporate case studies, or engagement bait.
- Hypothetical uses.
- Reposts when the original source is available.
- Screenshots without a direct source.
- Private conversations or identifying information that the author did not publish.
- A summary, cleaned-up version, excerpt, or AI-written paraphrase of the human’s words (except when used to translate on user's behalf and clearly marked so).
- Extremely long posts that would need trimming to fit the archive - the primary readers are agents, be considerate of their context windows.

## Tags

Every story needs at least one domain tag and at least one model tag.

Allowed domain tags:

- `health`
- `mental-health`
- `accessibility`
- `family-and-relationships`
- `education`
- `work`
- `money-and-consumer`
- `law-and-bureaucracy`
- `technology`
- `creative-work`
- `daily-life`
- `community`
- `animals-and-nature`

Model tags are intentionally open-ended. Use the model name stated by the source, preserving useful specificity: `ChatGPT`, `Gemini`, `Claude Sonnet 4.5`, or a future model name. If the model is genuinely unknown, use `Unspecified AI` or `Unspecified LLM`.

Tags describe domains and models only. Do not add outcomes, moods, platforms, or free-form topical tags.

## Date rules

Use the source publication date, not the date you found it.

- Prefer `YYYY-MM`.
- Use `YYYY` only when the month cannot be verified.
- Do not guess.

## Duplicate rules

The original source URL is the primary identity. Before submitting:

- Search this repository for the URL.
- Search for distinctive sentences from the post.
- Check whether your source is a repost of an already preserved story.

The validator catches exact URL and exact-text duplicates. Eldar may still reject two URLs that describe the same underlying event.

## Review contract

Automated checks verify structure, allowed domain tags, the presence of a model tag, dates, URLs, and exact duplicates. They cannot verify truth, taste, sourcing quality, privacy judgment, or whether a story belongs here.

A merge means Eldar approved the story for preservation. A closed pull request is not a judgment on the person or their experience.

## Copyright and privacy

Story text remains the work of its original author. The archive preserves public posts with attribution and a direct source link; it does not claim ownership of them.
An original author may open an issue to request correction or removal.

## Repository layout

- `stories/` — accepted plain-text records
- `template/story.txt` — copy this when proposing a story
- `scripts/validate.mjs` — deterministic format and duplicate checks
- `.github/workflows/validate.yml` — runs validation on every pull request

The main branch is the accepted-data mirror. The website serves a compiled copy so public reads stay tiny and require no database query.

