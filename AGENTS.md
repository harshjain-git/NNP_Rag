# Development Guidelines for NNT RAG (AGENTS.md)

This document contains the permanent, mandatory guidelines that all AI agents and developers must strictly follow when working on the **NNT RAG** repository.

---

## 1. Project Source of Truth

* Always read and follow [`project_blueprint.md`](./project_blueprint.md) (also referenced as `PROJECT_BLUEPRINT.md`).
* Treat `project_blueprint.md` as the authoritative source of truth for:
  * Project purpose, scope, and phases (currently Phase 1).
  * System architecture and component interactions.
  * Technology stack selections (Node.js/Express, Next.js, PostgreSQL/pgvector, Drizzle ORM, LlamaParse, LLM/embedding providers).
  * Folder structures and file organization.
  * Major implementation and technical decisions.
* **Never silently contradict, alter, or replace decisions documented in the blueprint.**

---

## 2. Existing Architecture

* Respect and adhere to the established project architecture:
  * **Frontend (`/frontend`)**: Next.js App Router, React, TypeScript, Tailwind CSS.
  * **Backend (`/backend`)**: Express.js, Node.js, TypeScript, Drizzle ORM, PostgreSQL with pgvector, modular RAG layers (`/src/rag/ingestion`, `/src/rag/retrieval`, `/src/rag/generation`).
* Before making changes, inspect existing code and verify where the new functionality belongs in the architectural layers (Routes → Controllers → Services → Database / RAG).
* Reuse existing modules, services, utilities, schemas, types, and client connections (e.g., database pool, LlamaCloud client, Drizzle schema) whenever possible.
* Do not introduce arbitrary architectural changes, unapproved layers, or ad-hoc libraries.

---

## 3. Smallest Possible Implementation

* Write the **smallest clean implementation** that directly solves the task at hand.
* Do not overwrite working code unnecessarily.
* Modify **only** files that actually require changes.
* Do not rewrite or restyle unrelated code.
* Do not introduce unnecessary abstractions, premature wrappers, extra helper layers, or speculative architectural scaffolding.
* Do not create duplicate files, shadow copies, or duplicate implementations.
* Do not add placeholder, dead, speculative, or future-phase code.

---

## 4. Clean Code & Conventions

* Keep code simple, readable, robust, and maintainable.
* Follow established project conventions:
  * TypeScript strict typing (prefer explicit interfaces and types over `any`).
  * ESM imports (`import ... from "./foo.js"` syntax required by Node.js ESM configuration).
  * Separation of concerns: keep HTTP routing/validation in controllers/validators, business logic in services, and data persistence in schema/queries.
* Prefer simple, understandable, idiomatic solutions over complex or clever patterns.

---

## 5. Testing Policy

* **Do not automatically generate test files for every change.**
* Create tests only when they are genuinely necessary or explicitly requested by the user.
* For small or incremental changes, rely on practical, manual verification (e.g., verifying builds, testing routes with curl or lightweight verification commands).

---

## 6. Blueprint Synchronization

If an architectural, library, or design decision must change:
1. Identify the existing decision in [`project_blueprint.md`](./project_blueprint.md).
2. Explicitly explain why the change is necessary.
3. Update [`project_blueprint.md`](./project_blueprint.md) to record the new decision.
4. Remove or replace the outdated decision so no conflicting statements remain.
5. Ensure the blueprint and codebase remain strictly synchronized.
* **Rule:** Never silently change an architectural or technology decision in code without updating the blueprint.

---

## 7. Workflow: Before Every Implementation

Before writing any code:
1. **Read the relevant section** of [`project_blueprint.md`](./project_blueprint.md).
2. **Inspect existing implementations** to understand active patterns and conventions.
3. **Check the folder structure** to locate where the code correctly belongs.
4. **Determine if functionality already exists** to avoid duplication.
5. **Formulate the smallest necessary change.**

*Do not begin creating files or editing code before completing this analysis.*

---

## 8. Communication: After Every Implementation

After completing a change, provide a concise explanation covering:

- **What changed:** Brief summary of the work.
- **Files modified:** Exact file paths.
- **Rationale:** Why the change was needed.
- **Verification:** Commands run and manual testing steps.
- **Remaining issues:** Any known limitations or failures.

Keep reports short, clear, and focused on the assigned task. Explain technical details only when necessary or requested.

## 9. User Learning Background

The repository owner is primarily a Python developer learning JavaScript and TypeScript.

When a JS/TS-specific concept is important or unfamiliar, briefly relate it to a Python equivalent when helpful. Avoid unnecessary explanations of basic programming concepts, repeated analogies, and lengthy technical walkthroughs.

## 10. Frontend Architecture and Code Quality

- **Frontend architecture:** Always read and follow `frontend/FRONTEND_ARCHITECTURE.md` when working on frontend code, alongside `project_blueprint.md` and the applicable `AGENTS.md`.
- **Simple, readable code:** Write the smallest clean implementation that follows the documented architecture.
- **Minimum necessary lines:** Avoid unnecessary boilerplate, excessive comments, redundant variables, and needless abstractions. Keep code concise without sacrificing readability, correctness, or maintainability.
- **Clear responsibilities:** Keep route pages, reusable components, hooks, API clients, contexts, and types in their documented architectural layers.
- **Reuse existing code:** Inspect and reuse existing components, API modules, types, and utilities before creating new ones.
- **No overengineering:** Create files, hooks, and components only when they provide a clear benefit. Do not split code into tiny components merely to reduce line counts.
- **No speculative implementation:** Do not add placeholder components, unused hooks, future-phase functionality, or unsupported API integrations.
- **Preserve working behavior:** Avoid unrelated refactoring and changes to existing functionality.
- **Validate changes:** Run the relevant existing type-check and lint commands, and report any failures accurately.

## 11. Scope Discipline and Development Cycle

Work exclusively on the assigned task.

Do not add unrelated features, redesign working architecture, introduce premature optimizations, switch technologies without approval, or create duplicate implementations.

Follow this cycle:

**Understand → Inspect → Make the smallest necessary change → Validate → Manually verify → Report**

## UI Design Ownership — Mandatory Rule

The user has complete authority over all UI/UX decisions.

- Do not invent or change colors, typography, spacing, layouts, shapes, borders, icons, animations, or responsive behavior without explicit user approval.
- Preserve the approved ChatGPT-style dark theme, typography, and curved shapes.
- Follow the user's approved design specifications exactly. Do not introduce unapproved visual improvements.
- Keep functional changes separate from visual changes.
- If a required design detail is undecided, ask the user before implementing it.
- After implementation, report changed files and confirm whether any visual changes were made.