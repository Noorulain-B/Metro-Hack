import { z } from 'zod';

export const ValidationSeveritySchema = z.enum(['error', 'warning', 'info']);
export type ValidationSeverity = z.infer<typeof ValidationSeveritySchema>;

export const ValidationIssueSchema = z.object({
  severity: ValidationSeveritySchema,
  code: z.string().describe('Standard error or warning code (e.g. UNKNOWN_NODE_TYPE, MISSING_REQUIRED_PARAM)'),
  message: z.string().describe('Plain-language explanation of the issue'),
  nodeId: z.string().optional().describe('ID of the node where the issue was found, if applicable'),
  nodeName: z.string().optional().describe('Display name of the node where the issue was found'),
  field: z.string().optional().describe('Parameter or field name causing the issue'),
  suggestedCorrection: z.string().optional().describe('Actionable advice on how to fix or resolve this issue'),
});

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/**
 * Standard structured validation report distinguishing structural validation
 * from runtime execution testing.
 */
export const ValidationReportSchema = z.object({
  valid: z.boolean().describe('True if zero blocking errors were found'),
  targetN8nVersion: z.string().describe('The n8n baseline version checked against'),
  errors: z.array(ValidationIssueSchema).default([]),
  warnings: z.array(ValidationIssueSchema).default([]),
  infos: z.array(ValidationIssueSchema).default([]),
  checksNotPerformed: z.array(z.string()).default([
    'Live execution inside an active n8n instance',
    'Real-time credential authentication verification',
    'External API endpoint reachability and network latency',
    'Dynamic runtime data payload validation',
  ]).describe('Explicit list of checks not performed to avoid false certainty'),
  timestamp: z.string().datetime(),
});

export type ValidationReport = z.infer<typeof ValidationReportSchema>;
