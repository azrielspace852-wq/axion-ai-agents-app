# Changelog

## v2.8.3 — Prompt Update Revision 3 (October 18, 2026)

- Restyled Settings into spaced charcoal/violet cards based on the supplied visual reference, preserving existing controls; moved remaining focus/selection accents off orange.
- Changed user attachment cards to landscape 3:2, added the animated neural-network assistant mark, adaptive startup splash, conditional quick-scroll buttons, conversation-empty-draft detection, and long-press conversation actions.
- Added full-screen Canvas and artifact previews with close/scroll behavior; Library picker uses a near-full-screen modal and Library includes multi-select delete/chat/download and clear-all controls.
- Added local-only workspace semantics, DOCX text extraction, format-aware attachment metadata, downloadable workspace artifacts, file read/write range and batch commands, and clearer command-first system instructions.
- Tightened Git agent eligibility and repository selection through explicit current-turn `@repo` mentions, automatic configurable repository refresh, and Allow/Dismiss approval for write operations.
- Hardened AXION Search response parsing by reading response text and returning structured client errors for HTML, malformed JSON, HTTP failures, and network failures. The ZIP has no Search server implementation, so server-side always-JSON guarantees remain outside this client-only package.
- Added `docs/PROMPT-UPDATE-R3-CHECKLIST.md`; preserved the earlier baseline checklist and archived the supplied prompt and Settings reference under `docs/reference/`.
- Validation scope: JavaScript syntax, local HTML references, source-level feature checks, and final ZIP integrity are run before release. Live external services/browser-provider flows are not claimed as tested without credentials and a runtime environment.

## v2.8.2 — AXION AI Agents System update (October 17, 2026)

- Replaced multi-provider web search routing with the supplied AXION Search JavaScript SDK and URL-only result content-extraction fallback.
- Added an IndexedDB-first storage layer, OPFS file storage, IndexedDB Blob fallback, persistent directory metadata, migration and compatibility mirroring.
- Added the private internal terminal executor, persistent task list, local conversation-memory summaries, command-driven Canvas, and File Library UI.
- Added ZIP upload extraction with relative paths, Library/device attachment source picker, attachment download/share handling, and duplicate detection.
- Added Max Token controls and approximate usage counters, Auto-Continue (default OFF), message revision navigation, attachment restore during edit, and retry/edit handling.
- Added provider-specific API configuration pages and custom-provider creation without a fixed provider limit.
- Added Settings → Personalization memory summary/custom instructions and Settings → Data full ZIP backup/import; added donation support section and recurring support prompt.
- Updated the system prompt, localization maps, theme/language bootstrap, feature/privacy pages, and architecture documentation.
- Added `docs/UPDATE-CHECKLIST.md` to map implementation against the complete 18-section update specification.
- Limitations documented: token estimation is approximate without provider tokenizer support; strict server-side session reuse varies by provider; real-browser runtime tests remain dependent on browser/origin and external CDN/provider availability.


## v2.8.1 — Stabilization & Anti-Bego Protocol (OWNER DECISION)

**Step 1 — Tolerant tool parser (js/agents.js):**
- Tool regex now case-insensitive with explicit `[a-zA-Z_-]+` (accepts uppercase tool names and dashed names), plus extra-space tolerance inside `<<< >>>` markers.
- Payload limits raised: open-tool payload 8000 → 32000 chars; tool-result body & history injection 8000/12000 → 32000 chars; readfile zip content 20000 → 60000 chars. No more mid-stream truncation that caused syntax errors.
- Workspace limits raised: list 20000→40000, tree 25000→50000, file read 30000→60000.
- Git/knowledge limits raised: readKnowledgeFile 20000→60000, knowledge exact-match 15000→32000, get_file 20000→60000, README 15000→32000.
- DeepSearch result limit 18000→36000.

