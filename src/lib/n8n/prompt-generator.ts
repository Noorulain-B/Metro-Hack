import { WorkflowBlueprint } from '../schemas/blueprint';
import { getNodeDefinition } from './registry';

/**
 * Deterministic Optimized n8n Prompt Generator.
 * Converts the approved canonical WorkflowBlueprint into a structured, highly specific
 * AI prompt that can be used with n8n's AI Assistant or other LLMs to build or refine the workflow.
 */
export function generateOptimizedN8nPrompt(blueprint: WorkflowBlueprint): string {
  const nodeMap = new Map<string, (typeof blueprint.nodes)[0]>();
  for (const node of blueprint.nodes) {
    nodeMap.set(node.id, node);
  }

  const sections: string[] = [];

  // 1. Goal and Overview
  sections.push(`# n8n Workflow Construction Prompt: ${blueprint.name}`);
  sections.push(`## 1. Automation Objective
${blueprint.description}`);

  // 2. Compatibility Baseline
  sections.push(`## 2. Environment Compatibility
- Target n8n baseline version: ${blueprint.targetN8nVersion}
- Complexity Level: ${blueprint.metadata.complexityLevel.toUpperCase()}
- AI Model Calls per run: ${blueprint.metadata.estimatedAiCallsPerRun}`);

  // 3. Node Specifications
  const nodeSpecs: string[] = ['## 3. Node Specifications (Verified n8n Types Only)'];
  blueprint.nodes.forEach((node, index) => {
    const def = getNodeDefinition(node.type);
    nodeSpecs.push(`### Step ${index + 1}: ${node.name}
- Canonical Type: \`${node.type}\`
- Type Version: \`${node.typeVersion}\`
- Category: ${def?.category || 'action'}
- Purpose: ${node.notes || def?.description || 'Custom step'}
- Parameters:
\`\`\`json
${JSON.stringify(node.parameters, null, 2)}
\`\`\``);

    if (node.credentials && Object.keys(node.credentials).length > 0) {
      nodeSpecs.push(`- Required Credentials: ${Object.keys(node.credentials).join(', ')} (Use n8n credential placeholders; do not hardcode secrets)`);
    }
  });
  sections.push(nodeSpecs.join('\n\n'));

  // 4. Connection Topology
  const connectionSpecs: string[] = ['## 4. Connection Relationships'];
  blueprint.connections.forEach((conn) => {
    const from = nodeMap.get(conn.fromNodeId)?.name || conn.fromNodeId;
    const to = nodeMap.get(conn.toNodeId)?.name || conn.toNodeId;
    const typeLabel = conn.fromOutputType !== 'main' ? ` [type: ${conn.fromOutputType}]` : '';
    connectionSpecs.push(`- Connect **${from}** (Output ${conn.fromOutputIndex}${typeLabel}) ➔ **${to}** (Input ${conn.toInputIndex})`);
  });
  sections.push(connectionSpecs.join('\n'));

  // 5. Explicit Assumptions & Known Constraints
  if (blueprint.assumptions && blueprint.assumptions.length > 0) {
    const assumptionList = blueprint.assumptions.map((a) => `- ${a}`).join('\n');
    sections.push(`## 5. Explicit Assumptions\n${assumptionList}`);
  }

  // 6. Strict Guardrails & Verification Instructions
  sections.push(`## 6. Construction Guardrails
1. DO NOT invent non-existent node types or parameters. Only use the canonical node identifiers specified above.
2. DO NOT embed live API keys or secrets in node parameter values.
3. Validate connection indexes before saving or executing.
4. Perform manual credential attachment in the n8n credential store.`);

  return sections.join('\n\n');
}
