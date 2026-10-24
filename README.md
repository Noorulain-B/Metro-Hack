# n8n AI Workflow Builder (MVP)

> **"From plain English to validated automation, with fewer AI calls and less manual debugging."**

An AI-powered web application that converts natural-language instructions into structured n8n workflow blueprints, validated import-ready n8n workflow JSON files, and optimized prompts.

---

## 🌟 Core Highlights

- **Zero Hallucinated Nodes**: All suggested nodes, versions, parameter keys, and connection types are deterministically validated against official n8n node specifications.
- **Dual Outputs from One Approved Blueprint**: Both the downloadable workflow `.json` and the optimized AI prompt are generated from the exact same canonical blueprint.
- **$0 Free Local Mode**: Comes with a built-in deterministic Mock AI engine so you can develop, test, and generate automations with zero API keys and zero cost.
- **Google Gemini Provider**: Optional integration using the official `@google/genai` SDK when you configure your `GEMINI_API_KEY`.
- **Deterministic Validation Engine**: Checks node existence, version compatibility, required parameters, broken connection links, and detects raw credential leaks.
- **Explicit Assumptions & Limitations**: Distinguishes structural validation from live execution testing to prevent false certainty.
- **Local SQLite Persistence**: Save and reload generated workflows without setting up external database servers.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v20 or higher (Tested on v24.19.0)
- **npm**: v10 or higher

### 2. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Running Locally ($0 Cost / No API Key Needed)
Start the local development server:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

By default, the builder runs on the **Local Mock Engine**, allowing you to explore starter templates and build automations for free.

---

## 🔑 Optional: Configuring Google Gemini

If you want to use your Google AI Pro subscription with live Gemini models:

1. Create a `.env.local` file in the project root:
   ```bash
   cp .env.example .env.local
   ```
2. Add your Google Gemini API key:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```
3. Restart the dev server (`npm run dev`) and select **"Google Gemini"** from the AI Provider dropdown in the UI.

---

## 🧪 Running Automated Tests & Linting

All unit and integration tests run offline using the deterministic mock engine (**$0 spend guaranteed**):

```bash
# Run the complete test suite (30 automated tests)
npm test

# Run ESLint check
npm run lint

# Run production build check
npm run build
```

---

## 📁 Project Architecture

```text
src/
├── app/
│   ├── api/
│   │   ├── analyze/            # Requirement extraction & clarifications endpoint
│   │   ├── blueprint/          # Blueprint, optimization, validation & export endpoint
│   │   ├── history/            # SQLite saved workflow persistence endpoint
│   │   └── templates/          # Verified starter templates endpoint
│   ├── layout.tsx              # Root HTML shell with Plus Jakarta Sans & JetBrains Mono
│   ├── globals.css             # Glassmorphic dark design system & tokens
│   └── page.tsx                # Interactive multi-tab builder interface
├── lib/
│   ├── schemas/                # Single source of truth (Zod runtime schemas)
│   │   ├── requirement.ts      # Natural language parsed requirements & clarifications
│   │   ├── blueprint.ts        # Canonical workflow blueprint schema
│   │   ├── node-registry.ts    # Official n8n node specification schema
│   │   └── validation.ts       # Structured validation report schema
│   ├── n8n/                    # Deterministic n8n Engine
│   │   ├── registry.ts         # Verified n8n node catalog & parameter rules
│   │   ├── registry-sources.md # Documentation of official n8n sources
│   │   ├── optimizer.ts        # Deterministic workflow optimization rules
│   │   ├── validator.ts        # Structural, compatibility, and credential leak validator
│   │   ├── generator.ts        # Blueprint -> Official n8n Workflow JSON converter
│   │   └── prompt-generator.ts # Blueprint -> Optimized AI Prompt generator
│   ├── ai/                     # Modular AI Provider Layer
│   │   ├── types.ts            # AiProvider interface & token tracking metrics
│   │   ├── mock-provider.ts    # Deterministic mock provider ($0 cost)
│   │   ├── gemini-provider.ts  # Google Gemini provider with token counting
│   │   └── factory.ts          # Provider resolver (Mock in tests, Gemini if configured)
│   ├── db/                     # Persistence Layer
│   │   ├── repository.ts       # Storage interface
│   │   └── sqlite.ts           # SQLite repository using better-sqlite3
│   └── templates/              # Curated starter templates (Google Sheets, AI Triage, etc.)
└── tests/                      # Automated test suite (Vitest / Node native test runner)
    ├── schemas.test.ts         # Schema validation boundary tests
    ├── registry.test.ts        # Verified node lookup & parameter tests
    ├── validator.test.ts       # Error detection (unknown nodes, invalid versions, leaks)
    ├── generator.test.ts       # n8n JSON output and prompt verification
    ├── mock-provider.test.ts   # $0 cost mock provider verification
    ├── persistence.test.ts     # SQLite save, list, and delete tests
    └── pipeline.test.ts        # End-to-end integration test
```

---

## ⚠️ Known Limitations & Unverified Behaviors

As required by MVP Acceptance Requirement #9:
1. **Structural Validation vs. Live Execution**: The application performs deterministic structural validation against verified schemas. It **does not execute** workflows inside a live n8n instance and cannot guarantee that external third-party APIs (e.g., Slack, Gmail) will succeed at runtime.
2. **Credential Authentication**: Real secrets are never requested or embedded in exports. After downloading the generated `.json` file and importing it into n8n, you must configure your credentials in the n8n credential store.
3. **Registry Scope**: The MVP registry covers core foundational nodes (Triggers, Logic, Set, Code, HTTP Request, Slack, Gmail, Google Sheets, LangChain AI Agent, Gemini & OpenAI chat models). Integrations not present in the registry are rejected rather than guessed.
