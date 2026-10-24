import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkflowBlueprint } from '../src/lib/n8n/validator';
import { WorkflowBlueprint } from '../src/lib/schemas/blueprint';

describe('Deterministic Validation Engine (Error Detection)', () => {
  const createBaseBlueprint = (): WorkflowBlueprint => ({
    id: 'bp_valid_test',
    name: 'Sample Webhook Alert',
    description: 'Valid test workflow',
    targetN8nVersion: '1.70.0',
    assumptions: ['Testing baseline v1.70.0'],
    unresolvedIssues: [],
    expectedOutputs: ['Webhook triggers notification'],
    nodes: [
      {
        id: 'node_webhook',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        parameters: { httpMethod: 'POST', path: 'incoming' },
        disabled: false,
      },
      {
        id: 'node_slack',
        name: 'Slack',
        type: 'n8n-nodes-base.slack',
        typeVersion: 2.2,
        parameters: { resource: 'message', operation: 'post', text: 'Alert received' },
        credentials: { slackApi: '[CONFIGURE_CREDENTIAL: slackApi]' },
        disabled: false,
      },
    ],
    connections: [
      {
        fromNodeId: 'node_webhook',
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
      tags: ['test'],
      version: '1.0.0',
      author: 'Tester',
    },
  });

  test('Valid blueprint passes validation with zero errors and populated checksNotPerformed', () => {
    const blueprint = createBaseBlueprint();
    const report = validateWorkflowBlueprint(blueprint);

    assert.equal(report.valid, true);
    assert.equal(report.errors.length, 0);
    assert.ok(report.checksNotPerformed.length >= 3, 'Must explicitly document checks not performed');
  });

  test('Detects deliberately introduced UNKNOWN_NODE_TYPE error', () => {
    const blueprint = createBaseBlueprint();
    blueprint.nodes.push({
      id: 'node_fake',
      name: 'Fake Node',
      type: 'n8n-nodes-base.hallucinatedNode',
      typeVersion: 1,
      parameters: {},
      disabled: false,
    });

    const report = validateWorkflowBlueprint(blueprint);
    assert.equal(report.valid, false);
    const unknownError = report.errors.find((e) => e.code === 'UNKNOWN_NODE_TYPE');
    assert.ok(unknownError, 'Must detect unknown node type');
    assert.equal(unknownError.nodeId, 'node_fake');
  });

  test('Detects deliberately introduced UNSUPPORTED_NODE_VERSION error', () => {
    const blueprint = createBaseBlueprint();
    // Webhook supports versions [1, 2], set to 99
    blueprint.nodes[0].typeVersion = 99;

    const report = validateWorkflowBlueprint(blueprint);
    assert.equal(report.valid, false);
    const versionError = report.errors.find((e) => e.code === 'UNSUPPORTED_NODE_VERSION');
    assert.ok(versionError, 'Must detect unsupported node version');
  });

  test('Detects deliberately introduced MISSING_REQUIRED_PARAMETER error', () => {
    const blueprint = createBaseBlueprint();
    // Slack requires 'resource' and 'operation'
    blueprint.nodes[1].parameters = { text: 'Hello' };

    const report = validateWorkflowBlueprint(blueprint);
    assert.equal(report.valid, false);
    const paramError = report.errors.find((e) => e.code === 'MISSING_REQUIRED_PARAMETER');
    assert.ok(paramError, 'Must detect missing required parameter');
  });

  test('Detects deliberately introduced BROKEN_CONNECTION_TARGET error', () => {
    const blueprint = createBaseBlueprint();
    blueprint.connections.push({
      fromNodeId: 'node_webhook',
      fromOutputIndex: 0,
      fromOutputType: 'main',
      toNodeId: 'non_existent_node_id',
      toInputIndex: 0,
      toInputType: 'main',
    });

    const report = validateWorkflowBlueprint(blueprint);
    assert.equal(report.valid, false);
    const brokenConn = report.errors.find((e) => e.code === 'BROKEN_CONNECTION_TARGET');
    assert.ok(brokenConn, 'Must detect broken connection target');
  });

  test('Detects CREDENTIAL_LEAK_DETECTED when raw secret is placed in parameters', () => {
    const blueprint = createBaseBlueprint();
    // Deliberately place raw OpenAI key in parameters
    blueprint.nodes[1].parameters.secret = 'sk-1234567890abcdefghijklmnopqrstuvwxyz';

    const report = validateWorkflowBlueprint(blueprint);
    assert.equal(report.valid, false);
    const leakError = report.errors.find((e) => e.code === 'CREDENTIAL_LEAK_DETECTED');
    assert.ok(leakError, 'Must catch raw secret token in parameters');
  });
});
