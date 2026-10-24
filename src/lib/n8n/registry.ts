import {
  SmartNodeDefinition,
  NodeCategory,
  SmartNodeDefinitionSchema,
} from '../schemas/node-registry';

/**
 * Curated, verified repository of official n8n node specifications.
 * All node types, parameter keys, and versions are cross-checked against
 * official n8n node definitions (n8n-nodes-base and @n8n/n8n-nodes-langchain).
 */
export const VERIFIED_N8N_NODES: Record<string, SmartNodeDefinition> = {
  // 1. Webhook Trigger
  'n8n-nodes-base.webhook': SmartNodeDefinitionSchema.parse({
    nodeType: 'n8n-nodes-base.webhook',
    displayName: 'Webhook',
    category: 'trigger',
    supportedVersions: [1, 2],
    defaultVersion: 2,
    description: 'Receives HTTP calls and starts the workflow upon receiving a webhook payload.',
    inputs: [],
    outputs: ['main'],
    defaultParameters: {
      httpMethod: 'POST',
      path: 'webhook-endpoint',
      responseMode: 'onReceived',
      responseData: 'allEntries',
      options: {},
    },
    parameters: [
      {
        name: 'httpMethod',
        displayName: 'HTTP Method',
        type: 'options',
        default: 'POST',
        required: true,
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' },
        ],
      },
      {
        name: 'path',
        displayName: 'Path',
        type: 'string',
        default: 'webhook-endpoint',
        required: true,
      },
      {
        name: 'responseMode',
        displayName: 'Response Mode',
        type: 'options',
        default: 'onReceived',
        options: [
          { name: 'Immediately', value: 'onReceived' },
          { name: 'When Last Node Finishes', value: 'lastNode' },
          { name: 'Using Respond to Webhook Node', value: 'responseNode' },
        ],
      },
    ],
    requiredParameters: ['httpMethod', 'path'],
    documentationUrl: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/',
    isAiNode: false,
  }),

  // 2. Schedule Trigger
  'n8n-nodes-base.scheduleTrigger': SmartNodeDefinitionSchema.parse({
    nodeType: 'n8n-nodes-base.scheduleTrigger',
    displayName: 'Schedule Trigger',
    category: 'trigger',
    supportedVersions: [1, 1.2],
    defaultVersion: 1.2,
    description: 'Triggers a workflow on a repeating time interval, cron schedule, or specific dates.',
    inputs: [],
    outputs: ['main'],
    defaultParameters: {
      rule: {
        interval: [
          {
            field: 'hours',
            hoursInterval: 1,
          },
        ],
      },
    },
    parameters: [
      {
        name: 'rule',
        displayName: 'Trigger Interval',
        type: 'collection',
        default: { interval: [{ field: 'hours', hoursInterval: 1 }] },
        required: true,
      },
    ],
    requiredParameters: ['rule'],
    documentationUrl: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/',
    isAiNode: false,
  }),

  // 3. Manual Trigger
  'n8n-nodes-base.manualTrigger': SmartNodeDefinitionSchema.parse({
    nodeType: 'n8n-nodes-base.manualTrigger',
    displayName: 'When clicking "Test workflow"',
    category: 'trigger',
    supportedVersions: [1],
    defaultVersion: 1,
    description: 'Runs the workflow manually when you click the Test step in the n8n editor.',
    inputs: [],
    outputs: ['main'],
    defaultParameters: {},
    parameters: [],
    requiredParameters: [],
    documentationUrl: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.manualtrigger/',
    isAiNode: false,
  }),

  // 4. HTTP Request
  'n8n-nodes-base.httpRequest': SmartNodeDefinitionSchema.parse({
    nodeType: 'n8n-nodes-base.httpRequest',
    displayName: 'HTTP Request',
    category: 'action',
    supportedVersions: [4, 4.1, 4.2],
    defaultVersion: 4.2,
    description: 'Makes custom HTTP requests to external APIs, REST endpoints, and services.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParameters: {
      method: 'GET',
      url: 'https://api.example.com/data',
      authentication: 'none',
      options: {},
    },
    parameters: [
      {
        name: 'method',
        displayName: 'Method',
        type: 'options',
        default: 'GET',
        required: true,
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'PATCH', value: 'PATCH' },
          { name: 'DELETE', value: 'DELETE' },
        ],
      },
      {
        name: 'url',
        displayName: 'URL',
        type: 'string',
        default: '',
        required: true,
      },
    ],
    requiredParameters: ['method', 'url'],
    documentationUrl: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/',
    isAiNode: false,
  }),

  // 5. Edit Fields (Set)
  'n8n-nodes-base.set': SmartNodeDefinitionSchema.parse({
    nodeType: 'n8n-nodes-base.set',
    displayName: 'Edit Fields (Set)',
    category: 'transform',
    supportedVersions: [3, 3.4],
    defaultVersion: 3.4,
    description: 'Transforms, formats, filters, and sets specific data fields passing through the workflow.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParameters: {
      mode: 'manual',
      fields: {
        values: [],
      },
      options: {},
    },
    parameters: [
      {
        name: 'mode',
        displayName: 'Mode',
        type: 'options',
        default: 'manual',
        options: [
          { name: 'Manual Mapping', value: 'manual' },
          { name: 'Raw JSON', value: 'raw' },
        ],
      },
    ],
    requiredParameters: ['mode'],
    documentationUrl: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.set/',
    isAiNode: false,
  }),

  // 6. Code (JavaScript / Python)
  'n8n-nodes-base.code': SmartNodeDefinitionSchema.parse({
    nodeType: 'n8n-nodes-base.code',
    displayName: 'Code',
    category: 'logic',
    supportedVersions: [1, 2],
    defaultVersion: 2,
    description: 'Executes custom JavaScript or Python to perform bespoke calculations, transformations, or data reshaping.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParameters: {
      mode: 'runOnceForEachItem',
      jsCode: '// Loop through incoming items\nreturn $input.item.json;',
    },
    parameters: [
      {
        name: 'mode',
        displayName: 'Mode',
        type: 'options',
        default: 'runOnceForEachItem',
        options: [
          { name: 'Run Once for Each Item', value: 'runOnceForEachItem' },
          { name: 'Run Once for All Items', value: 'runOnceForAllItems' },
        ],
      },
      {
        name: 'jsCode',
        displayName: 'JavaScript Code',
        type: 'string',
        default: 'return $input.item.json;',
        required: true,
      },
    ],
    requiredParameters: ['mode'],
    documentationUrl: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/',
    isAiNode: false,
  }),

  // 7. If Conditional Node
  'n8n-nodes-base.if': SmartNodeDefinitionSchema.parse({
    nodeType: 'n8n-nodes-base.if',
    displayName: 'If',
    category: 'logic',
    supportedVersions: [2, 2.2],
    defaultVersion: 2.2,
    description: 'Routes data items into True or False branches based on user-defined condition rules.',
    inputs: ['main'],
    outputs: ['main', 'main'], // output 0 = true, output 1 = false
    defaultParameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
        },
        conditions: [],
        combinator: 'and',
      },
      options: {},
    },
    parameters: [
      {
        name: 'conditions',
        displayName: 'Conditions',
        type: 'collection',
        required: true,
      },
    ],
    requiredParameters: ['conditions'],
    documentationUrl: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.if/',
    isAiNode: false,
  }),

  // 8. Slack
  'n8n-nodes-base.slack': SmartNodeDefinitionSchema.parse({
    nodeType: 'n8n-nodes-base.slack',
    displayName: 'Slack',
    category: 'action',
    supportedVersions: [2, 2.1, 2.2],
    defaultVersion: 2.2,
    description: 'Sends messages, alerts, blocks, or manages channels inside Slack workspaces.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParameters: {
      resource: 'message',
      operation: 'post',
      select: 'channel',
      channelId: {
        __rl: true,
        value: '',
        mode: 'name',
      },
      text: '',
    },
    parameters: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'options',
        default: 'message',
        required: true,
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'options',
        default: 'post',
        required: true,
      },
      {
        name: 'text',
        displayName: 'Text',
        type: 'string',
        default: '',
        required: true,
      },
    ],
    requiredParameters: ['resource', 'operation'],
    credentialsRequired: 'slackApi',
    documentationUrl: 'https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.slack/',
    isAiNode: false,
  }),

  // 9. Gmail
  'n8n-nodes-base.gmail': SmartNodeDefinitionSchema.parse({
    nodeType: 'n8n-nodes-base.gmail',
    displayName: 'Gmail',
    category: 'action',
    supportedVersions: [2, 2.1],
    defaultVersion: 2.1,
    description: 'Reads emails, drafts responses, and sends messages using the Gmail API.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParameters: {
      resource: 'message',
      operation: 'send',
      toList: [],
      subject: '',
      message: '',
    },
    parameters: [
      {
        name: 'resource',
        displayName: 'Resource',
        type: 'options',
        default: 'message',
        required: true,
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'options',
        default: 'send',
        required: true,
      },
    ],
    requiredParameters: ['resource', 'operation'],
    credentialsRequired: 'gmailOAuth2',
    documentationUrl: 'https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.gmail/',
    isAiNode: false,
  }),

  // 10. LangChain AI Agent
  '@n8n/n8n-nodes-langchain.agent': SmartNodeDefinitionSchema.parse({
    nodeType: '@n8n/n8n-nodes-langchain.agent',
    displayName: 'AI Agent',
    category: 'ai',
    supportedVersions: [1, 1.7],
    defaultVersion: 1.7,
    description: 'Autonomous AI Agent capable of reasoning, executing multi-step instructions, and calling connected tools.',
    inputs: ['main', 'ai_languageModel', 'ai_tool', 'ai_memory'],
    outputs: ['main'],
    defaultParameters: {
      promptType: 'auto',
      text: '={{ $json.chatInput || $json.body || $json.message }}',
      options: {
        systemMessage: 'You are a helpful and reliable AI assistant in an n8n workflow.',
      },
    },
    parameters: [
      {
        name: 'promptType',
        displayName: 'Prompt Type',
        type: 'options',
        default: 'auto',
        options: [
          { name: 'Take from previous node', value: 'auto' },
          { name: 'Define below', value: 'define' },
        ],
      },
      {
        name: 'text',
        displayName: 'Prompt / Input Text',
        type: 'string',
        default: '',
        required: true,
      },
    ],
    requiredParameters: ['promptType'],
    documentationUrl: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/',
    isAiNode: true,
  }),

  // 11. Google Gemini Chat Model (LangChain subnode)
  '@n8n/n8n-nodes-langchain.lmChatGoogleGemini': SmartNodeDefinitionSchema.parse({
    nodeType: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
    displayName: 'Google Gemini Chat Model',
    category: 'ai',
    supportedVersions: [1],
    defaultVersion: 1,
    description: 'Provides Gemini 1.5/2.0 intelligence to the LangChain AI Agent node.',
    inputs: [],
    outputs: ['ai_languageModel'],
    defaultParameters: {
      modelName: 'models/gemini-1.5-pro-latest',
      options: {
        temperature: 0.2,
      },
    },
    parameters: [
      {
        name: 'modelName',
        displayName: 'Model Name',
        type: 'string',
        default: 'models/gemini-1.5-pro-latest',
        required: true,
      },
    ],
    requiredParameters: ['modelName'],
    credentialsRequired: 'googlePalmApi',
    documentationUrl: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatgooglegemini/',
    isAiNode: true,
  }),

  // 12. OpenAI Chat Model (LangChain subnode)
  '@n8n/n8n-nodes-langchain.lmChatOpenAi': SmartNodeDefinitionSchema.parse({
    nodeType: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
    displayName: 'OpenAI Chat Model',
    category: 'ai',
    supportedVersions: [1, 1.2],
    defaultVersion: 1.2,
    description: 'Provides OpenAI GPT-4o / GPT-4o-mini intelligence to the LangChain AI Agent node.',
    inputs: [],
    outputs: ['ai_languageModel'],
    defaultParameters: {
      model: 'gpt-4o-mini',
      options: {
        temperature: 0.2,
      },
    },
    parameters: [
      {
        name: 'model',
        displayName: 'Model',
        type: 'string',
        default: 'gpt-4o-mini',
        required: true,
      },
    ],
    requiredParameters: ['model'],
    credentialsRequired: 'openAiApi',
    documentationUrl: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenai/',
    isAiNode: true,
  }),
};

/**
 * Registry helper functions
 */
export function getNodeDefinition(nodeType: string): SmartNodeDefinition | undefined {
  return VERIFIED_N8N_NODES[nodeType];
}

export function isSupportedNodeType(nodeType: string): boolean {
  return nodeType in VERIFIED_N8N_NODES;
}

export function getAllNodeDefinitions(): SmartNodeDefinition[] {
  return Object.values(VERIFIED_N8N_NODES);
}

export function getNodesByCategory(category: NodeCategory): SmartNodeDefinition[] {
  return getAllNodeDefinitions().filter((node) => node.category === category);
}
