# AXION AI v2.8.2 — Baseline Update Checklist (Historical)

This is the preserved baseline checklist for the earlier v2.8.2 update. Revision 3 changes some of the behaviors documented here (including Canvas closing behavior and the workspace boundary); the current authoritative scope is `PROMPT-UPDATE-R3-CHECKLIST.md`. “Implemented” means corresponding code/UI is present; it is not a claim that every provider/browser combination was runtime-tested.

## 1. Storage Architecture — Implemented with compatibility fallback

- [x] IndexedDB stores AXION key/value state, settings and conversation cache, File Library metadata, task records, memory summary, fallback blobs, and directory metadata.
- [x] OPFS stores file bytes where supported.
- [x] IndexedDB Blob storage is used when OPFS is unavailable or denied.
- [x] Existing `localStorage` state is migrated and retained as a compatibility cache for synchronous legacy modules.
- [!] The app continues to use a small `localStorage` compatibility layer rather than eliminating it entirely; IndexedDB is the durable structured-state store.

## 2. Artifacts Handling — Implemented

- [x] Internal terminal writes individual files and folders before ZIP creation.
- [x] File Library separates private generated/uploaded files from files explicitly shared into chat.
- [x] Terminal has explicit share/publish actions, and chat send shares attached file content with the chosen AI provider.
- [x] ZIPs can be created from workspace paths and ZIP files can be extracted locally.
- [!] Legacy artifact parsing remains in the app for compatibility; the system prompt directs multi-file project generation through the private terminal workflow.

## 3. Canvas System — Implemented

- [x] Canvas creation is command-driven (`/canvas`, optionally followed by a title and newline/content); no manual Markdown fence is required.
- [x] Initial Canvas display is padded/sliced to exactly 15 lines.
- [x] Copy and View All controls are placed in the top-right action group.
- [x] View All expands the full content and can return to the 15-line preview.
- [!] Canvas is currently exposed on the chat surface. Other pages do not create a chat Canvas unless they contain a compatible host.

## 4. AI Output Format — Implemented

- [x] Markdown remains the normal message format.
- [x] Existing Markdown renderer supports code, tables, SVG/HTML-compatible outputs subject to sanitization and the provider's returned content.
- [x] System prompt includes rules for SVG/HTML diagrams and the command-driven Canvas workflow.
- [!] Arbitrary HTML execution is intentionally not guaranteed; rendering is subject to app sanitization and browser security.

## 5. AI Workspace & Terminal — Implemented

- [x] Internal JS terminal supports `pwd`, `cd`, `ls`, `tree`, `mkdir`, `cat`/`read`, `write`/`create`, `edit`, `rm`/`delete`, `mv`/`move`/`rename`, `zip`, `unzip`/`extract`, `share`/`publish`, and stats.
- [x] File and folder operations use OPFS where possible and the IndexedDB fallback otherwise.
- [x] Persistent task list stored in IndexedDB.
- [x] AI can read uploaded File Library files and individually address ZIP entries through preserved relative paths.
- [x] Terminal is registered as an AI tool and no visible terminal page/panel is added for users.
- [!] In-page terminal commands run within browser storage, not a general operating-system shell. External process execution is not provided.

## 6. Personalization & Memory — Implemented

- [x] Local summaries of recent conversation messages are saved to IndexedDB during conversation persistence.
- [x] Settings → Personalization includes Custom Instructions, Auto-Continue, and Memory Summary view.
- [x] Memory summaries are inspectable from the settings page.
- [!] The summary is a deterministic local extractive summary rather than a separate AI-generated abstractive summary.

## 7. ZIP Upload & Processing — Implemented

- [x] ZIP upload is accepted as an attachment or via File Library.
- [x] JSZip is loaded on Chat, File Library, and Settings pages where archive operations are used.
- [x] ZIP contents are extracted into the local workspace/File Library storage.
- [x] Relative folder paths are preserved and sent as structure metadata to the agent.
- [x] Agent can request selected extracted files through the file-read tool.
- [x] Extracted file contents remain local unless the user submits them in a chat or explicitly shares them.

## 8. Token Management — Implemented with approximation

- [x] Settings includes Max Token context limit and maximum output tokens per request.
- [x] A token estimate is shown in the composer and output usage is recorded after generation.
- [x] The configured budget is added to the system prompt at session start.
- [!] Counts are heuristic/character-based when no exact tokenizer is available; they must not be treated as exact billing counts for every model.

## 9. UI/UX Improvements — Implemented; browser visual QA remains

