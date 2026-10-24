import { AiProvider, AiUsageMetrics, AiGenerationOptions } from './types';
import { RequirementSpecification } from '../schemas/requirement';
import { WorkflowBlueprint } from '../schemas/blueprint';
import { OpenAiAiProvider } from './openai-provider';
import { GeminiAiProvider } from './gemini-provider';
import { MockAiProvider } from './mock-provider';

/**
 * Resilient Multi-Tier Fallback AI Provider.
 * Tier 1: OpenAI (GPT-4o-mini / GPT-4o) if OPENAI_API_KEY is configured.
 * Tier 2: Google Gemini (Gemini 2.5 Flash / Pro) if GEMINI_API_KEY is configured.
 * Tier 3: Deterministic Mock Engine ($0 Free, guaranteed 100% demo uptime).
 *
 * If any tier encounters an API error, rate limit, or invalid response,
 * it seamlessly cascades to the next tier so live hackathon demos never crash.
 */
export class ResilientFallbackAiProvider implements AiProvider {
  readonly providerId = 'fallback' as const;
  private openAiProvider: OpenAiAiProvider | null = null;
  private geminiProvider: GeminiAiProvider | null = null;
  private mockProvider: MockAiProvider;

  constructor() {
    this.mockProvider = new MockAiProvider();
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
      this.openAiProvider = new OpenAiAiProvider();
    }
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
      this.geminiProvider = new GeminiAiProvider();
    }
  }

  async analyzeRequirement(
    userPrompt: string,
    options?: AiGenerationOptions
  ): Promise<{ requirement: RequirementSpecification; metrics: AiUsageMetrics }> {
    // 1. Try OpenAI
    if (this.openAiProvider) {
      try {
        return await this.openAiProvider.analyzeRequirement(userPrompt, options);
      } catch (openAiErr) {
        console.warn('[FallbackProvider] OpenAI analyze failed, attempting Gemini fallback:', openAiErr);
      }
    }

    // 2. Try Gemini
    if (this.geminiProvider) {
      try {
        const result = await this.geminiProvider.analyzeRequirement(userPrompt, options);
        return {
          ...result,
          metrics: {
            ...result.metrics,
            modelName: `${result.metrics.modelName} (fallback)`,
          },
        };
      } catch (geminiErr) {
        console.warn('[FallbackProvider] Gemini analyze failed, cascading to deterministic Mock engine:', geminiErr);
      }
    }

    // 3. Guaranteed Mock Engine fallback
    const mockResult = await this.mockProvider.analyzeRequirement(userPrompt, options);
    return {
      ...mockResult,
      metrics: {
        ...mockResult.metrics,
        modelName: 'mock-deterministic-engine (resilient fallback)',
      },
    };
  }

  async generateBlueprint(
    requirement: RequirementSpecification,
    options?: AiGenerationOptions
  ): Promise<{ blueprint: WorkflowBlueprint; metrics: AiUsageMetrics }> {
    // 1. Try OpenAI
    if (this.openAiProvider) {
      try {
        return await this.openAiProvider.generateBlueprint(requirement, options);
      } catch (openAiErr) {
        console.warn('[FallbackProvider] OpenAI blueprint generation failed, attempting Gemini fallback:', openAiErr);
      }
    }

    // 2. Try Gemini
    if (this.geminiProvider) {
      try {
        const result = await this.geminiProvider.generateBlueprint(requirement, options);
        return {
          ...result,
          metrics: {
            ...result.metrics,
            modelName: `${result.metrics.modelName} (fallback)`,
          },
        };
      } catch (geminiErr) {
        console.warn('[FallbackProvider] Gemini blueprint generation failed, cascading to deterministic Mock engine:', geminiErr);
      }
    }

    // 3. Guaranteed Mock Engine fallback
    const mockResult = await this.mockProvider.generateBlueprint(requirement, options);
    return {
      ...mockResult,
      metrics: {
        ...mockResult.metrics,
        modelName: 'mock-deterministic-engine (resilient fallback)',
      },
    };
  }
}
