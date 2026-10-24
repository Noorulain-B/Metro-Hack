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
    if (requirement.triggerType === 'email') {
      const gmailTriggerDef = VERIFIED_N8N_NODES['n8n-nodes-base.gmailTrigger'];
      nodes.push({
        id: 'node_trigger',
        name: 'Gmail Trigger',
        type: gmailTriggerDef.nodeType,
        typeVersion: gmailTriggerDef.defaultVersion,
        parameters: {
          pollTimes: {
            item: [{ mode: 'everyMinute' }],
          },
          event: 'messageReceived',
          filters: {
            readStatus: 'unread',
          },
        },
        credentials: {
          gmailOAuth2: '[CONFIGURE_CREDENTIAL: gmailOAuth2]',
        },
        notes: 'Polls Gmail for new unread customer support messages',
        disabled: false,
      });
    } else if (requirement.triggerType === 'schedule') {
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
            { name: 'customerName', stringValue: '={{ $json.from?.value?.[0]?.name || $json.from?.text || "Valued Customer" }}' },
            { name: 'customerEmail', stringValue: '={{ $json.from?.value?.[0]?.address || $json.from?.text || "customer@example.com" }}' },
            { name: 'subject', stringValue: '={{ $json.subject || "(No Subject)" }}' },
            { name: 'body', stringValue: '={{ $json.textPlain || $json.snippet || "" }}' },
            { name: 'rawPayload', stringValue: '={{ $json.textPlain || $json.snippet || $json.subject || $json }}' },
          ],
        },
        options: {},
      },
      notes: 'Normalizes incoming email payload with customer name, email address, subject, and body',
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
          text: '=Customer Name: {{ $json.customerName }}\nCustomer Email: {{ $json.customerEmail }}\nSubject: {{ $json.subject }}\nBody: {{ $json.body }}',
          options: {
            systemMessage:
              'You are an expert customer support email classification agent.\nAnalyze the incoming customer email and output a strict JSON object with these fields:\n1) customerName: string (extracted from sender headers or email signature)\n2) customerEmail: string (customer email address)\n3) issueCategory: string ("billing" | "technical_support" | "account_access" | "feature_request" | "general_inquiry")\n4) sentiment: string ("positive" | "neutral" | "negative")\n5) urgency: string ("low" | "medium" | "high" | "critical")\n6) summary: string (concise 1-2 sentence overview of the issue)\n7) recommendedAction: string (suggested immediate next action for support engineers)\n8) confidenceScore: number (0.0 to 1.0)\n9) isUncertain: boolean (set to true if email is ambiguous, incomplete, or confidence is below 0.70)\n\nSTRICT SAFETY GUARDRAIL: Do NOT send any automatic email replies to customers. This automation performs internal triage and team notification only.',
            continueOnFail: true,
          },
        },
        notes: 'Classifies customer email sentiment (positive/neutral/negative) and urgency (low/medium/high/critical), extracts customer details and next action, and includes fallback error handling',
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
    const wantsSlack =
      requirement.integrations.includes('slack') ||
      requirement.userGoal.toLowerCase().includes('slack');

    if (wantsSlack) {
      const goalLower = requirement.userGoal.toLowerCase();
      const requiresUrgencyCheck =
        goalLower.includes('urgency') ||
        goalLower.includes('urgent') ||
        goalLower.includes('priority') ||
        goalLower.includes('classify');

      if (requiresUrgencyCheck && requirement.hasAiAgent) {
        // Multi-branch triage routing:
        // Branch 1: High/Critical urgency -> High Priority Slack Alert (#support-urgent)
        // Branch 2: Low/Medium urgency -> Normal Priority Slack Notification (#support-triage)
        // Branch 3: Uncertain or failed classification -> Manual Review Slack Alert (#support-manual-review)
        const ifDef = VERIFIED_N8N_NODES['n8n-nodes-base.if'];
        const slackDef = VERIFIED_N8N_NODES['n8n-nodes-base.slack'];

        // Node 5: Check If Classification Valid
        nodes.push({
          id: 'node_if_valid',
          name: 'Check If Classification Valid',
          type: ifDef.nodeType,
          typeVersion: ifDef.defaultVersion,
          parameters: {
            conditions: {
              options: {
                caseSensitive: false,
                leftValue: '',
                typeValidation: 'strict',
              },
              conditions: [
                {
                  leftValue: '={{ $json.output?.urgency || $json.urgency }}',
                  rightValue: '',
                  operator: {
                    type: 'string',
                    operation: 'notEmpty',
                  },
                },
                {
                  leftValue: '={{ String($json.output?.isUncertain || $json.isUncertain || false) }}',
                  rightValue: 'true',
                  operator: {
                    type: 'string',
                    operation: 'notEquals',
                  },
                },
              ],
              combinator: 'and',
            },
          },
          notes: 'Evaluates whether AI classification succeeded and is certain; routes uncertain or failed items to manual review',
          disabled: false,
        });

        connections.push({
          fromNodeId: previousNodeId,
          fromOutputIndex: 0,
          fromOutputType: 'main' as const,
          toNodeId: 'node_if_valid',
          toInputIndex: 0,
          toInputType: 'main' as const,
        });

        // Node 6: Check If High or Critical Urgency (connected from node_if_valid Output 0 - True branch)
        nodes.push({
          id: 'node_if_urgency',
          name: 'Check If High or Critical Urgency',
          type: ifDef.nodeType,
          typeVersion: ifDef.defaultVersion,
          parameters: {
            conditions: {
              options: {
                caseSensitive: false,
                leftValue: '',
                typeValidation: 'strict',
              },
              conditions: [
                {
                  leftValue: '={{ ($json.output?.urgency || $json.urgency || "").toLowerCase() }}',
                  rightValue: 'high',
                  operator: {
                    type: 'string',
                    operation: 'equals',
                  },
                },
                {
                  leftValue: '={{ ($json.output?.urgency || $json.urgency || "").toLowerCase() }}',
                  rightValue: 'critical',
                  operator: {
                    type: 'string',
                    operation: 'equals',
                  },
                },
              ],
              combinator: 'or',
            },
          },
          notes: 'Splits urgent tickets (high or critical) from standard tickets (low or medium)',
          disabled: false,
        });

        connections.push({
          fromNodeId: 'node_if_valid',
          fromOutputIndex: 0, // Output 0 = True (Valid classification)
          fromOutputType: 'main' as const,
          toNodeId: 'node_if_urgency',
          toInputIndex: 0,
          toInputType: 'main' as const,
        });

        // Node 7: Manual Review Slack Alert (connected from node_if_valid Output 1 - False / Uncertain / Error branch)
        nodes.push({
          id: 'node_slack_manual_review',
          name: 'Alert Manual Review Team',
          type: slackDef.nodeType,
          typeVersion: slackDef.defaultVersion,
          parameters: {
            resource: 'message',
            operation: 'post',
            select: 'channel',
            channelId: {
              __rl: true,
              value: '#support-manual-review',
              mode: 'name',
            },
            text: `*[⚠️ Manual Review Required: Triage Uncertainty or AI Failure]*\n• *Customer:* ={{ $json.customerName || 'Unknown Customer' }} (={{ $json.customerEmail || 'No Email' }})\n• *Subject:* ={{ $json.subject || '(No Subject)' }}\n• *Status:* AI classification was uncertain (confidence: ={{ $json.output?.confidenceScore || 'low' }}) or encountered an error.\n• *Raw Snippet:* ={{ $json.snippet || $json.body || $json.rawPayload }}\n• *Action Required:* Please manually inspect, classify, and assign this customer ticket.\n• *Note:* No automated response was sent to the customer.`,
          },
          credentials: {
            slackApi: '[CONFIGURE_CREDENTIAL: slackApi]',
          },
          notes: 'Alerts human support team to review unclassified or uncertain emails',
          disabled: false,
        });

        connections.push({
          fromNodeId: 'node_if_valid',
          fromOutputIndex: 1, // Output 1 = False (Uncertain or Failed classification)
          fromOutputType: 'main' as const,
          toNodeId: 'node_slack_manual_review',
          toInputIndex: 0,
          toInputType: 'main' as const,
        });

        // Node 8: High Priority Slack Alert (connected from node_if_urgency Output 0 - True / High or Critical branch)
        nodes.push({
          id: 'node_slack_high_priority',
          name: 'High Priority Slack Alert',
          type: slackDef.nodeType,
          typeVersion: slackDef.defaultVersion,
          parameters: {
            resource: 'message',
            operation: 'post',
            select: 'channel',
            channelId: {
              __rl: true,
              value: options?.previousClarifications?.q_slack_channel || '#support-urgent',
              mode: 'name',
            },
            text: `*[🚨 HIGH / CRITICAL Support Alert]*\n• *Customer:* ={{ $json.output?.customerName || $json.customerName || 'Customer' }} (={{ $json.output?.customerEmail || $json.customerEmail || 'No Email' }})\n• *Issue Category:* ={{ $json.output?.issueCategory || 'General' }}\n• *Classification / Sentiment:* ={{ $json.output?.sentiment || 'Negative' }}\n• *Urgency Level:* ={{ $json.output?.urgency || 'High' }}\n• *Summary:* ={{ $json.output?.summary || $json.snippet || 'High priority customer issue requiring immediate escalation' }}\n• *Recommended Next Action:* ={{ $json.output?.recommendedAction || 'Escalate to on-call support team immediately' }}\n• *Note:* Internal notification only; no customer reply sent.`,
          },
          credentials: {
            slackApi: '[CONFIGURE_CREDENTIAL: slackApi]',
          },
          notes: 'Delivers high-priority alert for high or critical tickets to #support-urgent',
          disabled: false,
        });

        connections.push({
          fromNodeId: 'node_if_urgency',
          fromOutputIndex: 0, // Output 0 = True (High or Critical)
          fromOutputType: 'main' as const,
          toNodeId: 'node_slack_high_priority',
          toInputIndex: 0,
          toInputType: 'main' as const,
        });

        // Node 9: Normal Priority Slack Notification (connected from node_if_urgency Output 1 - False / Low or Medium branch)
        nodes.push({
          id: 'node_slack_normal_priority',
          name: 'Normal Priority Slack Notification',
          type: slackDef.nodeType,
          typeVersion: slackDef.defaultVersion,
          parameters: {
            resource: 'message',
            operation: 'post',
            select: 'channel',
            channelId: {
              __rl: true,
              value: '#support-triage',
              mode: 'name',
            },
            text: `*[📋 Standard Support Ticket]*\n• *Customer:* ={{ $json.output?.customerName || $json.customerName || 'Customer' }} (={{ $json.output?.customerEmail || $json.customerEmail || 'No Email' }})\n• *Issue Category:* ={{ $json.output?.issueCategory || 'General' }}\n• *Classification / Sentiment:* ={{ $json.output?.sentiment || 'Neutral' }}\n• *Urgency Level:* ={{ $json.output?.urgency || 'Low / Medium' }}\n• *Summary:* ={{ $json.output?.summary || $json.snippet || 'Standard support enquiry' }}\n• *Recommended Next Action:* ={{ $json.output?.recommendedAction || 'Queue for standard business hours response' }}\n• *Note:* Internal notification only; no customer reply sent.`,
          },
          credentials: {
            slackApi: '[CONFIGURE_CREDENTIAL: slackApi]',
          },
          notes: 'Delivers standard notification for low or medium tickets to #support-triage',
          disabled: false,
        });

        connections.push({
          fromNodeId: 'node_if_urgency',
          fromOutputIndex: 1, // Output 1 = False (Low or Medium)
          fromOutputType: 'main' as const,
          toNodeId: 'node_slack_normal_priority',
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
    } else if (requirement.integrations.includes('gmail')) {
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
        'Gmail Trigger polls for new unread customer messages using Google OAuth2',
        'AI Agent classifies sentiment (positive, neutral, negative) and urgency (low, medium, high, critical)',
        'AI Agent extracts customer name, customer email, issue category, summary, and recommended action with fallback error handling',
        'High and critical urgency tickets route to #support-urgent for immediate escalation',
        'Low and medium urgency tickets route to #support-triage for standard queue handling',
        'Uncertain classifications and AI errors route to #support-manual-review for human agent inspection',
        'Strict safety guardrail: no automated email replies are sent to customers (internal triage and Slack alerts only)',
        'Credentials are to be configured in user n8n instance via credential placeholders',
      ],
      unresolvedIssues: [
        'User must supply actual credential tokens (Slack bot token, Gmail OAuth, Google Palm API) upon import',
        'Target Slack channels (#support-urgent, #support-triage, #support-manual-review) must exist or be mapped in n8n',
      ],
      expectedOutputs: [
        'High/Critical priority Slack notification posted to #support-urgent',
        'Standard priority Slack notification posted to #support-triage',
        'Manual review Slack notification posted to #support-manual-review for uncertain/failed classifications',
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
