# n8n AI Workflow Builder (MVP)

> **"From natural language to validated n8n automations with fewer AI calls, zero node hallucinations, and deterministic safety checks."**

An AI-powered web application that converts natural-language automation requests into structured, canonical n8n workflow blueprints, validated import-ready n8n workflow JSON files, and optimized copy-paste AI prompts.

---

## Table of Contents

1. [Project Overview & Purpose](#1-project-overview--purpose)
2. [Feature Status Matrix](#2-feature-status-matrix)
3. [Architecture Overview & Mermaid Flowchart](#3-architecture-overview--mermaid-flowchart)
4. [Technology Stack](#4-technology-stack)
5. [Repository Structure](#5-repository-structure)
6. [End-to-End Request Lifecycle](#6-end-to-end-request-lifecycle)
7. [API Endpoints & Contracts](#7-api-endpoints--contracts)
8. [Node Registry Design & Supported Coverage](#8-node-registry-design--supported-coverage)
9. [AI Provider Architecture & Mock Engine](#9-ai-provider-architecture--mock-engine)
10. [Google Gemini Integration Configuration](#10-google-gemini-integration-configuration)
11. [Database Design & SQLite Persistence](#11-database-design--sqlite-persistence)
12. [Validation Engine & Rules](#12-validation-engine--rules)
13. [Workflow JSON Export & Manual n8n Import Guide](#13-workflow-json-export--manual-n8n-import-guide)
14. [Prerequisites & Setup Commands (Windows & Mac/Linux)](#14-prerequisites--setup-commands-windows--maclinux)
15. [Environment Variables](#15-environment-variables)
16. [Starting the Local Development Server](#16-starting-the-local-development-server)
17. [Running Tests, Linting & Production Build](#17-running-tests-linting--production-build)
18. [Test Coverage & Audit Verification Results](#18-test-coverage--audit-verification-results)
19. [Security, Credential Handling & Privacy Limitations](#19-security-credential-handling--privacy-limitations)
20. [Known Limitations, Unverified Behaviors & Roadmap](#20-known-limitations-unverified-behaviors--roadmap)
21. [Troubleshooting Common Issues](#21-troubleshooting-common-issues)

---

## 1. Project Overview & Purpose

Building workflows in n8n from natural language using generic AI models often leads to:
1. **Hallucinated Node Types & Versions**: LLMs frequently invent node names or mix incompatible version schemas.
2. **Broken Connections**: AI models struggle with n8n's multi-output index indexing (e.g. IF and Switch nodes) and sub-node attachments (e.g., LangChain model connections via `ai_languageModel`).
3. **Silent Trigger Degradation**: Replacing specific triggers (like `gmailTrigger`) with generic webhooks without user knowledge.
4. **Security Risks**: LLMs hallucinating real or dummy API keys directly inside workflow parameters.
5. **False Execution Certainty**: Presenting unverified JSON as guaranteed to work without testing runtime constraints.

**The Solution:**
The **n8n AI Workflow Builder** implements a **two-phase deterministic pipeline**:
- **Phase 1: Intent Analysis & Clarification**: Translates natural language into a structured requirement schema, identifying missing parameters (e.g. Slack channels, schedule intervals) before building.
- **Phase 2: Canonical Blueprint Generation & Deterministic Validation**: Generates a canonical workflow blueprint strictly constrained by a verified n8n node registry. It then deterministically compiles both the official n8n workflow `.json` and an optimized prompt from the **exact same approved blueprint**.

---

## 2. Feature Status Matrix

| Feature | Status | Verification Type | Notes |
| :--- | :--- | :--- | :--- |
| **Local Mock AI Mode ($0 Spend)** | ✅ Implemented | Integration Tested | 100% offline, deterministic parsing, $0 spend guaranteed. |
| **Natural Language Requirement Parsing** | ✅ Implemented | Integration Tested | Extracts triggers, tasks, integrations, and clarifies ambiguities. |
| **Ambiguity Clarification Prompts** | ✅ Implemented | Unit Tested | Prompts user when schedule interval or channels are ambiguous. |
| **Verified n8n Node Registry** | ✅ Implemented | Unit Tested | 15 foundational nodes cross-referenced with official n8n v1.70.0. |
| **Canonical Blueprint Generation** | ✅ Implemented | Integration Tested | Compiles Zod-validated canonical representation. |
| **Deterministic Optimizer** | ✅ Implemented | Unit Tested | Links AI model sub-nodes, enables error handling (`continueOnFail`). |
| **Dual Output Alignment** | ✅ Implemented | Integration Tested | Exported JSON and Optimized Prompt derived from identical blueprint. |
| **Exportable n8n v1 Workflow JSON** | ✅ Implemented | Statically Validated | Valid JSON with nodes, connections, coordinates, and pins. |
| **Manual Review & Urgency Branching** | ✅ Implemented | Regression Tested | Full 9-node triage pipeline with 3-way branching verified. |
| **Secret Leak Scanner** | ✅ Implemented | Unit Tested | Regex checks for OpenAI, Slack, Google API keys & passwords. |
| **SQLite Workflow Persistence** | ✅ Implemented | Integration Tested | Save, list, retrieve, and delete via local `better-sqlite3`. |
| **Dark n8n-Inspired Dashboard UI** | ✅ Implemented | Manually Verified | Canvas grid, inspector drawer, category badges, tabs. |
| **Curated Starter Templates** | ✅ Implemented | Integration Tested | 4 verified automation templates available via modal. |
| **Google Gemini Integration** | 🟡 Partially Implemented | Statically Validated | Code implemented via `@google/genai`; unverified with live API keys. |
| **Live n8n Runtime Execution** | ❌ Planned / Out of Scope | Not Implemented | Workflows must be manually imported into an n8n instance. |
| **OAuth Credential Validation** | ❌ Planned / Out of Scope | Not Implemented | Real authentication occurs within n8n credential store. |

---

## 3. Architecture Overview & Mermaid Flowchart

The system follows a strict pipeline where no workflow JSON is emitted without first passing through the Canonical Blueprint, Optimizer, and Validator:

```mermaid
flowchart TD
    A[User Natural Language Prompt] --> B[/api/analyze]
    B --> C{AI Provider}
    C -->|Mock Mode| D[Deterministic Mock Engine]
    C -->|Gemini Mode| E[Google Gemini 2.5 Flash]
    D --> F[Requirement Specification Schema]
    E --> F
    F -->|Clarifications Needed| G[User Interactive Clarification Form]
    G --> F
    F --> H[/api/blueprint]
    H --> I[Candidate Workflow Blueprint]
    I --> J[Deterministic Optimizer]
    J --> K[Approved Canonical Blueprint]
    K --> L[Deterministic Validator]
    L -->|Checks Against| M[(Verified Node Registry)]
    L --> N{Validation Passed?}
    N -->|Errors Found| O[Structured Validation Report with Corrections]
    N -->|Passed| P[Dual Generator Pipeline]
    P --> Q[generateN8nWorkflowJson]
    P --> R[generateOptimizedN8nPrompt]
    Q --> S[Downloadable n8n v1 JSON]
    R --> T[Copyable AI Prompt]
    S --> U[Visual Canvas & JSON Inspector]
    T --> U
    U --> V[/api/history SQLite Persistence]
```

---

## 4. Technology Stack

### Frontend
- **Framework**: Next.js 16.4.3 (Turbopack, App Router)
- **Library**: React 19.0.0
- **Language**: TypeScript 5.8
- **Styling**: Vanilla CSS Modules & Tokens (`globals.css`) adhering to a dark glassmorphic n8n-inspired theme (no heavy CSS utility overhead).
- **Icons**: Lucide React (`lucide-react`)

### Backend & Persistence
- **Runtime**: Node.js v20+
- **API Routes**: Next.js Server Route Handlers (`app/api/*`)
- **Schema Validation**: Zod (`zod` v3.24) as the single source of truth for all runtime boundaries.
- **Database**: SQLite via `better-sqlite3` v11.8 for zero-configuration, zero-latency local storage.

### AI Integration
- **Deterministic Mock Provider**: Built-in zero-cost simulator for testability and offline development.
- **Live Provider**: Official Google Gen AI SDK (`@google/genai` v0.1.2) for Gemini 2.5 Flash integration.

### Testing & Tooling
- **Test Runner**: Node.js Native Test Runner (`node:test` + `node:assert/strict`) via `tsx`
- **Linting**: ESLint v9 with Next.js Core Web Vitals configuration

---

## 5. Repository Structure

```text
metro hackathon/
├── data/
│   └── workflows.db                 # Local SQLite database (created automatically on startup)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/
│   │   │   │   └── route.ts         # Requirement extraction & ambiguity analysis
│   │   │   ├── blueprint/
│   │   │   │   └── route.ts         # Blueprint optimization, validation & export
│   │   │   ├── history/
│   │   │   │   └── route.ts         # SQLite CRUD persistence (GET, POST, DELETE)
│   │   │   └── templates/
│   │   │       └── route.ts         # Curated starter automation templates
│   │   ├── favicon.ico
│   │   ├── globals.css              # Dark theme tokens, canvas dot grid & scrollbars
│   │   ├── layout.tsx               # Root HTML shell with font configuration
│   │   └── page.tsx                 # Main application dashboard shell
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── NodeInspector.tsx    # Slide-out drawer showing node details & parameters
│   │   │   └── WorkflowCanvas.tsx   # Interactive SVG node graph with bezier connections
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx          # Prompt input, provider selector & token stats
│   │   │   └── TopBar.tsx           # Global navigation, badges & modal triggers
│   │   └── modals/
│   │       ├── HelpModal.tsx        # Workflow builder guide & limitations explanation
│   │       ├── RegistryModal.tsx    # Searchable catalog of 15 verified n8n nodes
│   │       ├── SavedWorkflowsModal.tsx # Workflow library manager (load & delete)
│   │       └── TemplatesModal.tsx   # Starter templates gallery
│   └── lib/
│       ├── ai/
│       │   ├── factory.ts           # Provider selector (defaults to Mock in tests)
│       │   ├── gemini-provider.ts   # Google Gemini implementation with token counters
│       │   ├── mock-provider.ts     # Deterministic mock engine with 9-node triage pipeline
│       │   └── types.ts             # AiProvider interface & AiUsageMetrics
│       ├── db/
│       │   ├── repository.ts        # Storage interface definition & SavedWorkflowRecord
│       │   └── sqlite.ts            # better-sqlite3 repository implementation
│       ├── n8n/
│       │   ├── generator.ts         # Converts Canonical Blueprint to official n8n v1 JSON
│       │   ├── optimizer.ts         # Auto-wires AI models, positions & error handling
│       │   ├── prompt-generator.ts  # Compiles copy-paste prompt from approved blueprint
│       │   ├── registry-sources.md  # Documentation of n8n GitHub source references
│       │   ├── registry.ts          # Catalog of 15 verified n8n nodes & parameter rules
│       │   └── validator.ts         # Deterministic structural validator & secret scanner
│       ├── schemas/
│       │   ├── blueprint.ts         # Zod schema for canonical workflow blueprint
│       │   ├── node-registry.ts     # Zod schema for verified node specifications
│       │   ├── requirement.ts       # Zod schema for user requirement specification
│       │   └── validation.ts        # Zod schema for structured validation reports
│       └── templates/
│           └── starter-templates.ts # Curated pre-built workflows (Triage, Sheets, etc.)
├── tests/
│   ├── blueprint-schemas.test.ts    # Zod schema boundary tests for blueprints
│   ├── generator.test.ts            # Verification of exported JSON structure & prompts
│   ├── mock-provider.test.ts        # Tests for deterministic mock responses ($0 spend)
│   ├── persistence.test.ts          # SQLite save, list, and delete tests
│   ├── pipeline.test.ts             # End-to-end integration test (prompt -> JSON)
│   ├── registry.test.ts             # Node registry lookup and parameter rule tests
│   ├── requirement-schemas.test.ts  # Requirement specification schema tests
│   ├── sample-regression.test.ts    # 9-node Gmail Customer Support regression test suite
│   ├── validation-schemas.test.ts   # Validation report schema tests
│   └── validator.test.ts            # Deterministic error detection & secret leak scanner
├── .env.example                     # Sample environment file
├── eslint.config.mjs                # ESLint configuration
├── next.config.ts                   # Next.js configuration
├── package.json                     # Project dependencies and script declarations
├── README.md                        # Comprehensive documentation (this file)
└── tsconfig.json                    # TypeScript compiler configuration
```

---

## 6. End-to-End Request Lifecycle

```text
[User Natural Language Prompt]
       │
       ▼
1. /api/analyze (POST)
   - Evaluates user goal against integration catalog.
   - Extracts trigger (e.g. email, webhook, schedule), processing steps, integrations.
   - Generates clarification questions if required details are ambiguous.
       │
       ▼
2. Requirement Specification (Validated via RequirementSpecificationSchema)
   - If clarifications are required, user can answer them in the UI.
       │
       ▼
3. /api/blueprint (POST)
   - Calls AiProvider.generateBlueprint() to synthesize candidate nodes and connections.
   - Constrained to node types registered in the Verified Registry.
       │
       ▼
4. Deterministic Workflow Optimization (optimizeWorkflowBlueprint)
   - Auto-attaches AI Chat Model sub-nodes to Agent nodes (`ai_languageModel` input).
   - Injects error handling policies (`continueOnFail: true` on AI Agent).
   - Computes clean 2D layout coordinates for canvas display.
       │
       ▼
5. Deterministic Validation (validateWorkflowBlueprint)
   - Validates node types against verified registry.
   - Validates node version against known bounds.
   - Checks presence of required parameters.
   - Checks connection target and source node existence.
   - Checks output index limits (e.g., If node has output 0 and 1).
   - Scans parameter values for raw credentials, secrets, and API tokens.
   - Flags trigger substitutions (e.g. Webhook replacing Gmail trigger).
   - Populates explicit `checksNotPerformed` list to prevent false certainty.
       │
       ▼
6. Dual Output Generation
   - `generateN8nWorkflowJson`: Emits official n8n v1 export format with pinData and connections.
   - `generateOptimizedN8nPrompt`: Emits structured Markdown instructions using the SAME blueprint.
       │
       ▼
7. Local Persistence (POST /api/history)
   - Saves record (Blueprint, JSON, Prompt, Validation Report) to local SQLite.
```

---

## 7. API Endpoints & Contracts

### `POST /api/analyze`
Analyzes natural language instructions and extracts requirements and clarifying questions.

- **Request Body**:
  ```json
  {
    "prompt": "When a new customer email arrives, classify sentiment and urgency, then notify the support team in Slack.",
    "provider": "mock"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "requirement": {
      "title": "Customer Support Email Classifier & Alert",
      "userGoal": "...",
      "triggerType": "email",
      "triggerDetails": { "sourceApp": "Gmail" },
      "dataProcessingSteps": ["..."],
      "hasAiAgent": true,
      "aiAgentTask": "...",
      "integrations": ["gmail", "slack"],
      "clarifications": [
        {
          "id": "q_slack_channel",
          "question": "Which Slack channel should receive the notification message?",
          "options": ["#alerts", "#notifications", "#general"],
          "defaultAnswer": "#alerts",
          "isEssential": false
        }
      ],
      "confidenceScore": 0.95
    },
    "metrics": {
      "modelName": "mock-deterministic-engine",
      "promptTokens": 83,
      "completionTokens": 287,
      "totalTokens": 370,
      "estimatedCostUsd": 0,
      "aiCallsCount": 1,
      "isMock": true
    }
  }
  ```

---

### `POST /api/blueprint`
Generates the canonical blueprint, optimizes it, validates it, and produces dual outputs.

- **Request Body**:
  ```json
  {
    "requirement": { ... },
    "targetN8nVersion": "1.70.0",
    "provider": "mock"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "blueprint": {
      "id": "bp_...",
      "name": "Customer Support Email Classifier & Alert",
      "nodes": [ ... ],
      "connections": [ ... ],
      "targetN8nVersion": "1.70.0"
    },
    "optimization": {
      "appliedRules": ["Connect language model to AI agent", "Enable continueOnFail"],
      "optimizedBlueprint": { ... }
    },
    "validationReport": {
      "valid": true,
      "targetN8nVersion": "1.70.0",
      "errors": [],
      "warnings": [],
      "infos": [],
      "checksNotPerformed": [
        "Live execution inside an active n8n instance",
        "Real-time credential authentication verification",
        "External API endpoint reachability and network latency",
        "Dynamic runtime data payload validation"
      ],
      "timestamp": "2026-10-24T06:00:00.000Z"
    },
    "workflowJson": {
      "name": "Customer Support Email Classifier & Alert",
      "nodes": [ ... ],
      "connections": { ... },
      "pinData": {},
      "settings": { "executionOrder": "v1" }
    },
    "generatedPrompt": "# n8n Workflow Implementation Guide\n...",
    "metrics": { ... }
  }
  ```

---

### `GET /api/history`
Returns up to 50 saved workflows from the local SQLite database.

- **Response (200 OK)**:
  ```json
  {
    "workflows": [
      {
        "id": "bp_1792827163607",
        "name": "Customer Support Email Classifier & Alert",
        "userPrompt": "...",
        "targetN8nVersion": "1.70.0",
        "createdAt": "2026-10-24T06:00:00.000Z"
      }
    ]
  }
  ```

---

### `POST /api/history`
Saves a workflow record into local SQLite.

- **Request Body**:
  ```json
  {
    "id": "bp_123456",
    "name": "My Automation",
    "userPrompt": "...",
    "targetN8nVersion": "1.70.0",
    "blueprint": { ... },
    "workflowJson": { ... },
    "generatedPrompt": "...",
    "validationReport": { ... },
    "createdAt": "2026-10-24T06:00:00.000Z"
  }
  ```
- **Response (200 OK)**: `{ "success": true }`

---

### `DELETE /api/history?id=<id>`
Deletes a saved workflow from local SQLite by its ID.

- **Query Param**: `id=string`
- **Response (200 OK)**: `{ "success": true }`

---

### `GET /api/templates`
Retrieves curated starter automation templates.

- **Response (200 OK)**:
  ```json
  {
    "templates": [
      {
        "id": "tpl_email_classifier",
        "name": "Customer Support Email Classifier",
        "description": "...",
        "category": "Customer Support",
        "prompt": "...",
        "tags": ["Gmail", "Gemini", "Slack", "AI Agent"]
      }
    ]
  }
  ```

---

## 8. Node Registry Design & Supported Coverage

All nodes used in generated blueprints must be explicitly defined in `src/lib/n8n/registry.ts`. The builder rejects any unlisted node type to prevent hallucinated configurations.

### Supported Baseline
- **Target n8n Version**: `1.70.0`
- **Catalog Size**: 15 verified node definitions

### Verified Node Catalog

| Node Identifier | Display Name | Category | Tested Versions | Required Parameters Checked |
| :--- | :--- | :--- | :--- | :--- |
| `n8n-nodes-base.webhook` | Webhook | trigger | 1.0 – 2.0 | `httpMethod`, `path` |
| `n8n-nodes-base.scheduleTrigger` | Schedule Trigger | trigger | 1.0 – 1.2 | `rule` |
| `n8n-nodes-base.gmailTrigger` | Gmail Trigger | trigger | 1.0 – 1.1 | `pollTimes` |
| `n8n-nodes-base.googleSheetsTrigger` | Google Sheets Trigger | trigger | 1.0 | `documentId`, `sheetName` |
| `n8n-nodes-base.if` | If Condition | logic | 1.0 – 2.2 | `conditions` |
| `n8n-nodes-base.switch` | Switch Router | logic | 1.0 – 3.2 | `rules` |
| `n8n-nodes-base.set` | Edit Fields (Set) | transform | 1.0 – 3.4 | `fields` |
| `n8n-nodes-base.code` | Code (JavaScript/Python) | transform | 1.0 – 2.0 | `jsCode` |
| `n8n-nodes-base.httpRequest` | HTTP Request | network | 1.0 – 4.2 | `url`, `method` |
| `n8n-nodes-base.slack` | Slack | output | 1.0 – 2.2 | `operation`, `channel` |
| `n8n-nodes-base.gmail` | Gmail | output | 1.0 – 2.1 | `operation`, `resource` |
| `n8n-nodes-base.googleSheets` | Google Sheets | transform | 1.0 – 4.5 | `operation`, `documentId` |
| `@n8n/n8n-nodes-langchain.agent` | AI Agent | ai | 1.0 – 1.7 | `text`, `options` |
| `@n8n/n8n-nodes-langchain.lmChatGoogleGemini` | Google Gemini Chat Model | ai | 1.0 | `modelName` |
| `@n8n/n8n-nodes-langchain.lmChatOpenAi` | OpenAI Chat Model | ai | 1.0 – 1.2 | `model` |

### Source References
Node specifications and connection conventions are cross-referenced directly from the official open-source n8n repositories:
- [n8n-io/n8n (packages/nodes-base)](https://github.com/n8n-io/n8n/tree/master/packages/nodes-base)
- [@n8n/n8n-nodes-langchain](https://github.com/n8n-io/n8n/tree/master/packages/%40n8n/nodes-langchain)

---

## 9. AI Provider Architecture & Resilient Multi-Tier Fallback

The application isolates AI generation behind a unified interface (`AiProvider` in `src/lib/ai/types.ts`):

```typescript
export interface AiProvider {
  analyzeRequirement(prompt: string, options?: AiGenerationOptions): Promise<{
    requirement: RequirementSpecification;
    metrics: AiUsageMetrics;
  }>;
  generateBlueprint(
    requirement: RequirementSpecification,
    options?: AiGenerationOptions
  ): Promise<{
    blueprint: WorkflowBlueprint;
    metrics: AiUsageMetrics;
  }>;
}
```

### Resilient Multi-Tier Fallback (`src/lib/ai/fallback-provider.ts`)
To guarantee 100% demo uptime and eliminate single points of failure during hackathon demonstrations:
1. **Tier 1 — OpenAI (GPT-4o-mini)**: If `OPENAI_API_KEY` is configured, requests are sent via structured JSON mode to OpenAI for live generation.
2. **Tier 2 — Google Gemini (Gemini 2.5 Flash)**: If OpenAI fails, rate-limits (HTTP 429), or exhausts quota, the system automatically cascades to Gemini (if `GEMINI_API_KEY` is configured).
3. **Tier 3 — Deterministic Local Mock Engine**: If both cloud providers fail, are unconfigured, or encounter network timeouts, the engine immediately cascades to the local deterministic engine. **The demo will never crash or throw an unhandled 500 error.**

### Deterministic Mock Engine (`src/lib/ai/mock-provider.ts`)
- **Default Mode**: Used automatically when no API keys are provided, and strictly enforced during automated tests (`npm test`).
- **$0 Spend Guarantee**: Requires zero API keys, makes no external network calls, and reports `estimatedCostUsd: 0`.
- **Deterministic Routing**: Contains verified pattern matchers for email triage, schedule health checks, Google Sheets, and webhook dispatchers.
- **Gmail Support Triage Pipeline**: Implements the complete 9-node workflow:
  1. `Gmail Trigger` (`n8n-nodes-base.gmailTrigger`)
  2. `Format Input Data` (`n8n-nodes-base.set`)
  3. `AI Agent Classifier` (`@n8n/n8n-nodes-langchain.agent`)
  4. `Google Gemini Model` (`@n8n/n8n-nodes-langchain.lmChatGoogleGemini`)
  5. `Check If Classification Valid` (`n8n-nodes-base.if`)
  6. `Check If High or Critical Urgency` (`n8n-nodes-base.if`)
  7. `Alert Manual Review Team` (`n8n-nodes-base.slack`)
  8. `High Priority Slack Alert` (`n8n-nodes-base.slack`)
  9. `Normal Priority Slack Notification` (`n8n-nodes-base.slack`)

---

## 10. OpenAI & Google Gemini Configuration

### Setup Instructions for Live AI
1. Open or create `.env.local` in the project root:
   ```bash
   cp .env.example .env.local
   ```
2. Add your OpenAI API key (and optionally your Gemini API key for dual-cloud fallback):
   ```env
   # OpenAI Key for live generation (Recommended for Hackathon)
   OPENAI_API_KEY=sk-proj-your_actual_key_here
   OPENAI_MODEL=gpt-4o-mini

   # Optional: Google Gemini key for multi-tier backup
   GEMINI_API_KEY=your_gemini_key_here
   ```
3. The Next.js dev server automatically reloads `.env.local`.
4. In the UI TopBar or prompt header, select **"OpenAI (GPT-4o-mini + Resilient Fallback)"** from the provider dropdown.

> [!NOTE]
> During automated testing (`npm test`), the application strictly forces **Local Mock Mode** ($0 spend). No external API calls are ever made during test execution.

---

## 11. Database Design & SQLite Persistence

The application uses an embedded **SQLite** database via `better-sqlite3`. No external database server (PostgreSQL, MySQL, Redis) is required.

### Database File Location
The database is initialized automatically at:
```text
data/workflows.db
```
*(In unit tests, an in-memory database `:memory:` is used to ensure complete test isolation.)*

### Schema Definition
```sql
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_prompt TEXT NOT NULL,
  target_version TEXT NOT NULL,
  blueprint_json TEXT NOT NULL,
  workflow_json TEXT NOT NULL,
  generated_prompt TEXT NOT NULL,
  validation_report_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### Persistence Features
- **Zero Migration Hassle**: Handled via `CREATE TABLE IF NOT EXISTS` at initialization.
- **Full History**: Saves the user prompt, canonical blueprint, validated workflow JSON, generated prompt, and validation report.
- **Repository Pattern**: `SqliteWorkflowRepository` implements the abstract `WorkflowRepository` interface (`saveWorkflow`, `listWorkflows`, `getWorkflowById`, `deleteWorkflow`).

---

## 12. Validation Engine & Rules

The validator (`src/lib/n8n/validator.ts`) performs static structural checks without invoking live n8n runtime engines.

### Validation Rule Checks

| Error Code | Severity | Description |
| :--- | :--- | :--- |
| `UNKNOWN_NODE_TYPE` | 🔴 Error | Node type does not exist in the verified registry. |
| `UNSUPPORTED_NODE_VERSION` | 🔴 Error | Node version is outside the minimum/maximum supported range. |
| `MISSING_REQUIRED_PARAMETER` | 🔴 Error | Node is missing one or more required parameters defined in registry. |
| `BROKEN_CONNECTION_TARGET` | 🔴 Error | Connection references a source or target node ID that does not exist. |
| `INVALID_OUTPUT_INDEX` | 🔴 Error | Connection specifies an output index exceeding the node's output count. |
| `CREDENTIAL_LEAK_DETECTED` | 🔴 Error | Parameter contains raw API keys (`sk-...`, `xoxb-...`, `AIza...`) or passwords. |
| `SUBSTITUTED_TRIGGER_DETECTED` | 🔴 Error | Requested trigger (e.g. Gmail) was replaced with a generic Webhook. |
| `OMITTED_CONDITIONAL_BRANCH` | 🔴 Error | User requested priority/urgency routing, but condition branches are missing. |
| `UNVERIFIED_N8N_VERSION` | 🟡 Warning | Target n8n version differs from the registry baseline (1.70.0). |
| `SUB_NODE_NOT_ATTACHED` | 🟡 Warning | AI model or memory sub-node is not connected to an AI Agent. |

### Explicit Limitations (`checksNotPerformed`)
Every validation report includes an explicit list of checks **not performed**:
1. Live execution inside an active n8n instance.
2. Real-time credential authentication verification.
3. External API endpoint reachability and network latency.
4. Dynamic runtime data payload schema validation.

---

## 13. Workflow JSON Export & Manual n8n Import Guide

### How to Export from the Builder
1. Generate your workflow or load a saved workflow from History.
2. Switch to the **"n8n JSON"** tab.
3. Click the **"Download Workflow JSON"** button to download `<workflow-name>.json`.

### How to Import into n8n
1. Open your self-hosted or cloud n8n instance (e.g. `http://localhost:5678`).
2. In the top-right menu of any workflow canvas, click the **Options menu (`...`)**.
3. Select **"Import from File"** (or use the shortcut `Ctrl+O` / `Cmd+O`).
4. Select the downloaded `.json` file.
5. In n8n, open each node marked with a red warning badge to select or configure your credentials (e.g. Gmail OAuth2, Slack API Token, Gemini API Key).
6. Test individual nodes with sample test executions before activating the workflow.

---

## 14. Prerequisites & Setup Commands (Windows & Mac/Linux)

### Prerequisites
- **Node.js**: v20.0.0 or higher (Tested on Node.js v24.19.0)
- **npm**: v10.0.0 or higher
- **Git**: Installed and configured

### Windows Setup (PowerShell / Command Prompt)
```powershell
# 1. Clone the repository
git clone <repo-url>
cd "metro hackathon"

# 2. Install dependencies
npm install

# 3. (Optional) Create environment file for live Gemini
copy .env.example .env.local

# 4. Start local development server
npm run dev
```

### Mac / Linux Setup (Terminal)
```bash
# 1. Clone the repository
git clone <repo-url>
cd "metro hackathon"

# 2. Install dependencies
npm install

# 3. (Optional) Create environment file for live Gemini
cp .env.example .env.local

# 4. Start local development server
npm run dev
```

---

## 15. Environment Variables

Documented in `.env.example`:

| Variable | Required? | Default | Description |
| :--- | :--- | :--- | :--- |
| `OPENAI_API_KEY` | Optional | *(None)* | OpenAI API key (e.g. `sk-proj-...`). Enables live GPT-4o-mini generation. |
| `OPENAI_MODEL` | Optional | `gpt-4o-mini` | OpenAI model identifier (e.g. `gpt-4o-mini` or `gpt-4o`). |
| `GEMINI_API_KEY` | Optional | *(None)* | Google Gemini API key from Google AI Studio. Used for Tier 2 fallback. |

*(Note: If all API keys are omitted, the application runs 100% in local Mock AI mode with $0 spend and zero dependencies on external services).*

---

## 16. Starting the Local Development Server

Run the development server using Next.js with Turbopack:
```bash
npm run dev
```

Expected output:
```text
  ▲ Next.js 16.4.3 (Turbopack)
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 450ms
```

Open your browser to:
**[http://localhost:3000](http://localhost:3000)**

---

## 17. Running Tests, Linting & Production Build

All tests run locally using the mock engine (**$0 spend, zero network calls**):

### 1. Run Automated Unit & Integration Tests
```bash
npm test
```
*Executes 35 tests across 11 test suites via the Node.js native test runner (`tsx --test tests/**/*.test.ts`).*

### 2. Run Code Quality & Lint Checks
```bash
npm run lint
```
*Runs ESLint across all TypeScript and React source files.*

### 3. Run Production Build Verification
```bash
npm run build
```
*Compiles the application with Next.js Turbopack and generates optimized static routes.*

---

## 18. Test Coverage & Audit Verification Results

**Audit Execution Date**: October 24, 2026

### Check Results Summary

| Check Command | Exit Code | Result | Details |
| :--- | :---: | :---: | :--- |
| `npm test` | **0** | **PASSED** | **35 tests passed, 0 failed** across 11 test suites (Duration: ~400ms). |
| `npm run lint` | **0** | **PASSED** | **0 errors, 0 warnings** across all project source files. |
| `npm run build` | **0** | **PASSED** | Next.js 16.4.3 compiled successfully with Turbopack (668ms). |

### Test Suite Breakdown

1. `tests/generator.test.ts`: Official n8n JSON output and prompt generation (3 tests) — **PASSED**
2. `tests/mock-provider.test.ts`: Deterministic mock provider ($0 cost) (4 tests) — **PASSED**
3. `tests/persistence.test.ts`: SQLite save, list, and delete operations (3 tests) — **PASSED**
4. `tests/pipeline.test.ts`: End-to-end prompt to blueprint pipeline (1 test) — **PASSED**
5. `tests/registry.test.ts`: Node lookup, version rules, parameter validation (7 tests) — **PASSED**
6. `tests/sample-regression.test.ts`:
   - Full-Fidelity Gmail Customer Support Triage, trigger fidelity, urgency branching, negative tests (3 tests) — **PASSED**
   - Test A — Hourly Scheduled API Health Check, HTTP GET, status evaluation, dual Slack reports (2 tests) — **PASSED**
7. `tests/requirement-schemas.test.ts`: Requirement schema boundaries and triggers (3 tests) — **PASSED**
8. `tests/blueprint-schemas.test.ts`: Blueprint and node schema validation (2 tests) — **PASSED**
9. `tests/validation-schemas.test.ts`: Validation report schema validation (1 test) — **PASSED**
10. `tests/validator.test.ts`: Error detection for missing params, broken links, secret leaks (6 tests) — **PASSED**

---

## 19. Security, Credential Handling & Privacy Limitations

1. **Zero Secret Storage**: The application does not store, request, or embed live API keys, OAuth access tokens, passwords, or secrets.
2. **Credential Placeholders**: When credentials are required by an n8n node, the builder emits explicit placeholders:
   ```json
   {
     "credentials": {
       "gmailOAuth2": "[CONFIGURE_CREDENTIAL: gmailOAuth2]"
     }
   }
   ```
3. **Automated Secret Leak Detection**: The deterministic validator scans all generated parameter values using regular expressions to prevent accidental exposure of keys (e.g. OpenAI `sk-...`, Slack `xoxb-...`, Google `AIza...`).
4. **Privacy & Data Retention**: User prompts and generated blueprints are stored strictly in the local SQLite file (`data/workflows.db`) on the user's local disk. No workflow telemetry is sent to third parties.

---

## 20. Known Limitations, Unverified Behaviors & Roadmap

### Known Limitations
1. **Static Validation vs. Live Execution**: Static validation checks structural schema correctness, connection integrity, and parameter existence. It does **not** prove that external services (Gmail, Slack, OpenAI) will authenticate or succeed at runtime.
2. **Registry Size**: The current MVP registry covers 15 foundational nodes. Community nodes or unlisted enterprise integrations are rejected.
3. **Complex Expressions**: Advanced n8n expressions (e.g. `{{ $json.body.items.map(...) }}`) are represented as text templates; dynamic expression evaluation against live payloads is not supported in the builder.

### Roadmap
- [ ] Expand registry coverage to 50+ integrations (HubSpot, GitHub, PostgreSQL, Airtable, Notion).
- [ ] Live n8n instance API integration via webhook execution test runner.
- [ ] Visual interactive connection dragging on the workflow canvas.
- [ ] Export directly to n8n Cloud via the official n8n Public API.

---

## 21. Troubleshooting Common Issues

### 1. Port 3000 Already in Use
If port 3000 is occupied:
```bash
# Start on an alternative port
npm run dev -- -p 3001
```

### 2. SQLite Database Lock or Permission Error
If you encounter `SqliteError: unable to open database file`:
- Ensure the `data/` directory exists and has write permissions.
- Ensure no other process holds an exclusive lock on `data/workflows.db`.
- In test environments, tests use an in-memory database (`:memory:`) to prevent locking.

### 3. Missing `better-sqlite3` Native Bindings
If you update your Node.js version and see a native binary error:
```bash
npm rebuild better-sqlite3
```

### 4. Build or ESLint Warnings
Ensure you are running Node.js v20+ and run:
```bash
npm run lint
npm run build
```

---

## License

MIT License. Created for local n8n workflow prototyping and automation design.
