'use client';

import React from 'react';
import { SavedWorkflowRecord } from '@/lib/db/repository';

interface SavedWorkflowsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflows: SavedWorkflowRecord[];
  onLoadWorkflow: (record: SavedWorkflowRecord) => void;
  onDeleteWorkflow: (id: string) => void;
}

export function SavedWorkflowsModal({
  isOpen,
  onClose,
  workflows,
  onLoadWorkflow,
  onDeleteWorkflow,
}: SavedWorkflowsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="panel-elevated"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '740px',
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
              Saved Automations ({workflows.length})
            </h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Locally persisted workflows stored in SQLite (`data/workflows.db`).
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon" style={{ fontSize: '1rem' }}>
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {workflows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📁</div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No saved workflows yet</div>
              <div style={{ fontSize: '0.76rem', marginTop: '4px' }}>
                Generate an automation and click &quot;Save&quot; in the top bar to store it here.
              </div>
            </div>
          ) : (
            workflows.map((record) => {
              const nodeCount = record.blueprint?.nodes?.length || record.workflowJson?.nodes?.length || 0;
              const formattedDate = new Date(record.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={record.id}
                  style={{
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {record.name}
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.64rem' }}>
                        {nodeCount} Nodes
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.64rem', fontFamily: 'monospace' }}>
                        v{record.targetN8nVersion}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: '0.76rem',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: '4px',
                      }}
                      title={record.userPrompt}
                    >
                      &quot;{record.userPrompt}&quot;
                    </p>

                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                      Saved on {formattedDate}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => onLoadWorkflow(record)}
                      className="btn-primary"
                      style={{ fontSize: '0.74rem', padding: '5px 10px' }}
                    >
                      Load Workflow
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteWorkflow(record.id)}
                      className="btn-icon"
                      style={{ width: '28px', height: '28px', color: '#fb7185', fontSize: '0.85rem' }}
                      title="Delete record"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
