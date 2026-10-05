# NNT RAG — Project Blueprint

> **Project Status:** Phase 1 — Foundation & Document Q&A
> **Document Purpose:** This document is the source of truth for the NNT RAG project's purpose, architecture, technology choices, scope, and major technical decisions.
>
> Any major architectural or technology decision made during development should be reflected in this document.

---

# 1. Project Overview

## 1.1 Project Name

**NNT RAG**

NNT RAG is a production-oriented document question-answering system based on Retrieval-Augmented Generation (RAG).

The system allows authorized administrators to upload documents and manage prompts. Users can then ask questions and receive answers generated from the available document knowledge.

---

# 2. Project Purpose

The primary purpose of NNT RAG is to build a structured, production-style RAG application where users can:

- Ask questions about uploaded documents.
- Retrieve relevant information from those documents.
- Receive answers generated using an LLM.
- See supporting document information/citations.
- Maintain conversations.

Administrators can:

- Upload documents.
- Process and manage documents.
- Manage prompts used by the RAG system.
- Control the knowledge available to users.

Super Administrators can additionally manage higher-level system configuration and administration.

---

# 3. Core RAG Principle

The most important rule of the system is:

> **The system should answer questions using only the authorized knowledge available through uploaded documents and administrator-managed prompts.**

The application should not intentionally use arbitrary external knowledge to answer document-related questions.

If sufficient evidence cannot be found in the available documents, the system should not invent an answer.

Expected behavior:

```text
User Question
      ↓
Retrieve relevant document content
      ↓
Check whether sufficient evidence exists
      ↓
 ┌───────────────┐
 │ Evidence      │
 │ sufficient?   │
 └───────┬───────┘
         │
     ┌───┴───┐
     │       │
    YES      NO
     │       │
     ↓       ↓
 Generate   Refuse / explain
 Answer     insufficient evidence
     │
     ↓
 Answer + Citations
```

---

# 4. Phase 1 Scope

## 4.1 Included

Phase 1 focuses on:

- User authentication and roles.
- Document upload.
- Document processing.
- Document storage.
- Document chunking.
- Embedding generation.
- Vector storage.
- Semantic retrieval.
- Evidence checking.
- LLM-based answer generation.
- Prompt management.
- Conversations.
- Messages/chat history.
- Citations/source information.
- Basic administration.
- Multiple LLM provider support.
- Local and API-based embedding support.

## 4.2 Initially Supported Documents

The initial document formats are:

- PDF
- TXT
- DOCX

Document processing flow:

```text
Upload
   ↓
Process
   ↓
Chunk
   ↓
Embed
   ↓
Store
   ↓
Ready
```

Possible processing states:

```text
UPLOADED
PROCESSING
READY
FAILED
```

## 4.3 Not Part of Initial Phase

The following are intentionally not required for the initial implementation:

- Microservices architecture.
- Kubernetes.
- Kafka.
- Redis.
- Separate vector database.
- Complex distributed processing.
- Large-scale cloud document processing.
- Real-time collaborative editing.
- Advanced analytics.
- Enterprise SSO.
- Complex multi-tenant infrastructure.

These may be considered later if the product requires them.

---

# 5. Users and Roles

The system has three primary roles.

## 5.1 User

A normal application user.

Responsibilities:

- Log in.
- View available documents/knowledge according to permissions.
- Ask questions.
- View generated answers.
- View citations.
- Create/view conversations.
- Continue previous conversations.

Users should not be able to modify system documents or prompts unless explicitly permitted by future requirements.

---

## 5.2 Admin

An administrator manages application knowledge.

Responsibilities may include:

- Upload documents.
- View uploaded documents.
- Process documents.
- Delete/manage documents.
- View document processing status.
- Create/update/manage prompts.
- Manage users within allowed administrative scope.
- Monitor basic system behavior.

---

## 5.3 Super Admin

The highest administrative role.

Responsibilities may include:

- Manage administrators.
- Manage users.
- Manage system-level settings.
- Manage global prompts.
- Configure available LLM providers.
- Configure embedding providers.
- Manage system-wide application configuration.
- Perform higher-level administrative operations.

Exact permissions will be implemented using role-based access control (RBAC).

---

# 6. High-Level System Architecture

