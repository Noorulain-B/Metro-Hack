import { WorkflowBlueprint } from '../schemas/blueprint';

export interface OptimizationResult {
  optimizedBlueprint: WorkflowBlueprint;
  appliedRules: string[];
  tradeOffs: string[];
  estimatedAiSavings: string;
}

/**
 * Deterministic Workflow Optimization Engine.
 * Implements rule-based optimizations to reduce unnecessary AI calls,
 * remove duplicate operations, and improve reliability without silently altering behavior.
 */
export function optimizeWorkflowBlueprint(blueprint: WorkflowBlueprint): OptimizationResult {
  const appliedRules: string[] = [];
  const tradeOffs: string[] = [];
  let aiCallsSaved = 0;

  // Clone blueprint to ensure immutability
  const optimized: WorkflowBlueprint = JSON.parse(JSON.stringify(blueprint));

  // 1. Check for AI Agent usage where deterministic logic could suffice
  const aiAgentNodes = optimized.nodes.filter(
    (n) => n.type === '@n8n/n8n-nodes-langchain.agent'
  );

  for (const agentNode of aiAgentNodes) {
    const promptText = (agentNode.parameters.text as string) || '';
    const options = agentNode.parameters.options as Record<string, unknown> | undefined;
    const systemMessage = (options?.systemMessage as string) || '';

    // If the AI agent is only used for basic string presence or simple boolean matching
    if (
      systemMessage.toLowerCase().includes('check if empty') ||
      systemMessage.toLowerCase().includes('check if valid email') ||
      promptText.toLowerCase().includes('is valid email')
    ) {
      appliedRules.push(
        `Recommendation: Replace AI Agent "${agentNode.name}" with deterministic "If" or "Code" regex node for email/empty verification.`
      );
      tradeOffs.push(
        `Deterministic logic eliminates 100% of LLM latency, token cost, and potential non-deterministic hallucinations.`
      );
      aiCallsSaved += 1;
    }
  }

  // 2. Detect multiple successive Edit Fields (Set) nodes that can be combined
  for (let i = 0; i < optimized.nodes.length - 1; i++) {
    const current = optimized.nodes[i];
    const next = optimized.nodes[i + 1];

    if (current.type === 'n8n-nodes-base.set' && next.type === 'n8n-nodes-base.set') {
      appliedRules.push(
        `Detected sequential Set nodes ("${current.name}" and "${next.name}"). They can be combined into a single Edit Fields node to reduce execution overhead.`
      );
    }
  }

  // 3. Rate-limiting check for API nodes inside loops/frequent schedules
  const hasSchedule = optimized.nodes.some(
    (n) => n.type === 'n8n-nodes-base.scheduleTrigger'
  );
  const httpNodes = optimized.nodes.filter(
    (n) => n.type === 'n8n-nodes-base.httpRequest'
  );

  if (hasSchedule && httpNodes.length > 0) {
    tradeOffs.push(
      'Scheduled HTTP requests should be monitored for external API rate limits. Consider adding pagination or retry settings in the HTTP node options.'
    );
  }

  // Record optimizations in the blueprint assumptions
  if (appliedRules.length > 0) {
    optimized.assumptions.push(...appliedRules.map((r) => `[Optimizer] ${r}`));
  }

  return {
    optimizedBlueprint: optimized,
    appliedRules,
    tradeOffs,
    estimatedAiSavings: aiCallsSaved > 0 ? `${aiCallsSaved} AI call(s) per run saved` : '0 AI calls saved',
  };
}
