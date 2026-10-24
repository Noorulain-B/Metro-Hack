'use client';

import React from 'react';
import { getAllNodeDefinitions } from '@/lib/n8n/registry';

interface RegistryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RegistryModal({ isOpen, onClose }: RegistryModalProps) {
  if (!isOpen) return null;
  const nodes = getAllNodeDefinitions();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="panel-elevated"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '840px',
          maxWidth: '92vw',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Verified n8n Node Registry ({nodes.length} Nodes)
            </h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Official n8n node specifications cross-referenced against n8n v1.70+ baseline.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon" style={{ fontSize: '1rem' }}>
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {nodes.map((node) => (
            <div
              key={node.nodeType}
              style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {node.displayName}
                  </span>
                  <span
                    style={{
                      fontSize: '0.64rem',
                      fontFamily: 'monospace',
                      color: 'var(--accent-primary)',
                      backgroundColor: 'var(--accent-primary-subtle)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                    }}
                  >
                    {node.nodeType}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="badge badge-neutral" style={{ fontSize: '0.62rem', textTransform: 'uppercase' }}>
                    {node.category}
                  </span>
                  <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>
                    v{node.defaultVersion} (Supported: {node.supportedVersions.join(', ')})
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                {node.description}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                <div>
                  Required Params: {node.requiredParameters.length > 0 ? node.requiredParameters.join(', ') : 'None'}
                  {node.credentialsRequired && (
                    <span style={{ marginLeft: '10px', color: '#fbbf24' }}>
                      🔑 Credential: {node.credentialsRequired}
                    </span>
                  )}
                </div>
                {node.documentationUrl && (
                  <a
                    href={node.documentationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#38bdf8', textDecoration: 'none' }}
                  >
                    Documentation ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
