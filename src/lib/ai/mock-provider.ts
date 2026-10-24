import { AiProvider, AiUsageMetrics, AiGenerationOptions } from './types';
import { RequirementSpecification, RequirementSpecificationSchema } from '../schemas/requirement';
import { WorkflowBlueprint, WorkflowBlueprintSchema } from '../schemas/blueprint';
import { VERIFIED_N8N_NODES } from '../n8n/registry';

/**
 * Deterministic Mock AI Provider.
 * Requires 0 API keys, 0 external network calls, and 0 credits.
 * Used for automated tests, CI, and local cost-free development.
 */
export class MockAiProvider implements AiProvider {
  readonly providerId = 'mock' as const;

  private createMetrics(promptLength: number, completionLength: number): AiUsageMetrics {
    const promptTokens = Math.max(10, Math.round(promptLength / 4));
    const completionTokens = Math.max(20, Math.round(completionLength / 4));
    return {
      modelName: 'mock-deterministic-engine',
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUsd: 0.0,
      aiCallsCount: 1,
      isMock: true,
    };
  }

  async analyzeRequirement(
    userPrompt: string,
    options?: AiGenerationOptions
  ): Promise<{ requirement: RequirementSpecification; metrics: AiUsageMetrics }> {
    const promptLower = userPrompt.toLowerCase();
    const hasAiMention = promptLower.includes('ai') || promptLower.includes('agent') || promptLower.includes('classify') || promptLower.includes('sentiment');
    const isScheduled = promptLower.includes('schedule') || promptLower.includes('daily') || promptLower.includes('hourly') || promptLower.includes('cron');
    const isEmail = promptLower.includes('email') || promptLower.includes('gmail');
    const isWebhook = promptLower.includes('webhook') || promptLower.includes('stripe') || promptLower.includes('order');

    let triggerType: 'webhook' | 'schedule' | 'email' | 'manual' = 'webhook';
    if (isScheduled) triggerType = 'schedule';
    else if (isEmail) triggerType = 'email';
    else if (isWebhook) triggerType = 'webhook';

    const integrations: string[] = [];
    if (isEmail) integrations.push('gmail');
    if (promptLower.includes('slack')) integrations.push('slack');
    if (promptLower.includes('http') || promptLower.includes('api')) integrations.push('httpRequest');
    if (integrations.length === 0) integrations.push('slack');

    const clarifications = [];
    // Ask clarification if trigger details are ambiguous and no previous answer was provided
    if (triggerType === 'schedule' && !options?.previousClarifications?.q_schedule_freq) {
      clarifications.push({
        id: 'q_schedule_freq',
        question: 'How often should this scheduled automation run?',
        context: 'Required to configure the Schedule Trigger interval node accurately.',
        options: ['Every hour', 'Every day at 9:00 AM', 'Every week on Monday', 'Every 15 minutes'],
        defaultAnswer: 'Every hour',
        isEssential: false,
        category: 'trigger' as const,
      });
    }

    if (integrations.includes('slack') && !options?.previousClarifications?.q_slack_channel) {
      clarifications.push({
        id: 'q_slack_channel',
        question: 'Which Slack channel should receive the notification message?',
        context: 'Used to configure the target channel ID in the Slack node.',
        options: ['#alerts', '#notifications', '#general'],
        defaultAnswer: '#alerts',
        isEssential: false,
        category: 'output' as const,
      });
    }

    const requirementData: RequirementSpecification = {
      title: isEmail
        ? 'Customer Support Email Classifier & Alert'
        : isScheduled
        ? 'Scheduled Data Ingestion and Alert Pipeline'
        : 'Webhook Event Notification Workflow',
      userGoal: userPrompt.trim(),
      triggerType,
      triggerDetails: {
        scheduleInterval: isScheduled ? (options?.previousClarifications?.q_schedule_freq || 'Every hour') : undefined,
        webhookMethod: 'POST',
        sourceApp: isEmail ? 'Gmail' : isScheduled ? 'Schedule' : 'External Webhook',
      },
      dataProcessingSteps: [
        `Receive incoming data via ${triggerType}`,
        hasAiMention ? 'Analyze and categorize payload using AI' : 'Validate payload fields and format data',
        'Check priority or condition rules',
        `Send notification or update via ${integrations.join(' and ')}`,
      ],
      hasAiAgent: hasAiMention,
      aiAgentTask: hasAiMention
        ? 'Analyze input text, determine urgency (high/medium/low), and summarize key points'
        : undefined,
      integrations,
      clarifications,
      confidenceScore: 0.95,
    };

    const requirement = RequirementSpecificationSchema.parse(requirementData);
    const metrics = this.createMetrics(userPrompt.length, JSON.stringify(requirement).length);

    return { requirement, metrics };
  }

