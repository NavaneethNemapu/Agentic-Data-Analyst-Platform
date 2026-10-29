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
  FileSpreadsheet,
  Server,
  Link2
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
  onConnectDbUrl,
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

  // Live database connection state
  const [dbConnectionUrl, setDbConnectionUrl] = useState('');
  const [isConnectingDb, setIsConnectingDb] = useState(false);
  const [dbConnectFeedback, setDbConnectFeedback] = useState(null);

  if (!isOpen) return null;

  const handleConnectLiveDb = async (e) => {
    e.preventDefault();
    if (!dbConnectionUrl.trim() || !onConnectDbUrl) return;
    setIsConnectingDb(true);
    setDbConnectFeedback(null);
    try {
      const result = await onConnectDbUrl(dbConnectionUrl.trim());
      if (result.success) {
        setDbConnectFeedback({ type: 'success', text: result.message });
      } else {
        setDbConnectFeedback({ type: 'error', text: result.message });
      }
    } catch (err) {
      setDbConnectFeedback({ type: 'error', text: err.message });
    } finally {
      setIsConnectingDb(false);
    }
  };

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

                {/* Method 1: Upload File-Based Dataset */}
                <div className="settings-section">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Upload size={15} color="var(--brand-primary)" />
                      <span>Option A: Upload File Dataset</span>
                    </label>
                    <span style={{ fontSize: '11px', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                      CSV &bull; SQLite (.db / .sqlite)
                    </span>
                  </div>
                  <p className="section-help">
                    Drag and drop or select flat database files from your computer to analyze immediately.
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

                {/* Method 2: Connect Live Database Server */}
                <div className="settings-section">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Server size={15} color="var(--brand-primary)" />
                      <span>Option B: Connect Live Database Server</span>
                    </label>
                    <span style={{ fontSize: '11px', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                      PostgreSQL &bull; MySQL &bull; SQLite
                    </span>
                  </div>
                  <p className="section-help">
                    Connect directly to any live server or cloud database dynamically. No code modifications or <code>.env</code> file edits required!
                  </p>

                  <form onSubmit={handleConnectLiveDb} className="db-connect-form">
                    <div className="input-group">
                      <label className="input-label">Connection URL</label>
                      <input
                        type="text"
                        className="settings-text-input"
                        placeholder="e.g. postgresql://user:password@localhost:5432/my_analytics_db"
                        value={dbConnectionUrl}
                        onChange={(e) => setDbConnectionUrl(e.target.value)}
                      />
                    </div>

                    {/* Quick fill pills */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Templates:</span>
                      <button
                        type="button"
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                        onClick={() => setDbConnectionUrl('postgresql://postgres:password@localhost:5432/analytics_db')}
                      >
                        PostgreSQL
                      </button>
                      <button
                        type="button"
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                        onClick={() => setDbConnectionUrl('mysql+pymysql://root:password@localhost:3306/analytics_db')}
                      >
                        MySQL
                      </button>
                      <button
                        type="button"
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                        onClick={() => setDbConnectionUrl('sqlite:///./data/target.db')}
                      >
                        SQLite (Local)
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
                      <button
                        type="submit"
                        className="btn-settings-action primary"
                        disabled={isConnectingDb || !dbConnectionUrl.trim()}
                      >
                        <Link2 size={14} />
                        <span>{isConnectingDb ? 'Testing Connection...' : 'Connect & Switch Engine'}</span>
                      </button>
                    </div>

                    {dbConnectFeedback && (
                      <div className={`db-connect-feedback ${dbConnectFeedback.type}`} style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        backgroundColor: dbConnectFeedback.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: dbConnectFeedback.type === 'success' ? '#22c55e' : '#ef4444',
                        border: `1px solid ${dbConnectFeedback.type === 'success' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                      }}>
                        {dbConnectFeedback.text}
                      </div>
                    )}
                  </form>
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
