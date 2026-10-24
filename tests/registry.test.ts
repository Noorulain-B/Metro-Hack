import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getNodeDefinition,
  isSupportedNodeType,
  isVersionSupported,
  validateNodeParameters,
  getAllNodeDefinitions,
  getNodesByCategory,
} from '../src/lib/n8n/registry';
import { SmartNodeDefinitionSchema } from '../src/lib/schemas/node-registry';

describe('Verified n8n Node Registry', () => {
  test('Every verified node definition matches SmartNodeDefinitionSchema', () => {
    const allNodes = getAllNodeDefinitions();
    assert.ok(allNodes.length >= 10, 'Registry should have at least 10 core nodes');

    for (const node of allNodes) {
      assert.doesNotThrow(
        () => SmartNodeDefinitionSchema.parse(node),
        `Node ${node.nodeType} failed schema validation`
      );
    }
  });

  test('getNodeDefinition returns exact specifications for known nodes', () => {
    const webhook = getNodeDefinition('n8n-nodes-base.webhook');
    assert.ok(webhook);
    assert.equal(webhook.category, 'trigger');
    assert.ok(webhook.supportedVersions.includes(2));

    const slack = getNodeDefinition('n8n-nodes-base.slack');
    assert.ok(slack);
    assert.equal(slack.credentialsRequired, 'slackApi');
  });

  test('isSupportedNodeType accurately identifies supported vs unsupported nodes', () => {
    assert.equal(isSupportedNodeType('n8n-nodes-base.webhook'), true);
    assert.equal(isSupportedNodeType('n8n-nodes-base.httpRequest'), true);
    assert.equal(isSupportedNodeType('@n8n/n8n-nodes-langchain.agent'), true);

    // Reject invented/hallucinated node types
    assert.equal(isSupportedNodeType('n8n-nodes-base.fakeImaginaryNode'), false);
    assert.equal(isSupportedNodeType('n8n-nodes-base.magicAITask'), false);
  });

  test('getNodesByCategory correctly filters nodes', () => {
    const triggers = getNodesByCategory('trigger');
    assert.ok(triggers.some((n) => n.nodeType === 'n8n-nodes-base.webhook'));
    assert.ok(triggers.some((n) => n.nodeType === 'n8n-nodes-base.scheduleTrigger'));

    const aiNodes = getNodesByCategory('ai');
    assert.ok(aiNodes.some((n) => n.nodeType === '@n8n/n8n-nodes-langchain.agent'));
    assert.ok(aiNodes.some((n) => n.nodeType === '@n8n/n8n-nodes-langchain.lmChatGoogleGemini'));
  });

  test('Google Sheets nodes are verified and properly configured', () => {
    const sheetsTrigger = getNodeDefinition('n8n-nodes-base.googleSheetsTrigger');
    assert.ok(sheetsTrigger);
    assert.equal(sheetsTrigger.category, 'trigger');
    assert.equal(sheetsTrigger.credentialsRequired, 'googleSheetsOAuth2');
    assert.ok(sheetsTrigger.requiredParameters.includes('documentId'));

    const sheetsAction = getNodeDefinition('n8n-nodes-base.googleSheets');
    assert.ok(sheetsAction);
    assert.equal(sheetsAction.category, 'action');
    assert.ok(sheetsAction.supportedVersions.includes(4.5));
  });

  test('isVersionSupported detects valid versions and rejects unsupported versions', () => {
    // Valid versions
    assert.equal(isVersionSupported('n8n-nodes-base.webhook', 2), true);
    assert.equal(isVersionSupported('n8n-nodes-base.googleSheets', 4.5), true);

    // Unsupported version
    assert.equal(isVersionSupported('n8n-nodes-base.webhook', 99), false);
    // Non-existent node
    assert.equal(isVersionSupported('n8n-nodes-base.fakeNode', 1), false);
  });

  test('validateNodeParameters checks required parameters and rejects incomplete configurations', () => {
    // Valid configuration for Webhook
    const validWebhookParams = { httpMethod: 'POST', path: 'my-hook' };
    const validResult = validateNodeParameters('n8n-nodes-base.webhook', validWebhookParams);
    assert.equal(validResult.valid, true);
    assert.equal(validResult.missingRequired.length, 0);

    // Incomplete configuration for Webhook (missing path)
    const invalidWebhookParams = { httpMethod: 'POST' };
    const invalidResult = validateNodeParameters('n8n-nodes-base.webhook', invalidWebhookParams);
    assert.equal(invalidResult.valid, false);
    assert.ok(invalidResult.missingRequired.includes('path'));

    // Unknown node rejection
    const unknownNodeResult = validateNodeParameters('n8n-nodes-base.fakeNode', {});
    assert.equal(unknownNodeResult.valid, false);
  });
});
