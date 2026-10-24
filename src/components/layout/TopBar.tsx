'use client';

import React from 'react';
import { WorkflowBlueprint } from '@/lib/schemas/blueprint';

interface TopBarProps {
  blueprint: WorkflowBlueprint | null;
  provider: 'mock' | 'gemini';
  targetN8nVersion: string;
  isSaved: boolean;
  copiedType: 'json' | 'prompt' | null;
  onSave: () => void;
  onCopyJson: () => void;
  onDownloadJson: () => void;
  onCopyPrompt: () => void;
}

export function TopBar({
  blueprint,
  provider,
  targetN8nVersion,
  isSaved,
  copiedType,
  onSave,
  onCopyJson,
  onDownloadJson,
  onCopyPrompt,
}: TopBarProps) {
  return (
    <header
      style={{
        height: '52px',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      {/* Left: Product Brand & Workflow Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.95rem',
              color: '#ffffff',
            }}
          >
            ⚡
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
            n8n Studio
          </span>
        </div>

        <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-subtle)' }} />

        {/* Current Workflow Title & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: blueprint ? 'var(--text-primary)' : 'var(--text-tertiary)',
              maxWidth: '320px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {blueprint ? blueprint.name : 'Untitled Automation'}
          </span>

          {blueprint && (
            <span
              className={`badge ${isSaved ? 'badge-success' : 'badge-neutral'}`}
              style={{ fontSize: '0.66rem', padding: '1px 6px' }}
            >
              {isSaved ? 'Saved' : 'Unsaved'}
            </span>
          )}
        </div>
      </div>

      {/* Center: System Status Indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          className="badge badge-neutral"
          style={{ fontSize: '0.68rem', fontFamily: 'monospace' }}
          title="Target n8n compatibility baseline"
        >
          n8n v{targetN8nVersion}
        </span>

        <span
          className={`badge ${provider === 'mock' ? 'badge-success' : 'badge-info'}`}
          style={{ fontSize: '0.68rem' }}
          title="AI Generation Engine Status"
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: provider === 'mock' ? '#34d399' : '#38bdf8',
            }}
          />
          {provider === 'mock' ? 'Local Mock Engine ($0 Free)' : 'Gemini AI Pro'}
        </span>
      </div>

      {/* Right: Primary Action Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={onSave}
          disabled={!blueprint}
          className="btn-secondary"
          style={{ fontSize: '0.78rem', padding: '5px 10px' }}
          title="Save workflow to local SQLite storage"
        >
          {isSaved ? '✓ Saved' : '💾 Save'}
        </button>

        <button
          type="button"
          onClick={onCopyPrompt}
          disabled={!blueprint}
          className="btn-secondary"
          style={{ fontSize: '0.78rem', padding: '5px 10px' }}
          title="Copy optimized n8n prompt"
        >
          {copiedType === 'prompt' ? '✓ Prompt Copied' : '📄 Copy Prompt'}
        </button>

        <button
          type="button"
          onClick={onCopyJson}
          disabled={!blueprint}
          className="btn-secondary"
          style={{ fontSize: '0.78rem', padding: '5px 10px' }}
          title="Copy workflow JSON to clipboard"
        >
          {copiedType === 'json' ? '✓ JSON Copied' : '📋 Copy JSON'}
        </button>

        <button
          type="button"
          onClick={onDownloadJson}
          disabled={!blueprint}
          className="btn-primary"
          style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          title="Download importable n8n workflow JSON file"
        >
          📥 Export JSON
        </button>
      </div>
    </header>
  );
}