- [x] Updated visual design styles for file cards, revision controls, token counters, Canvas, Library, and step details.
- [x] Welcome state is dismissed persistently after the first sent message.
- [x] Edit loads the selected user content into the composer and restores attachment references with remove/re-add controls.
- [x] User and assistant messages use revision counters/navigation where revision records exist.
- [x] Search result sources are handled by the agent and rendered with the current answer flow.
- [x] Provider cards link to dedicated API settings; Add creates more custom providers without a fixed count limit.
- [x] Attachments render as portrait 2:4 cards and use horizontal scrolling when additional files overflow.
- [x] Settings is organized into categorized sections.
- [x] Theme setting applies immediately and persists; language maps cover the new pages and settings strings.
- [!] The UI has been statically checked, but exhaustive manual inspection of every dynamic UI string, screen size, and theme/language combination has not been completed in a live browser.

## 10. Search Engine Integration — Implemented

- [x] Legacy search routing was removed from `js/search.js` and old provider settings removed from defaults/translations.
- [x] The supplied official AXION Search SDK is included as `js/axion-search-sdk.js`.
- [x] AXION Search is the only integrated search provider and has no user-facing disable toggle.
- [x] Search is called as an agent tool in the background when needed.
- [x] URL-only results trigger independent page-content extraction fallbacks.
- [!] Extraction can fail under CORS restrictions, anti-bot challenges, upstream rate limiting, or provider outages; such failures must be reported rather than concealed.

## 11. Step-by-Step Execution — Implemented

- [x] Step-by-step output is wrapped in a collapsible `Step by step ▶` detail section.
- [x] Tool/step state updates during execution instead of remaining solely descriptive.
- [x] The section can be expanded and collapsed without hiding the final response.

## 12. Retry & Edit System — Partially implemented; provider constraint

- [x] Retry identifies the current user turn and re-processes it without appending a duplicate user-message entry.
- [x] Edit submits the edited message, truncates later client-side conversation state, and generates a new response.
- [x] Revision navigation stores and restores message/history snapshots where available.
- [!] Universal server-side session reuse and “only re-send the immediate turn, never prior history” cannot be guaranteed across the app's supported stateless provider APIs. This requires a provider-specific persistent session endpoint; current behavior reconstructs necessary context from client-side history.
- [!] Nested revision snapshots are simplified when a full message snapshot is cloned, so restoring a previous global conversation state does not preserve every nested snapshot pointer exactly.

## 13. File Library — Implemented

- [x] Separate `library.html` page is reachable from navigation.
- [x] Upload, search/filter, preview, download, delete, ZIP extract, and explicit share-to-chat actions exist.
- [x] Attachment `+` flow offers Choose from Library and Choose from Device.
- [x] Duplicate uploads are checked by file identity metadata.
- [x] Library storage metadata and binary contents are split between IndexedDB and OPFS/fallback storage.

## 14. Backup & Import — Implemented

- [x] Settings → Data exports a ZIP containing a manifest, stored AXION values, indexed key/value data, tasks, memory summary, File Library metadata, and each stored Library blob.
- [x] Import validates the archive manifest, asks before replacing current state, restores local values/metadata/blobs, and reloads.
- [!] Backup archives can include API keys and private files; they should be treated as sensitive local data.

## 15. Auto-Continue — Implemented with guard

- [x] Settings → Personalization provides Auto-Continue and defaults it to OFF.
- [x] When enabled, truncated responses may continue automatically within a safety limit.
- [x] If the safety limit is reached while output still appears truncated, the UI reports that the response may be incomplete rather than claiming success.

## 16. Donation & Support — Implemented

- [x] Settings → Support links to `https://axion-hub.axn.cc.cd/donate`.
- [x] Localized donation copy says the user may donate as desired to help the developer buy coffee.
- [x] A first-visit and 15-day recurring support prompt offers “No thanks” and “Donate now”.
- [x] Donate now directs users to the Support section of Settings.

## 17. AI System Prompt — Implemented

- [x] Base prompt describes IndexedDB/OPFS storage, private terminal workflow, Library privacy/share rules, AXION Search only, ZIPs, Canvas, tasks, memory, token limit, Auto-Continue, and not claiming incomplete work is complete.
- [x] Tool protocol documents terminal, tasks, file reading, and search/content fallback use.

## 18. Bug Fixes — Implemented in source; runtime verification limited

- [x] Settings persistence and storage-ready hydration reapply theme/language after IndexedDB restoration.
- [x] Theme is applied through document theme attributes/CSS variables immediately.
- [x] The language maps cover new Settings, Library, provider configuration, and workflow UI text.
- [!] External CDN availability and browser policy can affect a running app; a complete automated live-browser regression suite was not available for this update. The headless Chromium smoke test in this container timed out before producing a DOM dump, so that test is not counted as passed. JavaScript syntax checks, HTML path checks, supplied-SDK identity, and final ZIP integrity are verified separately.

## Pre-delivery verification

- [x] Run `node --check` on every JavaScript file.
- [x] Verify HTML page structure and required local script paths.
- [x] Verify that the supplied SDK file is present and byte-for-byte identical in the source tree.
- [x] Verify ZIP archive integrity.
- [x] Inspect final packaged file list and required deliverables.
