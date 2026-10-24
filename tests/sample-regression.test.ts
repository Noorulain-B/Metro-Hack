import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MockAiProvider } from '../src/lib/ai/mock-provider';
import { validateWorkflowBlueprint } from '../src/lib/n8n/validator';
import { generateN8nWorkflowJson, formatN8nJsonString } from '../src/lib/n8n/generator';
import { generateOptimizedN8nPrompt } from '../src/lib/n8n/prompt-generator';
import { isSupportedNodeType, isVersionSupported, validateNodeParameters } from '../src/lib/n8n/registry';
import { WorkflowBlueprint } from '../src/lib/schemas/blueprint';

describe('Sample Request Regression Test: Full-Fidelity Customer Support Triage', () => {
  const provider = new MockAiProvider();
  const samplePrompt = 'When a new customer email arrives, classify its sentiment and urgency, then notify the support team in Slack.';

  test('Implements complete customer support workflow with real Gmail trigger, sentiment, urgency, customer extraction, and 3-way routing', async () => {
    // 1. Analyze requirement
    const { requirement } = await provider.analyzeRequirement(samplePrompt);
    assert.equal(requirement.triggerType, 'email');
    assert.equal(requirement.hasAiAgent, true);

    // 2. Generate canonical blueprint
    const { blueprint } = await provider.generateBlueprint(requirement, { targetN8nVersion: '1.70.0' });

    // --- Requirement Check 1: Real Gmail Trigger (NO silent webhook substitution) ---
    const triggerNode = blueprint.nodes.find((n) => n.id === 'node_trigger');
    assert.ok(triggerNode, 'Trigger node must exist');
    assert.equal(triggerNode.type, 'n8n-nodes-base.gmailTrigger', 'First node MUST be n8n-nodes-base.gmailTrigger');
    assert.notEqual(triggerNode.type, 'n8n-nodes-base.webhook');
    assert.equal(triggerNode.credentials?.gmailOAuth2, '[CONFIGURE_CREDENTIAL: gmailOAuth2]');

    // --- Requirement Check 2 & 3: Sentiment & Urgency Levels ---
    const agentNode = blueprint.nodes.find((n) => n.type === '@n8n/n8n-nodes-langchain.agent');
    assert.ok(agentNode, 'AI Agent node must exist');
    const agentSystemMessage = (agentNode.parameters.options as { systemMessage?: string })?.systemMessage || '';
    
    // Positive, neutral, negative sentiment
    assert.ok(agentSystemMessage.includes('positive') && agentSystemMessage.includes('neutral') && agentSystemMessage.includes('negative'),
      'AI Agent must instruct model to classify into positive, neutral, and negative sentiment');
    
    // Urgency levels low, medium, high, and critical
    assert.ok(
      agentSystemMessage.includes('low') &&
      agentSystemMessage.includes('medium') &&
      agentSystemMessage.includes('high') &&
      agentSystemMessage.includes('critical'),
      'AI Agent must instruct model to classify urgency into low, medium, high, and critical'
    );

    // --- Requirement Check 4: Extraction of Customer Name, Email, Category, Summary, Action ---
    assert.ok(agentSystemMessage.includes('customerName'), 'Must extract customerName');
    assert.ok(agentSystemMessage.includes('customerEmail'), 'Must extract customerEmail');
    assert.ok(agentSystemMessage.includes('issueCategory'), 'Must extract issueCategory');
    assert.ok(agentSystemMessage.includes('summary'), 'Must extract summary');
    assert.ok(agentSystemMessage.includes('recommendedAction'), 'Must extract recommendedAction');

    // --- Requirement Check 5: High/Critical Branch -> High Priority Slack Notification ---
    const highPrioritySlack = blueprint.nodes.find((n) => n.id === 'node_slack_high_priority');
    assert.ok(highPrioritySlack, 'High-priority Slack alert node must exist');
    const highSlackText = (highPrioritySlack.parameters.text as string) || '';
    assert.ok(highSlackText.includes('HIGH / CRITICAL'), 'High-priority Slack message must indicate high/critical priority');
    assert.ok(highSlackText.includes('Customer:'), 'High-priority Slack message must contain Customer');
    assert.ok(highSlackText.includes('Issue Category:'), 'High-priority Slack message must contain Issue Category');
    assert.ok(highSlackText.includes('Sentiment:'), 'High-priority Slack message must contain Sentiment');
    assert.ok(highSlackText.includes('Urgency Level:'), 'High-priority Slack message must contain Urgency Level');
    assert.ok(highSlackText.includes('Summary:'), 'High-priority Slack message must contain Summary');
    assert.ok(highSlackText.includes('Recommended Next Action:'), 'High-priority Slack message must contain Recommended Next Action');

    // --- Requirement Check 6: Low/Medium Branch -> Normal Priority Slack Notification ---
    const normalPrioritySlack = blueprint.nodes.find((n) => n.id === 'node_slack_normal_priority');
    assert.ok(normalPrioritySlack, 'Normal-priority Slack notification node must exist');
    const normalSlackText = (normalPrioritySlack.parameters.text as string) || '';
    assert.ok(normalSlackText.includes('Standard Support Ticket'), 'Normal-priority Slack message must indicate standard priority');
    assert.ok(normalSlackText.includes('Customer:'), 'Normal-priority Slack message must contain Customer');
    assert.ok(normalSlackText.includes('Issue Category:'), 'Normal-priority Slack message must contain Issue Category');
    assert.ok(normalSlackText.includes('Sentiment:'), 'Normal-priority Slack message must contain Sentiment');
    assert.ok(normalSlackText.includes('Urgency Level:'), 'Normal-priority Slack message must contain Urgency Level');
    assert.ok(normalSlackText.includes('Summary:'), 'Normal-priority Slack message must contain Summary');
    assert.ok(normalSlackText.includes('Recommended Next Action:'), 'Normal-priority Slack message must contain Recommended Next Action');

    // --- Requirement Check 7: Uncertain/Failed Path -> Manual Review ---
    const manualReviewSlack = blueprint.nodes.find((n) => n.id === 'node_slack_manual_review');
    assert.ok(manualReviewSlack, 'Manual review Slack node must exist for uncertain or failed classifications');
    const manualSlackText = (manualReviewSlack.parameters.text as string) || '';
    assert.ok(manualSlackText.includes('Manual Review Required'), 'Manual review Slack text must state manual review is required');

    // --- Requirement Check 8: Error Handling on AI Classification ---
    const agentOptions = agentNode.parameters.options as { continueOnFail?: boolean };
    assert.equal(agentOptions?.continueOnFail, true, 'AI Agent must have continueOnFail enabled for safe error handling');

    // --- Requirement Check 9: Safety Guardrail - No Automatic Replies to Customers ---
    const hasOutboundEmailNode = blueprint.nodes.some(
      (n) => n.type === 'n8n-nodes-base.gmail' && n.parameters.operation === 'send'
    );
    assert.equal(hasOutboundEmailNode, false, 'STRICT GUARDRAIL: Workflow must NOT contain any automatic customer email send node');
    assert.ok(agentSystemMessage.includes('Do NOT send any automatic email replies'), 'Agent prompt must explicitly forbid automatic email replies');

    // --- Connection Topology Verification ---
    // 1. Trigger -> Format Data
    assert.ok(blueprint.connections.some((c) => c.fromNodeId === 'node_trigger' && c.toNodeId === 'node_format_data'));
    // 2. Format Data -> AI Agent
    assert.ok(blueprint.connections.some((c) => c.fromNodeId === 'node_format_data' && c.toNodeId === 'node_ai_agent'));
    // 3. Gemini Model -> AI Agent (ai_languageModel)
    assert.ok(blueprint.connections.some((c) => c.fromNodeId === 'node_gemini_model' && c.toNodeId === 'node_ai_agent' && c.fromOutputType === 'ai_languageModel'));
    // 4. AI Agent -> If Valid
    assert.ok(blueprint.connections.some((c) => c.fromNodeId === 'node_ai_agent' && c.toNodeId === 'node_if_valid'));
    // 5. If Valid Output 1 (False/Uncertain) -> Manual Review Slack
    assert.ok(blueprint.connections.some((c) => c.fromNodeId === 'node_if_valid' && c.fromOutputIndex === 1 && c.toNodeId === 'node_slack_manual_review'));
    // 6. If Valid Output 0 (True/Valid) -> If Urgency
    assert.ok(blueprint.connections.some((c) => c.fromNodeId === 'node_if_valid' && c.fromOutputIndex === 0 && c.toNodeId === 'node_if_urgency'));
    // 7. If Urgency Output 0 (True/High/Critical) -> High Priority Slack
    assert.ok(blueprint.connections.some((c) => c.fromNodeId === 'node_if_urgency' && c.fromOutputIndex === 0 && c.toNodeId === 'node_slack_high_priority'));
    // 8. If Urgency Output 1 (False/Low/Medium) -> Normal Priority Slack
    assert.ok(blueprint.connections.some((c) => c.fromNodeId === 'node_if_urgency' && c.fromOutputIndex === 1 && c.toNodeId === 'node_slack_normal_priority'));

    // --- Node Registry Verification for Every Node ---
    for (const node of blueprint.nodes) {
      assert.ok(isSupportedNodeType(node.type), `Node "${node.name}" (${node.type}) must be in verified registry`);
      assert.ok(isVersionSupported(node.type, node.typeVersion), `Node "${node.name}" v${node.typeVersion} must be supported`);
      const paramCheck = validateNodeParameters(node.type, node.parameters);
      assert.ok(paramCheck.valid, `Node "${node.name}" missing required params: ${paramCheck.missingRequired.join(', ')}`);
    }

    // --- Validator Verification ---
    const validationReport = validateWorkflowBlueprint(blueprint, requirement);
    assert.equal(validationReport.valid, true, 'Validation must pass for complete workflow');
    assert.equal(validationReport.errors.length, 0);
    assert.ok(validationReport.checksNotPerformed.length >= 3, 'Must explicitly state unperformed runtime checks');

    // --- Dual Output Verification from SAME Approved Blueprint ---
    const jsonOutput = generateN8nWorkflowJson(blueprint);
    const promptOutput = generateOptimizedN8nPrompt(blueprint);

    assert.equal(jsonOutput.nodes.length, blueprint.nodes.length);
    assert.ok(promptOutput.includes('n8n-nodes-base.gmailTrigger'));
    assert.ok(promptOutput.includes('node_slack_manual_review') || promptOutput.includes('Alert Manual Review Team'));
    assert.ok(promptOutput.includes('node_slack_high_priority') || promptOutput.includes('High Priority Slack Alert'));
    assert.ok(promptOutput.includes('node_slack_normal_priority') || promptOutput.includes('Normal Priority Slack Notification'));

    // --- Security & Secret Leaks Check on Exported JSON ---
    const jsonString = formatN8nJsonString(jsonOutput);
    const parsedBack = JSON.parse(jsonString);
    assert.equal(parsedBack.nodes.length, 9, 'Exported JSON must contain all 9 nodes');
    assert.equal(/sk-[a-zA-Z0-9]{20,}/.test(jsonString), false);
    assert.equal(/xoxb-[0-9]{10,}/.test(jsonString), false);
    assert.equal(/AIza[0-9A-Za-z-_]{35}/.test(jsonString), false);
  });

  test('Validator detects and FAILS if webhook is substituted for Gmail trigger', () => {
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
          type: 'n8n-nodes-base.webhook',
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

describe('Sample Request Regression Test: Test A — API Health Check & Alert', () => {
  const provider = new MockAiProvider();
  const healthCheckPrompt =
    'Every hour, trigger a scheduled workflow, make an HTTP GET request to a configurable API health endpoint, evaluate the HTTP status, and send a concise success or failure report to Slack. Handle timeouts and request errors. Do not expose secrets.';

  test('Implements complete API health check workflow with Schedule trigger, HTTP GET, status evaluation, and dual Slack reports', async () => {
    // 1. Analyze requirement
    const { requirement } = await provider.analyzeRequirement(healthCheckPrompt);
    assert.equal(requirement.triggerType, 'schedule');
    assert.ok(requirement.integrations.includes('httpRequest'));
    assert.ok(requirement.integrations.includes('slack'));
    assert.equal(requirement.hasAiAgent, false, 'API health check should be deterministic without unnecessary AI agent overhead');

    // 2. Generate canonical blueprint
    const { blueprint } = await provider.generateBlueprint(requirement, { targetN8nVersion: '1.70.0' });
    assert.equal(blueprint.nodes.length, 5, 'Must generate exactly 5 verified nodes');

    // Node 1: Schedule Trigger
    const triggerNode = blueprint.nodes.find((n) => n.id === 'node_trigger');
    assert.ok(triggerNode, 'Schedule trigger node must exist');
    assert.equal(triggerNode.type, 'n8n-nodes-base.scheduleTrigger');
    assert.equal(triggerNode.typeVersion, 1.2);

    // Node 2: HTTP Request to health endpoint
    const httpNode = blueprint.nodes.find((n) => n.id === 'node_http_health_check');
    assert.ok(httpNode, 'HTTP Request node must exist');
    assert.equal(httpNode.type, 'n8n-nodes-base.httpRequest');
    assert.equal(httpNode.typeVersion, 4.2);
    assert.equal(httpNode.parameters.method, 'GET');
    assert.ok(httpNode.parameters.url, 'Must specify health check URL');
    const httpOptions = httpNode.parameters.options as { timeout?: number; response?: { response?: { neverError?: boolean } } };
    assert.equal(httpOptions?.timeout, 10000, 'Must configure request timeout');
    assert.equal(httpOptions?.response?.response?.neverError, true, 'Must enable neverError to handle timeouts and errors gracefully');

    // Node 3: If Status Check
    const ifNode = blueprint.nodes.find((n) => n.id === 'node_if_status');
    assert.ok(ifNode, 'If node must exist to evaluate HTTP status');
    assert.equal(ifNode.type, 'n8n-nodes-base.if');
    assert.equal(ifNode.typeVersion, 2.2);

    // Node 4: Success Slack Report (Output 0)
    const successNode = blueprint.nodes.find((n) => n.id === 'node_slack_success');
    assert.ok(successNode, 'Success Slack notification node must exist');
    assert.equal(successNode.type, 'n8n-nodes-base.slack');
    assert.ok((successNode.parameters.text as string).includes('Operational'), 'Success text must indicate operational');

    // Node 5: Failure Slack Report (Output 1)
    const failureNode = blueprint.nodes.find((n) => n.id === 'node_slack_failure');
    assert.ok(failureNode, 'Failure Slack notification node must exist');
    assert.equal(failureNode.type, 'n8n-nodes-base.slack');
    assert.ok((failureNode.parameters.text as string).includes('Failure / Outage Detected'), 'Failure text must indicate failure/outage');

    // Connection verification
    // Trigger -> HTTP Request
    assert.ok(blueprint.connections.some((c) => c.fromNodeId === 'node_trigger' && c.toNodeId === 'node_http_health_check'));
    // HTTP Request -> If Status
    assert.ok(blueprint.connections.some((c) => c.fromNodeId === 'node_http_health_check' && c.toNodeId === 'node_if_status'));
    // If Status Output 0 (True) -> Success Slack
    assert.ok(blueprint.connections.some((c) => c.fromNodeId === 'node_if_status' && c.fromOutputIndex === 0 && c.toNodeId === 'node_slack_success'));
    // If Status Output 1 (False) -> Failure Slack
    assert.ok(blueprint.connections.some((c) => c.fromNodeId === 'node_if_status' && c.fromOutputIndex === 1 && c.toNodeId === 'node_slack_failure'));

    // Validate node parameters against registry
    for (const node of blueprint.nodes) {
      assert.ok(isSupportedNodeType(node.type), `Node "${node.name}" (${node.type}) must be in verified registry`);
      assert.ok(isVersionSupported(node.type, node.typeVersion), `Node "${node.name}" v${node.typeVersion} must be supported`);
      const paramCheck = validateNodeParameters(node.type, node.parameters);
      assert.ok(paramCheck.valid, `Node "${node.name}" missing required params: ${paramCheck.missingRequired.join(', ')}`);
    }

    // Validation Report
    const validationReport = validateWorkflowBlueprint(blueprint, requirement);
    assert.equal(validationReport.valid, true, 'Validation must pass for complete health check workflow');
    assert.equal(validationReport.errors.length, 0);

    // Export JSON & Prompt Verification from same blueprint
    const jsonOutput = generateN8nWorkflowJson(blueprint);
    const promptOutput = generateOptimizedN8nPrompt(blueprint);
    assert.equal(jsonOutput.nodes.length, 5);
    assert.ok(promptOutput.includes('n8n-nodes-base.httpRequest'));
    assert.ok(promptOutput.includes('node_slack_success') || promptOutput.includes('Send Success Report to Slack'));
    assert.ok(promptOutput.includes('node_slack_failure') || promptOutput.includes('Send Failure Report to Slack'));

    // Security check: Zero secrets in exported JSON
    const jsonString = formatN8nJsonString(jsonOutput);
    assert.equal(/sk-[a-zA-Z0-9]{20,}/.test(jsonString), false);
    assert.equal(/xoxb-[0-9]{10,}/.test(jsonString), false);
    assert.equal(/AIza[0-9A-Za-z-_]{35}/.test(jsonString), false);
  });

  test('Validator detects and FAILS if HTTP status conditional branch is omitted in health check', () => {
    const faultyBlueprint: WorkflowBlueprint = {
      id: 'bp_faulty_health_branch',
      name: 'Faulty Health Workflow',
      description: 'API health check request',
      targetN8nVersion: '1.70.0',
      assumptions: [],
      unresolvedIssues: [],
      expectedOutputs: [],
      nodes: [
        {
          id: 'node_trigger',
          name: 'Schedule Trigger',
          type: 'n8n-nodes-base.scheduleTrigger',
          typeVersion: 1.2,
          parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1 }] } },
          disabled: false,
        },
        {
          id: 'node_http',
          name: 'HTTP Request',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 4.2,
          parameters: { method: 'GET', url: 'https://api.example.com/health' },
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
        { fromNodeId: 'node_trigger', fromOutputIndex: 0, fromOutputType: 'main', toNodeId: 'node_http', toInputIndex: 0, toInputType: 'main' },
        { fromNodeId: 'node_http', fromOutputIndex: 0, fromOutputType: 'main', toNodeId: 'node_slack', toInputIndex: 0, toInputType: 'main' },
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

    const healthRequirement = {
      title: 'Hourly API Health Check & Alert',
      userGoal: healthCheckPrompt,
      triggerType: 'schedule' as const,
      triggerDetails: { scheduleInterval: 'Every hour', webhookMethod: 'POST' as const },
      dataProcessingSteps: ['Trigger', 'HTTP Request', 'Evaluate HTTP status', 'Send success or failure report to Slack'],
      hasAiAgent: false,
      integrations: ['httpRequest', 'slack'],
      clarifications: [],
      confidenceScore: 0.95,
    };

    const report = validateWorkflowBlueprint(faultyBlueprint, healthRequirement);
    assert.equal(report.valid, false, 'Validation MUST fail when status branch is omitted in health check');
    const branchError = report.errors.find((e) => e.code === 'OMITTED_CONDITIONAL_BRANCH');
    assert.ok(branchError, 'Must report OMITTED_CONDITIONAL_BRANCH error code');
  });
});
