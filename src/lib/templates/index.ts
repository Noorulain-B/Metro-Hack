export interface WorkflowTemplate {
  id: string;
  title: string;
  description: string;
  category: 'sheets' | 'ai' | 'scheduled' | 'webhook';
  userPrompt: string;
  tags: string[];
  nodeTypes: string[];
}

export const STARTER_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'tpl_sheets_triage',
    title: 'Google Sheets New Row to Slack Alert',
    description: 'Watches for newly appended rows in Google Sheets, normalizes row values, and posts formatted notifications to Slack.',
    category: 'sheets',
    userPrompt: 'When a new Google Sheets row is added, format the row data and send an alert notification to Slack.',
    tags: ['Google Sheets', 'Slack', 'Trigger'],
    nodeTypes: [
      'n8n-nodes-base.googleSheetsTrigger',
      'n8n-nodes-base.set',
      'n8n-nodes-base.slack',
    ],
  },
  {
    id: 'tpl_ai_email_triage',
    title: 'Customer Email AI Agent Classifier',
    description: 'Reads customer support emails, employs an AI Agent with Google Gemini to evaluate sentiment & urgency, and sends immediate alerts for high-priority tickets.',
    category: 'ai',
    userPrompt: 'When a new customer email arrives, classify its sentiment and urgency, then notify the support team in Slack.',
    tags: ['Gmail', 'AI Agent', 'Gemini', 'If Condition', 'Slack'],
    nodeTypes: [
      'n8n-nodes-base.gmailTrigger',
      'n8n-nodes-base.set',
      '@n8n/n8n-nodes-langchain.agent',
      '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
      'n8n-nodes-base.if',
      'n8n-nodes-base.slack',
    ],
  },
  {
    id: 'tpl_scheduled_health_check',
    title: 'Hourly API Health Check & Alert',
    description: 'Runs on a recurring schedule to ping external REST API endpoints and triggers an alert if unexpected response status is returned.',
    category: 'scheduled',
    userPrompt: 'Every hour on schedule, make an HTTP GET request to check API status and post results to Slack.',
    tags: ['Schedule', 'HTTP Request', 'Monitoring', 'Slack'],
    nodeTypes: [
      'n8n-nodes-base.scheduleTrigger',
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.slack',
    ],
  },
  {
    id: 'tpl_webhook_ingest',
    title: 'Webhook Payload Ingestion & Forwarding',
    description: 'Exposes an instant HTTP POST endpoint, cleans and transforms incoming JSON data, and forwards it to an external backend service.',
    category: 'webhook',
    userPrompt: 'Receive incoming webhook data via HTTP POST, format payload fields, and forward to an external API endpoint.',
    tags: ['Webhook', 'Transform', 'HTTP Request'],
    nodeTypes: [
      'n8n-nodes-base.webhook',
      'n8n-nodes-base.set',
      'n8n-nodes-base.httpRequest',
    ],
  },
];
