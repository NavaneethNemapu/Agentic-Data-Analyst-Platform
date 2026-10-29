import React, { useState } from 'react';
import {
  X,
  Settings,
  Cpu,
  Database,
  User,
  Sliders,
  Sun,
  Moon,
  Upload,
  RotateCcw,
  Check,
  Trash2,
  LogOut,
  ArrowRight,
  FileSpreadsheet
} from 'lucide-react';

const AGENT_ROLES = [
  { key: 'schema_linker', name: 'Schema Linker', role: 'Filters tables & columns relevant to the user analytical inquiry' },
  { key: 'query_planner', name: 'Query Planner', role: 'Deconstructs analytical question into step-by-step SQL operations' },
  { key: 'sql_generator', name: 'SQL Generator', role: 'Generates dialect-accurate SQL with experience memory recall' },
  { key: 'validator', name: 'Validator & Analyst', role: 'Executes against database, validates accuracy, and derives business takeaways' }
];

export default function SettingsModal({
  isOpen,
  onClose,
  initialTab = 'general',
  theme,
  onSetTheme,
  routingSettings,
  onRoutingChange,
  availableProviders = ['auto', 'groq', 'sambanova', 'ollama', 'openai', 'anthropic', 'gemini'],
  dbInfo,
  onUploadClick,
  onResetDb,
  currentUser,
  onLogout,
  onOpenAuth,
  onClearHistory
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [autoVisualize, setAutoVisualize] = useState(() => {
    return localStorage.getItem('agentic_auto_viz') !== 'false';
  });
  const [defaultChartType, setDefaultChartType] = useState(() => {
    return localStorage.getItem('agentic_default_chart') || 'auto';
  });

  if (!isOpen) return null;

  const handleToggleAutoViz = () => {
    const next = !autoVisualize;
    setAutoVisualize(next);
    localStorage.setItem('agentic_auto_viz', String(next));
  };

  const handleChangeChartType = (type) => {
    setDefaultChartType(type);
    localStorage.setItem('agentic_default_chart', type);
  };

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Settings Header */}
        <div className="settings-dialog-header">
          <div className="settings-dialog-title">
            <Settings size={20} className="settings-header-icon" />
            <span>Settings</span>
          </div>
          <button
            type="button"
            className="settings-close-btn"
            onClick={onClose}
            title="Close Settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Settings Body Layout: Left Tabs + Right Panel */}
        <div className="settings-dialog-body">
          {/* Settings Tabs Sidebar */}
          <nav className="settings-tabs-sidebar">
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <Sliders size={16} />
              <span>General</span>
            </button>

            <button
              type="button"
              className={`settings-tab-btn ${activeTab === 'routing' ? 'active' : ''}`}
              onClick={() => setActiveTab('routing')}
            >
              <Cpu size={16} />
              <span>Multi-Agent Routing</span>
            </button>

            <button
              type="button"
              className={`settings-tab-btn ${activeTab === 'database' ? 'active' : ''}`}
              onClick={() => setActiveTab('database')}
            >
              <Database size={16} />
              <span>Database & Data</span>
            </button>

            <button
              type="button"
              className={`settings-tab-btn ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              <User size={16} />
              <span>Account</span>
            </button>
          </nav>

          {/* Settings Tab Content */}
          <div className="settings-tab-content">
            {/* 1. GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="settings-pane">
                <h3 className="pane-title">General Preferences</h3>
                <p className="pane-sub">Customize the appearance and behavior of your analytics workspace.</p>

                {/* Theme Selector */}
                <div className="settings-section">
                  <label className="section-label">Theme</label>
                  <p className="section-help">Choose your workspace appearance (ChatGPT & Gemini style).</p>
                  <div className="theme-options-grid">
                    <button
                      type="button"
                      className={`theme-option-card ${theme === 'dark' ? 'active' : ''}`}
                      onClick={() => onSetTheme('dark')}
                    >
                      <Moon size={18} />
                      <div className="theme-text">
                        <span className="theme-name">Dark</span>
                        <span className="theme-desc">Obsidian & Slate</span>
                      </div>
                      {theme === 'dark' && <Check size={14} className="theme-check" />}
                    </button>

                    <button
                      type="button"
                      className={`theme-option-card ${theme === 'light' ? 'active' : ''}`}
                      onClick={() => onSetTheme('light')}
                    >
                      <Sun size={18} />
                      <div className="theme-text">
                        <span className="theme-name">Light</span>
                        <span className="theme-desc">Crisp & Clean</span>
                      </div>
                      {theme === 'light' && <Check size={14} className="theme-check" />}
                    </button>
                  </div>
                </div>

                {/* Visualization Preferences */}
                <div className="settings-section">
                  <div className="switch-row">
                    <div>
                      <span className="section-label">Auto-Render Data Visualizations</span>
                      <p className="section-help">Automatically generate and display charts when analytical results are returned.</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={autoVisualize}
                        onChange={handleToggleAutoViz}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>

                <div className="settings-section">
                  <label className="section-label">Preferred Visualization Type</label>
                  <p className="section-help">Default visual format for queries when multiple charts fit the data.</p>
                  <div className="chart-type-selector">
                    {['auto', 'bar', 'line', 'pie', 'table'].map(type => (
                      <button
                        key={type}
                        type="button"
                        className={`chart-type-btn ${defaultChartType === type ? 'active' : ''}`}
                        onClick={() => handleChangeChartType(type)}
                      >
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Local Cache */}
                <div className="settings-section danger-zone">
                  <label className="section-label danger">Conversation Cache</label>
                  <p className="section-help">Clear recent local conversation cache from this browser.</p>
                  <button
                    type="button"
                    className="btn-danger-outline"
                    onClick={() => {
                      if (window.confirm('Clear all local conversation history?')) {
                        onClearHistory();
                      }
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Clear Conversation Cache</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. MULTI-AGENT ROUTING TAB */}
            {activeTab === 'routing' && (
              <div className="settings-pane">
                <h3 className="pane-title">Multi-LLM Agent API Routing</h3>
                <p className="pane-sub">
                  Assign specialized LLM APIs (Groq, SambaNova, Ollama, OpenAI, Anthropic, Gemini) and model weights to each agent role in the consensus pipeline.
                </p>

                {/* Pipeline Flow Visualization */}
                <div className="routing-pipeline-summary">
                  <div className="pipeline-pill">
                    <span>1. Linker</span>
                    <strong>{routingSettings.providers.schema_linker}</strong>
                  </div>
                  <ArrowRight size={14} className="pipeline-arrow" />
                  <div className="pipeline-pill">
                    <span>2. Planner</span>
                    <strong>{routingSettings.providers.query_planner}</strong>
                  </div>
                  <ArrowRight size={14} className="pipeline-arrow" />
                  <div className="pipeline-pill">
                    <span>3. SQL Gen</span>
                    <strong>{routingSettings.providers.sql_generator}</strong>
                  </div>
                  <ArrowRight size={14} className="pipeline-arrow" />
                  <div className="pipeline-pill">
                    <span>4. Validator</span>
                    <strong>{routingSettings.providers.validator}</strong>
                  </div>
                </div>

                <div className="agent-routing-cards-list">
                  {AGENT_ROLES.map(({ key, name, role }) => (
                    <div key={key} className="agent-routing-card">
                      <div className="agent-routing-card-header">
                        <div>
                          <span className="agent-name">{name}</span>
                          <p className="agent-desc">{role}</p>
                        </div>
                      </div>

                      <div className="agent-routing-inputs-row">
                        <div className="input-group">
                          <label className="input-label">Provider</label>
                          <select
                            className="settings-select"
                            value={routingSettings.providers[key] || 'groq'}
                            onChange={(e) => onRoutingChange(key, 'providers', e.target.value)}
                          >
                            {availableProviders.map(p => (
                              <option key={p} value={p}>{p.toUpperCase()}</option>
                            ))}
                          </select>
                        </div>

                        <div className="input-group flex-1">
                          <label className="input-label">Model Identifier</label>
                          <input
                            type="text"
                            className="settings-text-input"
                            placeholder="e.g. gpt-4o, claude-3-5-sonnet, openai/gpt-oss-120b"
                            value={routingSettings.models[key] || ''}
                            onChange={(e) => onRoutingChange(key, 'models', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. DATABASE & DATASETS TAB */}
            {activeTab === 'database' && (
              <div className="settings-pane">
                <h3 className="pane-title">Active Database & Datasets</h3>
                <p className="pane-sub">
                  Inspect the connected relational database schema, upload custom CSVs/SQLite files, or reset to standard demo data.
                </p>

                {/* Database Connection Card */}
                <div className="db-connected-card">
                  <div className="db-connected-header">
                    <div className="db-connected-title">
                      <Database size={20} color="var(--brand-primary)" />
                      <div>
                        <h4>Connected Engine: {dbInfo?.dialect || 'SQLite'}</h4>
                        <p>{dbInfo?.tables?.length || 0} tables indexed and ready for analytical queries</p>
                      </div>
                    </div>
                    <span className="badge-online">Active</span>
                  </div>

                  {/* Tables List */}
                  {dbInfo?.tables && dbInfo.tables.length > 0 && (
                    <div className="db-tables-grid">
                      {dbInfo.tables.map(table => (
                        <div key={table} className="db-table-pill">
                          <FileSpreadsheet size={13} />
                          <span>{table}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upload & Reset Actions */}
                <div className="settings-section">
                  <label className="section-label">Dataset Management</label>
                  <p className="section-help">
                    You can upload your own datasets (CSV, SQLite database files) to query them immediately with multi-agent intelligence.
                  </p>

                  <div className="data-action-buttons">
                    <button
                      type="button"
                      className="btn-settings-action primary"
                      onClick={() => {
                        onClose();
                        onUploadClick();
                      }}
                    >
                      <Upload size={15} />
                      <span>Upload CSV or SQLite File</span>
                    </button>

                    <button
                      type="button"
                      className="btn-settings-action secondary"
                      onClick={onResetDb}
                    >
                      <RotateCcw size={15} />
                      <span>Reset to Default E-Commerce DB</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. ACCOUNT TAB */}
            {activeTab === 'account' && (
              <div className="settings-pane">
                <h3 className="pane-title">Account & Workspace</h3>
                <p className="pane-sub">Manage your analyst credentials and workspace profile.</p>

                {currentUser ? (
                  <div className="account-details-card">
                    <div className="account-avatar-large">
                      {currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <div className="account-info-block">
                      <h4 className="account-username">{currentUser.username}</h4>
                      <p className="account-email">{currentUser.email}</p>
                      <div className="account-badges">
                        <span className="role-chip">{currentUser.role || 'Senior Data Analyst'}</span>
                        <span className="status-chip">Enterprise Workspace</span>
                      </div>
                    </div>

                    <div className="account-actions">
                      <button
                        type="button"
                        className="btn-danger-outline"
                        onClick={onLogout}
                      >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="account-guest-card">
                    <User size={36} className="guest-icon" />
                    <h4>Guest Analyst Session</h4>
                    <p>
                      You are using the workspace in guest mode. Sign in or create a free account to save pinned queries, view your personal analytics dashboard, and track verification metrics.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                      <button
                        type="button"
                        className="btn-settings-action primary"
                        onClick={() => {
                          onClose();
                          onOpenAuth('signin');
                        }}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        className="btn-settings-action secondary"
                        onClick={() => {
                          onClose();
                          onOpenAuth('signup');
                        }}
                      >
                        Sign Up
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Settings Footer */}
        <div className="settings-dialog-footer">
          <button
            type="button"
            className="btn-settings-done"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
