import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MockAiProvider } from '../src/lib/ai/mock-provider';
import { optimizeWorkflowBlueprint } from '../src/lib/n8n/optimizer';
import { validateWorkflowBlueprint } from '../src/lib/n8n/validator';
import { generateN8nWorkflowJson, formatN8nJsonString } from '../src/lib/n8n/generator';
import { generateOptimizedN8nPrompt } from '../src/lib/n8n/prompt-generator';

describe('End-to-End Pipeline Integration Test (Mock Mode: $0 Spend)', () => {
  const mockAi = new MockAiProvider();

  test('Realistic user prompt traverses full pipeline: Prompt ➔ Requirement ➔ Blueprint ➔ Optimizer ➔ Validator ➔ JSON & Prompt', async () => {
    // 1. User enters natural language request
    const userPrompt = 'When a customer support email arrives, use AI to classify the sentiment and urgency, and if urgent send a Slack notification';

    // 2. AI Requirement Analysis
    const { requirement, metrics: reqMetrics } = await mockAi.analyzeRequirement(userPrompt);
    assert.equal(requirement.hasAiAgent, true);
    assert.equal(requirement.triggerType, 'email');
    assert.equal(reqMetrics.estimatedCostUsd, 0.0);

    // 3. Structured Workflow Blueprint Generation
    const { blueprint, metrics: bpMetrics } = await mockAi.generateBlueprint(requirement, {
      targetN8nVersion: '1.70.0',
    });
    assert.equal(blueprint.targetN8nVersion, '1.70.0');
    assert.ok(blueprint.nodes.length >= 3, 'Must create trigger, transform, AI agent, and action nodes');
    assert.equal(bpMetrics.estimatedCostUsd, 0.0);

    // 4. Deterministic Optimization
    const optimization = optimizeWorkflowBlueprint(blueprint);
    assert.ok(optimization.optimizedBlueprint);
    assert.equal(optimization.optimizedBlueprint.id, blueprint.id);

    // 5. Deterministic Validation Engine
    const validationReport = validateWorkflowBlueprint(optimization.optimizedBlueprint);
    assert.equal(validationReport.valid, true, 'Generated blueprint must pass validation with 0 blocking errors');
    assert.equal(validationReport.errors.length, 0);
    assert.ok(validationReport.checksNotPerformed.length > 0);

    // 6. Dual Output Generation from the SAME approved blueprint
    const approvedBlueprint = optimization.optimizedBlueprint;

    // A: n8n Workflow JSON
    const n8nJson = generateN8nWorkflowJson(approvedBlueprint);
    assert.equal(n8nJson.name, approvedBlueprint.name);
    assert.equal(n8nJson.nodes.length, approvedBlueprint.nodes.length);
    assert.ok(Object.keys(n8nJson.connections).length > 0);

    // Verify downloadable string
    const jsonString = formatN8nJsonString(n8nJson);
    assert.ok(jsonString.includes('n8n-nodes-base'));

    // B: Optimized AI Prompt
    const promptText = generateOptimizedN8nPrompt(approvedBlueprint);
    assert.ok(promptText.includes(approvedBlueprint.name));
    assert.ok(promptText.includes('Construction Guardrails'));

    // 7. Verify both outputs share the exact same nodes
    for (const node of approvedBlueprint.nodes) {
      assert.ok(n8nJson.nodes.some((n) => n.name === node.name));
      assert.ok(promptText.includes(node.name));
    }

    // 8. Total spend verification
    const totalCost = reqMetrics.estimatedCostUsd + bpMetrics.estimatedCostUsd;
    assert.equal(totalCost, 0.0, 'Pipeline in mock mode must have strictly $0 cost');
  });
});
