import { NextResponse } from 'next/server';
import { getAiProvider } from '@/lib/ai/factory';
import { optimizeWorkflowBlueprint } from '@/lib/n8n/optimizer';
import { validateWorkflowBlueprint } from '@/lib/n8n/validator';
import { generateN8nWorkflowJson } from '@/lib/n8n/generator';
import { generateOptimizedN8nPrompt } from '@/lib/n8n/prompt-generator';
import { RequirementSpecificationSchema } from '@/lib/schemas/requirement';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { requirement, targetN8nVersion, provider } = body;

    const parsedRequirement = RequirementSpecificationSchema.parse(requirement);
    const ai = getAiProvider(provider || 'mock');

    // 1. Generate candidate blueprint
    const { blueprint: rawBlueprint, metrics } = await ai.generateBlueprint(parsedRequirement, {
      targetN8nVersion: targetN8nVersion || '1.70.0',
    });

    // 2. Deterministic optimization
    const optimization = optimizeWorkflowBlueprint(rawBlueprint);
    const approvedBlueprint = optimization.optimizedBlueprint;

    // 3. Deterministic validation
    const validationReport = validateWorkflowBlueprint(approvedBlueprint);

    // 4. Deterministic n8n Workflow JSON generation
    const workflowJson = generateN8nWorkflowJson(approvedBlueprint);

    // 5. Deterministic optimized prompt generation
    const generatedPrompt = generateOptimizedN8nPrompt(approvedBlueprint);

    return NextResponse.json({
      blueprint: approvedBlueprint,
      optimization,
      validationReport,
      workflowJson,
      generatedPrompt,
      metrics,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during blueprint generation.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
