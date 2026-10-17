# Prompt Update (1) — Revision 3 Implementation Checklist

Date: 2026-10-18

This checklist maps the supplied update specification to the delivered source. The application is a static/browser project, so server-side behavior cannot be guaranteed from this ZIP alone.

The original checklist remains in `UPDATE-CHECKLIST.md` as a historical v2.8.2 baseline. The supplied source files are retained under `docs/reference/`.

## UI updates
- [x] Settings palette shifted to charcoal + violet, with cleaner grouped sections and whitespace; existing settings controls retained.
- [x] File attachment cards changed to landscape 3:2 (width:height), including mobile sizing.
- [x] Assistant avatar is a subtle animated neural network graphic.
- [x] Canvas View All uses a full-screen viewer with close and downward scroll/swipe behavior.
- [x] Artifact/file viewer uses full-screen display with close and downward scroll/swipe behavior.
- [x] Cloud / AXION Neuralis displays translated Coming Soon (ID: Segera Hadir). Local/Private remains the active workspace choice.

## Bug fixes
- [x] AXION Search SDK reads response text before parsing. HTML/doctype, invalid JSON, HTTP failure, and network errors are normalized to structured error responses instead of reaching an unconditional `response.json()` parser.
- [x] Chat page includes `js/library.js`; `pickFiles` now opens a near-full-screen Library selector with a corner close button and cancel/attach controls.
- [x] Search caller surfaces explicit endpoint errors instead of treating them as successful empty result sets.

## New features
- [x] Conditional scroll-to-top / scroll-to-bottom controls above the composer.
- [x] Startup selects an existing empty conversation or creates one if all saved conversations contain messages.
- [x] Lightweight adaptive splash screen with a bounded initialization wait.
- [x] File Library hamburger menu: Select Files and Clear All Data.
- [x] Multi-select, selected-only deletion, Chat With existing/new conversation submenu, and Download Selected.
- [x] Long-press conversation menu: pin/unpin, duplicate, delete.
- [x] Remote Git workspace/mirroring controls removed from active workspace; workspace operations stay local.
- [x] AI-generated file cards are distinguished from user uploads; user cards display above and right-aligned to the user's message bubble; output cards render in AI output area above action buttons.
- [x] DOCX upload conversion is automatic in the chat pipeline and supported for document preview.
- [x] View File is limited to document formats; Download remains available for every file type.
- [x] Uploaded-file MIME type, extension, and size are passed into the AI context; original file bytes remain available as attachment blobs.
- [x] Workspace exposes single/batch/parallel reads, range and incremental reads, single/batch/parallel writes, range replacement, exact patches, and post-workspace delivery commands.
- [x] Git agent is gated by username + token, @ repo mention, configurable list refresh, and explicit Allow/Dismiss approval for every write action.

## System prompt and reliability
- [x] Base system prompt documents local IndexedDB/OPFS storage, workspace boundaries, tools/commands, file operation modes, UI behavior, artifact delivery, constraints and failure reporting.
- [x] All declared command families are described in the prompt and mapped to existing tool handlers where present.
- [x] JavaScript syntax checks, HTML local-path checks, and final ZIP integrity are part of pre-delivery validation.

## Explicit limitation
- [!] The delivered ZIP contains browser/client source but no server implementation for the remote AXION Search endpoint. The client now safely normalizes HTML/non-JSON/error responses, so they do not cause the reported JSON parse exception; server-side “always JSON” behavior must be enforced in the endpoint backend configuration/code.
- [!] Live OAuth/provider flows and manual browser visual QA require runtime credentials/network and are not represented as verified merely by static checks.
