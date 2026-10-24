import { AiProvider } from './types';
import { MockAiProvider } from './mock-provider';
import { GeminiAiProvider } from './gemini-provider';

/**
 * Returns the appropriate AI Provider.
 * Guaranteed behavior:
 * - Always returns MockAiProvider in test environments (zero API spend).
 * - Defaults to MockAiProvider if no GEMINI_API_KEY is configured.
 */
export function getAiProvider(preferred?: 'mock' | 'gemini'): AiProvider {
  if (process.env.NODE_ENV === 'test' || preferred === 'mock') {
    return new MockAiProvider();
  }

  if (preferred === 'gemini') {
    return new GeminiAiProvider();
  }

  // If a Gemini API key is configured, default to Gemini, otherwise Mock
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    return new GeminiAiProvider();
  }

  return new MockAiProvider();
}
