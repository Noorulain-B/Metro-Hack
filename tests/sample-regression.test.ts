import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MockAiProvider } from '../src/lib/ai/mock-provider';
import { validateWorkflowBlueprint } from '../src/lib/n8n/validator';
import { generateN8nWorkflowJson } from '../src/lib/n8n/generator';
import { generateOptimizedN8nPrompt } from '../src/lib/n8n/prompt-generator';
import { isSupportedNodeType } from '../src/lib/n8n/registry';
import { WorkflowBlueprint } from '../src/lib/schemas/blueprint';

describe('Sample Request Regression Test: Gmail Support Classifier & Urgent Slack Alert', () => {
  const provider = new MockAiProvider();
  const samplePrompt = 'When a new customer email arrives, classify its sentiment and urgency, then notify the support team in Slack.';

  test('Produces genuinely correct workflow with real Gmail trigger, Gemini-powered AI agent, urgency branch, and Slack alert', async () => {
    // 1. Analyze requirement
    const { requirement } = await provider.analyzeRequirement(samplePrompt);
    assert.equal(requirement.triggerType, 'email');
    assert.equal(requirement.hasAiAgent, true);

    // 2. Generate blueprint
    const { blueprint } = await provider.generateBlueprint(requirement, { targetN8nVersion: '1.70.0' });

    // Regression Check A: First node must be verified Gmail Trigger (NO silent webhook substitution!)
    const triggerNode = blueprint.nodes.find((n) => n.id === 'node_trigger');
    assert.ok(triggerNode, 'Trigger node must exist');
    assert.equal(
      triggerNode.type,
      'n8n-nodes-base.gmailTrigger',
      'First node MUST be n8n-nodes-base.gmailTrigger, NOT a substituted webhook'
    );
    assert.notEqual(triggerNode.type, 'n8n-nodes-base.webhook');
    assert.equal(triggerNode.credentials?.gmailOAuth2, '[CONFIGURE_CREDENTIAL: gmailOAuth2]');

    // Regression Check B: All nodes in the blueprint must be officially supported in registry
    for (const node of blueprint.nodes) {
      assert.ok(isSupportedNodeType(node.type), `Node "${node.name}" (${node.type}) must be in verified registry`);
    }

    // Regression Check C: AI Agent is connected to Gemini Model
    const agentNode = blueprint.nodes.find((n) => n.type === '@n8n/n8n-nodes-langchain.agent');
    const geminiNode = blueprint.nodes.find((n) => n.type === '@n8n/n8n-nodes-langchain.lmChatGoogleGemini');
    assert.ok(agentNode, 'AI Agent node must be present');
    assert.ok(geminiNode, 'Gemini Chat Model node must be present');

    const modelConnection = blueprint.connections.find(
      (c) => c.fromNodeId === geminiNode.id && c.toNodeId === agentNode.id && c.fromOutputType === 'ai_languageModel'
    );
    assert.ok(modelConnection, 'Gemini Model must connect to AI Agent via ai_languageModel socket');

    // Regression Check D: Urgency condition branch (If node) must be implemented
    const ifNode = blueprint.nodes.find((n) => n.type === 'n8n-nodes-base.if');
    assert.ok(ifNode, 'Urgency condition (n8n-nodes-base.if) must NOT be omitted');

    // Regression Check E: Slack action node receives classification, urgency, summary, and action
    const slackNode = blueprint.nodes.find((n) => n.type === 'n8n-nodes-base.slack');
    assert.ok(slackNode, 'Slack notification node must exist');
    const slackText = (slackNode.parameters.text as string) || '';
    assert.ok(slackText.includes('Classification'), 'Slack text must include Classification/Sentiment');
    assert.ok(slackText.includes('Urgency'), 'Slack text must include Urgency Level');
    assert.ok(slackText.includes('Summary'), 'Slack text must include Summary');
    assert.ok(slackText.includes('Recommended Next Action'), 'Slack text must include Recommended Next Action');

    // Regression Check F: Slack is connected to True branch (Output 0) of the If node
    const ifToSlackConn = blueprint.connections.find(
      (c) => c.fromNodeId === ifNode.id && c.toNodeId === slackNode.id && c.fromOutputIndex === 0
    );
    assert.ok(ifToSlackConn, 'Slack must be connected to True branch (Output index 0) of If node');

    // Regression Check G: Validation must pass and must declare checks not performed
    const validationReport = validateWorkflowBlueprint(blueprint, requirement);
    assert.equal(validationReport.valid, true);
    assert.equal(validationReport.errors.length, 0);
    assert.ok(validationReport.checksNotPerformed.length >= 3, 'Must explicitly declare checks not performed');

    // Regression Check H: Outputs derived from same blueprint
    const jsonOutput = generateN8nWorkflowJson(blueprint);
    const promptOutput = generateOptimizedN8nPrompt(blueprint);

    assert.equal(jsonOutput.nodes.length, blueprint.nodes.length);
    assert.ok(promptOutput.includes('n8n-nodes-base.gmailTrigger'));
    assert.ok(promptOutput.includes('n8n-nodes-base.if'));
    assert.ok(promptOutput.includes('n8n-nodes-base.slack'));
  });

  test('Validator detects and FAILS if webhook is substituted for Gmail trigger', () => {
    // Clone blueprint and maliciously substitute webhook
    const faultyBlueprint: WorkflowBlueprint = {
      id: 'bp_faulty_sub',
      name: 'Faulty Substituted Workflow',
      description: 'Customer email request',
      targetN8nVersion: '1.70.0',
      assumptions: [],
      unresolvedIssues: [],
      expectedOutputs: [],
      nodes: [
        {
          id: 'node_trigger',
          name: 'Webhook Trigger',
          type: 'n8n-nodes-base.webhook', // Substituted!
          typeVersion: 2,
          parameters: { httpMethod: 'POST', path: 'test' },
          disabled: false,
        },
        {
          id: 'node_slack',
          name: 'Slack',
          type: 'n8n-nodes-base.slack',
          typeVersion: 2.2,
          parameters: { resource: 'message', operation: 'post', text: 'Alert' },
          disabled: false,
        },
      ],
      connections: [
        { fromNodeId: 'node_trigger', fromOutputIndex: 0, fromOutputType: 'main', toNodeId: 'node_slack', toInputIndex: 0, toInputType: 'main' },
      ],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        targetN8nVersion: '1.70.0',
        complexityLevel: 'simple',
        estimatedAiCallsPerRun: 0,
        tags: [],
        version: '1.0.0',
        author: 'Test',
      },
    };

    const emailRequirement = {
      title: 'Customer Email Triage',
      userGoal: 'When a new customer email arrives, classify urgency then notify Slack',
      triggerType: 'email' as const,
      triggerDetails: { webhookMethod: 'POST' as const },
      dataProcessingSteps: ['Receive email', 'Notify'],
      hasAiAgent: false,
      integrations: ['gmail', 'slack'],
      clarifications: [],
      confidenceScore: 0.95,
    };

    const report = validateWorkflowBlueprint(faultyBlueprint, emailRequirement);
    assert.equal(report.valid, false, 'Validation MUST fail when webhook is substituted for Gmail');
    const subError = report.errors.find((e) => e.code === 'SUBSTITUTED_TRIGGER_DETECTED');
    assert.ok(subError, 'Must report SUBSTITUTED_TRIGGER_DETECTED error code');
  });

  test('Validator detects and FAILS if urgency condition branch is omitted', () => {
    const faultyBlueprint: WorkflowBlueprint = {
      id: 'bp_faulty_branch',
      name: 'Faulty Branch Workflow',
      description: 'Customer email request',
      targetN8nVersion: '1.70.0',
      assumptions: [],
      unresolvedIssues: [],
      expectedOutputs: [],
      nodes: [
        {
          id: 'node_trigger',
          name: 'Gmail Trigger',
          type: 'n8n-nodes-base.gmailTrigger',
          typeVersion: 1.1,
          parameters: { pollTimes: { item: [{ mode: 'everyMinute' }] }, event: 'messageReceived' },
          disabled: false,
        },
        {
          id: 'node_slack',
          name: 'Slack',
          type: 'n8n-nodes-base.slack',
          typeVersion: 2.2,
          parameters: { resource: 'message', operation: 'post', text: 'Alert' },
          disabled: false,
        },
      ],
      connections: [
        { fromNodeId: 'node_trigger', fromOutputIndex: 0, fromOutputType: 'main', toNodeId: 'node_slack', toInputIndex: 0, toInputType: 'main' },
      ],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        targetN8nVersion: '1.70.0',
        complexityLevel: 'simple',
        estimatedAiCallsPerRun: 0,
        tags: [],
        version: '1.0.0',
        author: 'Test',
      },
    };

    const urgentRequirement = {
      title: 'Customer Email Triage',
      userGoal: 'When a new customer email arrives, classify its sentiment and urgency, then notify the support team in Slack.',
      triggerType: 'email' as const,
      triggerDetails: { webhookMethod: 'POST' as const },
      dataProcessingSteps: ['Receive email', 'Check urgency', 'Notify'],
      hasAiAgent: true,
      integrations: ['gmail', 'slack'],
      clarifications: [],
      confidenceScore: 0.95,
    };

    const report = validateWorkflowBlueprint(faultyBlueprint, urgentRequirement);
    assert.equal(report.valid, false, 'Validation MUST fail when urgency branch is omitted');
    const branchError = report.errors.find((e) => e.code === 'OMITTED_CONDITIONAL_BRANCH');
    assert.ok(branchError, 'Must report OMITTED_CONDITIONAL_BRANCH error code');
  });
});
