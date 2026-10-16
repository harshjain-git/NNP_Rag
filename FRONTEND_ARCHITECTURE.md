# NNT RAG — Frontend Architecture Specification

> **Status:** Architecture Reference & Implementation Guide  
> **Repository:** `NNT_Rag`  
> **Workspace Location:** `frontend/`  
> **Source of Truth Alignment:** [`project_blueprint.md`](./project_blueprint.md) & [`AGENTS.md`](./AGENTS.md)  
> **Primary Design Language:** Minimal Dark Charcoal (ChatGPT-inspired) with Generously Rounded Curved Geometry  

---

## 1. Executive Summary & Architectural Overview

The **NNT RAG** frontend is a high-performance, responsive single-page and multi-route application built on the **Next.js App Router (v16.3.8)**, **React 19**, and **Tailwind CSS (v4)**. It provides a conversational interface for querying, synthesizing, and auditing enterprise documents grounded by an asynchronous RAG pipeline and vector search engine (pgvector).

### Core Architectural Principles
1. **Separation of Presentation & Business Logic:** Presentational components render purely from props; data fetching, state management, and side effects are managed in custom hooks and contexts.
2. **Stateless API Clients with Strict Type Parity:** All network requests route through typed, stateless API modules that directly mirror backend Express routes and Drizzle ORM schema contracts.
3. **Single Source of Truth for State:** Authentication and session tokens are synchronized via React 19's pure `useSyncExternalStore` mechanism, avoiding stale closures and mutation-during-render bugs.
4. **Curved & Minimal Dark Aesthetics:** The visual language uses dark charcoal surfaces (`#212121`, `#171717`), high-contrast light actions (`rounded-full bg-white text-black`), and generously rounded elements (`rounded-2xl`, `rounded-3xl`) without unnecessary gradients or visual clutter.
5. **Role-Based Access Control (RBAC):** Navigation and views are strictly partitioned by user role (`USER`, `ADMIN`, `SUPER_ADMIN`).

---

## 2. Current Architecture & Existing Baseline

The frontend foundation is already functional, type-checked, and linted with zero errors:

```
frontend/
├── package.json               # Next.js 16.3.8, React 19.2.8, Tailwind CSS v4, TypeScript 5
├── src/
│   ├── proxy.ts               # Next.js 16 Proxy (Middleware) route protection & cookie guard
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx         # Root layout with Geist fonts & application-level AuthProvider
│   │   ├── globals.css        # Tailwind v4 import & dark theme base
│   │   ├── page.tsx           # Initial monolithic main shell (sidebar, suggestions, composer)
│   │   ├── login/page.tsx     # Approved minimal dark login page with show/hide toggle
│   │   └── register/page.tsx  # Approved registration page with 4 inputs & independent toggles
│   ├── context/
│   │   └── AuthContext.tsx    # Pure useSyncExternalStore auth provider (localStorage + memory)
│   ├── lib/
│   │   └── api/               # 8 verified typed REST client modules
│   │       ├── client.ts      # Fetch wrapper (base URL, auto-Bearer JWT, ApiClientError)
│   │       ├── auth.ts        # /api/auth/login, /api/auth/register, logout
│   │       ├── chat.ts        # /api/chat query dispatcher
│   │       ├── conversations.ts # /api/conversations CRUD
│   │       ├── documents.ts   # /api/documents upload & query
│   │       ├── prompts.ts     # /api/prompts admin management
│   │       ├── admin.ts       # /api/admin/users management
│   │       └── index.ts       # Barrel export
│   └── types/                 # 8 strict TypeScript definitions mirroring backend
│       ├── auth.ts            # RoleName, User, SafeUser, AuthResponse, Payloads
│       ├── chat.ts            # Citation, ChatRequest, ChatResponse
│       ├── conversations.ts   # Conversation, Message, Response envelopes
│       ├── documents.ts       # DocumentItem, DocumentStatus, Upload response
│       ├── prompts.ts         # PromptItem, PromptType, PromptStatus
│       ├── admin.ts           # AdminUser payloads & responses
│       ├── events.ts          # IngestionEvent SSE contracts
│       └── index.ts           # Barrel export with ApiErrorResponse
```

