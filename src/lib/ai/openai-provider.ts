import { AiProvider, AiUsageMetrics, AiGenerationOptions } from './types';
import { RequirementSpecification, RequirementSpecificationSchema } from '../schemas/requirement';
import { WorkflowBlueprint, WorkflowBlueprintSchema } from '../schemas/blueprint';
import { VERIFIED_N8N_NODES } from '../n8n/registry';

/**
 * OpenAI AI Provider.
 * Communicates with OpenAI models (e.g., gpt-4o-mini, gpt-4o) using native fetch.
 * Uses structured JSON mode for reliable schema adherence and tracks token metrics.
 */
export class OpenAiAiProvider implements AiProvider {
  readonly providerId = 'openai' as const;
  private defaultModel: string;

  constructor() {
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  private getApiKey(): string {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error(
        'OPENAI_API_KEY is not configured. Please add your OPENAI_API_KEY to .env.local or select Mock AI Provider.'
      );
    }
    return apiKey.trim();
  }

  async analyzeRequirement(
    userPrompt: string,
    options?: AiGenerationOptions
  ): Promise<{ requirement: RequirementSpecification; metrics: AiUsageMetrics }> {
    const apiKey = this.getApiKey();
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
Do not invent facts. Record assumptions or missing info in clarifications. Output pure JSON only.`;

    const userContent = `User Request: ${userPrompt}\nPrevious clarification answers: ${JSON.stringify(options?.previousClarifications || {})}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.defaultModel,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim() || '{}';
    const parsedData = JSON.parse(rawContent);
    const requirement = RequirementSpecificationSchema.parse(parsedData);

    const promptTokens = data.usage?.prompt_tokens || Math.round(userPrompt.length / 4);
    const completionTokens = data.usage?.completion_tokens || Math.round(rawContent.length / 4);
    const totalTokens = data.usage?.total_tokens || promptTokens + completionTokens;

    // Approximate cost for gpt-4o-mini ($0.15/1M input, $0.60/1M output)
    const cost = (promptTokens * 0.00015 + completionTokens * 0.0006) / 1000;

    return {
      requirement,
      metrics: {
        modelName: `openai/${this.defaultModel}`,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: Number(cost.toFixed(6)),
        aiCallsCount: 1,
        isMock: false,
      },
    };
  }

  async generateBlueprint(
    requirement: RequirementSpecification,
    options?: AiGenerationOptions
  ): Promise<{ blueprint: WorkflowBlueprint; metrics: AiUsageMetrics }> {
    const apiKey = this.getApiKey();
    const targetVersion = options?.targetN8nVersion || '1.70.0';

    const systemInstruction = `You are a senior n8n automation engineer.
Convert this requirement specification into a valid Workflow Blueprint.
CRITICAL CONSTRAINT: You MUST only use verified node types: ${Object.keys(VERIFIED_N8N_NODES).join(', ')}.
Never invent non-existent node types or parameters.
Target n8n baseline version: ${targetVersion}.
Always use generic credential placeholders like [CONFIGURE_CREDENTIAL: slackApi].
Output pure JSON matching the WorkflowBlueprint schema with:
- id: string
- name: string
- description: string
- targetN8nVersion: string
- assumptions: string[]
- unresolvedIssues: string[]
- expectedOutputs: string[]
- nodes: array of { id, name, type, typeVersion, parameters, credentials?, notes?, disabled? }
- connections: array of { fromNodeId, fromOutputIndex, fromOutputType, toNodeId, toInputIndex, toInputType }
- metadata: { createdAt, updatedAt, targetN8nVersion, complexityLevel, estimatedAiCallsPerRun, tags, version, author }`;

    const userContent = `Requirement Specification: ${JSON.stringify(requirement)}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.defaultModel,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim() || '{}';
    const parsedData = JSON.parse(rawContent);
    const blueprint = WorkflowBlueprintSchema.parse({
      ...parsedData,
      targetN8nVersion: targetVersion,
    });

    const promptTokens = data.usage?.prompt_tokens || 300;
    const completionTokens = data.usage?.completion_tokens || 600;
    const totalTokens = data.usage?.total_tokens || promptTokens + completionTokens;
    const cost = (promptTokens * 0.00015 + completionTokens * 0.0006) / 1000;

    return {
      blueprint,
      metrics: {
        modelName: `openai/${this.defaultModel}`,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: Number(cost.toFixed(6)),
        aiCallsCount: 1,
        isMock: false,
      },
    };
  }
}
