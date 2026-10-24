'use client';

import React, { useState, useRef } from 'react';
import { WorkflowBlueprint, BlueprintNode } from '@/lib/schemas/blueprint';

interface WorkflowCanvasProps {
  blueprint: WorkflowBlueprint | null;
  selectedNodeId?: string | null;
  onSelectNode?: (node: BlueprintNode | null) => void;
}

export function WorkflowCanvas({ blueprint, selectedNodeId, onSelectNode }: WorkflowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  if (!blueprint || !blueprint.nodes || blueprint.nodes.length === 0) {
    return (
      <div
        className="canvas-grid-pattern"
        style={{
          width: '100%',
          height: '100%',
          minHeight: '440px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          position: 'relative',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '380px', padding: '24px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              margin: '0 auto 14px auto',
              color: 'var(--text-tertiary)',
            }}
          >
            ⚡
          </div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Workflow Canvas Ready
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Describe your automation requirement in the editor panel or pick a starter template to generate an n8n visual graph.
          </p>
        </div>
      </div>
    );
  }

  // Node position mapping (n8n canvas grid)
  const getNodePos = (node: BlueprintNode, index: number) => {
    // Custom offsets for known multi-branch topology
    if (node.id === 'node_trigger') return { x: 40, y: 160 };
    if (node.id === 'node_format_data') return { x: 300, y: 160 };
    if (node.id === 'node_ai_agent') return { x: 560, y: 160 };
    if (node.id === 'node_gemini_model') return { x: 560, y: 350 };
    if (node.id === 'node_if_valid') return { x: 820, y: 160 };
    if (node.id === 'node_slack_manual_review') return { x: 1080, y: 340 };
    if (node.id === 'node_if_urgency') return { x: 1080, y: 80 };
    if (node.id === 'node_slack_high_priority') return { x: 1340, y: 20 };
    if (node.id === 'node_slack_normal_priority') return { x: 1340, y: 170 };
    if (node.id === 'node_http_health_check') return { x: 300, y: 160 };
    if (node.id === 'node_if_status') return { x: 580, y: 160 };
    if (node.id === 'node_slack_success') return { x: 860, y: 80 };
    if (node.id === 'node_slack_failure') return { x: 860, y: 260 };

    // Default horizontal layout fallback
    return { x: 40 + index * 260, y: 160 };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click drag
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 20, y: 20 });
  };

  const getNodeCategoryBadge = (node: BlueprintNode) => {
    if (node.type.includes('Trigger')) {
      return { label: 'TRIGGER', color: 'var(--node-trigger)', bg: 'var(--node-trigger-bg)', border: 'var(--node-trigger-border)', icon: '⚡' };
    }
    if (node.type.includes('agent')) {
      return { label: 'AI AGENT', color: 'var(--node-ai)', bg: 'var(--node-ai-bg)', border: 'var(--node-ai-border)', icon: '🧠' };
    }
    if (node.type.includes('lmChat')) {
      return { label: 'MODEL', color: 'var(--node-ai)', bg: 'var(--node-ai-bg)', border: 'var(--node-ai-border)', icon: '✨' };
    }
    if (node.type.includes('.if')) {
      return { label: 'CONDITION', color: 'var(--node-logic)', bg: 'var(--node-logic-bg)', border: 'var(--node-logic-border)', icon: '🔀' };
    }
    if (node.type.includes('.slack')) {
      if (node.id.includes('manual_review')) {
        return { label: 'MANUAL REVIEW', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.4)', icon: '⚠️' };
      }
      return { label: 'ACTION', color: 'var(--node-action)', bg: 'var(--node-action-bg)', border: 'var(--node-action-border)', icon: '💬' };
    }
    if (node.type.includes('.set')) {
      return { label: 'TRANSFORM', color: 'var(--node-transform)', bg: 'var(--node-transform-bg)', border: 'var(--node-transform-border)', icon: '🔄' };
    }
    return { label: 'ACTION', color: 'var(--text-secondary)', bg: 'var(--bg-surface-subtle)', border: 'var(--border-subtle)', icon: '⚙️' };
  };

  // Build node lookup map for coordinates
  const nodeCoords = new Map<string, { x: number; y: number }>();
  blueprint.nodes.forEach((n, idx) => {
    nodeCoords.set(n.id, getNodePos(n, idx));
  });

  const NODE_WIDTH = 210;
  const NODE_HEIGHT = 90;

  return (
    <div
      ref={containerRef}
      className="canvas-grid-pattern"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '480px',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      {/* Top Left Canvas HUD */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 10,
          background: 'rgba(23, 25, 32, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px 10px',
        }}
      >
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
          TOPOLOGY:
        </span>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {blueprint.nodes.length} Nodes · {blueprint.connections.length} Connections
        </span>
      </div>

      {/* Top Right Zoom Controls */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          zIndex: 10,
          background: 'rgba(23, 25, 32, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '3px',
        }}
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.6, Math.min(1.4, z - 0.1)))}
          className="btn-icon"
          style={{ width: '26px', height: '26px', fontSize: '0.85rem' }}
          title="Zoom Out"
        >
          -
        </button>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '0 6px', fontFamily: 'monospace' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.6, Math.min(1.4, z + 0.1)))}
          className="btn-icon"
          style={{ width: '26px', height: '26px', fontSize: '0.85rem' }}
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          onClick={resetView}
          className="btn-icon"
          style={{ width: '26px', height: '26px', fontSize: '0.75rem' }}
          title="Reset View"
        >
          ⟲
        </button>
      </div>

      {/* Zoomable & Pannable Canvas World */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '1650px',
          height: '520px',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        {/* SVG Connection Lines */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <defs>
            <marker
              id="arrowhead-main"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="#64748b" />
            </marker>
            <marker
              id="arrowhead-ai"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="#8b5cf6" />
            </marker>
            <marker
              id="arrowhead-urgent"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="#ea4b35" />
            </marker>
            <marker
              id="arrowhead-fallback"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="#f59e0b" />
            </marker>
          </defs>

          {blueprint.connections.map((conn, idx) => {
            const srcPos = nodeCoords.get(conn.fromNodeId);
            const tgtPos = nodeCoords.get(conn.toNodeId);
            if (!srcPos || !tgtPos) return null;

            let startX = srcPos.x + NODE_WIDTH;
            let startY = srcPos.y + 45;
            let endX = tgtPos.x;
            let endY = tgtPos.y + 45;

            // Multi-output socket offsets
            if (conn.fromNodeId === 'node_if_valid') {
              startY = conn.fromOutputIndex === 0 ? srcPos.y + 30 : srcPos.y + 60;
            } else if (conn.fromNodeId === 'node_if_urgency') {
              startY = conn.fromOutputIndex === 0 ? srcPos.y + 30 : srcPos.y + 60;
            }

            // AI Language model subnode connection (bottom up)
            const isAiSubnode = conn.fromOutputType === 'ai_languageModel';
            if (isAiSubnode) {
              startX = srcPos.x + NODE_WIDTH / 2;
              startY = srcPos.y;
              endX = tgtPos.x + NODE_WIDTH / 2;
              endY = tgtPos.y + NODE_HEIGHT;
            }

            // Smooth Bézier curve calculation
            let pathD = '';
            let label = '';
            let strokeColor = '#475569';
            let markerId = 'arrowhead-main';

            if (isAiSubnode) {
              pathD = `M ${startX} ${startY} C ${startX} ${startY - 40}, ${endX} ${endY + 40}, ${endX} ${endY}`;
              strokeColor = '#8b5cf6';
              label = 'ai_languageModel';
              markerId = 'arrowhead-ai';
            } else {
              const dx = Math.abs(endX - startX) * 0.5;
              pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

              // Determine branch label
              if (conn.fromNodeId === 'node_if_valid') {
                if (conn.fromOutputIndex === 0) {
                  label = 'Valid & Certain (0)';
                  strokeColor = '#34d399';
                } else {
                  label = 'Uncertain / Failed (1)';
                  strokeColor = '#f59e0b';
                  markerId = 'arrowhead-fallback';
                }
              } else if (conn.fromNodeId === 'node_if_urgency') {
                if (conn.fromOutputIndex === 0) {
                  label = 'High / Critical (0)';
                  strokeColor = '#ea4b35';
                  markerId = 'arrowhead-urgent';
                } else {
                  label = 'Low / Medium (1)';
                  strokeColor = '#38bdf8';
                }
              }
            }

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            return (
              <g key={`conn-${idx}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isAiSubnode ? 1.8 : 2}
                  strokeDasharray={isAiSubnode ? '4 3' : 'none'}
                  markerEnd={`url(#${markerId})`}
                  opacity={0.85}
                />
                {label && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-48}
                      y={-10}
                      width={96}
                      height={18}
                      rx={4}
                      fill="#1e2028"
                      stroke={strokeColor}
                      strokeWidth={1}
                      opacity={0.95}
                    />
                    <text
                      x={0}
                      y={3}
                      fill="#f3f4f6"
                      fontSize="9.5"
                      fontFamily="monospace"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Node Cards */}
        {blueprint.nodes.map((node, index) => {
          const pos = nodeCoords.get(node.id) || getNodePos(node, index);
          const badge = getNodeCategoryBadge(node);
          const isSelected = selectedNodeId === node.id;

          return (
            <div
              key={node.id}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectNode) onSelectNode(node);
              }}
              style={{
                position: 'absolute',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${NODE_WIDTH}px`,
                minHeight: `${NODE_HEIGHT}px`,
                backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                border: `1px solid ${isSelected ? 'var(--accent-primary)' : badge.border}`,
                borderLeft: `4px solid ${badge.color}`,
                borderRadius: 'var(--radius-sm)',
                boxShadow: isSelected ? '0 0 0 2px var(--accent-primary-subtle), var(--shadow-md)' : 'var(--shadow-sm)',
                padding: '10px 12px',
                cursor: 'pointer',
                zIndex: isSelected ? 5 : 2,
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {/* Card Header */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.9rem' }}>{badge.icon}</span>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        color: badge.color,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.64rem',
                      color: '#34d399',
                      fontWeight: 600,
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                    }}
                  >
                    v{node.typeVersion}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={node.name}
                >
                  {node.name}
                </div>

                <div
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-tertiary)',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: '2px',
                  }}
                >
                  {node.type.replace('n8n-nodes-base.', '').replace('@n8n/n8n-nodes-langchain.', '')}
                </div>
              </div>

              {/* Card Footer Notes */}
              {node.notes && (
                <div
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-secondary)',
                    marginTop: '6px',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {node.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
