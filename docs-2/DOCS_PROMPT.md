# Self-Contained Documentation Generation Prompt (use on ANY repo)

> This file is the scaffolding prompt itself — NOT one of the five deliverables.
> Copy its contents into your AI agent of choice to generate the real documentation set.

## How to use this prompt
- Paste this whole prompt into any codebase and run it. It is fully self-contained:
  everything the agent needs is explained below — no prior context required.
- The deliverable is a new `docs-2` folder at the repo root, created if it doesn't exist.
- The final section, "PROJECT CONTEXT", is OPTIONAL. It only applies when the repo matches that
  description. For any other project, delete that section before pasting.

## What this task IS (read this first — this prompt creates a documentation set)
You will produce a set of five markdown files inside a `docs-2` folder at the root of THIS
project. `docs-2` is a conventional place for human-readable project documentation (as
opposed to the code folders). It may or may not already exist:

- If `docs-2` does NOT exist, create it and generate all five files fresh.
- If `docs-2` DOES exist, each file is handled separately (see "Existing vs. fresh" below) —
  never assume a file is absent just because the folder exists, and never delete other people's files.

The five target files are:
1. `docs-2/README.md` — Project Overview (what it is, key features, tech stack, architecture
   diagram, quick start).
2. `docs-2/USER_GUIDE.md` — for a non-technical person who uses/reads this project.
3. `docs-2/DEVELOPER_GUIDE.md` — for engineers who build on it.
4. `docs-2/ARCHITECTURE.md` — diagram-first "what connects to what" reference.
5. `docs-2/CHANGELOG_TEMPLATE.md` — a blank Keep a Changelog template.

Each file's full spec is in Step 2. The project may lack some of the things the specs mention
(no login screen, no API, no database). When that happens you DO NOT invent them — you say so
explicitly in the doc and adapt the section. Instructions for this are baked into each step.

## STEP 1 — DISCOVERY (do this first, show me before writing anything)

Output a short **Project Map** and stop. Wait for my confirmation before Step 2.

Scan the full project and report on every item below. When an item does not apply to this project,
say "N/A — <one-line reason>" rather than silently dropping it. Base every claim on actual code and
files — never on memory, convention, or assumption.

- **Tech stack** — languages, frameworks, and EXACT versions from `package.json` /
  `requirements.txt` / `go.mod` / `Cargo.toml` / etc.
- **Entry points and overall folder structure** — what each top-level directory is for (e.g. a UI
  folder, a library folder, a content folder, a config folder). This is the map readers will use to
  navigate your docs.
- **Backends/services** — if there is a server or services, how they talk to each other (direct
  calls? a proxy/BFF? separate auth service?). If there is NO backend (pure static site, CLI tool,
  or library), say so plainly.
- **API routes/endpoints** — if a backend exists: every endpoint with method, path, auth
  requirement, and request/response shape. If the project instead uses file-based or framework
  routing (e.g. Next.js/App Router, SvelteKit, a static site generator), document THAT routing
  scheme in equivalent detail. If neither exists, say so.
- **Database models/schema** — if a database exists: tables/models and relationships. If the
  project uses files or content as its "database" (e.g. markdown content, JSON config, YAML data),
  document that content model instead. If neither, say so.
- **The ACTUAL navigation structure (if there is a UI) — READ THE CODE, DO NOT INFER.** Open the
  sidebar/nav/router/route-map source directly and report:
  - the exact clickable label for every screen/route (as rendered, not filename-derived guesses),
  - which screens are NOT in the main nav (reached only via search, a button on another page, or a
    raw URL),
  - any unreachable/dead routes,
  - if there is NO UI (CLI/library/headless), state that and instead map the user-facing "surfaces"
    (commands, exports, entry points) the same way.
- **Environment variables / config** — every env var required to run it (with which are optional),
  and which config files matter (`.env*`, `next.config.*`, `tailwind.config.*`, `tsconfig`,
  linters, etc.).
- **Build, run, test, deploy scripts** — from package.json scripts, Makefile, Dockerfile, CI configs
  (.github/workflows, .gitlab-ci.yml, etc.). Be honest about which exist and which don't (e.g. "no
  test script exists").
- **Existing README/docs** — anything already in the repo (root README, `docs-2/`,
  comments-as-docs). Your generated set must extend, correct, or link to them — never silently
  duplicate.
