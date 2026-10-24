import { WorkflowBlueprint } from '../schemas/blueprint';

export interface N8nWorkflowNode {
  parameters: Record<string, unknown>;
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  credentials?: Record<string, { id?: string; name?: string }>;
  disabled?: boolean;
  notes?: string;
}

export interface N8nConnectionItem {
  node: string;
  type: string;
  index: number;
}

export type N8nConnections = Record<
  string,
  Record<string, N8nConnectionItem[][]>
>;

export interface N8nWorkflowExport {
  name: string;
  nodes: N8nWorkflowNode[];
  connections: N8nConnections;
  pinData: Record<string, unknown>;
  settings: {
    executionOrder: string;
    saveExecutionProgress?: boolean;
    callerPolicy?: string;
  };
  versionId: string;
  meta?: {
    templateCredsSetupCompleted?: boolean;
    instanceId?: string;
    targetVersion?: string;
  };
}

/**
 * Deterministic n8n Workflow JSON Generator.
 * Converts the approved canonical WorkflowBlueprint into official,
 * import-ready n8n workflow JSON.
 */
export function generateN8nWorkflowJson(blueprint: WorkflowBlueprint): N8nWorkflowExport {
  const nodeMap = new Map<string, (typeof blueprint.nodes)[0]>();
  for (const node of blueprint.nodes) {
    nodeMap.set(node.id, node);
  }

  // 1. Calculate clean 2D layout coordinates for nodes
  // Standard n8n grid spacing: horizontal step 260px, vertical base 300px
  const n8nNodes: N8nWorkflowNode[] = blueprint.nodes.map((node, index) => {
    let x = 240 + index * 260;
    let y = 300;

    // Sub-nodes (like Language Models or Tools attached to AI agents) are positioned beneath the agent
    if (node.type.startsWith('@n8n/n8n-nodes-langchain.lmChat')) {
      x = 760;
      y = 520;
    } else if (node.id === 'node_if_valid') {
      x = 1040;
      y = 300;
    } else if (node.id === 'node_slack_manual_review') {
      x = 1320;
      y = 500;
    } else if (node.id === 'node_if_urgency') {
      x = 1320;
      y = 200;
    } else if (node.id === 'node_slack_high_priority') {
      x = 1600;
      y = 120;
    } else if (node.id === 'node_slack_normal_priority') {
      x = 1600;
      y = 280;
    }

    const n8nNode: N8nWorkflowNode = {
      parameters: { ...node.parameters },
      id: node.id,
      name: node.name,
      type: node.type,
      typeVersion: node.typeVersion,
      position: [x, y],
    };

    if (node.disabled) {
      n8nNode.disabled = true;
    }

    if (node.notes) {
      n8nNode.notes = node.notes;
    }

    // Convert credential placeholders into safe n8n credential objects
    if (node.credentials && Object.keys(node.credentials).length > 0) {
      n8nNode.credentials = {};
      for (const [credType, placeholder] of Object.entries(node.credentials)) {
        n8nNode.credentials[credType] = {
          name: placeholder,
        };
      }
    }

    return n8nNode;
  });

  // 2. Build the official n8n connections graph
  const connections: N8nConnections = {};

  for (const conn of blueprint.connections) {
    const sourceNode = nodeMap.get(conn.fromNodeId);
    const targetNode = nodeMap.get(conn.toNodeId);

    if (!sourceNode || !targetNode) {
      continue;
    }

    const sourceName = sourceNode.name;
    const targetName = targetNode.name;
    const outputType = conn.fromOutputType || 'main';
    const outputIndex = conn.fromOutputIndex || 0;

    if (!connections[sourceName]) {
      connections[sourceName] = {};
    }

    if (!connections[sourceName][outputType]) {
      connections[sourceName][outputType] = [];
    }

    // Ensure array exists for outputIndex
    while (connections[sourceName][outputType].length <= outputIndex) {
      connections[sourceName][outputType].push([]);
    }

    connections[sourceName][outputType][outputIndex].push({
      node: targetName,
      type: conn.toInputType || 'main',
      index: conn.toInputIndex || 0,
    });
  }

  return {
    name: blueprint.name,
    nodes: n8nNodes,
    connections,
    pinData: {},
    settings: {
      executionOrder: 'v1',
    },
    versionId: `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    meta: {
      templateCredsSetupCompleted: false,
      targetVersion: blueprint.targetN8nVersion,
    },
  };
}

/**
 * Pretty-formats the n8n workflow export as downloadable JSON string.
 */
export function formatN8nJsonString(workflow: N8nWorkflowExport): string {
  return JSON.stringify(workflow, null, 2);
}
