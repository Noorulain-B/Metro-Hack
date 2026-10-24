import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateN8nWorkflowJson, formatN8nJsonString } from '../src/lib/n8n/generator';
import { generateOptimizedN8nPrompt } from '../src/lib/n8n/prompt-generator';
import { WorkflowBlueprint } from '../src/lib/schemas/blueprint';

describe('Official n8n Output Generators (JSON & Prompt)', () => {
  const approvedBlueprint: WorkflowBlueprint = {
    id: 'bp_export_test',
    name: 'Customer Support Triage Flow',
    description: 'When an email arrives, categorize urgency and notify Slack',
    targetN8nVersion: '1.70.0',
    assumptions: ['Using verified n8n nodes only'],
    unresolvedIssues: [],
    expectedOutputs: ['Slack notification delivered'],
    nodes: [
      {
        id: 'node_trigger',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        parameters: { httpMethod: 'POST', path: 'support-webhook' },
        disabled: false,
      },
      {
        id: 'node_slack',
        name: 'Slack Notification',
        type: 'n8n-nodes-base.slack',
        typeVersion: 2.2,
        parameters: { resource: 'message', operation: 'post', text: 'Urgent triage' },
        credentials: { slackApi: '[CONFIGURE_CREDENTIAL: slackApi]' },
        disabled: false,
      },
    ],
    connections: [
      {
        fromNodeId: 'node_trigger',
        fromOutputIndex: 0,
        fromOutputType: 'main',
        toNodeId: 'node_slack',
        toInputIndex: 0,
        toInputType: 'main',
      },
    ],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetN8nVersion: '1.70.0',
      complexityLevel: 'simple',
      estimatedAiCallsPerRun: 0,
      tags: ['webhook', 'slack'],
      version: '1.0.0',
      author: 'Test',
    },
  };

  test('generateN8nWorkflowJson produces valid official n8n workflow structure', () => {
    const jsonOutput = generateN8nWorkflowJson(approvedBlueprint);

    // Structural assertions
    assert.equal(jsonOutput.name, 'Customer Support Triage Flow');
    assert.equal(jsonOutput.nodes.length, 2);
    assert.ok(jsonOutput.versionId.startsWith('v_'));
    assert.deepEqual(jsonOutput.settings, { executionOrder: 'v1' });

    // Node positioning assertions
    const triggerNode = jsonOutput.nodes.find((n) => n.id === 'node_trigger');
    const slackNode = jsonOutput.nodes.find((n) => n.id === 'node_slack');
    assert.ok(triggerNode);
    assert.ok(slackNode);
    assert.deepEqual(triggerNode.position, [240, 300]);
    assert.deepEqual(slackNode.position, [500, 300]);

    // Credentials placeholder check
    assert.ok(slackNode.credentials?.slackApi);
    assert.equal(slackNode.credentials.slackApi.name, '[CONFIGURE_CREDENTIAL: slackApi]');

    // Connections graph assertions
    const webhookConns = jsonOutput.connections['Webhook Trigger'];
    assert.ok(webhookConns);
    assert.ok(webhookConns.main);
    assert.equal(webhookConns.main[0][0].node, 'Slack Notification');
  });

  test('formatN8nJsonString produces valid, re-parseable JSON string', () => {
    const jsonOutput = generateN8nWorkflowJson(approvedBlueprint);
    const formatted = formatN8nJsonString(jsonOutput);

    assert.ok(typeof formatted === 'string');
    const parsedBack = JSON.parse(formatted);
    assert.equal(parsedBack.name, approvedBlueprint.name);
  });

  test('generateOptimizedN8nPrompt uses the SAME approved blueprint and matches its nodes', () => {
    const promptOutput = generateOptimizedN8nPrompt(approvedBlueprint);

    // Verify key blueprint components are represented in prompt
    assert.ok(promptOutput.includes('Customer Support Triage Flow'));
    assert.ok(promptOutput.includes('n8n-nodes-base.webhook'));
    assert.ok(promptOutput.includes('n8n-nodes-base.slack'));
    assert.ok(promptOutput.includes('Webhook Trigger'));
    assert.ok(promptOutput.includes('Slack Notification'));
    assert.ok(promptOutput.includes('DO NOT invent non-existent node types'));
  });
});
