import { z } from 'zod';
import { ConnectionTypeSchema } from './node-registry';

/**
 * Blueprint Node: An instance of an n8n node planned for the workflow.
 */
export const BlueprintNodeSchema = z.object({
  id: z.string().min(1).describe('Unique ID within the blueprint (e.g. node_webhook_1)'),
  name: z.string().min(1).describe('Display name shown in n8n canvas (e.g. "Customer Webhook")'),
  type: z.string().min(1).describe('Exact official n8n node type (e.g. n8n-nodes-base.webhook)'),
  typeVersion: z.number().positive().describe('Exact n8n typeVersion (e.g. 2 or 1.2)'),
  parameters: z.record(z.string(), z.any()).default({}).describe('Node-specific parameters'),
  credentials: z.record(z.string(), z.string()).optional().describe('Map of credential placeholder names, e.g. { slackApi: "[CONFIGURE_CREDENTIAL: slackApi]" }'),
  notes: z.string().optional().describe('Explanation of what this node does in the context of the workflow'),
  disabled: z.boolean().default(false),
});

export type BlueprintNode = z.infer<typeof BlueprintNodeSchema>;

/**
 * Blueprint Connection: Directed link between two nodes.
 */
export const BlueprintConnectionSchema = z.object({
  fromNodeId: z.string().min(1).describe('ID of the source node'),
  fromOutputIndex: z.number().int().min(0).default(0).describe('Output connector index (0 for main output, 1 for false branch in If node, etc.)'),
  fromOutputType: ConnectionTypeSchema.default('main').describe('Connector type (usually "main" or "ai_languageModel")'),
  toNodeId: z.string().min(1).describe('ID of the destination node'),
  toInputIndex: z.number().int().min(0).default(0).describe('Input connector index (usually 0)'),
  toInputType: ConnectionTypeSchema.default('main').describe('Connector type (usually "main")'),
});

export type BlueprintConnection = z.infer<typeof BlueprintConnectionSchema>;

/**
 * Metadata about the blueprint
 */
export const BlueprintMetadataSchema = z.object({
  createdAt: z.string().datetime().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().datetime().describe('ISO 8601 update timestamp'),
  targetN8nVersion: z.string().default('1.70.0').describe('Configurable target n8n baseline version'),
  complexityLevel: z.enum(['simple', 'moderate', 'complex']).default('simple'),
  estimatedAiCallsPerRun: z.number().int().min(0).default(0),
  tags: z.array(z.string()).default([]),
  version: z.string().default('1.0.0'),
  author: z.string().default('AI n8n Workflow Builder'),
});

export type BlueprintMetadata = z.infer<typeof BlueprintMetadataSchema>;

/**
 * The approved Workflow Blueprint: the single source of truth for both JSON and Prompt generation.
 */
export const WorkflowBlueprintSchema = z.object({
  id: z.string().describe('Unique ID for this blueprint (uuid)'),
  name: z.string().min(2).max(120).describe('Human-friendly workflow name'),
  description: z.string().min(5).describe('Clear overview of what the workflow accomplishes'),
  targetN8nVersion: z.string().default('1.70.0').describe('The n8n compatibility baseline targeted'),
  assumptions: z.array(z.string()).default([]).describe('Explicitly recorded assumptions about triggers, payloads, or integrations'),
  unresolvedIssues: z.array(z.string()).default([]).describe('Any pending questions, missing credentials, or manual actions required'),
  expectedOutputs: z.array(z.string()).default([]).describe('What successful execution of this workflow produces'),
  nodes: z.array(BlueprintNodeSchema).min(1).describe('List of all nodes in this workflow'),
  connections: z.array(BlueprintConnectionSchema).describe('Directed connections between nodes'),
  metadata: BlueprintMetadataSchema,
});

export type WorkflowBlueprint = z.infer<typeof WorkflowBlueprintSchema>;
