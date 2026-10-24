import { z } from 'zod';

export const NodeCategorySchema = z.enum([
  'trigger',
  'action',
  'logic',
  'transform',
  'ai',
  'utility',
]);

export type NodeCategory = z.infer<typeof NodeCategorySchema>;

export const ConnectionTypeSchema = z.enum([
  'main',
  'ai_languageModel',
  'ai_tool',
  'ai_memory',
  'ai_outputParser',
]);

export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;

/**
 * Parameter definition for a node property
 */
export const NodeParameterSchema = z.object({
  name: z.string().describe('Parameter identifier in n8n'),
  displayName: z.string().describe('Human readable label in the n8n UI'),
  type: z.enum(['string', 'number', 'boolean', 'options', 'json', 'collection', 'fixedCollection']),
  default: z.any().optional().describe('Default value assigned if none provided'),
  required: z.boolean().default(false),
  description: z.string().optional(),
  options: z.array(z.object({
    name: z.string(),
    value: z.any(),
  })).optional().describe('Allowed values for options type'),
});

export type NodeParameter = z.infer<typeof NodeParameterSchema>;

/**
 * Verified schema for an official n8n node definition
 */
export const SmartNodeDefinitionSchema = z.object({
  nodeType: z.string().min(3).describe('Exact official n8n node type name (e.g. n8n-nodes-base.webhook)'),
  displayName: z.string().min(1).describe('User-friendly label (e.g. Webhook)'),
  category: NodeCategorySchema,
  supportedVersions: z.array(z.number()).min(1).describe('Valid n8n typeVersions (e.g. [1, 2])'),
  defaultVersion: z.number().describe('Recommended default typeVersion to generate'),
  description: z.string().describe('What this node does in n8n'),
  inputs: z.array(ConnectionTypeSchema).default(['main']).describe('Accepted input connection types'),
  outputs: z.array(ConnectionTypeSchema).default(['main']).describe('Produced output connection types'),
  defaultParameters: z.record(z.string(), z.any()).default({}).describe('Baseline verified parameter configuration'),
  parameters: z.array(NodeParameterSchema).default([]).describe('Supported parameters'),
  requiredParameters: z.array(z.string()).default([]).describe('Names of parameters that must be set'),
  credentialsRequired: z.string().optional().describe('Name of credential type if required, e.g. slackApi, gmailOAuth2'),
  documentationUrl: z.string().url().describe('Official n8n docs link for this node'),
  isAiNode: z.boolean().default(false).describe('Whether this node is an AI/LangChain component'),
});

export type SmartNodeDefinition = z.infer<typeof SmartNodeDefinitionSchema>;

/**
 * Registry map indexed by nodeType
 */
export const NodeRegistryMapSchema = z.record(z.string(), SmartNodeDefinitionSchema);
export type NodeRegistryMap = z.infer<typeof NodeRegistryMapSchema>;
