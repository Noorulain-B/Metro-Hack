'use client';

import React from 'react';
import { STARTER_TEMPLATES, WorkflowTemplate } from '@/lib/templates';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: WorkflowTemplate) => void;
}

export function TemplatesModal({
  isOpen,
  onClose,
  onSelectTemplate,
}: TemplatesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="panel-elevated"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '780px',
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
              Starter Automation Templates
            </h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Pre-configured prompts utilizing 100% verified n8n official nodes.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon" style={{ fontSize: '1rem' }}>
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '14px' }}>
          {STARTER_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {tpl.title}
                  </h4>
                  <span className="badge badge-neutral" style={{ fontSize: '0.62rem', textTransform: 'uppercase' }}>
                    {tpl.category}
                  </span>
                </div>

                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '10px' }}>
                  {tpl.description}
                </p>

                {/* Node Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {tpl.nodeTypes.map((nodeType, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.64rem',
                        fontFamily: 'monospace',
                        color: 'var(--text-tertiary)',
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '3px',
                        padding: '1px 5px',
                      }}
                    >
                      {nodeType.replace('n8n-nodes-base.', '').replace('@n8n/n8n-nodes-langchain.', '')}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectTemplate(tpl);
                  onClose();
                }}
                className="btn-primary"
                style={{ fontSize: '0.76rem', padding: '6px 12px', width: '100%', justifyContent: 'center' }}
              >
                Load Template
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
