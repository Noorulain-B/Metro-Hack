import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MockAiProvider } from '../src/lib/ai/mock-provider';
import { optimizeWorkflowBlueprint } from '../src/lib/n8n/optimizer';
import { validateWorkflowBlueprint } from '../src/lib/n8n/validator';
import { generateN8nWorkflowJson, formatN8nJsonString } from '../src/lib/n8n/generator';
import { generateOptimizedN8nPrompt } from '../src/lib/n8n/prompt-generator';
import { RequirementSpecificationSchema } from '../src/lib/schemas/requirement';
import { WorkflowBlueprintSchema } from '../src/lib/schemas/blueprint';
import { ValidationReportSchema } from '../src/lib/schemas/validation';

describe('End-to-End Pipeline Verification: Customer Email Triage to Slack', () => {
  const mockAi = new MockAiProvider();

  test('Pipeline processes: "When a new customer email arrives, classify its sentiment and urgency, then notify the support team in Slack."', async () => {
    const userPrompt = 'When a new customer email arrives, classify its sentiment and urgency, then notify the support team in Slack.';

    // Stage 2.1: Requirement Specification
    const { requirement, metrics: reqMetrics } = await mockAi.analyzeRequirement(userPrompt);
    const validatedRequirement = RequirementSpecificationSchema.parse(requirement);

    assert.equal(validatedRequirement.triggerType, 'email');
    assert.equal(validatedRequirement.hasAiAgent, true);
    assert.ok(validatedRequirement.integrations.includes('slack'));
    assert.ok(validatedRequirement.dataProcessingSteps.length >= 3);
    assert.equal(reqMetrics.estimatedCostUsd, 0.0);
    assert.equal(reqMetrics.isMock, true);

    // Stage 2.2: Canonical Workflow Blueprint
    const { blueprint, metrics: bpMetrics } = await mockAi.generateBlueprint(validatedRequirement, {
      targetN8nVersion: '1.70.0',
    });
    const validatedBlueprint = WorkflowBlueprintSchema.parse(blueprint);

    assert.equal(validatedBlueprint.targetN8nVersion, '1.70.0');
    assert.ok(validatedBlueprint.nodes.length >= 4, 'Must include trigger, transform, AI agent, model subnode, and Slack action');
    assert.ok(validatedBlueprint.connections.length >= 3);
    assert.equal(bpMetrics.estimatedCostUsd, 0.0);

    // Verify Slack node is explicitly present
    const slackNode = validatedBlueprint.nodes.find((n) => n.type === 'n8n-nodes-base.slack');
    assert.ok(slackNode, 'Blueprint must contain the requested Slack action node');
    assert.equal(slackNode.credentials?.slackApi, '[CONFIGURE_CREDENTIAL: slackApi]');

    // Stage 2.3: Deterministic Optimization
    const optimization = optimizeWorkflowBlueprint(validatedBlueprint);
    const approvedBlueprint = optimization.optimizedBlueprint;
    assert.equal(approvedBlueprint.id, validatedBlueprint.id);

    // Stage 2.4: Deterministic Validation Report
    const validationReport = validateWorkflowBlueprint(approvedBlueprint);
    const validatedReport = ValidationReportSchema.parse(validationReport);

    assert.equal(validatedReport.valid, true, 'Workflow must be structurally valid with zero blocking errors');
    assert.equal(validatedReport.errors.length, 0);
    assert.ok(validatedReport.checksNotPerformed.length >= 3, 'Must clearly declare checks not performed');

    // Stage 2.5: Dual Output Generation from SAME approved blueprint
    // Output A: Official n8n Workflow JSON
    const n8nJson = generateN8nWorkflowJson(approvedBlueprint);
    assert.equal(n8nJson.name, approvedBlueprint.name);
    assert.equal(n8nJson.nodes.length, approvedBlueprint.nodes.length);
    assert.ok(n8nJson.connections['Gmail Trigger'] || n8nJson.connections['Inbound Email Webhook'] || n8nJson.connections['Webhook Trigger']);

    // Check Slack connection in JSON
    const slackJsonNode = n8nJson.nodes.find((n) => n.type === 'n8n-nodes-base.slack');
    assert.ok(slackJsonNode);
    assert.deepEqual(slackJsonNode.credentials, {
      slackApi: { name: '[CONFIGURE_CREDENTIAL: slackApi]' },
    });

    const jsonString = formatN8nJsonString(n8nJson);
    assert.ok(jsonString.includes('n8n-nodes-base.slack'));

    // Output B: Optimized Prompt
    const promptText = generateOptimizedN8nPrompt(approvedBlueprint);
    assert.ok(promptText.includes('n8n-nodes-base.slack'));
    assert.ok(promptText.includes('@n8n/n8n-nodes-langchain.agent'));
    assert.ok(promptText.includes('Construction Guardrails'));

    // Stage 3 Verification: Confirm NO secrets are exposed
    const fullJsonText = JSON.stringify(n8nJson);
    assert.equal(/sk-[a-zA-Z0-9]{20,}/.test(fullJsonText), false);
    assert.equal(/xoxb-[0-9]{10,}/.test(fullJsonText), false);
    assert.equal(/AIza[0-9A-Za-z-_]{35}/.test(fullJsonText), false);

    // Total cost verification
    assert.equal(reqMetrics.estimatedCostUsd + bpMetrics.estimatedCostUsd, 0.0);
  });
});
