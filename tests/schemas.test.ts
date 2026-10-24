import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RequirementSpecificationSchema, ClarificationQuestionSchema } from '../src/lib/schemas/requirement';
import { WorkflowBlueprintSchema, BlueprintNodeSchema } from '../src/lib/schemas/blueprint';
import { ValidationReportSchema } from '../src/lib/schemas/validation';

describe('Requirement Schemas', () => {
  test('ClarificationQuestionSchema validates proper question definition', () => {
    const validQuestion = {
      id: 'q_test_1',
      question: 'What Slack channel should receive alerts?',
      context: 'Needed for configuring the Slack destination channel',
      options: ['#alerts', '#general'],
      defaultAnswer: '#alerts',
      isEssential: false,
      category: 'output' as const,
    };

    const parsed = ClarificationQuestionSchema.parse(validQuestion);
    assert.equal(parsed.id, 'q_test_1');
    assert.equal(parsed.defaultAnswer, '#alerts');
  });

  test('RequirementSpecificationSchema accepts valid specification and applies defaults', () => {
    const validReq = {
      title: 'Email Alert Workflow',
      userGoal: 'Send a Slack message when a new customer email arrives',
      triggerType: 'email' as const,
      dataProcessingSteps: ['Receive email', 'Format message', 'Send Slack alert'],
      integrations: ['gmail', 'slack'],
    };

    const parsed = RequirementSpecificationSchema.parse(validReq);
    assert.equal(parsed.title, 'Email Alert Workflow');
    assert.equal(parsed.hasAiAgent, false);
    assert.deepEqual(parsed.clarifications, []);
    assert.equal(parsed.confidenceScore, 1.0);
  });

  test('RequirementSpecificationSchema rejects invalid trigger types', () => {
    const invalidReq = {
      title: 'Bad Workflow',
      userGoal: 'Invalid trigger test',
      triggerType: 'invalid_trigger_type',
      dataProcessingSteps: ['Step 1'],
      integrations: [],
    };

    assert.throws(() => RequirementSpecificationSchema.parse(invalidReq));
  });
});

describe('Blueprint Schemas', () => {
  test('BlueprintNodeSchema validates a verified n8n node structure', () => {
    const node = {
      id: 'node_webhook_1',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      parameters: { httpMethod: 'POST', path: 'test' },
      credentials: {},
      disabled: false,
    };

    const parsed = BlueprintNodeSchema.parse(node);
    assert.equal(parsed.type, 'n8n-nodes-base.webhook');
    assert.equal(parsed.typeVersion, 2);
  });

  test('WorkflowBlueprintSchema validates a complete workflow blueprint', () => {
    const validBlueprint = {
      id: 'bp_123',
      name: 'Customer Support Flow',
      description: 'Categorizes incoming customer emails and sends Slack alerts',
      targetN8nVersion: '1.70.0',
      assumptions: ['Targeting n8n v1.70+'],
      unresolvedIssues: [],
      expectedOutputs: ['Slack message posted to #support'],
      nodes: [
        {
          id: 'node_trigger',
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 2,
          parameters: { httpMethod: 'POST', path: 'support' },
        },
        {
          id: 'node_slack',
          name: 'Slack',
          type: 'n8n-nodes-base.slack',
          typeVersion: 2.2,
          parameters: { resource: 'message', operation: 'post', text: 'New support request' },
        },
      ],
      connections: [
        {
          fromNodeId: 'node_trigger',
          fromOutputIndex: 0,
          fromOutputType: 'main' as const,
          toNodeId: 'node_slack',
          toInputIndex: 0,
          toInputType: 'main' as const,
        },
      ],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        targetN8nVersion: '1.70.0',
        complexityLevel: 'simple' as const,
        estimatedAiCallsPerRun: 0,
        tags: ['webhook', 'slack'],
        version: '1.0.0',
        author: 'Test',
      },
    };

    const parsed = WorkflowBlueprintSchema.parse(validBlueprint);
    assert.equal(parsed.name, 'Customer Support Flow');
    assert.equal(parsed.nodes.length, 2);
    assert.equal(parsed.connections.length, 1);
  });
});

describe('Validation Schemas', () => {
  test('ValidationReportSchema validates structured report with checksNotPerformed', () => {
    const report = {
      valid: true,
      targetN8nVersion: '1.70.0',
      errors: [],
      warnings: [
        {
          severity: 'warning' as const,
          code: 'CREDENTIAL_PLACEHOLDER_REQUIRED',
          message: 'Slack node requires credential configuration in your n8n instance',
          nodeId: 'node_slack',
          suggestedCorrection: 'Configure Slack API credentials after importing into n8n',
        },
      ],
      infos: [],
      checksNotPerformed: [
        'Live execution inside an active n8n instance',
        'Real-time credential authentication verification',
      ],
      timestamp: new Date().toISOString(),
    };

    const parsed = ValidationReportSchema.parse(report);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.warnings.length, 1);
    assert.equal(parsed.checksNotPerformed.length, 2);
  });
});