```text
                         NNT RAG
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ↓                             ↓
      Next.js Frontend              Express Backend
      TypeScript                    Node.js + TypeScript
             │                             │
             │          REST API           │
             └─────────────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ↓                      ↓                      ↓
                  Auth              Document Management       Chat/RAG
                    │                      │                      │
                    │                      ↓                      ↓
                    │                Document Processing     LlamaIndex.TS
                    │                                             │
                    │                                             ↓
                    │                                    Retrieval / RAG
                    │                                             │
                    └──────────────────────┬──────────────────────┘
                                           │
                                           ↓
                                Supabase PostgreSQL
                                           │
                                  PostgreSQL + pgvector
                                           │
                         ┌─────────────────┴─────────────────┐
                         ↓                                   ↓
                    Relational Data                     Vector Data
                         │                                   │
                         ↓                                   ↓
                    Documents                         Document Embeddings
                    Users                              Chunk Embeddings
                    Prompts
                    Conversations
                    Messages

                                           │
                                           ↓
                                  LLM / Embedding Layer
                                           │
                     ┌─────────────────────┼─────────────────────┐
                     ↓                     ↓                     ↓
                  Gemini                 Groq             Local Llama/Ollama
```

---

# 7. Frontend Architecture

## 7.1 Technology

The frontend uses:

- Next.js
- React
- TypeScript
- App Router
- Tailwind CSS
- ESLint
- React Compiler

The frontend is an independent application from the backend.

Location:

```text
NNT_Rag/frontend/
```

---

# 8. Frontend Folder Structure

The following is the planned application structure.

```text
frontend/
│
├── public/
│
├── src/
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx
│   │   │
│   │   ├── chat/
│   │   │   └── page.tsx
│   │   │
│   │   ├── documents/
│   │   │   └── page.tsx
│   │   │
│   │   ├── admin/
│   │   │   └── ...
│   │   │
│   │   └── super-admin/
│   │       └── ...
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── chat/
│   │   ├── documents/
│   │   └── admin/
│   │
│   ├── lib/
│   │   ├── api/
│   │   ├── auth/
│   │   └── utils/
│   │
│   ├── hooks/
│   │
│   ├── types/
│   │
│   └── ...
│
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
└── AGENTS.md
```

This structure is an **application-level design**, not a claim that Next.js requires these exact folders.

Next.js provides the routing/application framework; our project determines how components, API clients, hooks, and other application code are organized.

---

# 9. Backend Architecture

## 9.1 Technology

The backend uses:

- Node.js
- TypeScript
- Express.js
- Zod
- LlamaIndex.TS
- Supabase PostgreSQL
- pgvector

The backend is an independent application.

Location:

```text
NNT_Rag/backend/
```

---

# 10. Backend Folder Structure

Planned structure:

```text
backend/
│
├── src/
│   │
│   ├── server.ts
│   │
│   ├── app.ts
│   │
│   ├── config/
│   │   ├── env.ts
│   │   └── ...
│   │
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── users.routes.ts
│   │   ├── documents.routes.ts
│   │   ├── prompts.routes.ts
│   │   ├── conversations.routes.ts
│   │   └── chat.routes.ts
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── documents.controller.ts
│   │   ├── prompts.controller.ts
│   │   ├── conversations.controller.ts
│   │   └── chat.controller.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── document.service.ts
│   │   ├── prompt.service.ts
│   │   ├── conversation.service.ts
│   │   └── rag.service.ts
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── role.middleware.ts
│   │   └── error.middleware.ts
│   │
│   ├── validators/
│   │   ├── auth.schema.ts
│   │   ├── document.schema.ts
│   │   ├── prompt.schema.ts
│   │   └── chat.schema.ts
│   │
│   ├── database/
│   │   ├── client.ts
│   │   └── ...
│   │
│   ├── rag/
│   │   ├── ingestion/
│   │   ├── retrieval/
│   │   ├── generation/
│   │   └── ...
│   │
│   ├── providers/
│   │   ├── llm/
│   │   │   ├── gemini.ts
│   │   │   ├── groq.ts
│   │   │   └── ollama.ts
│   │   │
│   │   └── embeddings/
│   │       ├── local.ts
│   │       └── api.ts
│   │
│   ├── types/
│   │
│   └── utils/
│
├── package.json
├── package-lock.json
└── tsconfig.json
```

This is our **planned application architecture**.

Express itself does not require this exact folder structure. The structure separates responsibilities so the application remains maintainable as it grows.

---

# 11. Backend Request Flow

The backend follows a general separation of responsibilities:

```text
HTTP Request
     ↓
Route
     ↓
Middleware
     ↓
Controller
     ↓
Service
     ↓
Database / RAG / Provider
     ↓
Controller
     ↓
HTTP Response
```