  async generateBlueprint(
    requirement: RequirementSpecification,
    options?: AiGenerationOptions
  ): Promise<{ blueprint: WorkflowBlueprint; metrics: AiUsageMetrics }> {
    const targetVersion = options?.targetN8nVersion || '1.70.0';
    const nodes = [];
    const connections = [];

    // 1. Trigger node
    if (requirement.triggerType === 'schedule') {
      const scheduleDef = VERIFIED_N8N_NODES['n8n-nodes-base.scheduleTrigger'];
      nodes.push({
        id: 'node_trigger',
        name: 'Schedule Trigger',
        type: scheduleDef.nodeType,
        typeVersion: scheduleDef.defaultVersion,
        parameters: { ...scheduleDef.defaultParameters },
        notes: 'Fires the workflow automatically on a scheduled interval',
        disabled: false,
      });
    } else {
      const webhookDef = VERIFIED_N8N_NODES['n8n-nodes-base.webhook'];
      nodes.push({
        id: 'node_trigger',
        name: 'Webhook Trigger',
        type: webhookDef.nodeType,
        typeVersion: webhookDef.defaultVersion,
        parameters: {
          httpMethod: requirement.triggerDetails.webhookMethod || 'POST',
          path: 'webhook-listener',
          responseMode: 'onReceived',
          responseData: 'allEntries',
          options: {},
        },
        notes: 'Listens for incoming HTTP POST events',
        disabled: false,
      });
    }

    let previousNodeId = 'node_trigger';

    // 2. Data Formatting / Set node
    const setDef = VERIFIED_N8N_NODES['n8n-nodes-base.set'];
    nodes.push({
      id: 'node_format_data',
      name: 'Format Input Data',
      type: setDef.nodeType,
      typeVersion: setDef.defaultVersion,
      parameters: {
        mode: 'manual',
        fields: {
          values: [
            { name: 'receivedAt', stringValue: '={{ $now.toISO() }}' },
            { name: 'rawPayload', stringValue: '={{ $json.body || $json }}' },
          ],
        },
        options: {},
      },
      notes: 'Normalizes and structures incoming payload data',
      disabled: false,
    });

    connections.push({
      fromNodeId: previousNodeId,
      fromOutputIndex: 0,
      fromOutputType: 'main' as const,
      toNodeId: 'node_format_data',
      toInputIndex: 0,
      toInputType: 'main' as const,
    });
    previousNodeId = 'node_format_data';

    // 3. Optional AI Agent node
    if (requirement.hasAiAgent) {
      const agentDef = VERIFIED_N8N_NODES['@n8n/n8n-nodes-langchain.agent'];
      const geminiModelDef = VERIFIED_N8N_NODES['@n8n/n8n-nodes-langchain.lmChatGoogleGemini'];

      nodes.push({
        id: 'node_ai_agent',
        name: 'AI Agent Classifier',
        type: agentDef.nodeType,
        typeVersion: agentDef.defaultVersion,
        parameters: {
          promptType: 'auto',
          text: '={{ $json.rawPayload }}',
          options: {
            systemMessage: requirement.aiAgentTask || 'You are an AI assistant categorizing incoming requests.',
          },
        },
        notes: 'Analyzes input text and determines category and sentiment',
        disabled: false,
      });

      // Gemini model sub-node connected to AI Agent
      nodes.push({
        id: 'node_gemini_model',
        name: 'Google Gemini Model',
        type: geminiModelDef.nodeType,
        typeVersion: geminiModelDef.defaultVersion,
        parameters: {
          modelName: 'models/gemini-1.5-pro-latest',
          options: { temperature: 0.2 },
        },
        credentials: {
          googlePalmApi: '[CONFIGURE_CREDENTIAL: googlePalmApi]',
        },
        notes: 'Provides AI reasoning intelligence to the AI Agent node',
        disabled: false,
      });

      // Main flow into AI Agent
      connections.push({
        fromNodeId: previousNodeId,
        fromOutputIndex: 0,
        fromOutputType: 'main' as const,
        toNodeId: 'node_ai_agent',
        toInputIndex: 0,
        toInputType: 'main' as const,
      });

      // Model connection into AI Agent
      connections.push({
        fromNodeId: 'node_gemini_model',
        fromOutputIndex: 0,
        fromOutputType: 'ai_languageModel' as const,
        toNodeId: 'node_ai_agent',
        toInputIndex: 0,
        toInputType: 'ai_languageModel' as const,
      });

      previousNodeId = 'node_ai_agent';
    }

    // 4. Action node (Slack / Gmail / HTTP)
    if (requirement.integrations.includes('gmail')) {
      const gmailDef = VERIFIED_N8N_NODES['n8n-nodes-base.gmail'];
      nodes.push({
        id: 'node_gmail_send',
        name: 'Send Gmail Notification',
        type: gmailDef.nodeType,
        typeVersion: gmailDef.defaultVersion,
        parameters: {
          resource: 'message',
          operation: 'send',
          toList: ['team@example.com'],
          subject: `=[Alert] ${requirement.title}`,
          message: '={{ $json.output || $json.rawPayload }}',
        },
        credentials: {
          gmailOAuth2: '[CONFIGURE_CREDENTIAL: gmailOAuth2]',
        },
        notes: 'Sends an email summary of the processed automation item',
        disabled: false,
      });

      connections.push({
        fromNodeId: previousNodeId,
        fromOutputIndex: 0,
        fromOutputType: 'main' as const,
        toNodeId: 'node_gmail_send',
        toInputIndex: 0,
        toInputType: 'main' as const,
      });
    } else {
      const slackDef = VERIFIED_N8N_NODES['n8n-nodes-base.slack'];
      nodes.push({
        id: 'node_slack_alert',
        name: 'Send Slack Notification',
        type: slackDef.nodeType,
        typeVersion: slackDef.defaultVersion,
        parameters: {
          resource: 'message',
          operation: 'post',
          select: 'channel',
          channelId: {
            __rl: true,
            value: options?.previousClarifications?.q_slack_channel || '#alerts',
            mode: 'name',
          },
          text: `*[Automated Alert]*\n${requirement.title}\nStatus: Completed successfully.`,
        },
        credentials: {
          slackApi: '[CONFIGURE_CREDENTIAL: slackApi]',
        },
        notes: 'Posts a formatted status message to Slack',
        disabled: false,
      });

      connections.push({
        fromNodeId: previousNodeId,
        fromOutputIndex: 0,
        fromOutputType: 'main' as const,
        toNodeId: 'node_slack_alert',
        toInputIndex: 0,
        toInputType: 'main' as const,
      });
    }

    const now = new Date().toISOString();
    const blueprintData: WorkflowBlueprint = {
      id: `bp_${Date.now()}`,
      name: requirement.title,
      description: requirement.userGoal,
      targetN8nVersion: targetVersion,
      assumptions: [
        `Targeting n8n baseline version ${targetVersion}`,
        'Incoming payload contains structured JSON or plain text body',
        'Credentials are to be configured in user n8n instance via credential placeholders',
      ],
      unresolvedIssues: [
        'User must supply actual credential tokens (e.g. Slack bot token, Gmail OAuth) upon import',
      ],
      expectedOutputs: [
        'Validated n8n workflow JSON ready for manual import',
        'Optimized prompt for manual AI refinement',
      ],
      nodes,
      connections,
      metadata: {
        createdAt: now,
        updatedAt: now,
        targetN8nVersion: targetVersion,
        complexityLevel: requirement.hasAiAgent ? 'moderate' : 'simple',
        estimatedAiCallsPerRun: requirement.hasAiAgent ? 1 : 0,
        tags: [requirement.triggerType, ...requirement.integrations],
        version: '1.0.0',
        author: 'AI n8n Workflow Builder (Mock Provider)',
      },
    };

    const blueprint = WorkflowBlueprintSchema.parse(blueprintData);
    const metrics = this.createMetrics(JSON.stringify(requirement).length, JSON.stringify(blueprint).length);

    return { blueprint, metrics };
  }
}
