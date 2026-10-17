
## Revision 3 update (2026-10-18)
This package includes the supplied `prompt-update (1).md` scope: reference-based Settings styling, landscape file cards, full-screen Canvas, artifact, and document viewers, chat startup cleanup, Library bulk actions and picker, DOCX conversion, file operation/delivery command extensions, and stricter Git repository selection/approval. See `docs/PROMPT-UPDATE-R3-CHECKLIST.md` for item-by-item coverage and the explicit remote Search backend limitation.

# AXION AI — Browser-Based AI Agent

**Version 2.8.3** · local-first storage · multiple AI providers · AXION Search SDK

AXION AI is a static web application with a chat UI and agent tools. Structured state is persisted in IndexedDB, while file bytes use the Origin Private File System (OPFS) when available and IndexedDB Blob storage as a fallback. AI, search, Git, and optional page-extraction requests still require network access when those features are used.

## Quick start

1. Extract the ZIP archive.
2. Serve the directory from an HTTP origin, for example `python3 -m http.server 8080`, then open `http://localhost:8080`. Some browser storage APIs are restricted under `file://`.
3. Open Settings, configure a key for one AI provider, choose the provider/model, then start a chat.

## Project structure

- `index.html`, `settings.html`, `provider-settings.html`, `library.html`: chat, categorized settings, per-provider API settings, and File Library.
- `features.html`, `guide.html`, `privacy.html`: product information and user guidance.
- `js/storage.js`: IndexedDB state layer, OPFS file storage and Blob fallback, File Library metadata, memory and task persistence.
- `js/terminal.js`: internal-only JavaScript file workspace / terminal command handler.
- `js/axion-search-sdk.js`, `js/search.js`: official AXION Search SDK integration and URL-content fallback extraction.
- `js/canvas.js`: command-driven 15-line Canvas preview.
- `js/memory.js`, `js/tasks.js`: local conversation summary and task tracking.
- `js/config.js`, `js/providers.js`, `js/agents.js`, `js/system-prompt.js`: providers, agent loop, and system behavior.
- `js/chat.js`, `js/settings.js`, `js/library.js`, `js/i18n.js`, `js/app.js`: UI workflows, persistence wiring, localization, and shared behavior.
- `docs/`: project Bible, Blueprint, Roadmap, and implementation checklist.

## Core capabilities

- Multiple built-in and custom AI providers; custom provider count is not capped by the UI.
- AXION Search only for integrated web search; scraping/extraction fallbacks attempt to retrieve content when search results contain URLs only.
- Collapsible execution steps with real in-progress status.
- Private file creation/editing through an internal-only terminal, with ZIP creation and extraction.
- File Library for uploads and generated files, with preview, download, extract, share, delete, and duplicate-upload prevention.
- ZIP upload parsing that retains relative paths so individual archive files can be selected/read.
- Message edit/retry with revision navigation and attachment persistence.
- Canvas command (`/canvas`) with an initial 15-line preview, Copy, and View All controls.
- Max Token context setting, output token cap, estimated token counter, and opt-in Auto-Continue (default OFF).
- IndexedDB-backed state, local memory summaries and tasks, plus full ZIP backup/import.
- English / Bahasa Indonesia and Dark / Light themes.
- Git operations and optional knowledge repository synchronization.

## Storage and network behavior

- **IndexedDB:** settings/state cache, conversations, provider configuration values, File Library metadata, memory summaries, and tasks.
- **OPFS:** file bytes where supported. IndexedDB Blob storage is used as a file fallback where OPFS is unavailable.
- **AI providers:** receive messages and attachment context that is used in a request.
- **AXION Search:** receives search queries. URL-content fallback may contact Jina Reader and/or public CORS extraction endpoints.
- **Git hosts:** receive operations and credentials for features that the user configures.

A browser-based application cannot guarantee server-side session retention for every third-party AI provider. Retry/Edit re-processes the relevant user turn with the available client-side conversation context; strict no-history retransmission depends on a provider-specific server-side session API, which is not available uniformly across supported endpoints.

## Settings

Settings are grouped into General, Personalization, Search, API Providers, Git/Knowledge, Workspace, Data, and Support. API keys can be configured on provider-specific pages. The AXION Search endpoint can be changed/tested but search cannot be disabled inside the app. Auto-Continue is OFF by default.

## Backup and restore

Use **Settings → Data → Export full backup ZIP** to package settings, stored values, conversations, tasks, memory summary, and File Library blobs. Use **Import backup ZIP** to replace the current local AXION state after reviewing the confirmation prompt. Keep backup archives in a secure location because they may contain API keys and private files.

## Verification

The included `docs/PROMPT-UPDATE-R3-CHECKLIST.md` maps Revision 3 requirements to project changes and records remaining limitations. Run syntax checks with Node.js if installed: `for f in js/*.js; do node --check "$f" || exit 1; done`. Browser behavior may vary by browser/origin and configured external provider.

## Project references

- Donation/support: https://axion-hub.axn.cc.cd/donate
- Documentation: https://axion-neuralis.axn.cc.cd
- Contact: `azrielspace852@gmail.com`, `axionneuralis@gmail.com`