### Verified Functionality Already in Place
- **Root `AuthProvider`:** Injected once in `frontend/src/app/layout.tsx`. All routes access `useAuth()` without redundant providers.
- **Pure Token Sync:** `AuthContext.tsx` uses a pure `getSnapshot()` that never mutates state during reads. Multi-tab synchronization is supported via native `storage` events.
- **Approved Authentication Views:** `/login` and `/register` share identical design tokens, rounded input borders, blue focus rings, keyboard-accessible SVG password reveal toggles, and client-side validation.
- **Main Shell Baseline:** `page.tsx` implements a collapsible responsive sidebar, mobile off-canvas drawer, suggestion cards, rounded composer, and role-gated administration links.

---

## 3. Proposed Modular Folder Structure

To scale the application cleanly without introducing unnecessary abstractions or speculative scaffolding, the codebase will be organized into feature-driven modules under `frontend/src/`:

```text
frontend/src/
├── app/                           # Next.js App Router: Thin Route Shells & Layouts
│   ├── layout.tsx                 # Root layout with Geist font & AuthProvider
│   ├── globals.css                # Global styles & Tailwind v4 imports
│   ├── page.tsx                   # Main Chat Dashboard view
│   ├── login/
│   │   └── page.tsx               # Authentication: Login view
│   ├── register/
│   │   └── page.tsx               # Authentication: Register view
│   ├── documents/                 # Document Management view (Phase 3)
│   │   └── page.tsx
│   └── admin/                     # Administration & Prompts view (Phase 4)
│       └── page.tsx
│
├── components/                    # Component Architecture
│   ├── ui/                        # Reusable Primitive Design System Components
│   │   ├── button.tsx             # Rounded pill & secondary action buttons
│   │   ├── input.tsx              # Curved input fields with focus & error styling
│   │   ├── modal.tsx              # Generously rounded dialog backdrop
│   │   ├── popover.tsx            # Floating curved popup menus
│   │   └── icons.tsx              # Unified, zero-dependency inline SVG icons
│   │
│   ├── layout/                    # Application Shell Structure
│   │   ├── sidebar.tsx            # Collapsible desktop sidebar & mobile drawer
│   │   ├── topbar.tsx             # Header bar with breadcrumbs & collapse triggers
│   │   └── user-profile-menu.tsx  # Bottom-left user popover (Profile, Settings, Logout)
│   │
│   ├── chat/                      # Chat Feature Domain
│   │   ├── welcome-screen.tsx     # "Ask your documents" heading & 4 suggestion cards
│   │   ├── message-list.tsx       # Message history stream container
│   │   ├── message-item.tsx       # User & Assistant bubbles with markdown rendering
│   │   ├── citation-badge.tsx     # Curved badge displaying document name & page
│   │   ├── citation-drawer.tsx    # Source citation viewer with excerpt & similarity
│   │   └── composer.tsx           # Generously rounded message input & action bar
│   │
│   ├── documents/                 # Document Management Domain
│   │   ├── document-table.tsx     # Table of ingested files, chunk count, status
│   │   ├── upload-dropzone.tsx    # Drag-and-drop file upload with validation
│   │   └── ingestion-badge.tsx    # Status indicator (uploaded, processing, ready, failed)
│   │
│   └── admin/                     # Administration Domain
│       ├── user-management.tsx    # User list, role update modal, deletion
│       └── prompt-management.tsx  # System and RAG prompt configuration panel
│
├── context/                       # Application State
│   └── AuthContext.tsx            # Existing pure useSyncExternalStore provider
│
├── hooks/                         # Domain Logic & API Orchestration Hooks
│   ├── useChat.ts                 # Chat lifecycle: sending queries, citations, active conversation
│   ├── useConversations.ts        # Conversation listing, switching, deletion
│   ├── useDocuments.ts            # Document list, upload mutations, deletion
│   └── useAdmin.ts                # Admin user operations & prompt engineering mutations
│
├── lib/                           # Existing API Clients & Utilities (Preserved)
│   └── api/
│       ├── client.ts
│       ├── auth.ts
│       ├── chat.ts
│       ├── conversations.ts
│       ├── documents.ts
│       ├── prompts.ts
│       ├── admin.ts
│       └── index.ts
│
└── types/                         # TypeScript Contracts (Preserved)
    ├── auth.ts
    ├── chat.ts
    ├── conversations.ts
    ├── documents.ts
    ├── prompts.ts
    ├── admin.ts
    ├── events.ts
    └── index.ts
```

---

## 4. Layer Responsibilities & Separation of Concerns

