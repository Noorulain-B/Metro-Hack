import { AiProvider } from './types';
import { MockAiProvider } from './mock-provider';
import { GeminiAiProvider } from './gemini-provider';
import { ResilientFallbackAiProvider } from './fallback-provider';

/**
 * Returns the appropriate AI Provider.
 * Guaranteed behavior:
 * - Always returns MockAiProvider in test environments (zero API spend).
 * - Defaults to ResilientFallbackAiProvider if OPENAI_API_KEY is configured.
 * - Defaults to GeminiAiProvider if GEMINI_API_KEY is configured.
 * - Defaults to MockAiProvider if no keys are configured ($0 cost).
 */
export function getAiProvider(preferred?: 'mock' | 'gemini' | 'openai' | 'fallback'): AiProvider {
  if (process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test' || preferred === 'mock') {
    return new MockAiProvider();
  }

  if (preferred === 'openai') {
    // Wrap in fallback so if OpenAI fails during live demo, it cascades seamlessly
    return new ResilientFallbackAiProvider();
  }

  if (preferred === 'fallback') {
    return new ResilientFallbackAiProvider();
  }

  if (preferred === 'gemini') {
    return new GeminiAiProvider();
  }

  // Automatic detection based on available environment keys
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
    return new ResilientFallbackAiProvider();
  }

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    return new GeminiAiProvider();
  }

  return new MockAiProvider();
}
