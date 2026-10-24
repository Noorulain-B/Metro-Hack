'use client';

import React, { useState } from 'react';
import { RequirementSpecification } from '@/lib/schemas/requirement';
import { WorkflowBlueprint } from '@/lib/schemas/blueprint';
import { ValidationReport } from '@/lib/schemas/validation';
import { N8nWorkflowExport, formatN8nJsonString } from '@/lib/n8n/generator';
import { OptimizationResult } from '@/lib/n8n/optimizer';
import { AiUsageMetrics } from '@/lib/ai/types';
import { STARTER_TEMPLATES, WorkflowTemplate } from '@/lib/templates';
import { SavedWorkflowRecord } from '@/lib/db/repository';

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

  // Workspace UI tab state
  const [activeTab, setActiveTab] = useState<'blueprint' | 'validation' | 'json' | 'prompt'>('blueprint');
  const [copiedType, setCopiedType] = useState<'json' | 'prompt' | null>(null);

  // History & Saved Workflows state
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflowRecord[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
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

  const openHistoryModal = () => {
    fetchHistory();
    setShowHistoryModal(true);
  };

  // Step 1: Analyze user request
  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

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

      // If there are unanswered clarification questions, present them
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
    setShowHistoryModal(false);
    setIsSaved(true);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(11, 15, 25, 0.85)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          className="container"
          style={{
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ea4b35 0%, #ff6d5a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(234, 75, 53, 0.3)',
                fontWeight: 800,
                fontSize: '1.1rem',
                color: '#fff',
              }}
            >
              ⚡
            </div>
            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                n8n AI Workflow Builder
                <span className="badge badge-n8n" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                  MVP
                </span>
              </h1>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                From plain English to validated automation, with fewer AI calls and less manual debugging.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Engine Indicator */}
            <div
              className={`badge ${provider === 'mock' ? 'badge-success' : 'badge-ai'}`}
              style={{ padding: '6px 12px' }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: provider === 'mock' ? '#10b981' : '#a855f7',
                  boxShadow: provider === 'mock' ? '0 0 8px #10b981' : '0 0 8px #a855f7',
                }}
              />
              {provider === 'mock' ? 'Local Mock Engine ($0 Free)' : 'Gemini AI Provider'}
            </div>

            {/* Saved Workflows Button */}
            <button
              onClick={openHistoryModal}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
            >
              📁 Saved Workflows ({savedWorkflows.length})
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="container" style={{ flex: 1, padding: '28px 24px', display: 'grid', gridTemplateColumns: '440px 1fr', gap: '28px' }}>
        {/* Left Column: Automation Builder Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📝</span> Describe Your Automation
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Explain what you want to automate in plain English. Verified n8n nodes will be selected deterministically.
            </p>

            <form onSubmit={handleAnalyze}>
              <div style={{ marginBottom: '16px' }}>
                <textarea
                  id="user-prompt-input"
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. When a new customer email arrives in Gmail, use an AI agent to analyze sentiment and urgency, and if high priority notify the team in Slack."
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: '0.88rem',
                    lineHeight: '1.5',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Starter Template Chips */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '8px' }}>
                  QUICK EXAMPLES (VERIFIED NODES):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {STARTER_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className="btn-chip"
                    >
                      {tpl.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Configuration Settings */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor="provider-select" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    AI Provider:
                  </label>
                  <select
                    id="provider-select"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as 'mock' | 'gemini')}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 10px',
                      color: '#fff',
                      fontSize: '0.82rem',
                    }}
                  >
                    <option value="mock">Local Mock Engine ($0 Free / Offline)</option>
                    <option value="gemini">Google Gemini (Requires API Key)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor="version-input" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Target n8n Version:
                  </label>
                  <input
                    id="version-input"
                    type="text"
                    value={targetN8nVersion}
                    onChange={(e) => setTargetN8nVersion(e.target.value)}
                    style={{
                      width: '140px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 10px',
                      color: '#fff',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(244, 63, 94, 0.1)',
                    border: '1px solid rgba(244, 63, 94, 0.25)',
                    color: '#fb7185',
                    fontSize: '0.82rem',
                    marginBottom: '16px',
                  }}
                >
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Action Button */}
              <button
                id="generate-button"
                type="submit"
                disabled={loading || !prompt.trim()}
                className="btn-primary"
                style={{ width: '100%' }}
              >
                {loading ? (
                  <>
                    <span className="pulse-glow">⏳</span> {statusMessage || 'Processing...'}
                  </>
                ) : (
                  <>
                    <span>⚡</span> Analyze & Build Workflow
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Clarification Modal / Step */}
          {showClarifications && requirement && requirement.clarifications.length > 0 && (
            <div className="glass-panel" style={{ padding: '20px', border: '1px solid var(--accent-amber)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span className="badge badge-warning">Targeted Clarification</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Only asked when essential details are ambiguous
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
                {requirement.clarifications.map((q) => (
                  <div key={q.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                      {q.question}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                      {q.context}
                    </div>

                    {q.options && q.options.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {q.options.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setClarificationAnswers((prev) => ({ ...prev, [q.id]: opt }))
                            }
                            className="btn-chip"
                            style={{
                              borderColor:
                                (clarificationAnswers[q.id] || q.defaultAnswer) === opt
                                  ? 'var(--accent-n8n)'
                                  : 'var(--border-subtle)',
                              color:
                                (clarificationAnswers[q.id] || q.defaultAnswer) === opt
                                  ? '#fff'
                                  : 'var(--text-muted)',
                              backgroundColor:
                                (clarificationAnswers[q.id] || q.defaultAnswer) === opt
                                  ? 'rgba(234, 75, 53, 0.2)'
                                  : 'transparent',
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={clarificationAnswers[q.id] || ''}
                        onChange={(e) =>
                          setClarificationAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder={`Default: ${q.defaultAnswer}`}
                        style={{
                          width: '100%',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '6px 10px',
                          color: '#fff',
                          fontSize: '0.82rem',
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => executeBlueprintGeneration(requirement)}
                  className="btn-primary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Apply & Generate Blueprint
                </button>
                <button
                  type="button"
                  onClick={() => executeBlueprintGeneration(requirement)}
                  className="btn-secondary"
                  style={{ padding: '10px' }}
                >
                  Accept Defaults
                </button>
              </div>
            </div>
          )}

          {/* Usage Transparency Card */}
          {metrics && (
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px' }}>
                COST & TRANSPARENCY TRACKER
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Engine: </span>
                  <span style={{ fontWeight: 600 }}>{metrics.modelName}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Estimated Cost: </span>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>
                    ${metrics.estimatedCostUsd.toFixed(2)} {metrics.isMock && '(Free)'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Tokens: </span>
                  <span>{metrics.totalTokens.toLocaleString()} total</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>AI Calls: </span>
                  <span>{metrics.aiCallsCount} call</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Workspace & Generated Outputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Workspace Tabs Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                id="tab-blueprint"
                onClick={() => setActiveTab('blueprint')}
                className="btn-secondary"
                style={{
                  backgroundColor: activeTab === 'blueprint' ? 'rgba(234, 75, 53, 0.15)' : 'transparent',
                  borderColor: activeTab === 'blueprint' ? 'var(--accent-n8n)' : 'transparent',
                  color: activeTab === 'blueprint' ? '#fff' : 'var(--text-muted)',
                }}
              >
                🗺️ Workflow Blueprint
              </button>
              <button
                id="tab-validation"
                onClick={() => setActiveTab('validation')}
                className="btn-secondary"
                style={{
                  backgroundColor: activeTab === 'validation' ? 'rgba(234, 75, 53, 0.15)' : 'transparent',
                  borderColor: activeTab === 'validation' ? 'var(--accent-n8n)' : 'transparent',
                  color: activeTab === 'validation' ? '#fff' : 'var(--text-muted)',
                }}
              >
                🛡️ Validation Report
                {validationReport && (
                  <span
                    className={`badge ${validationReport.valid ? 'badge-success' : 'badge-error'}`}
                    style={{ marginLeft: '6px', padding: '2px 6px', fontSize: '0.65rem' }}
                  >
                    {validationReport.valid ? 'Passed' : `${validationReport.errors.length} Errors`}
                  </span>
                )}
              </button>
              <button
                id="tab-json"
                onClick={() => setActiveTab('json')}
                className="btn-secondary"
                style={{
                  backgroundColor: activeTab === 'json' ? 'rgba(234, 75, 53, 0.15)' : 'transparent',
                  borderColor: activeTab === 'json' ? 'var(--accent-n8n)' : 'transparent',
                  color: activeTab === 'json' ? '#fff' : 'var(--text-muted)',
                }}
              >
                📄 n8n Workflow JSON
              </button>
              <button
                id="tab-prompt"
                onClick={() => setActiveTab('prompt')}
                className="btn-secondary"
                style={{
                  backgroundColor: activeTab === 'prompt' ? 'rgba(234, 75, 53, 0.15)' : 'transparent',
                  borderColor: activeTab === 'prompt' ? 'var(--accent-n8n)' : 'transparent',
                  color: activeTab === 'prompt' ? '#fff' : 'var(--text-muted)',
                }}
              >
                💬 Optimized AI Prompt
              </button>
            </div>

            {/* Quick Export Actions */}
            {blueprint && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  id="save-workflow-button"
                  onClick={handleSaveWorkflow}
                  className="btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                >
                  {isSaved ? '✓ Saved to DB' : '💾 Save Workflow'}
                </button>
                <button
                  id="download-json-button"
                  onClick={handleDownloadJson}
                  className="btn-primary"
                  style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                >
                  ⬇️ Download .json
                </button>
              </div>
            )}
          </div>

          {/* Empty State */}
          {!blueprint && !loading && (
            <div
              className="glass-panel"
              style={{
                padding: '60px 40px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚡</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
                Ready to Build Your Automation
              </h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '500px', fontSize: '0.9rem', lineHeight: '1.6' }}>
                Enter an automation request on the left or select a verified starter template. The system will analyze requirements, verify n8n nodes, optimize execution, and generate both an importable JSON file and an optimized prompt.
              </p>
            </div>
          )}

          {/* Tab 1: Workflow Blueprint View */}
          {blueprint && activeTab === 'blueprint' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Optimization Banner if applied */}
              {optimization && optimization.appliedRules.length > 0 && (
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>✨</span> Workflow Optimization Applied ({optimization.estimatedAiSavings})
                  </div>
                  {optimization.appliedRules.map((rule, idx) => (
                    <div key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                      • {rule}
                    </div>
                  ))}
                </div>
              )}

              {/* Blueprint Summary Card */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{blueprint.name}</h3>
                  <span className="badge badge-info">Target n8n v{blueprint.targetN8nVersion}</span>
                </div>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  {blueprint.description}
                </p>

                {/* Ordered Node Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
                    EXECUTION PIPELINE ({blueprint.nodes.length} NODES)
                  </div>
                  {blueprint.nodes.map((node, index) => (
                    <div
                      key={node.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(234, 75, 53, 0.15)',
                            color: '#ff6d5a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{node.name}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                            {node.type} (v{node.typeVersion})
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {node.credentials && Object.keys(node.credentials).length > 0 && (
                          <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                            🔑 {Object.keys(node.credentials).join(', ')}
                          </span>
                        )}
                        <span className="badge badge-n8n" style={{ fontSize: '0.7rem' }}>
                          Verified
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explicit Assumptions Card */}
              {blueprint.assumptions && blueprint.assumptions.length > 0 && (
                <div className="glass-panel" style={{ padding: '18px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px' }}>
                    EXPLICIT ASSUMPTIONS & RESOLUTIONS
                  </div>
                  <ul style={{ paddingLeft: '18px', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    {blueprint.assumptions.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Validation Report */}
          {validationReport && activeTab === 'validation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                className="glass-panel"
                style={{
                  padding: '20px',
                  borderLeft: `4px solid ${validationReport.valid ? '#10b981' : '#f43f5e'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {validationReport.valid ? (
                      <>
                        <span style={{ color: '#10b981' }}>✓</span> Workflow Structurally Valid
                      </>
                    ) : (
                      <>
                        <span style={{ color: '#f43f5e' }}>✖</span> Validation Issues Found
                      </>
                    )}
                  </h3>
                  <span className="badge badge-info">Baseline: v{validationReport.targetN8nVersion}</span>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  All node types, versions, connections, and required parameters have been deterministically evaluated against official n8n schemas.
                </p>
              </div>

              {/* Issues List */}
              {validationReport.errors.length > 0 && (
                <div className="glass-panel" style={{ padding: '20px', borderColor: 'rgba(244, 63, 94, 0.3)' }}>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fb7185', marginBottom: '12px' }}>
                    BLOCKING ERRORS ({validationReport.errors.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {validationReport.errors.map((err, idx) => (
                      <div key={idx} style={{ padding: '10px', backgroundColor: 'rgba(244, 63, 94, 0.05)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>
                          [{err.code}] {err.message}
                        </div>
                        {err.suggestedCorrection && (
                          <div style={{ fontSize: '0.78rem', color: '#fbbf24', marginTop: '4px' }}>
                            Correction: {err.suggestedCorrection}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings List */}
              {validationReport.warnings.length > 0 && (
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fbbf24', marginBottom: '12px' }}>
                    WARNINGS & SETUP NOTES ({validationReport.warnings.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {validationReport.warnings.map((warn, idx) => (
                      <div key={idx} style={{ padding: '10px', backgroundColor: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>
                          [{warn.code}] {warn.message}
                        </div>
                        {warn.suggestedCorrection && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Action: {warn.suggestedCorrection}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checks Not Performed Disclaimer */}
              <div className="glass-panel" style={{ padding: '18px', backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px' }}>
                  CHECKS NOT PERFORMED (PREVENTS FALSE CERTAINTY)
                </div>
                <ul style={{ paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                  {validationReport.checksNotPerformed.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Tab 3: n8n Workflow JSON Preview */}
          {workflowJson && activeTab === 'json' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Ready to copy and paste or download into your n8n canvas (Manual Import).
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    id="copy-json-button"
                    onClick={() => handleCopy(formatN8nJsonString(workflowJson), 'json')}
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    {copiedType === 'json' ? '✓ Copied to Clipboard!' : '📋 Copy JSON'}
                  </button>
                  <button
                    onClick={handleDownloadJson}
                    className="btn-primary"
                    style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                  >
                    ⬇️ Download .json
                  </button>
                </div>
              </div>

              <div className="code-container" style={{ maxHeight: '550px' }}>
                <pre>{formatN8nJsonString(workflowJson)}</pre>
              </div>
            </div>
          )}

          {/* Tab 4: Optimized AI Prompt Preview */}
          {generatedPrompt && activeTab === 'prompt' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Optimized prompt based on the approved canonical blueprint.
                </div>
                <button
                  id="copy-prompt-button"
                  onClick={() => handleCopy(generatedPrompt, 'prompt')}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  {copiedType === 'prompt' ? '✓ Copied to Clipboard!' : '📋 Copy Prompt'}
                </button>
              </div>

              <div className="code-container" style={{ maxHeight: '550px', whiteSpace: 'pre-wrap' }}>
                {generatedPrompt}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* History Modal */}
      {showHistoryModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '24px',
          }}
        >
          <div className="glass-panel-elevated" style={{ width: '100%', maxWidth: '640px', padding: '28px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Saved Workflows (SQLite)</h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="btn-secondary"
                style={{ padding: '4px 10px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {savedWorkflows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  No saved workflows yet. Generate a workflow and click &quot;Save Workflow&quot;.
                </div>
              ) : (
                savedWorkflows.map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rec.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {new Date(rec.createdAt).toLocaleDateString()} • {rec.blueprint.nodes.length} nodes
                      </div>
                    </div>
                    <button
                      onClick={() => handleLoadSaved(rec)}
                      className="btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                    >
                      Load
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '20px 0',
          textAlign: 'center',
          fontSize: '0.78rem',
          color: 'var(--text-dim)',
        }}
      >
        <div className="container">
          AI-Powered n8n Workflow Builder • Deterministic Validation & Zero Hallucination Guarantee • Target n8n v1.70+
        </div>
      </footer>
    </div>
  );
}
