# Update Specification: AXION AI System — Revision 3
## Role & Objective
You are a senior developer tasked with updating and refining the AXION AI application. **Follow every single requirement exactly — do not skip, omit, or alter any point.** Maintain a running task list throughout your work to ensure full coverage. Communicate with me in **Indonesian**. Deliver the final complete package as a ZIP archive.

---

## 1. UI Updates
### 1.1 Settings Page
- Implement the Settings page layout, structure, and styling to match the provided `contoh-settings.html` reference.
- Update all CSS styles, colors, and design system to align with the reference design — replace the orange accent and adjust other colors accordingly to match the reference palette.
- Important: The HTML file serves only as a visual/layout reference. Adapt JavaScript logic, existing functions, dimensions, and behaviors to maintain full functionality.
- Ensure the Settings page is **clean, tidy, and well-structured**: maximize whitespace and breathing room **without removing any existing buttons or features**. Achieve this purely through layout reorganization (grid, spacing, grouping, sectioning) — never by deleting functionality.

### 1.2 File Cards
- Change file card aspect ratio from **2:4** to **1:1.5** (height: 1 unit, width: 1.5 units).

### 1.3 AI Visual Indicator
- Replace the icon shown beside AI responses with a subtle accent graphic or animated neural network visualization.

### 1.4 Canvas Modal Behavior
- When user clicks **"View All"** on a Canvas:
  - Canvas opens in **full-screen view**.
  - Can be closed by: clicking the close button or scrolling downward.

### 1.5 Artifacts / File View
- The "View Files" modal uses the same full-screen display and close behavior as the Canvas above.

### 1.6 Workspace Labeling
- Only the **Local/Private** workspace is currently active. Mark the **Cloud / AXION Neuralis** workspace option with the text: **"Coming Soon"** — automatically translated into the user's active language.

---

