# Verified n8n Node Registry — Sources, Acquisition & Maintenance

## 1. Core Principle: Zero Hallucination

In standard AI generation, LLMs frequently hallucinate non-existent n8n nodes, invented parameter names (e.g. `channel` instead of `channelId`, `endpoint` instead of `path`), unsupported connection types, or obsolete versions.

The **Smart n8n Node Registry** serves as the deterministic ground truth for our application. Every node proposed by an AI prompt or template must exist in this registry before a workflow blueprint or JSON file can be generated.

---

## 2. Official Primary Sources

The definitions in this registry are derived directly from the official n8n open-source codebase:

1. **`n8n-nodes-base` Repository**:
   * Repository: [https://github.com/n8n-io/n8n/tree/master/packages/nodes-base](https://github.com/n8n-io/n8n/tree/master/packages/nodes-base)
   * Contains core triggers (Webhook, Schedule, Manual), transformation nodes (Set/Edit Fields, Code), conditional logic (If, Switch), and standard app integrations (Slack, Gmail, Google Sheets, HTTP Request).

2. **`@n8n/n8n-nodes-langchain` Repository**:
   * Repository: [https://github.com/n8n-io/n8n/tree/master/packages/@n8n/nodes-langchain](https://github.com/n8n-io/n8n/tree/master/packages/@n8n/nodes-langchain)
   * Contains official AI Agent roots and model sub-nodes (`@n8n/n8n-nodes-langchain.agent`, `@n8n/n8n-nodes-langchain.lmChatGoogleGemini`, `@n8n/n8n-nodes-langchain.lmChatOpenAi`).

3. **Official n8n Node Documentation**:
   * Docs URL: [https://docs.n8n.io/integrations/builtin/](https://docs.n8n.io/integrations/builtin/)

---

## 3. Compatibility Baseline & Versioning

* **Default Baseline Version**: `n8n v1.70.0+`
* **Configurability**: Workflows store a configurable `targetN8nVersion` in both the blueprint and validation report.
* **Node Type Versions**:
  * `n8n-nodes-base.webhook`: Version `2.0` (Supports modern response modes and streaming).
  * `n8n-nodes-base.scheduleTrigger`: Version `1.2` (Supports interval rules and cron).
  * `n8n-nodes-base.httpRequest`: Version `4.2` (Modern parameter layout with authentication options).
  * `n8n-nodes-base.set`: Version `3.4` (Modern Edit Fields syntax).
  * `n8n-nodes-base.if`: Version `2.2` (Modern condition builder).
  * `n8n-nodes-base.code`: Version `2.0` (Modern JavaScript/Python execution).
  * `n8n-nodes-base.slack`: Version `2.2` (Modern blocks and resource operations).
  * `n8n-nodes-base.gmail`: Version `2.1` (Resource/operation structure).
  * `n8n-nodes-base.googleSheets`: Version `4.5` (Modern append, read, update operations).
  * `@n8n/n8n-nodes-langchain.agent`: Version `1.7` (Modern LangChain root node).

---

## 4. Normalization and Ingestion Process

Every node entry in `registry.ts` is normalized into a strict Zod-validated schema (`SmartNodeDefinitionSchema`):

```typescript
export interface SmartNodeDefinition {
  nodeType: string;                 // e.g. "n8n-nodes-base.webhook"
  displayName: string;              // e.g. "Webhook"
  category: NodeCategory;           // "trigger" | "action" | "logic" | "transform" | "ai"
  supportedVersions: number[];      // e.g. [1, 2]
  defaultVersion: number;           // e.g. 2
  description: string;
  inputs: ConnectionType[];         // e.g. ["main"] or LangChain inputs
  outputs: ConnectionType[];        // e.g. ["main", "main"] for If node
  defaultParameters: Record<string, any>;
  parameters: NodeParameter[];
  requiredParameters: string[];
  credentialsRequired?: string;     // e.g. "slackApi", "googlePalmApi"
  documentationUrl: string;
  isAiNode: boolean;
}
```

---

## 5. Maintenance & Expansion Strategy

1. **Adding New Nodes**:
   * Inspect the official `*.node.ts` file in `n8n-nodes-base` or `@n8n/nodes-langchain`.
   * Extract the node's `description.properties` to identify required parameters and accepted options.
   * Add the normalized definition to `VERIFIED_N8N_NODES` in `src/lib/n8n/registry.ts`.
   * Add unit tests verifying schema adherence and lookup.

2. **Rejecting Gaps & Unsupported Nodes**:
   * If a user requests a tool or service not present in the verified registry, the application **explicitly flags the limitation** instead of inventing a configuration.