| Layer | Responsibility | What It CAN Do | What It CANNOT Do |
| :--- | :--- | :--- | :--- |
| **`app/**/page.tsx`** | Routing boundary & composition | Render feature containers, handle route params, route-level auth checks. | No direct API fetching, no raw SVG markup, no low-level CSS calculations. |
| **`components/ui/`** | Visual design system primitives | Accept props, emit user events, manage pure localized visual state (e.g. open/closed). | No domain context consumption (`useAuth`), no API calls, no routing logic. |
| **`components/layout/`** | Application scaffolding | Layout responsiveness, sidebar state, user menu triggering. | No chat streaming logic, no document upload mutation logic. |
| **`components/{feature}/`** | Domain presentation | Render messages, citations, dropzones, tables from props. | No direct `fetch()` calls; delegates actions to hooks via callbacks. |
| **`hooks/`** | Business logic & data orchestration | Coordinate `lib/api/`, handle async loading/error states, manage caching and optimistic UI. | No JSX rendering; returns purely state and dispatch functions. |
| **`context/`** | Cross-cutting persistent state | Provide global user authentication and token state via `useSyncExternalStore`. | Do not use for transient form state or local component visibility toggles. |
| **`lib/api/`** | Stateless HTTP communication | Execute HTTP requests, serialize payloads, deserialize responses, throw `ApiClientError`. | No React hook usage, no UI alerts, no direct navigation/redirects. |
| **`types/`** | Canonical data contracts | Declare interfaces, payloads, response envelopes, enums. | No runtime logic or executable functions. |

---

## 5. Coding Conventions & Quality Guidelines

### 5.1 Naming Conventions
- **Component Files:** `kebab-case.tsx` (e.g., `citation-badge.tsx`, `upload-dropzone.tsx`).
- **Component Identifiers:** `PascalCase` (e.g., `CitationBadge`, `UploadDropzone`).
- **Hook Files & Functions:** `camelCase.ts` prefixed with `use` (e.g., `useChat.ts`, `useDocuments.ts`).
- **API Files & Functions:** `camelCase.ts` with descriptive verbs (e.g., `getDocuments`, `uploadDocuments`).
- **Type Files & Interfaces:** `PascalCase` for types (`Conversation`, `DocumentItem`) and `camelCase.ts` for type definition filenames (`chat.ts`, `auth.ts`).

### 5.2 Component Size & Decomposition Rules
- **Size Ceiling:** No component file should exceed **200–250 lines**.
- **Refactoring Trigger:** If a single component handles layout, data transformation, and multiple interactive widgets simultaneously (as the initial monolithic `page.tsx` did with its SVGs and modals), it must be split into dedicated feature components.
- **Pure Helpers:** Inline SVGs must reside in `components/ui/icons.tsx` rather than being copied inline across multiple views.

### 5.3 Import Hierarchy
All files must adhere to strict, clean import ordering:
```typescript
// 1. React & Next.js Core
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// 2. Contexts & Hooks
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/hooks/useChat";

// 3. Components (Layout -> Feature -> UI)
import { Sidebar } from "@/components/layout/sidebar";
import { MessageList } from "@/components/chat/message-list";
import { Button } from "@/components/ui/button";
import { DocumentIcon } from "@/components/ui/icons";

// 4. API & Utilities
import { getDocuments } from "@/lib/api/documents";

// 5. Types
import type { ChatResponse, Citation } from "@/types";
```

---

## 6. Authentication, RBAC, and Request Lifecycle

### 6.1 Authentication Flow
```
User Enters Credentials ──→ api.auth.login() ──→ AuthContext.login()
                                                        │
                      ┌─────────────────────────────────┴─────────────────────────────────┐
                      ▼                                                                   ▼
       localStorage.setItem("nnt_rag_user")                               localStorage.setItem("nnt_rag_token")
                      │                                                                   │
                      └─────────────────────────────────┬─────────────────────────────────┘
                                                        ▼
                                              notify() Subscribers
                                                        │
                                                        ▼
                                     React UI Re-renders via getSnapshot()
```

### 6.2 Role-Based Access Control (RBAC) Matrix
The backend Express API strictly validates JWT roles. The frontend mirrors this authorization boundary to guarantee clean UX and avoid forbidden request failures:

