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

After completing any change, provide a structured explanation covering:
* **What changed:** Clear summary of what was accomplished.
* **Files modified:** Exact list of files created or updated with clickable links.
* **Rationale:** Why the change was made.
* **How it works:** Core mechanism of the implementation.
* **Architectural alignment:** How it fits into the broader system architecture.
* **Manual verification:** Step-by-step instructions for testing and validating the change.

### Required Two-Level Explanations:
Always structure the explanation into two distinct levels:
1. **Simple Explanation (Python Bridge):**
   * Tailored for someone who understands programming and Python well but is learning JavaScript/TypeScript.
   * Uses intuitive Python analogues (e.g., comparing `Promise`/`async/await` to Python `asyncio`, TypeScript `interface` to Python `TypedDict`/Pydantic, `multer` to FastAPI file uploads).
2. **Technical Explanation (Deep Dive):**
   * Covers the exact JavaScript/TypeScript, Node.js, Express, database, pgvector, or RAG concepts involved.

---

## 9. User Learning Background & Python Comparisons

The repository owner is primarily a **Python developer** mastering JavaScript/TypeScript while developing this system.

* When introducing JS/TS-specific patterns, briefly connect them to their Python counterparts when helpful:
  * `Promise` / `async/await` ↔ Python `asyncio` / coroutines
  * TypeScript `interface` / `type` ↔ Python `typing.TypedDict` / Pydantic models / dataclasses
  * Generics (`<T>`) ↔ Python `TypeVar` / generic typing
  * Express middleware (`(req, res, next) => {}`) ↔ FastAPI / Flask middleware or decorators
  * Node.js Streams / Buffers ↔ Python `io.BytesIO` / file streams
  * NPM / ESM modules (`type: "module"`) ↔ Python modules / `__init__.py` packaging
  * Callbacks & Event Loop ↔ Python event loops and asynchronous callbacks
  * Dependency injection / Provider patterns ↔ Python class-based adapters / factory patterns
* **Do not** explain basic programming fundamentals (loops, conditionals, basic OOP) that an experienced programmer already knows.

---

## 10. Scope Discipline & Development Cycle

Work exclusively on the assigned task.

**Strict Prohibitions:**
* Do NOT add unrelated features.
* Do NOT redesign working architecture.
* Do NOT introduce premature optimizations.
* Do NOT add speculative future-phase features.
* Do NOT switch libraries or technologies without explicit instruction and blueprint alignment.
* Do NOT create unnecessary files or duplicate code.
* Do NOT refactor working, unrelated code.

### Mandatory Development Cycle:
$$\text{Understand} \longrightarrow \text{Make Smallest Change} \longrightarrow \text{Run / Build} \longrightarrow \text{Manually Verify} \longrightarrow \text{Explain} \longrightarrow \text{Continue}$$
