'use client';

import React from 'react';
import { BlueprintNode } from '@/lib/schemas/blueprint';
import { getNodeDefinition } from '@/lib/n8n/registry';

interface NodeInspectorProps {
  node: BlueprintNode | null;
  onClose: () => void;
}

export function NodeInspector({ node, onClose }: NodeInspectorProps) {
  if (!node) return null;
  const def = getNodeDefinition(node.type);

  return (
    <div
      className="panel-elevated"
      style={{
        width: '320px',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-surface)',
        zIndex: 20,
        overflow: 'hidden',
      }}
    >
      {/* Inspector Header */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
            NODE INSPECTOR
          </span>
        </div>
        <button type="button" onClick={onClose} className="btn-icon" style={{ width: '24px', height: '24px', fontSize: '0.8rem' }}>
          ✕
        </button>
      </div>

      {/* Inspector Content */}
      <div style={{ padding: '14px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
            {node.name}
          </h4>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
            {node.type} (v{node.typeVersion})
          </div>
        </div>

        {node.notes && (
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45, backgroundColor: 'var(--bg-surface-subtle)', padding: '8px 10px', borderRadius: 'var(--radius-xs)' }}>
            {node.notes}
          </div>
        )}

        {/* Credentials */}
        {node.credentials && Object.keys(node.credentials).length > 0 && (
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
              CREDENTIAL CONFIGURATION
            </div>
            {Object.entries(node.credentials).map(([k, v]) => (
              <div
                key={k}
                style={{
                  fontSize: '0.72rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '6px 8px',
                  color: '#fbbf24',
                }}
              >
                <strong>{k}:</strong> {v}
              </div>
            ))}
          </div>
        )}

        {/* Parameters */}
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
            NODE PARAMETERS
          </div>
          <div className="code-container" style={{ maxHeight: '240px', fontSize: '0.72rem' }}>
            <pre>{JSON.stringify(node.parameters, null, 2)}</pre>
          </div>
        </div>

        {def?.documentationUrl && (
          <div>
            <a
              href={def.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.74rem', color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Official n8n Node Reference ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