| Route / Component | Allowed Roles | Unauthenticated Behavior | Unauthorized Behavior |
| :--- | :--- | :--- | :--- |
| **`/login`, `/register`** | Public | Display forms | Redirect to `/` if already logged in |
| **`/` (Main Chat)** | `USER`, `ADMIN`, `SUPER_ADMIN` | Read-only / Prompts login to persist | Accessible to all authenticated users |
| **`/documents` (View)** | `USER`, `ADMIN`, `SUPER_ADMIN` | Redirect to `/login` | Full list visible |
| **`/documents` (Upload/Delete)** | `ADMIN`, `SUPER_ADMIN` | Action hidden | Backend returns 403; button hidden for `USER` |
| **`/admin` (Users & Prompts)** | `ADMIN` (Prompts), `SUPER_ADMIN` (Users + Prompts) | Redirect to `/login` | Redirect to `/` with "Access Denied" notice |

### 6.3 API Error Handling & Loading Standard
1. **Network Layer:** `client.ts` automatically extracts `ApiErrorResponse` envelopes (`{ error: string, statusCode: number, details?: ApiErrorDetail[] }`).
2. **Hook Layer:** Custom hooks catch `ApiClientError` and store localized error strings for the UI:
   ```typescript
   try {
     setIsLoading(true);
     setError(null);
     const res = await sendChatQuery({ query, conversationId }, token);
     setMessages((prev) => [...prev, formatMessage(res)]);
   } catch (err) {
     setError(err instanceof ApiClientError ? err.message : "An unexpected error occurred");
   } finally {
     setIsLoading(false);
   }
   ```
3. **Session Expiry (401):** If an API call throws with `statusCode === 401`, the client triggers `logout()` and redirects to `/login`.

---

## 7. Design System: Approved ChatGPT-Style Dark Theme

The visual identity must maintain strict continuity with the approved authentication and main shell interfaces.

### 7.1 Color Tokens
| Token | Hex Value | Usage |
| :--- | :--- | :--- |
| **Page Background** | `#212121` | Base canvas background for all pages (`bg-[#212121]`) |
| **Sidebar Surface** | `#171717` | Navigation panel and elevated desktop drawers |
| **Card / Popover Surface**| `#262626` | Suggestion cards, user menus, modals (`bg-[#262626]`) |
| **Interactive Surface** | `#2f2f2f` | Input fields, textareas, active dropdowns |
| **Subtle Border** | `#3f3f46` (Zinc 700) | Subtle borders on inputs, cards, dividers |
| **Focus Border** | `#3b82f6` (Blue 500) | Form focus outlines with 1px ring |
| **Primary Button** | `#ffffff` (Text `#000000`) | High-contrast light button (`rounded-full bg-white text-black`) |
| **Secondary Button** | `#27272a` (Zinc 800) | Bordered pill button (`rounded-full bg-zinc-800 text-white`) |
| **Accent Text / Links** | `#60a5fa` (Blue 400) | Interactive links, citations, active tab highlights |
| **Error / Alert** | `#450a0a` / `#991b1b` | Red alerts (`bg-red-950/70 border-red-800 text-red-200`) |

### 7.2 Curvature & Geometry
- **Strict Rule:** Avoid square corners or small rectangular radiuses (`rounded-sm`, `rounded-md`).
- **Pills (`rounded-full`):** Action buttons, "New Chat" button, category badges, user avatar circles, send button.
- **Composer Container (`rounded-3xl`):** The primary chat composer box.
- **Cards, Drawers, and Dialogs (`rounded-2xl`):** Suggestion cards, navigation list items, user popover menu, citation popovers, upload dropzones.

### 7.3 Typography & Spacing
- **Font Family:** `Geist Sans` (`var(--font-geist-sans)` / `font-sans`).
- **Heading Styles:** `text-2xl sm:text-3xl font-semibold text-white tracking-tight`.
- **Body Text:** `text-sm sm:text-base text-zinc-200 leading-relaxed`.
- **Secondary / Meta:** `text-xs text-zinc-400`.
- **Spacing Scale:** Generous vertical padding (`py-6`, `py-8`) and centered max-width constraint (`max-w-3xl`) for readable conversational line lengths.

---

## 8. Phased Implementation Roadmap

```
┌─────────────────────────────────┐
│ Phase 1: Foundation (Completed) │
│ • API Client & TypeScript Types │
│ • Pure AuthContext Sync         │
│ • Login & Register Dark UI      │
│ • Initial Shell Baseline        │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ Phase 2: Shell Refactoring &    │
│          Chat Integration       │
│ • Decompose page.tsx            │
│ • useChat Hook & Citations UI   │
│ • Multi-turn conversation sync  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ Phase 3: Document Management    │
│ • /documents Route              │
│ • Multi-file Drag & Drop Upload │
│ • Ingestion Status Polling/SSE  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ Phase 4: Administration &       │
│          Prompts                │
│ • /admin Protected Route        │
│ • User Role Management          │
│ • System/RAG Prompt Editor      │
└─────────────────────────────────┘
```

