# AXION AI — Technical Blueprint

## Overview

AXION AI is a static, build-free web app. Opening `index.html` boots a single-page chat; sibling pages (Settings, Features, Guide, Privacy) share the same shell and scripts. All logic runs in the browser.

## Data flow

```
User input
   │
   ▼
chat.js ── builds history (text + attached files + zip structure)
   │
   ▼
agents.run()  ◄──────────────────────────────┐
   │                                         │
   ├─► providers.chat()  (streaming SSE)     │
   │     ├─ openai-kind: /chat/completions   │
   │     ├─ anthropic:   /messages           │
   │     ├─ google:      streamGenerateContent (or generateContent for TTS)
   │     └─ non-streaming fallback on failure
   │
   ├─ scan output for <<<TOOL:...>>> blocks
   │     ├─ search/fetch  → search.js (AXION Search SDK + extraction fallback)
   │     ├─ runjs         → sandboxed Function
   │     ├─ context       → context.js (clock/date/GPS/screen)
   │     ├─ knowledge/readfile → git.js (local index + uploaded zips)
   │     └─ git           → git.js (REST, permission-gated)
   │
   ├─ each tool → visible step in UI (onStep callback)
   ├─ append tool result to history
   └─ loop (max N iterations) ───────────────┘
   │
   ▼
final tool-free text → render markdown + artifact cards + images + audio
```

## Modules

| Module | Responsibility |
|--------|---------------|
| `config.js` | Provider registry, curated model catalog, git permission tiers, app constants |
| `i18n.js` | EN/ID dictionary, `t()`, `applyI18n()` for `[data-i18n]` nodes |
| `state.js` | Settings load/save, theme application, screen-size detection, enter-key policy |
| `system-prompt.js` | Built-in AXION prompt, tool protocol docs, live-context injection |
| `context.js` | Background clock/date/timezone, GPS watch, screen snapshot |
| `search.js` | AXION Search SDK + independent URL-content extraction fallback |
| `git.js` | Knowledge-repo ZIP sync/index; GitHub/GitLab/Gitea REST client; permission gate |
| `artifacts.js` | Parse ` ```file ` artifacts, build ZIPs (JSZip), download, sandboxed JS runner |
| `providers.js` | Unified `chat()` + per-kind streaming parsers + TTS/image handling + live `/models` fetch |
| `agents.js` | Tool extraction, execution loop, step emission |
| `chat.js` | Conversations/tabs, message rendering, steps, artifacts, attach, send flow |
| `settings.js` | Settings form save/load, knowledge sync, GPS toggle, feedback mailto |
| `app.js` | Page bootstrap: theme, i18n, background context, nav, mobile menu |

## Provider adapter contract

`providers.chat({ providerId, model, modelInfo, messages, system, thinking, signal, onChunk })` → `{ text, thinking, images, audio }`.

- `messages` normalized to `[{role, text, images:[{data,mime}]}]`.
- Streaming via SSE; on any non-Abort failure, retry once non-streaming.
- TTS/audio-output and image-gen models bypass streaming and use the appropriate endpoint; binary returned as base64.
- `fetchModels(providerId)` returns live list or null (curated list used then).

## Storage

- IndexedDB (`axion_ai_storage_v3`) stores key/value state, conversation state, File Library metadata, task metadata, memory summaries, fallback blobs, and directory metadata.
- OPFS (`axion-ai/` root) stores file bytes when the browser and origin support the File System API.
- IndexedDB Blob records are the fallback for files when OPFS is unavailable.
- `localStorage` remains a synchronous compatibility cache for older modules and settings access. The storage layer migrates AXION keys and mirrors writes to IndexedDB.

## Security boundaries

- `runjs`: `new Function` with a whitelisted argument set (console, JSON, Math, Date, primitives) — no `window`, no `document`, no `fetch`.
- Artifact iframes: `sandbox="allow-scripts"`, `srcdoc` only.
- Markdown: sanitized with DOMPurify.
- Git writes: blocked at Low, confirmed at Medium, automatic at High (never default).
- API keys never logged; never sent anywhere except the matching provider endpoint.

## Known limitations (v2.0)

- Knowledge sync supports GitHub public repos (codeload ZIP). Private repos require a token extension.
- Git client covers read/write file + create repo; no branching/merge/PR automation yet (see ROADMAP).
- AXION Search availability and URL-content extraction can be affected by service uptime, browser CORS rules, upstream rate limits, and origin security restrictions. Token counts are approximate without provider-specific tokenizers.
- True Python execution would need Pyodide (large) — currently JS sandbox only.


## v2.6 — Clean Claude-style UI + Always Workspace
- Composer pill (attach + model pill popover + circular send/stop button). Empty state = AX mark + time-based greeting only.
- New Chat button is hidden until a conversation starts. Theme/language only in Settings. All icons = inline SVG.
- Workspace: always-on toggle; WORKSPACE_SCRIPT injected into system prompt (AI runs code/search inside repo + Actions, no artifact/workflow fences). "Suntik script" modal on first enable.
- Added: Export chat (.md), Continue generating.


## v2.7 — Full-width composer, natural agent loop, auto-continue
- Composer spans full viewport width; file chips above input.
- New Chat / Temp Chat alternate by conversation state.
- Repeat action added to user-message long-press menu.
- Thinking/steps/final driven by model output (no forced blocks).
- Auto-continue up to 2 rounds when output looks truncated.
- Workspace injected-script versioning + overwrite/clear permission popup.
- Search cache + extra proxies + tolerant source parsing.


## v2.8.2 additions

- AXION Search SDK is the only integrated search provider; search cannot be toggled off in Settings.
- `storage.js`, `terminal.js`, `tasks.js`, `memory.js`, `canvas.js`, `library.js`, and provider-specific settings pages establish the new storage/workspace UI.
- File Library files use private/shared metadata and local file bytes; ZIP ingestion tracks relative paths. Settings includes Max Token, Auto-Continue, Memory Summary, and full ZIP backup/import.
- Retry/Edit can only avoid re-transmitting prior history when a provider exposes server-side conversation sessions. Across stateless provider APIs, the browser supplies the context required to reconstruct the answer; see `UPDATE-CHECKLIST.md`.
