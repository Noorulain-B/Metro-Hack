import { z } from 'zod';

/**
 * Schema for targeted clarification questions when essential user details are missing.
 */
export const ClarificationQuestionSchema = z.object({
  id: z.string().describe('Unique identifier for this question (e.g. q_trigger_schedule)'),
  question: z.string().min(5).describe('The plain-language question asked to the user'),
  context: z.string().describe('Why this question is necessary to build the workflow correctly'),
  options: z.array(z.string()).optional().describe('Pre-defined answers if question is multiple choice'),
  defaultAnswer: z.string().describe('Sensible default used if the user chooses not to answer'),
  isEssential: z.boolean().default(false).describe('Whether workflow generation is blocked without an answer or default approval'),
  category: z.enum(['trigger', 'credentials', 'logic', 'ai_agent', 'output']).default('logic'),
});

export type ClarificationQuestion = z.infer<typeof ClarificationQuestionSchema>;

/**
 * Schema representing the parsed user requirements extracted from natural language.
 */
export const RequirementSpecificationSchema = z.object({
  title: z.string().min(3).max(120).describe('Concise descriptive title of the workflow'),
  userGoal: z.string().min(10).describe('Clear summary of what problem the user wants the workflow to solve'),
  triggerType: z.enum([
    'webhook',
    'schedule',
    'email',
    'manual',
    'form',
    'app_event',
    'unknown',
  ]).describe('The event or signal that kicks off this workflow'),
  triggerDetails: z.object({
    scheduleInterval: z.string().optional().describe('e.g. "Every 1 hour", "Daily at 9 AM" or cron expression'),
    webhookMethod: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional().default('POST'),
    sourceApp: z.string().optional().describe('Source application like Stripe, GitHub, or Shopify'),
  }).default({ webhookMethod: 'POST' }),
  dataProcessingSteps: z.array(z.string()).min(1).describe('Ordered human-readable list of steps'),
  hasAiAgent: z.boolean().default(false).describe('Whether the user requested AI reasoning, classification, or generation'),
  aiAgentTask: z.string().optional().describe('Description of the specific AI agent task if applicable'),
  integrations: z.array(z.string()).describe('Third-party tools needed, e.g. ["slack", "gmail", "notion"]'),
  clarifications: z.array(ClarificationQuestionSchema).default([]).describe('Questions needed to clarify ambiguous requirements'),
  confidenceScore: z.number().min(0).max(1).default(1.0).describe('Confidence level of the requirement interpretation (0.0 - 1.0)'),
});

export type RequirementSpecification = z.infer<typeof RequirementSpecificationSchema>;