### Phase 2: Shell Decomposition & Chat Integration
- **Step 2.1:** Extract common icons into `components/ui/icons.tsx`.
- **Step 2.2:** Decompose `frontend/src/app/page.tsx` into:
  - `components/layout/sidebar.tsx`
  - `components/layout/topbar.tsx`
  - `components/layout/user-profile-menu.tsx`
  - `components/chat/welcome-screen.tsx`
  - `components/chat/composer.tsx`
- **Step 2.3:** Implement `hooks/useChat.ts` to manage:
  - Active conversation ID.
  - Sending queries to `/api/chat`.
  - Storing message streams (`Message[]`).
  - Rendering source citations with `components/chat/citation-badge.tsx` and drawer.

### Phase 3: Document Management (`/documents`)
- **Step 3.1:** Create route `frontend/src/app/documents/page.tsx` using the shared `Sidebar` and `Topbar`.
- **Step 3.2:** Build `components/documents/document-table.tsx` displaying filename, fileType, chunkCount, status, and delete action (`DELETE /api/documents/:id`).
- **Step 3.3:** Build `components/documents/upload-dropzone.tsx` accepting PDFs/DOCX/TXT and uploading via `uploadDocuments(files, token)` (`multipart/form-data`).
- **Step 3.4:** Display real-time ingestion status using event types (`document.parsing`, `document.chunking`, `document.embedding`, `document.ready`).

### Phase 4: Administration & Prompt Engineering (`/admin`)
- **Step 4.1:** Create route `frontend/src/app/admin/page.tsx` with role guard (`ADMIN` / `SUPER_ADMIN`).
- **Step 4.2:** Implement user management tab: view users (`GET /api/admin/users`), promote/demote roles (`PATCH /api/admin/users/:id/role`), create admin users.
- **Step 4.3:** Implement prompt management tab: view prompts (`GET /api/prompts`), edit RAG prompt template (`PATCH /api/prompts/:id`), activate prompts.

---

## 9. Architectural Integrity & Preserved Code

### 9.1 Existing Code to Preserve Completely
1. **`frontend/src/context/AuthContext.tsx`:** Verified pure snapshot implementation. No mutations occur inside `getSnapshot()`. Multi-tab storage listeners are intact.
2. **`frontend/src/lib/api/` (All 8 Modules):** Complete parity with backend Express controllers and Drizzle models. Preserved without regression.
3. **`frontend/src/types/` (All 8 Modules):** Canonical TypeScript interfaces. Preserved without alteration.
4. **`frontend/src/app/login/page.tsx` & `register/page.tsx`:** Verified compliant with approved dark UI specifications and accessibility standards.

### 9.2 Identified Duplication & Proposed Cleanups
- **Duplicate Inline SVGs:** `EyeIcon` and `EyeOffIcon` exist in both `login/page.tsx` and `register/page.tsx`, and ~10 icons exist in `page.tsx`.
  - *Action in Phase 2:* Centralize all icons in `frontend/src/components/ui/icons.tsx`.
- **Monolithic `page.tsx`:** Currently contains ~715 lines encompassing sidebar, profile menu, suggestion cards, and composer.
  - *Action in Phase 2:* Decompose into modular components under `components/layout/` and `components/chat/`.

---

## 10. Explicit Technical Inquiries & Blueprint Alignment

To maintain zero-assumptions development, the following architectural details are documented:

1. **Chat Streaming vs. Discrete JSON:** The backend `/api/chat` currently returns a discrete JSON response envelope (`ChatResponse`). If future milestones add token-by-token streaming, a Server-Sent Events (SSE) or WebStream reader will be added to `useChat.ts` without breaking the `ChatResponse` interface.
2. **Ingestion Progress Mechanism:** `types/events.ts` specifies `IngestionEvent` types. While the backend ingestion queue runs via asynchronous worker threads, live frontend progress updates will initially utilize lightweight polling on `GET /api/documents` before connecting a dedicated SSE endpoint.
3. **Markdown & Code Highlighting in Chat:** Chat answers return structured markdown and citations. A lightweight markdown renderer with code block styling matching the `#262626` background will be integrated in `components/chat/message-item.tsx`.
