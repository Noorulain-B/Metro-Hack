import { GoogleGenAI } from '@google/genai';
import { AiProvider, AiUsageMetrics, AiGenerationOptions } from './types';
import { RequirementSpecification, RequirementSpecificationSchema } from '../schemas/requirement';
import { WorkflowBlueprint, WorkflowBlueprintSchema } from '../schemas/blueprint';
import { VERIFIED_N8N_NODES } from '../n8n/registry';

/**
 * Google Gemini AI Provider.
 * Communicates with Google's Gemini models using the official @google/genai SDK.
 * Respects strict cost controls and verifies API key existence before making calls.
 */
export class GeminiAiProvider implements AiProvider {
  readonly providerId = 'gemini' as const;
  private client: GoogleGenAI | null = null;
  private defaultModel = 'gemini-1.5-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim() !== '') {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  private ensureClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        throw new Error(
          'GEMINI_API_KEY is not configured. Please add your GEMINI_API_KEY to .env.local or select Mock AI Provider.'
        );
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  async analyzeRequirement(
    userPrompt: string,
    options?: AiGenerationOptions
  ): Promise<{ requirement: RequirementSpecification; metrics: AiUsageMetrics }> {
    const ai = this.ensureClient();

    const verifiedNodeList = Object.keys(VERIFIED_N8N_NODES).join(', ');
    const systemInstruction = `You are a strict, senior n8n automation architect.
Your task is to analyze user requests and extract structured requirements.
Only propose integrations and steps that match actual n8n capabilities.
Known verified n8n nodes include: ${verifiedNodeList}.
Output MUST be a single valid JSON object strictly matching this schema:
{
  "title": string,
  "userGoal": string,
  "triggerType": "webhook" | "schedule" | "email" | "manual" | "form" | "app_event" | "unknown",
  "triggerDetails": { "scheduleInterval"?: string, "webhookMethod"?: "GET"|"POST"|"PUT"|"DELETE", "sourceApp"?: string },
  "dataProcessingSteps": string[],
  "hasAiAgent": boolean,
  "aiAgentTask"?: string,
  "integrations": string[],
  "clarifications": [
    {
      "id": string,
      "question": string,
      "context": string,
      "options"?: string[],
      "defaultAnswer": string,
      "isEssential": boolean,
      "category": "trigger" | "credentials" | "logic" | "ai_agent" | "output"
    }
  ],
  "confidenceScore": number
}
Do not invent facts. Record assumptions or missing info in clarifications. Do not include markdown code block backticks. Output pure JSON only.`;

    const response = await ai.models.generateContent({
      model: this.defaultModel,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemInstruction}\n\nUser Request: ${userPrompt}\nPrevious answers: ${JSON.stringify(options?.previousClarifications || {})}`,
            },
          ],
        },
      ],
    });

    const responseText = response.text?.trim() || '{}';
    const cleanedJson = responseText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    const parsedData = JSON.parse(cleanedJson);
    const requirement = RequirementSpecificationSchema.parse(parsedData);

    const promptTokens = response.usageMetadata?.promptTokenCount || Math.round(userPrompt.length / 4);
    const completionTokens = response.usageMetadata?.candidatesTokenCount || Math.round(responseText.length / 4);

    return {
      requirement,
      metrics: {
        modelName: this.defaultModel,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCostUsd: 0.0, // Google AI Pro / Free tier quota
        aiCallsCount: 1,
        isMock: false,
      },
    };
  }

  async generateBlueprint(
    requirement: RequirementSpecification,
    options?: AiGenerationOptions
  ): Promise<{ blueprint: WorkflowBlueprint; metrics: AiUsageMetrics }> {
    const ai = this.ensureClient();
    const targetVersion = options?.targetN8nVersion || '1.70.0';

    const systemInstruction = `You are a senior n8n automation engineer.
Convert this requirement specification into a valid Workflow Blueprint.
CRITICAL CONSTRAINT: You MUST only use verified node types: ${Object.keys(VERIFIED_N8N_NODES).join(', ')}.
Never invent non-existent node types or parameters.
Target n8n baseline version: ${targetVersion}.
Always use generic credential placeholders like [CONFIGURE_CREDENTIAL: slackApi].
Output pure JSON matching the WorkflowBlueprint schema.`;

    const response = await ai.models.generateContent({
      model: this.defaultModel,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemInstruction}\n\nRequirement: ${JSON.stringify(requirement)}`,
            },
          ],
        },
      ],
    });

    const responseText = response.text?.trim() || '{}';
    const cleanedJson = responseText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    const parsedData = JSON.parse(cleanedJson);
    const blueprint = WorkflowBlueprintSchema.parse({
      ...parsedData,
      targetN8nVersion: targetVersion,
    });

    const promptTokens = response.usageMetadata?.promptTokenCount || 200;
    const completionTokens = response.usageMetadata?.candidatesTokenCount || 500;

    return {
      blueprint,
      metrics: {
        modelName: this.defaultModel,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCostUsd: 0.0,
        aiCallsCount: 1,
        isMock: false,
      },
    };
  }
}