Example:

```text
POST /api/chat
       ↓
chat.routes.ts
       ↓
auth.middleware.ts
       ↓
chat.controller.ts
       ↓
rag.service.ts
       ↓
LlamaIndex.TS
       ↓
pgvector retrieval
       ↓
LLM
       ↓
Answer + citations
```

---

# 12. RAG Architecture

LlamaIndex.TS is the selected RAG framework.

The application should use LlamaIndex's RAG building blocks instead of unnecessarily implementing retrieval and indexing logic from scratch.

## 12.1 Document Ingestion

```text
Document Upload
      ↓
Validate File
      ↓
Store Original File
      ↓
Extract Text
      ↓
Create Document Nodes/Chunks
      ↓
Generate Embeddings
      ↓
Store Chunks + Embeddings
      ↓
Document READY
```

---

# 13. Document Processing

Initial supported formats:

```text
PDF
TXT
DOCX
```

The processing layer is responsible for:

- File validation.
- Text extraction.
- Metadata extraction where available.
- Chunking.
- Embedding generation.
- Vector storage.
- Processing status.

For difficult documents such as scanned PDFs, tables, forms, or complex layouts, specialized parsing technology may be evaluated later.

---

# 14. Document Storage

For Phase 1:

> **Local filesystem storage** will be used for original uploaded documents.

Conceptually:

```text
uploads/
├── document-1.pdf
├── document-2.txt
└── document-3.docx
```

The database stores document metadata and processing information.

Future versions may move original file storage to object storage such as Supabase Storage or another cloud storage provider.

---

# 15. Chunking

Documents will be divided into smaller chunks before embedding.

Conceptually:

```text
Document
    ↓
Text
    ↓
Chunks
    ↓
Embeddings
    ↓
Vector Database
```

Each chunk should retain useful metadata such as:

- Document ID.
- Chunk ID.
- Chunk index.
- Page number where applicable.
- Source information.
- Additional metadata.

Exact chunk size and overlap will be evaluated during RAG quality testing rather than permanently hardcoded as an architectural decision.

---

# 16. Embedding Architecture

The application will support two categories of embeddings.

## 16.1 Local Embeddings

A local embedding model such as a BGE-family or similar model may be used.

Advantages:

- No external API dependency.
- Greater control.
- Potentially lower recurring API cost.
- Data can remain local.

The exact model and vector dimension will be finalized before the production vector schema is created.

---

## 16.2 API Embeddings

An API-based embedding provider may also be supported.

Candidate:

- Gemini embeddings.

The embedding provider should be configurable rather than tightly coupled to the RAG implementation.

---

# 17. Vector Database

The selected vector storage solution is:

> **PostgreSQL + pgvector through Supabase**

The database provides both:

```text
Relational data
+
Vector similarity search
```

This avoids introducing a separate vector database during Phase 1.

---

# 18. Supabase Database

Supabase is being used as the hosted PostgreSQL database platform.

Current database setup:

```text
Supabase
   ↓
PostgreSQL
   ↓
pgvector extension
```

The `vector` PostgreSQL extension has been enabled.

Current verified pgvector version:

```text
0.8.2
```

The exact embedding vector dimension will be decided before creating the final `document_chunks.embedding` column.

---

# 19. Planned Database Schema

Initial planned entities:

```text
users
roles
documents
document_chunks
prompts
conversations
messages
```

## 19.1 Roles

Stores application roles and permissions.

Example roles:

```text
USER
ADMIN
SUPER_ADMIN
```

---

## 19.2 Users

Stores application user information.

Potential fields:

```text
id
name
email
password/auth reference
role_id
created_at
updated_at
```

Exact authentication implementation will be finalized during the authentication phase.

---

## 19.3 Documents

Stores uploaded document metadata.

Potential fields:

```text
id
filename
file_type
file_path
status
uploaded_by
created_at
updated_at
```

---

## 19.4 Document Chunks

Stores processed document chunks and their embeddings.

Potential fields:

```text
id
document_id
content
page_number
chunk_index
embedding
metadata
created_at
```

The exact vector dimension depends on the selected embedding model.

---

## 19.5 Prompts

Stores administrator-managed prompts.

Potential fields:

```text
id
name
content
type
status
created_by
created_at
updated_at
```

Prompt versioning may be introduced if required.

---

## 19.6 Conversations

Stores user conversations.

