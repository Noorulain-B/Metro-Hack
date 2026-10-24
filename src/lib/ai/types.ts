import { RequirementSpecification } from '../schemas/requirement';
import { WorkflowBlueprint } from '../schemas/blueprint';

/**
 * Tracks AI calls, token usage, and costs with full transparency.
 */
export interface AiUsageMetrics {
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  aiCallsCount: number;
  isMock: boolean;
}

/**
 * Common configuration options for AI generation requests.
 */
export interface AiGenerationOptions {
  targetN8nVersion?: string;
  previousClarifications?: Record<string, string>;
  allowAiAgent?: boolean;
}

/**
 * Pluggable AI Provider interface.
 * Implemented by MockAiProvider (for $0 tests and dry runs) and GeminiAiProvider.
 */
export interface AiProvider {
  readonly providerId: 'mock' | 'gemini' | 'openai';

  /**
   * Analyzes a natural-language prompt into structured requirements and clarifications.
   */
  analyzeRequirement(
    userPrompt: string,
    options?: AiGenerationOptions
  ): Promise<{
    requirement: RequirementSpecification;
    metrics: AiUsageMetrics;
  }>;

  /**
   * Converts an approved requirement into a canonical workflow blueprint.
   */
  generateBlueprint(
    requirement: RequirementSpecification,
    options?: AiGenerationOptions
  ): Promise<{
    blueprint: WorkflowBlueprint;
    metrics: AiUsageMetrics;
  }>;
}
