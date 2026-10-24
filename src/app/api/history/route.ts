import { NextResponse } from 'next/server';
import { getWorkflowRepository } from '@/lib/db/sqlite';

export async function GET() {
  try {
    const repo = getWorkflowRepository();
    const workflows = await repo.listWorkflows();
    return NextResponse.json({ workflows });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve workflow history.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const repo = getWorkflowRepository();
    await repo.saveWorkflow(body);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to save workflow.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing workflow ID.' }, { status: 400 });
    }
    const repo = getWorkflowRepository();
    const deleted = await repo.deleteWorkflow(id);
    return NextResponse.json({ success: deleted });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete workflow.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