Potential fields:

```text
id
user_id
title
created_at
updated_at
```

---

## 19.7 Messages

Stores messages belonging to conversations.

Potential fields:

```text
id
conversation_id
role
content
citations
created_at
```

---

# 20. Prompt Management

Prompts are treated as application-managed data rather than hardcoded application behavior.

Authorized administrators can manage prompts.

Possible prompt categories include:

- System instructions.
- RAG answer instructions.
- Citation instructions.
- Role-specific prompts.
- Future specialized prompts.

The application should retrieve the appropriate prompt from the database/configuration layer when generating an answer.

---

# 21. LLM Architecture

The generation layer will support multiple providers.

## 21.1 Gemini

Cloud/API-based LLM provider.

Use cases:

- Answer generation.
- Potentially embeddings.
- Other AI functionality where appropriate.

---

## 21.2 Groq

Cloud/API-based provider.

Use cases:

- Fast LLM inference.
- Alternative generation provider.

---

## 21.3 Local Llama / Ollama

Local LLM option.

Use cases:

- Local development.
- Offline/private inference where supported.
- Reducing dependence on external APIs.

---

# 22. LLM Provider Abstraction

The application should not hardcode the entire RAG pipeline around one LLM provider.

Conceptually:

```text
RAG Service
    ↓
LLM Interface
    ↓
 ┌──────────┬──────────┬──────────┐
 ↓          ↓          ↓
Gemini     Groq     Ollama/Local
```

The selected provider should be configurable.

This allows changing the generator without rewriting the complete RAG pipeline.

---

# 23. Embedding Provider Abstraction

Embeddings should follow a similar abstraction:

```text
Embedding Service
       ↓
Embedding Provider
       ↓
 ┌──────────────┬──────────────┐
 ↓              ↓
Local Model     API Provider
                 ↓
               Gemini
```

The application should keep embedding-provider-specific logic isolated.

---

# 24. Chat Flow

The primary user flow is:

```text
User
 ↓
Question
 ↓
Backend API
 ↓
RAG Service
 ↓
Query Processing
 ↓
Retrieve Relevant Chunks
 ↓
Evidence Check
 ↓
Load Authorized Prompt
 ↓
Construct LLM Context
 ↓
Generate Answer
 ↓
Attach Citations
 ↓
Return Response
```

---

# 25. Evidence and Hallucination Control

The system should check whether retrieved information is sufficient before generating a confident answer.

If evidence is insufficient:

```text
Question
   ↓
Retrieval
   ↓
Insufficient Evidence
   ↓
Do NOT invent answer
   ↓
Return appropriate response
```

This is a core RAG quality requirement.

---

# 26. Citations

Answers should provide source information whenever possible.

Example conceptual response:

```text
Answer:
The document states that ...

Sources:
- Employee Handbook — Page 12
- HR Policy — Page 5
```

Citation format will depend on the final document-processing and retrieval implementation.

---

# 27. REST API

Frontend and backend communicate using REST APIs.

Initial API categories:

```text
/api/auth
/api/users
/api/documents
/api/prompts
/api/conversations
/api/chat
```

Examples:

```text
POST   /api/auth/login

GET    /api/documents
POST   /api/documents
GET    /api/documents/:id
DELETE /api/documents/:id

GET    /api/prompts
POST   /api/prompts
PUT    /api/prompts/:id

GET    /api/conversations
POST   /api/conversations

POST   /api/chat
```

The exact endpoints may change as implementation progresses.

---

# 28. API Validation

**Zod** will be used for request and data validation.

Conceptually:

```text
HTTP Request
     ↓
Zod Validation
     ↓
Valid?
   /   \
 YES    NO
 ↓       ↓
Service  Error Response
```

This provides runtime validation in addition to TypeScript's compile-time type checking.

---

# 29. Authentication and Authorization

The system will use role-based access control.

```text
User
 ↓
Authentication
 ↓
Authenticated User
 ↓
Role
 ├── USER
 ├── ADMIN
 └── SUPER_ADMIN
```

Authorization should happen on the backend.

The frontend should not be considered the security boundary.

Example:

```text
POST /api/documents
        ↓
Authenticate
        ↓
Check role
        ↓
ADMIN / SUPER_ADMIN?
      /       \
    YES        NO
     ↓         ↓
Upload       Reject
```

The exact authentication provider/implementation will be selected during the authentication phase.

---

# 30. Configuration and Environment Variables