- **Third-party integrations** — auth providers, payment, push, analytics, AI services, error
  tracking, etc. Classify each as: required / optional / wired-but-inactive. If there are none, say
  so (don't invent any).
- **Auth/authorization** — if login exists: the full flow, and where permissions/scope are layered
  (role-based gates vs. row-level data scope — these are often conflated; call them out separately).
  If there is NO auth, say so plainly.
- **Tests** — what tests exist, and the exact command(s) to run them. Report real coverage; if there
  is no test suite or test script, say so explicitly.
- **The `docs-2` existence check** — for EACH of the five target files (README.md,
  USER_GUIDE.md, DEVELOPER_GUIDE.md, ARCHITECTURE.md, CHANGELOG_TEMPLATE.md) under `docs-2`,
  note whether it exists. For each that exists, skim it and say in one line whether it looks
  current, partially stale, or factually wrong. This determines whether Step 2 is a fresh
  generation or an update pass for that file. If the `docs-2` folder itself doesn't exist,
  say so — everything in Step 2 is then fresh.

## STEP 2 — GENERATE OR UPDATE THE DOCS

Once I confirm the Project Map, for each of the five target files, first check whether it already
exists in `docs-2`:

- **If it doesn't exist:** create it fresh per the spec below.
- **If it already exists:** read it in full first. This is an update pass, not a replacement — keep
  everything still accurate, correct anything wrong (say explicitly what and why), add what's
  missing, remove what no longer applies, preserve the file's existing structure/tone where
  reasonable. End each updated file with a short "What changed in this update" note so I can see
  the delta without diffing.

### `docs-2/README.md`
One-paragraph description, key features, a tech stack table, a mermaid architecture diagram, and
copy-pasteable quick start commands (clone → install → run).

### `docs-2/USER_GUIDE.md`
For a non-technical end user — zero code, zero jargon.
- If the project has a UI: start with how to log in/access it, a "getting to know the screen"
  section teaching the app's general UI patterns ONCE (nav structure, list vs. board views, how
  forms behave, common icons), and a plain-language glossary of domain terms.
- If the project has NO UI (CLI, library, or a site whose users are readers, not operators): say so
  up front, reframe the guide for the project's real audience (e.g. "how to read the docs site" or
  "how to install and use the command"), and keep the same zero-jargon register.
- Add a "Quick Start" table pointing at the 4-5 most common tasks.
- Walk every screen/command/route: what it's for, what you can do, and for anything more than a
  single click — actual numbered steps, not just bullets.
- Every screen section must open with a line stating EXACTLY what to click to reach it (exact
  sidebar label, tab name, or button — from the nav code you read in Step 1, not guessed). If a
  screen isn't in the main nav, say precisely how it IS reached (global search, another page's
  link, or "no link exists anywhere — direct URL only").
- End with a few end-to-end example workflows and an FAQ covering first-time realities (permissions
  confusion, login issues, "I can't find X").

### `docs-2/DEVELOPER_GUIDE.md`
For engineers. Local setup (prerequisites, full env var reference, run commands), folder structure
explained, architecture decisions and request/data flow, the full data or content model (table by
table or field by field, with small mermaid ER diagrams per logical group — not one giant diagram),
the full API or routing reference (every endpoint or route: method, path, auth, request/response,
plus a couple of runnable curl or command examples), coding conventions actually observed in the
code, a repeatable checklist for adding a new route/page/command (adapted to this project's routing
scheme), how to run and add tests (be honest about current coverage), the deployment process end to
end, and a **Known Limitations / Tech Debt** section (quirks, missing tests, placeholder assets,
intentional shortcuts — anything a new engineer would trip on).

### `docs-2/ARCHITECTURE.md`
A short, diagram-first "what connects to what and why" reference, separate from the exhaustive
developer guide. Mermaid diagrams in plain markdown fences (renders natively in GitHub/VS Code), each
small enough to read — split into several rather than cramming one. Cover: system landscape (core
services/parts), external integrations, request/auth flow (include an auth sequence diagram ONLY if
auth exists — otherwise omit it, don't fake one), data layer (grouped, not exhaustive),
deployment/infra, an integration reference table, tech stack table, and a glossary.

### `docs-2/CHANGELOG_TEMPLATE.md`
A blank Keep a Changelog (keepachangelog.com) template. If the repo already has a changelog in a
different format, don't touch it — this is a separate, forward-looking template.

## RULES
- Base everything strictly on what's actually in the code. Never invent an endpoint, env var,
  feature, screen, route, or navigation label.
- If something is ambiguous or unconfirmed (production URL, a deploy trigger, an intent behind
  unusual behavior), write `⚠️ NEEDS CONFIRMATION: ...` instead of guessing.
- If you find an existing doc/diagram in the repo that's factually wrong, correct it in your version
  and say so explicitly — don't silently repeat the error.
- Cross-link the docs to each other (Quick Start → full walkthrough, User Guide → Developer Guide
  for the technical version, etc.).
- Write the User Guide and Developer Guide in genuinely different registers — zero technical
  vocabulary in one, precise and technical in the other.
- For any file that already exists, this is an update, not a rewrite — see Step 2.

## Two things worth knowing before you reuse this
1. Discovery on a large codebase is often too big for one pass. If the project has a big API
   surface, schema, or many pages, delegate the endpoint inventory / schema inventory /
   page-walkthrough to subagents in parallel rather than reading everything yourself — otherwise you
   run out of context or give a shallow pass.
2. The navigation-accuracy step is the one people skip and shouldn't. It is what turns a
   plausible-sounding guide into an actually correct one — keep it even if you shorten the rest of
   the prompt.

---

## OPTIONAL PROJECT CONTEXT — only applies if this repo matches the description below
(delete for other projects)

⚠️ TODO: If you are scaffolding docs for a project with known quirks, facts, or conventions,
record them here so the agent verifies rather than re-derives them. Delete or leave blank for
generic projects.
