'use client';

import React from 'react';

export type NavView = 'builder' | 'saved' | 'templates' | 'registry';

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  onNewWorkflow: () => void;
  savedCount: number;
}

export function Sidebar({
  currentView,
  onSelectView,
  onNewWorkflow,
  savedCount,
}: SidebarProps) {
  const navItems: { id: NavView; label: string; icon: string; count?: number }[] = [
    { id: 'builder', label: 'Workflow Builder', icon: '⚡' },
    { id: 'saved', label: 'Saved Workflows', icon: '📁', count: savedCount },
    { id: 'templates', label: 'Starter Templates', icon: '🧩' },
    { id: 'registry', label: 'Verified Nodes', icon: '🛡️' },
  ];

  return (
    <aside
      style={{
        width: '210px',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        height: '100%',
        userSelect: 'none',
      }}
    >
      <div>
        {/* New Workflow Action Button */}
        <div style={{ padding: '12px 14px' }}>
          <button
            type="button"
            onClick={onNewWorkflow}
            className="btn-primary"
            style={{ width: '100%', fontSize: '0.8rem', padding: '7px 10px', justifyContent: 'center' }}
          >
            <span>+</span> New Workflow
          </button>
        </div>

        {/* Navigation Section */}
        <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div
            style={{
              fontSize: '0.66rem',
              fontWeight: 700,
              color: 'var(--text-tertiary)',
              padding: '6px 10px',
              letterSpacing: '0.04em',
            }}
          >
            WORKSPACE
          </div>

          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  border: isActive ? '1px solid var(--border-medium)' : '1px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 600 : 500,
                  textAlign: 'left',
                  transition: 'all 0.12s ease',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.9rem' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-surface-subtle)',
                      color: '#ffffff',
                      borderRadius: '9999px',
                      padding: '1px 6px',
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Info: Local Environment */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(0, 0, 0, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            SQLite Storage Active
          </span>
        </div>
        <div style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)' }}>
          Local Mode · $0 Spend · 0 Leaks
        </div>
      </div>
    </aside>
  );
}