Secrets must not be hardcoded into source code.

Examples of future environment variables:

```text
DATABASE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

GEMINI_API_KEY
GROQ_API_KEY

LLM_PROVIDER
EMBEDDING_PROVIDER
```

Actual variable names will be finalized during implementation.

Environment files containing secrets must not be committed to Git.

---

# 31. Frontend ↔ Backend Communication

The frontend will communicate with the backend through HTTP REST APIs.

```text
Next.js
   │
   │ HTTP/JSON
   ↓
Express API
   │
   ↓
Application Services
```

The frontend should not directly access the backend database for protected application operations.

---

# 32. Technology Stack

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
ESLint
React Compiler
```

## Backend

```text
Node.js
Express.js
TypeScript
Zod
```

## RAG

```text
LlamaIndex.TS
```

## Database

```text
Supabase
PostgreSQL
pgvector
```

## Document Processing

```text
PDF
TXT
DOCX
```

Parser/processing technology will be selected based on document complexity.

## LLM Providers

```text
Gemini
Groq
Local Llama / Ollama
```

## Embedding Providers

```text
Local BGE or similar embedding model
Gemini/API embedding provider
```

## Storage

Phase 1:

```text
Local filesystem
```

Future:

```text
Object/cloud storage if required
```

---

# 33. Development Architecture

Frontend and backend are intentionally maintained as separate applications.

```text
NNT_Rag/
│
├── frontend/
│   ├── package.json
│   ├── node_modules/
│   └── src/
│
├── backend/
│   ├── package.json
│   ├── node_modules/
│   └── src/
│
└── PROJECT_BLUEPRINT.md
```

There is currently no requirement for an npm workspace or monorepo configuration.

---

# 34. Development Principles

The project should follow these principles:

## 34.1 Keep Responsibilities Separate

Frontend:

> UI and user interaction.

Backend:

> API, authentication, business logic, RAG orchestration.

Database:

> Persistent application and vector data.

LlamaIndex:

> RAG framework functionality.

LLM providers:

> Generation/inference.

---

## 34.2 Avoid Unnecessary Complexity

Do not introduce infrastructure simply because it is common in large systems.

Every additional technology should have a clear reason.

---

## 34.3 Prefer Framework Capabilities

Use established capabilities of:

- Next.js
- Express
- LlamaIndex.TS
- PostgreSQL
- pgvector
- Supabase

before implementing custom replacements.

---

## 34.4 Keep Providers Replaceable

LLM and embedding providers should be abstracted sufficiently that changing providers does not require rewriting the complete application.

---

## 34.5 Backend Is the Security Boundary

Authorization, role checking, document access, prompt access, and protected operations must be enforced on the backend.

---

# 35. Current Project State

## Completed

### Frontend

Next.js application initialized with:

```text
TypeScript: Yes
ESLint: Yes
React Compiler: Yes
Tailwind CSS: Yes
src directory: Yes
App Router: Yes
Default @/* alias: Yes
AGENTS.md: Yes
```

### Backend

Node/Express/TypeScript application initialized.

Installed:

```text
express
typescript
tsx
@types/node
@types/express
```

Backend TypeScript configuration is working.

A basic Express server has been created and tested successfully.

Current server test:

```text
http://localhost:3000
```

returns:

```json
{
  "message": "NNT RAG Backend is running"
}
```

### Database

Supabase project created.

PostgreSQL database is accessible through pgAdmin.

pgvector extension is enabled and verified.

Current pgvector version:

```text
0.8.2
```

---

# 36. Current Development Stage

Current stage:

```text
Foundation Setup
       ↓
Frontend initialized       ✓
Backend initialized        ✓
Express tested             ✓
Supabase configured        ✓
pgvector enabled           ✓
       ↓
Backend architecture       ← CURRENT
       ↓
Database schema
       ↓
Authentication
       ↓
Document management
       ↓
Document processing
       ↓
Embedding + vector storage
       ↓
RAG retrieval
       ↓
LLM generation
       ↓
Chat
       ↓
Frontend integration
       ↓
Testing / evaluation
       ↓
Deployment
```

---

# 37. Evaluation and RAG Quality

RAG quality should not be judged only by whether the application runs.

A small evaluation dataset should eventually be created containing:

```text
Question
Expected answer
Expected source document
Expected page/chunk
```

Evaluation should consider:

- Retrieval quality.
- Answer correctness.
- Citation correctness.
- Evidence sufficiency.
- Hallucination rate.
- Response latency.
- Provider differences.

The exact evaluation framework will be selected later.

---

# 38. Future Improvements

Potential future features:

- Cloud object storage.
- Advanced document parsing.
- OCR/scanned-document support.
- Hybrid retrieval.
- Reranking.
- Query rewriting.
- Conversation-aware retrieval.
- Prompt versioning.
- Advanced permissions.
- Multi-tenant architecture.
- Background document processing.
- Job queues.
- Redis/caching.
- Advanced monitoring.
- RAG evaluation dashboards.
- Streaming responses.
- Enterprise authentication.
- Production deployment infrastructure.

These are **future possibilities**, not Phase 1 requirements.

---

# 39. Important Architecture Decisions

| Decision         | Current Choice                     | Reason                                          |
| ---------------- | ---------------------------------- | ----------------------------------------------- |
| Frontend         | Next.js + TypeScript               | Modern React application framework              |
| Backend          | Node.js + Express + TypeScript     | Lightweight REST API backend                    |
| RAG Framework    | LlamaIndex.TS                      | Dedicated RAG framework                         |
| Database         | Supabase PostgreSQL                | Hosted relational database                      |
| Vector Search    | pgvector                           | Vector search inside PostgreSQL                 |
| File Storage     | Local filesystem                   | Simple Phase 1 implementation                   |
| API Style        | REST + JSON                        | Simple frontend/backend separation              |
| Validation       | Zod                                | Runtime request validation                      |
| LLMs             | Gemini + Groq + Local Llama/Ollama | Provider flexibility                            |
| Embeddings       | Local + API                        | Provider flexibility                            |
| Documents        | PDF + TXT + DOCX                   | Initial document coverage                       |
| Frontend/Backend | Separate applications              | Clear responsibility separation                 |
| Architecture     | Modular application                | Maintainability without premature microservices |

---

# 40. Architecture Decision Log

Important changes should be recorded here.

Format:

```text
Date:
Decision:
Reason:
Impact:
```

Example:

```text
Date: 2026-10-05

Decision:
Use Supabase PostgreSQL + pgvector instead of a separate vector database.

Reason:
Phase 1 requires both relational and vector data, and PostgreSQL can handle both.

Impact:
No separate vector database is required initially.
```

---

# 41. Rules for Future Development

Before introducing a new technology, ask:

1. What problem does it solve?
2. Is the problem already solved by our existing stack?
3. Does it add unnecessary complexity?
4. Does it fit the current architecture?
5. Is it required for Phase 1?
6. Can we postpone it?

Before changing an existing architecture decision:

1. Update this blueprint.
2. Record the reason in the decision log.
3. Check which existing components are affected.
4. Update implementation accordingly.

---

# 42. Source of Truth

This document is the primary project-level reference for:

- Product scope.
- Architecture.
- Technology decisions.
- Folder structure.
- Roles.
- RAG behavior.
- Database direction.
- LLM/embedding strategy.
- Development principles.

If implementation and this document disagree, the discrepancy should be reviewed rather than silently ignoring the document.

The blueprint should be updated whenever an important architectural decision changes.

---

# 43. Phase 1 Final Target

At the end of Phase 1, the expected system should support:

```text
                    NNT RAG
                       │
                       ↓
                  User Login
                       │
                       ↓
                  Chat Interface
                       │
                       ↓
                Ask a Question
                       │
                       ↓
                 Backend API
                       │
                       ↓
                 RAG Pipeline
                       │
              ┌────────┴────────┐
              ↓                 ↓
          Retrieval         Prompt Load
              │                 │
              └────────┬────────┘
                       ↓
                 Evidence Check
                       │
                       ↓
                    LLM
                       │
                       ↓
             Answer + Citations
                       │
                       ↓
                    User
```

Administrators should be able to:

```text
Login
  ↓
Upload Document
  ↓
Process Document
  ↓
Document Ready
  ↓
Manage Prompts
```

The complete system should therefore provide a functional foundation for a production-oriented document Q&A RAG application while keeping the architecture simple enough to evolve.

---

# 44. Current Principle

> **Build a clean, modular Phase 1 system first. Do not add infrastructure or complexity until the actual requirement justifies it.**

The project should prioritize:

```text
Correctness
    ↓
Maintainability
    ↓
RAG Quality
    ↓
Security
    ↓
Observability
    ↓
Scalability
```

rather than prematurely optimizing for large-scale infrastructure.

---

# End of Project Blueprint