**Step 2 — Artifact few-shot prompting (js/system-prompt.js):**
- Added explicit CORRECT vs WRONG artifact examples. The closing fence MUST repeat the exact filename (` ```filename.ext `); bare backticks as closer are explicitly forbidden because they corrupt files containing nested code blocks.

## v2.8.0 — Tool-calling, thinking & UI hardening

**Tool calling (now actually works end-to-end):**
- Agent loop now returns the full conversation history (tool calls + tool results) so the AI remembers its own tool usage across turns — tools keep working mid-conversation.
- Tolerant `<<<TOOL:name>>>` parsing: accepts extra spaces inside markers, and executes an *open* tool block at end of output even if the model forgets `<<<END>>>`.
- Raw `<<<TOOL>>>` markup no longer flashes in chat during streaming (stripped for live display).
- `runjs` strips ```code fences``` the model may wrap around it.
- System prompt reinforced: tool results are authoritative; never invent success/output; iterate code until it really runs.

**Thinking / step-by-step (like ChatGPT/Claude):**
- FIXED: Gemini reasoning (`thought` parts) was silently dropped — thinking blocks now appear for Gemini.
- Synthetic "Analyzing request" step shows immediately while waiting for the first chunk.
- Thinking + tool steps are saved with the message and re-rendered after reload (they used to vanish).
- Thinking accumulates across auto-continue iterations.

**Provider fixes:**
- OpenAI o-series (o3/o4-mini) now uses `max_completion_tokens` (not `max_tokens`, which caused HTTP 400) and `reasoning_effort` is sent only to provider `openai` (xAI/Groq/custom endpoints reject it).
- Anthropic thinking budget raised (4096 → up to 32000).
- Live-fetched model list now correctly drives thinking/image flags.

**Bug fixes:**
- Provider error no longer leaves an empty bot bubble and no longer deletes the user message (retry works).
- `continueLast` now stays consistent with message history (edit/repeat indices align).
- `app.js` guards `AXION.context`/`AXION.git` so Features/Guide/Privacy pages (which don't load those modules) no longer crash — mobile sidebar works there.
- Added missing Knowledge Base section (sync button + status) to Settings (the JS referenced it but UI was absent).

**Edit feature (like typical AI apps):**
- Inline edit: Ctrl/Cmd+Enter saves & resubmits, Escape cancels, auto-focus+select.
- Edited messages show an "(edited)" badge. Guarded against double-send.

**UI overlap fixes:**
- Artifact panel becomes a full overlay on mobile (no longer crushes the chat column).
- Model popover flips inside viewport if it would overflow; max-height + scroll added.
- Topbar no longer wraps to two rows. Composer bar never wraps send button off-screen.
- Hover copy/edit chips hidden on touch devices (long-press menu provides them) → no overlap.
- Step detail width responsive; composer textarea max-height reduced on mobile.


All notable changes to AXION AI are documented here.

## [2.7.0] — 2026-10-04

### UI/UX
- **Input column now spans full width** (left edge to right edge); attached files appear as chips above the composer.
- **New Chat / Temporary Chat buttons alternate** in the same topbar spot: New Chat appears only after a conversation starts; Temporary Chat (ghost) appears only before a conversation starts.
- **Long-press on a user message** now offers **Repeat (Ulangi)** in addition to Copy / Select / Edit — it re-sends that message from that point. (Regenerate remains on AI messages.)

### Agent behavior (more like Claude / ChatGPT)
- **Thinking, steps, and final answer are now driven by the model's actual output** — no forced "thinking" block per iteration. A reasoning block appears only when the model actually streams thinking; tool steps appear only when tools run.
- **AI can correct files it writes**: writing/running workspace files is part of step-by-step work; if a run errors, the AI is instructed to read back, fix, and re-write until it works. Final answer summarizes paths/results, not full file contents.
- **Search bias prompt added**: if the AI is not certain or does not know something, it must run a web search before answering — no guessing.
- **Artifacts render directly as cards**: system prompt instructs the AI to wrap deliverables in ```filename.ext fences; they auto-render as preview/download cards (raw fence text never shown).
- **Process does not stop early**: if output looks truncated (long and ends mid-sentence), the agent auto-continues up to 2 more rounds, appending to the same answer.

### Search stability
- Added in-memory result cache (10 min TTL) — repeated queries in a session are instant and never re-fail.
- Added extra CORS proxies to rotation (r.jina.ai text-reader endpoint included).
- Source-ball parsing made tolerant (any URL + preceding text becomes a source entry).

### Workspace
- **Injected-script detection**: on enable, AXION checks for `.axion/runtime-script.txt` in the workspace. If an old/foreign script is found, a permission popup offers Overwrite / Keep / Clear-entire-workspace. If none exists, the current script is injected silently. A marker file records the version.

### Fixed / robustness
- All JS passes syntax check; chat + settings pages smoke-tested in browser.

## [2.6.0] — 2026-10-04

### UI/UX (Claude-inspired clean layout)
- **Composer pill** like the reference: rounded container with attach (+) button, a model pill (opens a popover with provider + model + thinking level), and a **circular send button** on the right. While the AI runs, the send button becomes a **circular STOP button** (force abort, partial output preserved).
- **Clean chat page**: empty state shows only the AXION mark + a time-based greeting ("Good morning/afternoon/evening…" / Bahasa Indonesia). No long welcome paragraph.
- **New Chat button appears only after a conversation has started** (topbar pencil icon, hidden on empty state).
- **Theme/language moved out of the topbar** — they live only in Settings now (topbar is minimal: menu, new-chat-when-active, workspace-when-enabled, temporary-chat).
- **All button/nav icons are inline SVG** (no emoji): menu, new chat, attach, send, stop, ghost, folder, gear, chat, sparkles, book, lock, copy, edit, regenerate, close, select, sun, moon, chevron, trash, download, external, play, search, bolt, check.

### Workspace (user repository + Actions)
- **Always workspace toggle** (Settings → Workspace): when on, the AI uses the workspace for search and code execution as its primary runtime — like running on a server with the repo checked out.
- **"Suntik script" popup**: when the workspace is first enabled, a modal shows the injected runtime script (`WORKSPACE_SCRIPT`) that tells the AI to use `<<<TOOL:workspace>>>` directly (read/write/run/search) and **not emit artifact/workflow Actions** for work that belongs in the repository. A "Re-inject" button re-shows it.
- `WORKSPACE_SCRIPT` is appended to the system prompt whenever the workspace is enabled (and emphasized when always-on).

### Common agent features added
- **Export chat (.md)** button in the sidebar footer.
- **Continue generating** button on every AI answer (appends a "continue" turn and resumes).
- Model/provider/thinking selection moved into a clean popover off the composer pill.

### Fixed / robustness
- Provider/model/thinking dropdowns no longer clutter the topbar; all existing features (temp chat, attach/zip, history, long-press edit/regenerate, search source balls, workspace viewer) verified working with the new DOM.
- Version bump to 2.6.0 across all pages + docs.

## [2.5.0] — 2026-10-04

### Fixed
- **Truncated AI output (root cause):** all three SSE readers (OpenAI, Anthropic, Gemini) dropped the final `data:` chunk when the stream ended without a trailing newline → answers cut off mid-sentence. Leftover buffer is now flushed. `max_tokens` raised from 8192 to 16384 and made configurable (Settings → Max output tokens).
- **Stop now preserves partial output:** pressing Stop no longer discards what was already streamed. Providers return the accumulated partial text; a "(stopped)" note is appended.

### Added
- **Step-by-step + reasoning like Claude/ChatGPT:** thinking blocks show a duration ("Thought for 3.2s"), auto-collapse when done, and stay expandable. Tool steps are interleaved as a clean timeline.
- **Expanded repository access:** new git actions — `get_tree`/`list_all_files` (full recursive listing), `search_code` (grep the repo), `get_readme`, `list_issues`/`get_issue`, `list_pulls`/`create_pull_request`, `list_commits_full`/`get_commit`, `list_tags`, `delete_repo`. Permission descriptions updated.
- **Search sources as "balls":** when the AI uses web search/fetch, small colored dots appear at the bottom-left of its answer bubble; click them to see the full list of source URLs (opens in a popover).
- **Workspace — dedicated user repository + Actions (NEW):** a private, persistent on-device file system (IndexedDB). The AI gets a `workspace` tool: `list`, `tree`, `read`, `write`, `delete`, `move`, `search`, and `run` (execute JavaScript Actions with a `ws` file API — no CI/CD or artifacts needed, same as local). Enable in Settings → Workspace; view files with the folder button in the chat topbar. Optional git repo mirror.
- **Edit message while AI is running:** long-press any user message → Edit (or use the pencil hover button). If the AI is mid-reply, it is auto-stopped first, then your edited message is re-sent and the answer regenerated. Works running or stopped.
- **Regenerate from long-press:** long-press an AI answer → Regenerate.
- **UI/UX restyled toward Claude:** warm neutral palette + orange accent, centered chat column, bot avatar, plain AI bubbles (no heavy gradients/glass), rounded composer, collapsible reasoning blocks.

### Changed
- Version bump to 2.5.0 across all pages.

## [2.4.0] — 2026-10-04

### Fixed — Git operations (root causes)
- **`repo` as `"owner/name"` was not understood** → calls went to `/repos/undefined/...`. Owner/repo are now normalised from `owner/name`, `full_name`, or a repo URL; owner defaults to your saved username, then to the token's own login.
- **Branch was hard-coded to `main`** → failed on `master`/custom defaults. The repo's real `default_branch` is looked up (and cached).
- **Nested paths 404'd on GitHub/Gitea** (whole path was encoded with `%2F`). Paths are now encoded per segment (GitLab keeps `%2F`, as its API requires).
- **UTF-8 files came back garbled** (`atob` is Latin-1). Proper UTF-8 base64 decode/encode; files > 1 MB are read through `download_url`.
- **Token with trailing space/newline** made every call fail with "Failed to fetch". The token is now trimmed.
- **Needless CORS preflights** (Content-Type on GET, extra headers) removed; Gitea now uses `Authorization: token …`.
- **`confirm()` is blocked on many mobile browsers**, so every write was silently "denied" at Medium level. Replaced by an in-page confirmation modal that shows the exact action.
- **Opaque errors**: every failure now states the cause and what to check (401/403/404/409/422, network/CORS).
- **Knowledge-repo sync** used `codeload.github.com` (no CORS). Now uses the Git Trees API + `raw.githubusercontent.com` (CORS-enabled), ZIP only as fallback.

### Added — Git
- New actions: `whoami`, `get_repo`, `list_files`, `delete_file`, `create_branch`, `list_commits`, `create_issue`, `push` (multi-file). Aliases accepted (`file`/`filepath`, `text`/`contents`, `ref`, `commit_message`).
- **Settings → Test git connection** button.

### Fixed — Search & scraping (root causes)
- **DuckDuckGo always returned 0 results**: its links are protocol-relative (`//duckduckgo.com/l/?uddg=…`) but the parser only matched `a[href^="http"]`. Dedicated DDG HTML/Lite parsers + redirect unwrapping.
- **Bing links were garbage**: they are wrapped as `u=a1<base64url>`. Now decoded.
- **Over-eager filter** dropped any URL containing "google"/"bing"/…; now only the engine's own host is excluded.
- **`innerText` on a detached document** is unreliable → `textContent` + normalisation, with readable-text extraction (article/main first).
- **Silent failures**: each attempt (direct, every proxy, every engine) is logged; the AI and user see why a search failed instead of a bare "failed".
- Proxy rotation now tries a direct request first (works for CORS-open sites), supports your own proxy (`{url}` placeholder), and blocked/bot-check pages are detected.
- Deep search scrapes the top results **in parallel** (much faster).

### Added — Search engines
- **SearXNG**: JSON API with HTML fallback; races several instances; set your own instance in Settings (recommended — public instances usually disable JSON/CORS).
- **InfoMesh**: connects to your own InfoMesh node's local HTTP API (default `http://localhost:8080`). InfoMesh is peer-to-peer software you run yourself; there is no public hosted endpoint.
- **Wikipedia** as a last-resort fallback; **Jina Reader** (`r.jina.ai`) for clean page scraping (toggle in Settings).
- Engine selector (Auto / SearXNG / InfoMesh / DuckDuckGo / Bing) and a **Test search & scraping** button showing per-engine status and timing.

### Added — UI
- **Long-press a message (yours or the AI's)** → menu with **Copy all** and **Select text**. Select text enters a selection mode with everything pre-selected so the native handles can refine it. The old "Select" buttons were removed. Desktop: hold the mouse button on a message without moving.
- **Temporary chat button moved to the chat page** (👻 in the top bar). It is session-only and always OFF on load; turning it on parks your saved chats and starts an in-memory conversation; turning it off asks before discarding. The Settings toggle was removed.
- **Swipe from the left screen edge to open the sidebar** (finger-following, with backdrop; swipe left or tap the backdrop to close).
- In-page modals/toasts replace `confirm()` for deleting a chat and for git permission prompts.

## [2.3.0] — 2026-10-04

### Fixed
- **Search & scraping reliability (root-cause fix)**: single proxy (allorigins) + single engine (DDG HTML) + single-structure parser caused frequent failures. Now rotates through 5 public CORS proxies (allorigins raw/get, corsproxy.io, codetabs, thingproxy), tries 3 search engines (DDG Lite → DDG HTML → Bing), and uses a generic link extractor that works on any result page. Bot-check/error pages are detected and skipped; the working proxy is remembered.

### Added
- **Stronger anti-hallucination system prompt**: three certainty levels (KNOWN / INFERRED / UNKNOWN), mandatory verification via search before factual claims, no fabricated URLs/sources, real tool-output quoting only, admit when tools fail.
- **Copy & Select on every message**: AI output has Copy (raw text) + Select text + Regenerate; user messages have Copy + Select + Edit. Copy shows "✓ Copied" feedback.
- **Two New Chat buttons**: one in the chat topbar (quick access) and one in the hamburger sidebar.
- **Temporary chat (incognito)**: toggle in Settings (default OFF). When on, conversations live in memory only and are never written to localStorage; a "Temporary" badge shows in the chat.

### Changed
- `fetchViaProxy` is exposed internally so both search and page scraping share the same rotation logic.


## [2.2.0] — 2026-10-04

### Added
- **Delete chat via long-press**: long-press (500ms) any conversation in the sidebar/hamburger history to delete it (with confirmation). Also works with right-click-style pointer events.
- **Attached files shown in messages**: files/ZIPs attached to a message now render as chips inside the user's message bubble.
- **Edit message**: click the ✎ on any user message to edit it; the conversation truncates to that point and regenerates the answer.
- **Regenerate answer**: every AI reply has a "↻ Regenerate" button to re-run the last response.
- **Search + scraping combined**: new `deepsearch` tool searches DuckDuckGo and auto-scrapes the top results; AI can also chain `search` + multiple `fetch` calls. Search/scrape always appear as visible steps.

### Changed
- **Thinking levels fixed**: Off / Low / Medium / High now work correctly. Off emits a neutral "Processing" step (no reasoning block); Low/Medium/High map to token budgets. Google Gemini now uses `thinkingBudget` (was invalid `thinkingLevel`).
- **Search engine switched to DuckDuckGo** and hidden from Settings — runs automatically in the background as an MCP-style tool. Search template / CORS proxy fields removed from UI.
- **UI restyled**: cleaner, flatter, professional minimalist look — softer single-accent blue, less glassmorphism, better spacing.

### Fixed
- Thinking could not be turned off (reasoning blocks always shown). Off now fully suppresses reasoning display.


## [2.1.0] — 2026-10-04

### Added
- **Interleaved step ↔ thinking timeline**: the agent now renders an alternating sequence of thinking blocks and tool steps (• bullet + label + indented sub-text), matching the pattern `thinking → step → thinking → step → … → final answer`. Thinking streams live during each iteration.
- **Unlimited agent steps**: removed the 8-step cap; the loop runs until the model emits a tool-free final answer (safety guard 100 only).
- **Code run/test loop**: AI can run code, see errors, fix, and re-run before the final answer — each iteration visible as a thinking + step pair (reading files → editing files → running code → fixing error → …).

### Changed
- **Chat history moved to the sidebar (hamburger)**: conversation list no longer shows as top tabs (which looked like a document editor). It now lives in the sidebar alongside Settings / Guide / Privacy links, accessible via the hamburger button on mobile.
- **Knowledge repository is invisible**: syncs silently in the background (every 24h, on load) and is used by the AI on demand. No UI button or status.
- **More responsive layout**: compact topbar on small screens, scrollable sidebar, hidden detail text on narrow viewports.

### Fixed
- Removed separate static thinking block; reasoning is now part of the live interleaved timeline.


## [2.0.0] — 2026-10-04

### Added
- **Separated codebase**: `index.html` at project root, with `css/main.css` and modular `js/*.js` (config, i18n, state, system-prompt, context, search, git, artifacts, providers, agents, chat, settings, app).
- **Dedicated pages**: `settings.html`, `features.html`, `guide.html`, `privacy.html` with shared sidebar navigation.
- **Multi-provider support**: OpenAI, Anthropic Claude, Google Gemini/Gemma, Groq, xAI Grok, and any OpenAI-compatible endpoint (Agnes, OpenRouter, Together…). Each with its own API key + base URL in Settings.
- **Model dropdown filtered by selected provider**; live model list auto-fetched from provider when a key is present; custom model ID input.
- **Agent tool loop with visible step-by-step output**: analysis, web search, page fetch, sandboxed JS code execution, git operations, knowledge-base lookup, and device-context reads all appear as expandable steps before the final answer.
- **Tool protocol** in the updated system prompt: `<<<TOOL:name>>>payload<<<END>>>`.
- **Background device context**: clock, date, timezone, weekday, screen size, and (if granted) GPS run on-device; injected into the AI's system prompt; accessible via the `context` tool.
- **Screen-size detection** (`mobile` / `tablet` / `desktop`) driving responsive layout and enter-key behavior.
- **Mobile enter key**: on touch devices Enter inserts a newline (not send); Ctrl+Enter or the Send button sends. Configurable in Settings (auto/send/newline).
- **Web search** using a configurable Google URL template via CORS proxy, with DuckDuckGo HTML fallback.
- **Git integration**: GitHub / GitLab / Gitea / custom via Personal Access Token. AI can list repos, read files, create/update files, create repos, list branches. Permission tiers: **Low** (read-only), **Medium** (asks before every write — default), **High** (autonomous — labeled "NOT RECOMMENDED, high risk").
- **Knowledge base**: auto-syncs `https://github.com/azrielspace852-wq/knowladge` (downloaded as ZIP, unzipped client-side, text files indexed) and lets the AI search/read it.
- **ZIP artifacts are download-only**: cannot be opened or edited in the preview panel; a direct Download button sits on every artifact card in the chat (not only inside the opened panel).
- **Dual theme** (Dark / Light, default Dark) and **dual language** (English / Bahasa Indonesia, default English).
- **TTS / audio / image output fix**: audio-output and image-gen models use non-streaming endpoints; binary/base64 payloads render as `<audio>` players or `<img>` instead of breaking the SSE parser. All providers also have a non-streaming fallback if streaming is rejected.
- **Updated system prompt** that teaches the AI its full capability set, tool protocol, artifact format, and anti-hallucination rules.
- **Settings page**: theme, language, API keys per provider, base URLs, custom model, enter-key behavior, max agent steps, search template, CORS proxy, custom instructions, GPS toggle, knowledge sync, git config + permission level, clear conversations, feedback mailto links, official docs link.
- **Documentation**: `README.md`, `CHANGELOG.md`, `docs/BIBLE.md`, `docs/BLUEPRINT.md`, `docs/ROADMAP.md`.

### Changed
- Replaced single-file `Gabut.html` (Gemini-only) with a modular multi-provider project.
- Artifact preview panel now only opens viewable/editable non-ZIP files.
- Thinking levels extended: `off / low / medium / high`.

### Security
- All keys/tokens stored only in `localStorage` on the user's device.
- Git write actions gated by permission level; Medium requires explicit user confirmation.
- `runjs` code execution sandboxed (no DOM, no network, no storage).
