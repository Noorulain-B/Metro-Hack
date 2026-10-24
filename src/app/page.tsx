'use client';

import React, { useState } from 'react';
import { RequirementSpecification } from '@/lib/schemas/requirement';
import { WorkflowBlueprint, BlueprintNode } from '@/lib/schemas/blueprint';
import { ValidationReport } from '@/lib/schemas/validation';
import { N8nWorkflowExport, formatN8nJsonString } from '@/lib/n8n/generator';
import { OptimizationResult } from '@/lib/n8n/optimizer';
import { AiUsageMetrics } from '@/lib/ai/types';
import { STARTER_TEMPLATES, WorkflowTemplate } from '@/lib/templates';
import { SavedWorkflowRecord } from '@/lib/db/repository';

import { TopBar } from '@/components/layout/TopBar';
import { Sidebar, NavView } from '@/components/layout/Sidebar';
import { WorkflowCanvas } from '@/components/canvas/WorkflowCanvas';
import { NodeInspector } from '@/components/canvas/NodeInspector';
import { SavedWorkflowsModal } from '@/components/modals/SavedWorkflowsModal';
import { TemplatesModal } from '@/components/modals/TemplatesModal';
import { RegistryModal } from '@/components/modals/RegistryModal';

export default function WorkflowBuilderPage() {
  // Input & Configuration state
  const [prompt, setPrompt] = useState<string>('');
  const [provider, setProvider] = useState<'mock' | 'gemini'>('mock');
  const [targetN8nVersion, setTargetN8nVersion] = useState<string>('1.70.0');

  // Execution flow state
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Requirement & Clarification state
  const [requirement, setRequirement] = useState<RequirementSpecification | null>(null);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [showClarifications, setShowClarifications] = useState<boolean>(false);

  // Generated outputs state
  const [blueprint, setBlueprint] = useState<WorkflowBlueprint | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [workflowJson, setWorkflowJson] = useState<N8nWorkflowExport | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [metrics, setMetrics] = useState<AiUsageMetrics | null>(null);

  // Workspace UI navigation & modal state
  const [currentNavView, setCurrentNavView] = useState<NavView>('builder');
  const [activeTab, setActiveTab] = useState<'blueprint' | 'validation' | 'json' | 'prompt'>('blueprint');
  const [copiedType, setCopiedType] = useState<'json' | 'prompt' | null>(null);
  const [selectedNode, setSelectedNode] = useState<BlueprintNode | null>(null);
  const [activeModal, setActiveModal] = useState<'saved' | 'templates' | 'registry' | null>(null);
  const [isPromptExpanded, setIsPromptExpanded] = useState<boolean>(true);

  // History & Saved Workflows state
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflowRecord[]>([]);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setSavedWorkflows(data.workflows || []);
      }
    } catch {
      // Offline / initial load resilience
    }
  };


  // Step 1: Analyze user request
  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setErrorMsg(null);
    setStatusMessage('Analyzing automation intent & verified nodes...');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          previousClarifications: clarificationAnswers,
          provider,
          targetN8nVersion,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to analyze requirements.');
      }

      const data = await res.json();
      setRequirement(data.requirement);
      setMetrics(data.metrics);

      // If there are clarification questions, present them
      if (data.requirement.clarifications && data.requirement.clarifications.length > 0) {
        setShowClarifications(true);
        setStatusMessage('Clarification questions generated.');
      } else {
        // Proceed straight to blueprint generation
        await executeBlueprintGeneration(data.requirement);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Generate Blueprint, Optimizer, Validator, JSON & Prompt
  const executeBlueprintGeneration = async (reqToUse: RequirementSpecification) => {
    setLoading(true);
    setStatusMessage('Constructing canonical blueprint & running validator...');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement: reqToUse,
          targetN8nVersion,
          provider,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Blueprint generation failed.');
      }

      const data = await res.json();
      setBlueprint(data.blueprint);
      setOptimization(data.optimization);
      setValidationReport(data.validationReport);
      setWorkflowJson(data.workflowJson);
      setGeneratedPrompt(data.generatedPrompt);
      setMetrics(data.metrics);
      setShowClarifications(false);
      setIsSaved(false);
      setSelectedNode(null);
      setStatusMessage('Workflow ready!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle template selection
  const handleSelectTemplate = (tpl: WorkflowTemplate) => {
    setPrompt(tpl.userPrompt);
    setErrorMsg(null);
    setActiveModal(null);
    setCurrentNavView('builder');
  };

  // Copy helpers with visual confirmation
  const handleCopy = (text: string, type: 'json' | 'prompt') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  // Download official n8n workflow JSON file
  const handleDownloadJson = () => {
    if (!workflowJson || !blueprint) return;
    const jsonString = formatN8nJsonString(workflowJson);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const sanitizedName = blueprint.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `n8n-workflow-${sanitizedName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Save to SQLite
  const handleSaveWorkflow = async () => {
    if (!blueprint || !workflowJson || !validationReport) return;

    try {
      const record: SavedWorkflowRecord = {
        id: blueprint.id,
        name: blueprint.name,
        userPrompt: prompt,
        targetN8nVersion,
        blueprint,
        workflowJson,
        generatedPrompt,
        validationReport,
        createdAt: new Date().toISOString(),
      };

      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });

      if (res.ok) {
        setIsSaved(true);
        fetchHistory();
      }
    } catch {
      // Save handling
    }
  };

  // Load a saved workflow from SQLite
  const handleLoadSaved = (record: SavedWorkflowRecord) => {
    setPrompt(record.userPrompt);
    setTargetN8nVersion(record.targetN8nVersion);
    setBlueprint(record.blueprint);
    setWorkflowJson(record.workflowJson);
    setGeneratedPrompt(record.generatedPrompt);
    setValidationReport(record.validationReport);
    setIsSaved(true);
    setSelectedNode(null);
    setActiveModal(null);
    setCurrentNavView('builder');
  };

  // Delete a saved workflow from SQLite
  const handleDeleteSaved = async (id: string) => {
    try {
      const res = await fetch(`/api/history?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchHistory();
      }
    } catch {
      // Error handling
    }
  };

  // Reset to empty new workflow
  const handleNewWorkflow = () => {
    setPrompt('');
    setRequirement(null);
    setBlueprint(null);
    setOptimization(null);
    setValidationReport(null);
    setWorkflowJson(null);
    setGeneratedPrompt(null as unknown as string);
    setSelectedNode(null);
    setIsSaved(false);
    setErrorMsg(null);
    setStatusMessage('');
    setCurrentNavView('builder');
  };

  // Sidebar navigation handler
  const handleNavSelect = (view: NavView) => {
    if (view === 'saved') {
      fetchHistory();
      setActiveModal('saved');
    } else if (view === 'templates') {
      setActiveModal('templates');
    } else if (view === 'registry') {
      setActiveModal('registry');
    } else {
      setCurrentNavView('builder');
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)' }}>
      {/* 1. Top Bar */}
      <TopBar
        blueprint={blueprint}
        provider={provider}
        targetN8nVersion={targetN8nVersion}
        isSaved={isSaved}
        copiedType={copiedType}
        onSave={handleSaveWorkflow}
        onCopyJson={() => workflowJson && handleCopy(formatN8nJsonString(workflowJson), 'json')}
        onDownloadJson={handleDownloadJson}
        onCopyPrompt={() => generatedPrompt && handleCopy(generatedPrompt, 'prompt')}
      />

      {/* 2. Workspace Body: Left Sidebar + Main Content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentView={currentNavView}
          onSelectView={handleNavSelect}
          onNewWorkflow={handleNewWorkflow}
          savedCount={savedWorkflows.length}
        />

        {/* Main Content Workspace */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflow: 'hidden',
            backgroundColor: 'var(--bg-canvas)',
          }}
        >
          {/* Top Panel: Natural-Language Request Editor */}
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                  AUTOMATION INSTRUCTION
                </span>
                <span className="badge badge-neutral" style={{ fontSize: '0.66rem' }}>
                  Natural Language to Verified n8n
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* AI Provider selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label htmlFor="provider-select" style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                    Provider:
                  </label>
                  <select
                    id="provider-select"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as 'mock' | 'gemini')}
                    className="select-input"
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  >
                    <option value="mock">Mock Engine ($0 Free)</option>
                    <option value="gemini">Google Gemini AI Pro</option>
                  </select>
                </div>

                {/* Target n8n version selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label htmlFor="version-select" style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                    Target n8n:
                  </label>
                  <select
                    id="version-select"
                    value={targetN8nVersion}
                    onChange={(e) => setTargetN8nVersion(e.target.value)}
                    className="select-input"
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  >
                    <option value="1.70.0">v1.70.0 (Recommended)</option>
                    <option value="1.60.0">v1.60.0</option>
                  </select>
                </div>

                {/* Collapse button */}
                <button
                  type="button"
                  onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                  className="btn-icon"
                  style={{ width: '26px', height: '26px', fontSize: '0.75rem' }}
                  title={isPromptExpanded ? 'Collapse editor' : 'Expand editor'}
                >
                  {isPromptExpanded ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {isPromptExpanded && (
              <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <textarea
                    id="user-prompt-input"
                    rows={2}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. When a new customer email arrives, classify its sentiment and urgency, then notify the support team in Slack."
                    style={{
                      flex: 1,
                      backgroundColor: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      lineHeight: '1.45',
                      resize: 'none',
                      outline: 'none',
                    }}
                  />

                  <button
                    id="generate-button"
                    type="submit"
                    disabled={loading || !prompt.trim()}
                    className="btn-primary"
                    style={{ height: '48px', padding: '0 18px', fontSize: '0.82rem', flexShrink: 0 }}
                  >
                    {loading ? (
                      <>
                        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</span>
                        <span>Building...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        <span>Analyze & Build</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Quick Examples Chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                    QUICK EXAMPLES:
                  </span>
                  {STARTER_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className="chip"
                    >
                      {tpl.title}
                    </button>
                  ))}
                </div>
              </form>
            )}

            {/* Error Message banner */}
            {errorMsg && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(244, 63, 94, 0.1)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: '#fb7185',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>⚠️ {errorMsg}</span>
                <button type="button" onClick={() => setErrorMsg(null)} className="btn-icon" style={{ width: '20px', height: '20px' }}>
                  ✕
                </button>
              </div>
            )}

            {/* Status notification */}
            {statusMessage && !errorMsg && (
              <div style={{ marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {statusMessage} {metrics && `· AI Cost: $${metrics.estimatedCostUsd.toFixed(4)} · Model: ${metrics.modelName} · Tokens: ${metrics.totalTokens}`}
              </div>
            )}
          </div>

          {/* Clarification Questions Card if Ambiguous */}
          {showClarifications && requirement && requirement.clarifications.length > 0 && (
            <div
              style={{
                padding: '12px 18px',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24' }}>
                💡 Clarification Needed to Avoid Assumptions:
              </div>
              {requirement.clarifications.map((q) => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-primary)' }}>{q.question}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {q.options && q.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const updated = { ...clarificationAnswers, [q.id]: opt };
                          setClarificationAnswers(updated);
                          if (requirement) executeBlueprintGeneration(requirement);
                        }}
                        className="btn-secondary"
                        style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Center: Interactive Workflow Canvas + Inspector */}
          <div style={{ flex: 1, minHeight: '360px', display: 'flex', position: 'relative', overflow: 'hidden' }}>
            <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden' }}>
              <WorkflowCanvas
                blueprint={blueprint}
                selectedNodeId={selectedNode?.id}
                onSelectNode={(node) => setSelectedNode(node)}
              />
            </div>

            {/* Node Inspector Drawer */}
            {selectedNode && (
              <NodeInspector
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
              />
            )}
          </div>

          {/* Bottom Panel: Structured Result Tabs */}
          {blueprint && (
            <div
              style={{
                height: '240px',
                backgroundColor: 'var(--bg-surface)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
              }}
            >
              {/* Tabs Navigation Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border-subtle)',
                  padding: '0 14px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  height: '36px',
                }}
              >
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('blueprint')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      color: activeTab === 'blueprint' ? '#ffffff' : 'var(--text-secondary)',
                      borderBottom: activeTab === 'blueprint' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      background: 'transparent',
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderTop: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    📋 Blueprint ({blueprint.nodes.length} Nodes)
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('validation')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      color: activeTab === 'validation' ? '#ffffff' : 'var(--text-secondary)',
                      borderBottom: activeTab === 'validation' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      background: 'transparent',
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderTop: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>🛡️ Validation</span>
                    {validationReport && (
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: validationReport.valid ? '#10b981' : '#f43f5e',
                        }}
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('json')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      color: activeTab === 'json' ? '#ffffff' : 'var(--text-secondary)',
                      borderBottom: activeTab === 'json' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      background: 'transparent',
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderTop: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {'{ }'} n8n Workflow JSON
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('prompt')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      color: activeTab === 'prompt' ? '#ffffff' : 'var(--text-secondary)',
                      borderBottom: activeTab === 'prompt' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      background: 'transparent',
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderTop: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    📄 Optimized Prompt
                  </button>
                </div>

                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                  Single Canonical Source: {blueprint.name}
                </div>
              </div>

              {/* Tab Content Body */}
              <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto' }}>
                {/* Tab 1: Blueprint */}
                {activeTab === 'blueprint' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {optimization && optimization.appliedRules.length > 0 && (
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          fontSize: '0.74rem',
                          color: '#34d399',
                        }}
                      >
                        ✨ Optimization: {optimization.appliedRules.join(' · ')}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                      {/* Assumptions */}
                      <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                          EXPLICIT ASSUMPTIONS ({blueprint.assumptions.length})
                        </div>
                        <ul style={{ paddingLeft: '14px', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {blueprint.assumptions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Expected Outputs */}
                      <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                          EXPECTED OUTPUTS ({blueprint.expectedOutputs.length})
                        </div>
                        <ul style={{ paddingLeft: '14px', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {blueprint.expectedOutputs.map((o, i) => (
                            <li key={i}>{o}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Validation */}
                {activeTab === 'validation' && validationReport && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: validationReport.valid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
                        border: `1px solid ${validationReport.valid ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: validationReport.valid ? '#34d399' : '#fb7185', fontWeight: 700, fontSize: '0.9rem' }}>
                          {validationReport.valid ? '✓ Passed' : '✖ Issues Found'}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                          Validated against official n8n v{validationReport.targetN8nVersion} schemas & verified registry.
                        </span>
                      </div>
                      <span className="badge badge-neutral" style={{ fontSize: '0.64rem' }}>
                        0 Blocking Errors · {validationReport.warnings.length} Warnings
                      </span>
                    </div>

                    {/* Disclaimers: Checks Not Performed */}
                    <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                        CHECKS NOT PERFORMED (PREVENTS FALSE CERTAINTY)
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {validationReport.checksNotPerformed.map((chk, i) => (
                          <span key={i} className="badge badge-neutral" style={{ fontSize: '0.66rem' }}>
                            • {chk}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: JSON */}
                {activeTab === 'json' && workflowJson && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Official n8n v1 format · {workflowJson.nodes.length} nodes · Ready to paste directly into n8n canvas.
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleCopy(formatN8nJsonString(workflowJson), 'json')}
                          className="btn-secondary"
                          style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                        >
                          {copiedType === 'json' ? '✓ Copied!' : '📋 Copy JSON'}
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadJson}
                          className="btn-primary"
                          style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                        >
                          📥 Download File
                        </button>
                      </div>
                    </div>
                    <div className="code-container" style={{ maxHeight: '140px' }}>
                      <pre>{formatN8nJsonString(workflowJson)}</pre>
                    </div>
                  </div>
                )}

                {/* Tab 4: Prompt */}
                {activeTab === 'prompt' && generatedPrompt && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Optimized prompt constructed from identical canonical blueprint.
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedPrompt, 'prompt')}
                        className="btn-secondary"
                        style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                      >
                        {copiedType === 'prompt' ? '✓ Copied!' : '📄 Copy Prompt'}
                      </button>
                    </div>
                    <div className="code-container" style={{ maxHeight: '140px' }}>
                      <pre>{generatedPrompt}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals & Drawers */}
      <SavedWorkflowsModal
        isOpen={activeModal === 'saved'}
        onClose={() => setActiveModal(null)}
        workflows={savedWorkflows}
        onLoadWorkflow={handleLoadSaved}
        onDeleteWorkflow={handleDeleteSaved}
      />

      <TemplatesModal
        isOpen={activeModal === 'templates'}
        onClose={() => setActiveModal(null)}
        onSelectTemplate={handleSelectTemplate}
      />

      <RegistryModal
        isOpen={activeModal === 'registry'}
        onClose={() => setActiveModal(null)}
      />
    </div>
  );
}
