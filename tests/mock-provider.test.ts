import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MockAiProvider } from '../src/lib/ai/mock-provider';
import { getAiProvider } from '../src/lib/ai/factory';
import { RequirementSpecificationSchema } from '../src/lib/schemas/requirement';
import { WorkflowBlueprintSchema } from '../src/lib/schemas/blueprint';
import { isSupportedNodeType } from '../src/lib/n8n/registry';

describe('Mock AI Provider ($0 Spend & Deterministic Engine)', () => {
  const provider = new MockAiProvider();

  test('analyzeRequirement returns valid RequirementSpecification for email triage prompt', async () => {
    const prompt = 'When a new customer email arrives, use AI to classify the request and send a Slack alert';
    const { requirement, metrics } = await provider.analyzeRequirement(prompt);

    // Validate against Zod schema
    const validated = RequirementSpecificationSchema.parse(requirement);
    assert.equal(validated.triggerType, 'email');
    assert.equal(validated.hasAiAgent, true);
    assert.ok(validated.integrations.includes('gmail') || validated.integrations.includes('slack'));

    // Check $0 cost guarantee
    assert.equal(metrics.estimatedCostUsd, 0.0);
    assert.equal(metrics.isMock, true);
    assert.ok(metrics.totalTokens > 0);
  });

  test('analyzeRequirement produces clarification questions for ambiguous schedule requests', async () => {
    const prompt = 'Run an automation on a schedule to fetch data and alert Slack';
    const { requirement } = await provider.analyzeRequirement(prompt);

    assert.equal(requirement.triggerType, 'schedule');
    const scheduleQuestion = requirement.clarifications.find((q) => q.id === 'q_schedule_freq');
    assert.ok(scheduleQuestion, 'Should produce a clarification question for schedule frequency');
    assert.equal(scheduleQuestion.defaultAnswer, 'Every hour');
  });

  test('generateBlueprint creates a valid WorkflowBlueprint with ONLY verified n8n nodes', async () => {
    const prompt = 'Send Slack alert on new webhook event with AI summary';
    const { requirement } = await provider.analyzeRequirement(prompt);
    const { blueprint, metrics } = await provider.generateBlueprint(requirement, { targetN8nVersion: '1.70.0' });

    // Validate complete blueprint against schema
    const validated = WorkflowBlueprintSchema.parse(blueprint);
    assert.equal(validated.targetN8nVersion, '1.70.0');
    assert.ok(validated.nodes.length >= 2, 'Should create at least 2 nodes');
    assert.ok(validated.connections.length >= 1, 'Should create at least 1 connection');

    // CRITICAL: Ensure NO node is hallucinated
    for (const node of validated.nodes) {
      assert.ok(
        isSupportedNodeType(node.type),
        `Node type "${node.type}" must be registered in verified registry`
      );
    }

    // Check cost metrics
    assert.equal(metrics.estimatedCostUsd, 0.0);
    assert.equal(metrics.isMock, true);
  });

  test('getAiProvider defaults to MockAiProvider in test environment', () => {
    const resolvedProvider = getAiProvider();
    assert.equal(resolvedProvider.providerId, 'mock');
  });
});
