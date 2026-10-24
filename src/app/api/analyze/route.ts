import { NextResponse } from 'next/server';
import { getAiProvider } from '@/lib/ai/factory';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, previousClarifications, provider, targetN8nVersion } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt is required and must not be empty.' },
        { status: 400 }
      );
    }

    const ai = getAiProvider(provider || 'mock');
    const result = await ai.analyzeRequirement(prompt, {
      previousClarifications,
      targetN8nVersion,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during requirement analysis.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
