import { WorkflowBlueprint } from '../schemas/blueprint';
import { ValidationReport, ValidationIssue } from '../schemas/validation';
import {
  isSupportedNodeType,
  isVersionSupported,
  validateNodeParameters,
  getNodeDefinition,
} from './registry';

/**
 * Deterministic Validation Engine.
 * Evaluates generated workflow blueprints against verified node rules,
 * structural constraints, and security checks without live execution.
 */
export function validateWorkflowBlueprint(blueprint: WorkflowBlueprint): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const infos: ValidationIssue[] = [];

  // 1. Structural check: Minimum nodes and target version
  if (!blueprint.nodes || blueprint.nodes.length === 0) {
    errors.push({
      severity: 'error',
      code: 'EMPTY_WORKFLOW',
      message: 'The workflow blueprint contains no nodes.',
      suggestedCorrection: 'Ensure at least one trigger node and one action node are defined.',
    });
  }

  const targetVersion = blueprint.targetN8nVersion || '1.70.0';

  // Build node lookup map
  const nodeMap = new Map<string, (typeof blueprint.nodes)[0]>();
  const duplicateIds = new Set<string>();

  for (const node of blueprint.nodes) {
    if (nodeMap.has(node.id)) {
      duplicateIds.add(node.id);
    }
    nodeMap.set(node.id, node);
  }

  // 2. Check for duplicate node IDs
  for (const dupId of duplicateIds) {
    errors.push({
      severity: 'error',
      code: 'DUPLICATE_NODE_ID',
      message: `Multiple nodes share the identical ID "${dupId}".`,
      nodeId: dupId,
      suggestedCorrection: 'Assign unique IDs to each node in the blueprint.',
    });
  }

  // 3. Trigger check: Must have at least one trigger or manual starting node
  const hasTrigger = blueprint.nodes.some((node) => {
    const def = getNodeDefinition(node.type);
    return def?.category === 'trigger';
  });

  if (!hasTrigger) {
    warnings.push({
      severity: 'warning',
      code: 'NO_TRIGGER_NODE',
      message: 'Workflow does not contain an automated trigger node. It will only run manually.',
      suggestedCorrection: 'Add a Webhook, Schedule Trigger, or Google Sheets Trigger to start automatically.',
    });
  }

  // 4. Validate each node against verified registry
  for (const node of blueprint.nodes) {
    // Check node type existence
    if (!isSupportedNodeType(node.type)) {
      errors.push({
        severity: 'error',
        code: 'UNKNOWN_NODE_TYPE',
        message: `Node type "${node.type}" is not in the verified n8n registry. It may be hallucinated or unsupported.`,
        nodeId: node.id,
        nodeName: node.name,
        suggestedCorrection: 'Replace this node with a verified n8n node definition from the registry.',
      });
      continue;
    }

    // Check version compatibility
    if (!isVersionSupported(node.type, node.typeVersion)) {
      const def = getNodeDefinition(node.type);
      errors.push({
        severity: 'error',
        code: 'UNSUPPORTED_NODE_VERSION',
        message: `Node "${node.name}" uses version ${node.typeVersion}, but supported versions are: [${def?.supportedVersions.join(', ')}].`,
        nodeId: node.id,
        nodeName: node.name,
        field: 'typeVersion',
        suggestedCorrection: `Update typeVersion to default version ${def?.defaultVersion}.`,
      });
    }

    // Check required parameters
    const paramValidation = validateNodeParameters(node.type, node.parameters);
    if (!paramValidation.valid) {
      for (const missingParam of paramValidation.missingRequired) {
        errors.push({
          severity: 'error',
          code: 'MISSING_REQUIRED_PARAMETER',
          message: `Node "${node.name}" is missing required parameter "${missingParam}".`,
          nodeId: node.id,
          nodeName: node.name,
          field: missingParam,
          suggestedCorrection: `Provide a valid value for parameter "${missingParam}".`,
        });
      }
    }

    // 5. Security & Credential Leak Check: Inspect parameter strings for raw secrets
    const paramString = JSON.stringify(node.parameters);
    const secretPatterns = [
      { pattern: /sk-[a-zA-Z0-9]{20,}/, name: 'OpenAI Secret Key' },
      { pattern: /ghp_[a-zA-Z0-9]{30,}/, name: 'GitHub Personal Access Token' },
      { pattern: /xoxb-[0-9]{10,}-[a-zA-Z0-9]{20,}/, name: 'Slack Bot Token' },
      { pattern: /AIza[0-9A-Za-z-_]{35}/, name: 'Google API Key' },
      { pattern: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/i, name: 'Raw Bearer Token' },
    ];

    for (const secret of secretPatterns) {
      if (secret.pattern.test(paramString)) {
        errors.push({
          severity: 'error',
          code: 'CREDENTIAL_LEAK_DETECTED',
          message: `Potential raw secret detected in parameters of node "${node.name}" (${secret.name}).`,
          nodeId: node.id,
          nodeName: node.name,
          suggestedCorrection: 'Never place raw API tokens in parameters. Use credential placeholders like [CONFIGURE_CREDENTIAL: credentialType].',
        });
      }
    }

    // Credential advice
    const def = getNodeDefinition(node.type);
    if (def?.credentialsRequired && (!node.credentials || Object.keys(node.credentials).length === 0)) {
      warnings.push({
        severity: 'warning',
        code: 'CREDENTIAL_CONFIGURATION_NEEDED',
        message: `Node "${node.name}" requires "${def.credentialsRequired}" credentials in n8n.`,
        nodeId: node.id,
        nodeName: node.name,
        suggestedCorrection: `After importing to n8n, create or attach credentials of type "${def.credentialsRequired}".`,
      });
    }
  }

  // 6. Connection Validation
  const connectedNodeIds = new Set<string>();

  for (const conn of blueprint.connections) {
    // Check source node existence
    if (!nodeMap.has(conn.fromNodeId)) {
      errors.push({
        severity: 'error',
        code: 'BROKEN_CONNECTION_SOURCE',
        message: `Connection originates from non-existent node ID "${conn.fromNodeId}".`,
        suggestedCorrection: `Ensure source node "${conn.fromNodeId}" exists in the blueprint nodes array.`,
      });
    } else {
      connectedNodeIds.add(conn.fromNodeId);
    }

    // Check destination node existence
    if (!nodeMap.has(conn.toNodeId)) {
      errors.push({
        severity: 'error',
        code: 'BROKEN_CONNECTION_TARGET',
        message: `Connection points to non-existent target node ID "${conn.toNodeId}".`,
        suggestedCorrection: `Ensure destination node "${conn.toNodeId}" exists in the blueprint nodes array.`,
      });
    } else {
      connectedNodeIds.add(conn.toNodeId);
    }
  }

  // Check for disconnected nodes (if workflow has more than 1 node)
  if (blueprint.nodes.length > 1) {
    for (const node of blueprint.nodes) {
      if (!connectedNodeIds.has(node.id)) {
        warnings.push({
          severity: 'warning',
          code: 'DISCONNECTED_NODE',
          message: `Node "${node.name}" (${node.id}) is completely disconnected from the workflow graph.`,
          nodeId: node.id,
          nodeName: node.name,
          suggestedCorrection: 'Connect this node to incoming or outgoing nodes, or remove it if unused.',
        });
      }
    }
  }

  // Informational note on assumptions
  if (blueprint.assumptions && blueprint.assumptions.length > 0) {
    infos.push({
      severity: 'info',
      code: 'RECORDED_ASSUMPTIONS',
      message: `${blueprint.assumptions.length} explicit assumption(s) recorded in blueprint.`,
      suggestedCorrection: 'Review recorded assumptions before deploying to production.',
    });
  }

  return {
    valid: errors.length === 0,
    targetN8nVersion: targetVersion,
    errors,
    warnings,
    infos,
    checksNotPerformed: [
      'Live execution inside an active n8n instance',
      'Real-time credential authentication and permission verification',
      'External API endpoint reachability, TLS handshake, and network latency',
      'Dynamic runtime data payload schema conformance',
    ],
    timestamp: new Date().toISOString(),
  };
}