## 2. Bug Fixes
### 2.1 AXION Search Error
- **Issue**: Search returns parsing error: `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.
- Action: Diagnose the root cause — likely receiving an HTML error page instead of the expected JSON response. Fix the request/handling logic so a valid JSON payload is returned and parsed correctly.
- Guarantee that the AXION Search endpoint **always returns valid, well-formed JSON** for every response path (success, empty result, and error). Under no circumstances should an HTML/doctype response ever reach the JSON parser.

### 2.2 Library File Selection Error
- **Issue**: Clicking `+ → Choose from Library` fails with: `Library selection failed: Cannot read properties of undefined (reading 'pickFiles')`.
- Fix the undefined reference issue.
- **Updated UI**: When selecting files from the Library, open a **large modal popup** (nearly full-screen) displaying available files, with a close button in the corner. Users select files from this modal.

---

## 3. New Features & Adjustments

### 3.1 Quick Scroll Buttons
- Add two small, unobtrusive arrow buttons in the **top-right area above the message input field**:
  - Scroll to Top — appears only when the user is not at the top.
  - Scroll to Bottom — appears only when the user is not at the bottom.
- Buttons should be reasonably sized — neither too large nor too small.

### 3.2 Default Chat Session & Conversation Detection
- Every time the application opens, users land on a **New Chat** — NOT the last/previous conversation session.
- **Mandatory conversation detection on startup**:
  - Scan all existing conversations and classify each as **empty** (no messages yet) or **active** (already contains messages).
  - If **at least one** conversation is still empty, route the user into that empty conversation instead of creating another blank chat.
  - Only when **every** existing conversation already contains messages should the app create and route the user into a brand-new chat.
  - This prevents an endless accumulation of empty conversation entries.

### 3.3 Splash Screen
- Display a lightweight splash screen on app startup. Duration adapts to device performance — shown just long enough for the app to initialize without unnecessary delay.

### 3.4 File Library Enhancements
- Add a **hamburger menu** in the top-right corner of the Library page. Menu options (translated to the user's language):
  - **Select Files** → Enables multi-selection of file cards. When active, show at the bottom:
    - Delete Selected — removes only checked files.
    - Chat With — opens a submenu: choose an existing conversation OR New Chat; attaches the selected files to the input field automatically.
    - Download Selected.
  - **Clear All Data** → removes all files from the library.
- Keep file cards visually clean — no clutter.

### 3.5 Conversation Actions
- In the sidebar/hamburger conversation list: **Long-press** on any conversation to open a small dropdown menu with:
  - Pin Conversation
  - Duplicate Conversation
  - Delete Conversation

### 3.6 Workspace Simplification
- Remove the "User Repository / GitHub-based Workspace" feature entirely. The Workspace is now **Local Only** on the user's device — no remote repository is ever used as a workspace or storage location.
- Note: GitHub remains available **exclusively as an agent/copilot capability** (see Section 5) — never as a workspace.

### 3.7 AI-Generated File Display
- Files created by the AI appear as distinct cards within the AI's message output area — visually different from user file cards.
- **Layout Rule**: All AI output elements — files, canvases, visuals — must appear **above** any action buttons (Copy, Regenerate, etc.). Buttons must always be at the very bottom of the AI response block.

### 3.8 DOCX File Support
- Users can upload `.docx` files. The AI uses internal commands to convert DOCX to plain text before reading and processing content — conversion happens automatically and transparently to the user.

### 3.9 View & Download Buttons & File Type Fidelity
- **"View File"** button appears **only for document file types** — not for archives (.zip/.rar) or other binary formats.
- **"Download"** button appears for **all file formats** without exception.
- Always inform the AI of the exact file/media type when a user sends a file — include format information in the context.
- **Ensure user-uploaded files are delivered as genuine files, not just metadata or text descriptions.** Detect the correct format and deliver each file in its native representation: documents as documents, images as images, video as video, audio as audio, archives as archives, objects as objects, etc.

### 3.10 Command-First AI Workflow
- The AI does not automatically execute scripts. Instead, it issues **commands** that trigger defined functions/scripts. The AI decides when and which command to use based on the task at hand.
- The AI determines placement of canvases, files, and visual outputs within its own response — top, middle, or bottom — as naturally appropriate to the answer structure, provided layout constraints are respected.

### 3.11 File Card Position & Styling
- User file cards appear **above** the user's message bubble — not below.
- Visually distinguish AI-generated file cards from user-uploaded cards:
  - AI file cards: aligned naturally within the AI output.
  - User file cards: above the user message bubble, right-aligned.
  - AI cards may appear above, below, or within the response — never side-by-side with text.

### 3.12 File Operation Mastery
- The AI must be able to **read files with full flexibility**:
  - Read all files at once, in parallel.
  - Read a single file.
  - Read progressively / incrementally.
  - Read specific line ranges (partial reads).
- The AI must be able to **write/edit files with equal flexibility**:
  - Write/edit all files in parallel.
  - Write/edit at specific line ranges.
  - Full-file overwrite or targeted patching.
- These capabilities must be exposed as proper tools the AI can invoke, and the AI must be explicitly instructed (in the system prompt) on how and when to use each mode.

### 3.13 Post-Workspace Artifact Delivery
- After the AI performs work in the workspace (e.g., creating or editing a file), it must be able to send the resulting output **directly to the user in the conversation as Artifacts**, so the user can view and download them inline without leaving the chat.

---

## 4. AI System Prompt Update
- Completely revise and strengthen the AI's base system prompt:
  - Use **clear, firm, unambiguous instructions** — no vague wording.
  - Document full capabilities, command system, storage architecture (IndexedDB + OPFS), workspace model, and visibility rules.
  - Explicitly list hard constraints, prohibitions, and boundaries the AI must never cross.
  - Reference all UI behaviors, output formats, and interaction rules so the AI fully understands the environment it operates within.
  - **Explicitly teach the AI every available tool**: its purpose, inputs, outputs, constraints, and correct usage patterns (file read/write, parallel operations, git, canvas, artifacts, etc.).
  - The AI must fully understand and correctly invoke every tool. Ambiguous, unused, or misused tools are treated as a defect, not an acceptable outcome.

---

## 5. GitHub Agent / Copilot Integration
- The GitHub integration exists **only** for agents/copilot purposes. It is **not** a workspace and must never store workspace data.
- **Configuration** (in Settings):
  - Input fields for GitHub **Username** and **Personal Access Token (Token)**.
  - GitHub agent is enabled **only when both** are provided.
- **Repository selection via `@` mention**:
  - Typing `@` in the chat input field opens a **dropdown listing the user's repositories**.
  - Clicking a repository inserts `@repo-name` into the input field automatically.
  - The AI may only act on a repository that has been explicitly mentioned using `@repo-name`.
  - If no repository is mentioned, the AI **cannot modify** any repository — it may only view the repository list.
- **Auto-refresh of repository list**:
  - The repository list is loaded automatically at a configurable interval (fully automatic by default).
  - Provide an **"Auto Refresh" toggle** in the Git configuration: when ON → auto-refresh runs; when OFF → it does not.
- **Verification of AI changes**:
  - When the AI finishes work on a specific repository, show **Allow** and **Dismiss** buttons.
  - **Allow** → confirms and applies the proposed changes to the repository.
  - **Dismiss** → discards the proposed changes.
  - No change is ever committed to a repository without explicit user approval.

---

## 6. System Reliability
- Verify every tool functions correctly and without interference.
- Every command the AI issues must resolve to an actual working function/script.
- No tool may silently fail — errors must surface clearly and be recoverable.

---

## Task Checklist
- [ ] Settings page UI implementation & color scheme update
- [ ] Settings page layout tidied — maximum whitespace, no features removed
- [ ] File card aspect ratio adjustment (1:1.5)
- [ ] AI response icon → neural network / animated accent
- [ ] Canvas full-screen modal + close on scroll / button
- [ ] Artifact viewer same modal behavior
- [ ] "Coming Soon" label for Cloud workspace
- [ ] AXION Search JSON parsing error diagnosis & fix — always valid JSON
- [ ] Library `pickFiles` undefined error — fixed + modal interface
- [ ] Scroll-to-top / bottom buttons above input
- [ ] App opens to New Chat by default
- [ ] Conversation detection on startup (route to empty chat if any exists)
- [ ] Splash screen implementation
- [ ] Library hamburger menu: Select / Clear All
- [ ] Multi-select + delete / chat / download actions
- [ ] Long-press conversation: Pin / Duplicate / Delete
- [ ] Remove GitHub / User Repo workspace — workspace is Local Only
- [ ] GitHub agent (Username + Token) — configuration in Settings
- [ ] `@` mention dropdown for repository selection
- [ ] AI may only act on explicitly-mentioned repositories
- [ ] Auto-refresh repository list + Auto Refresh toggle
- [ ] Allow / Dismiss verification after AI finishes repo work
- [ ] Distinct AI file card styling & positioning
- [ ] DOCX upload + conversion-to-text support
- [ ] Conditional View File button; universal Download button
- [ ] File format metadata passed to AI
- [ ] True file delivery (native type) for user uploads
- [ ] AI parallel file reading (all / single / incremental / line-range)
- [ ] AI parallel file writing / editing (all / line-range / patch)
- [ ] Post-workspace artifact delivery to conversation
- [ ] Command-based AI execution model defined
- [ ] AI controls output element placement
- [ ] User file cards above message bubbles
- [ ] AI vs user card visual differentiation
- [ ] System prompt rewrite — comprehensive & strict
- [ ] System prompt explicitly documents every tool
- [ ] All tools verified working without interference
- [ ] Final review — verify every point completed
- [ ] Package deliverable into ZIP archive