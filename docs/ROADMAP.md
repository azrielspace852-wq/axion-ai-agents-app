# AXION AI — Roadmap

## v2.8.2 — Update specification implementation (October 2026)

- [x] IndexedDB structured state and OPFS file storage with Blob fallback.
- [x] Internal-only terminal workspace with file/folder operations and ZIP pack/unpack.
- [x] File Library page, upload/pick/share/download/delete/preview and duplicate-upload checks.
- [x] AXION Search SDK integration only, plus page-content extraction fallback.
- [x] Command-driven 15-line Canvas with Copy/View All.
- [x] Persistent task records and local conversation-memory summaries.
- [x] Max Token and output token controls, estimated token counter, Auto-Continue toggle (default OFF).
- [x] Message revisions, edit-to-composer, attachment persistence and retry/edit flow.
- [x] Settings categorization, provider-specific key pages, unlimited custom-provider UI, Data backup/import, Support donation entry.
- [x] English/Indonesian and Dark/Light theme wiring, welcome-dismiss persistence, updated privacy and implementation documentation.
- [!] Provider-server-side session reuse remains provider-dependent; universal “reprocess only the immediate message without sending prior history” cannot be guaranteed across stateless third-party APIs. Tokenization is estimated where exact tokenizers are not available.
- [!] Browser runtime behavior needs final validation in supported browsers/origins; see `UPDATE-CHECKLIST.md`.


## v2.0 — Shipped (Oct 2026)
- Multi-provider chat (OpenAI, Anthropic, Google, Groq, xAI, custom/OpenAI-compatible)
- Agent tool loop with visible step-by-step output
- Web search + page fetch (client-side)
- Sandboxed JS code runner
- Git integration (GitHub/GitLab/Gitea) with Low/Medium/High permission tiers
- Knowledge-repo auto-sync (`azrielspace852-wq/knowladge`)
- Live device context: clock, date, timezone, GPS (opt-in), screen size
- File & ZIP artifacts with direct download buttons; ZIPs download-only
- Dual theme (dark/light) + dual language (EN/ID)
- Mobile enter-key = newline; screen-size detection
- TTS/audio/image output support (non-streaming fix)
- Settings / Features / Guide / Privacy pages
- Full docs: README, CHANGELOG, BIBLE, BLUEPRINT, ROADMAP

## v2.1 — Near term
- [ ] **Streaming TTS audio** (progressive audio chunks for Gemini/OpenAI audio models)
- [ ] **Speech-to-text input** (Whisper via Groq / OpenAI, or browser Web Speech API)
- [ ] **Private knowledge-repo sync** using the user's git token
- [ ] **Branch/PR automation** in git tool (create branch, open pull request)
- [ ] **Conversation export/import** (JSON backup file)
- [ ] **Prompt templates / slash commands** (`/search`, `/code`, `/git`)
- [ ] **Per-conversation provider/model override**

## v2.2 — Medium term
- [ ] **Pyodide Python runner** (optional, lazy-loaded) for data-science tasks
- [ ] **In-browser file system** (File System Access API) so AI can read/write a local project folder
- [ ] **Multiple knowledge repos** (user can add several)
- [ ] **RAG over knowledge base** (embeddings via transformers.js, on-device)
- [ ] **Function-calling native mode** for providers that support it (parallel tool calls)
- [ ] **Artifact live preview with hot reload** for HTML/CSS/JS projects
- [ ] **PWA install** (offline-capable, service worker caching of CDN libs)

## v3.0 — Vision
- [ ] **Local model support** (WebGPU / WebLLM) so the app works fully offline with an on-device LLM
- [ ] **Multi-agent orchestration** (planner + worker agents, visible in step tree)
- [ ] **MCP (Model Context Protocol) client** to connect arbitrary local tools
- [ ] **End-to-end encrypted sync** of conversations across devices (user-owned key)
- [ ] **Plugin system** (user-provided JS tools loaded on demand)

## Backlog / ideas
- Theming: custom accent color picker
- Token usage & cost estimator per provider
- Image input cropping/resizing before upload
- Markdown export of a conversation
- Keyboard shortcut cheatsheet overlay
- Session restore after tab crash (draft input saved)


## v2.6 Shipped (moved from planned)
- [x] Claude-style composer pill + circular send/stop button
- [x] Clean empty state (logo + greeting), New Chat only after conversation starts
- [x] Theme/language only in Settings; all icons as inline SVG
- [x] Always-workspace toggle + runtime script injection ("suntik script")
- [x] Export chat (.md), Continue generating
- [ ] Planned next: voice input (mic in composer), branch/duplicate conversation, token usage meter, prompt templates library, Pyodide for true Python Actions


## v2.7 Shipped
- [x] Full-width composer, file chips above input
- [x] New Chat / Temp Chat alternate by state
- [x] Repeat (ulangi) in user-message long-press
- [x] Natural thinking/step/final driven by model
- [x] Auto-continue truncated answers
- [x] Workspace script version detection + overwrite/clear popup
- [x] Search cache + proxy expansion + tolerant source parsing
- [ ] Planned next: voice input (mic in composer), token/usage meter, prompt templates, branch/duplicate conversation, Pyodide Python Actions
