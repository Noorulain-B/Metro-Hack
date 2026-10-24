import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteWorkflowRepository } from '../src/lib/db/sqlite';
import { SavedWorkflowRecord } from '../src/lib/db/repository';

describe('SQLite Workflow Persistence Layer', () => {
  const repo = new SqliteWorkflowRepository(':memory:');

  const sampleRecord: SavedWorkflowRecord = {
    id: 'test_wf_1',
    name: 'Saved Webhook Flow',
    userPrompt: 'Build a webhook flow',
    targetN8nVersion: '1.70.0',
    blueprint: {
      id: 'bp_1',
      name: 'Saved Webhook Flow',
      description: 'Test description',
      targetN8nVersion: '1.70.0',
      assumptions: [],
      unresolvedIssues: [],
      expectedOutputs: [],
      nodes: [
        {
          id: 'node_1',
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 2,
          parameters: { httpMethod: 'POST', path: 'test' },
          disabled: false,
        },
      ],
      connections: [],
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
    },
    workflowJson: {
      name: 'Saved Webhook Flow',
      nodes: [],
      connections: {},
      pinData: {},
      settings: { executionOrder: 'v1' },
      versionId: 'v_123',
    },
    generatedPrompt: 'Prompt text...',
    validationReport: {
      valid: true,
      targetN8nVersion: '1.70.0',
      errors: [],
      warnings: [],
      infos: [],
      checksNotPerformed: ['Live execution'],
      timestamp: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };

  test('Saves workflow record and retrieves it by ID', async () => {
    await repo.saveWorkflow(sampleRecord);

    const retrieved = await repo.getWorkflowById('test_wf_1');
    assert.ok(retrieved);
    assert.equal(retrieved.name, 'Saved Webhook Flow');
    assert.equal(retrieved.blueprint.nodes[0].name, 'Webhook');
  });

  test('Lists saved workflow records ordered by creation date', async () => {
    const list = await repo.listWorkflows();
    assert.ok(list.length >= 1);
    assert.equal(list[0].id, 'test_wf_1');
  });

  test('Deletes workflow by ID', async () => {
    const deleted = await repo.deleteWorkflow('test_wf_1');
    assert.equal(deleted, true);

    const notFound = await repo.getWorkflowById('test_wf_1');
    assert.equal(notFound, null);
  });
});
