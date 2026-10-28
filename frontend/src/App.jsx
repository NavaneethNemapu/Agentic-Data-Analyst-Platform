import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Database,
  Send,
  Bot,
  RotateCcw,
  Code2,
  Table as TableIcon,
  BarChart2,
  PieChart as PieIcon,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Loader2,
  Layers,
  ArrowRight,
  Settings,
  X,
  Cpu,
  Upload,
  Download,
  LayoutDashboard,
  LogOut
} from 'lucide-react';
import AuthModal from './components/AuthModal';
import UserDashboard from './components/UserDashboard';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';

const CHART_COLORS = [
  '#4F46E5', // Indigo
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#14B8A6'  // Teal
];

const AGENT_ROLES = [
  { key: 'schema_linker', name: 'Schema Linker', role: 'Filters tables & columns relevant to the question' },
  { key: 'query_planner', name: 'Query Planner', role: 'Deconstructs analytical question into SQL steps' },
  { key: 'sql_generator', name: 'SQL Generator', role: 'Generates dialect-accurate SQL queries' },
  { key: 'validator', name: 'Validator & Analyst', role: 'Verifies data and provides senior business insights' }
];

function App() {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState('');
  const [dbInfo, setDbInfo] = useState({ dialect: 'Database', tables: [], status: 'connecting' });
  const [copiedId, setCopiedId] = useState(null);
  const [viewModes, setViewModes] = useState({}); // messageId -> 'chart' | 'table'
  const [expandedSections, setExpandedSections] = useState({}); // `${msgId}_sql` or `${msgId}_reasoning`

  // Per-Agent Multi-API Routing State
  const [isRoutingModalOpen, setIsRoutingModalOpen] = useState(false);
  const [availableProviders, setAvailableProviders] = useState(['auto', 'groq', 'sambanova', 'ollama', 'openai', 'anthropic', 'gemini']);
  const [routingSettings, setRoutingSettings] = useState({
    providers: {
      schema_linker: 'groq',
      query_planner: 'groq',
      sql_generator: 'groq',
      validator: 'groq'
    },
    models: {
      schema_linker: 'openai/gpt-oss-20b',
      query_planner: 'openai/gpt-oss-20b',
      sql_generator: 'openai/gpt-oss-120b',
      validator: 'openai/gpt-oss-120b'
    }
  });

  const wsRef = useRef(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  // Authentication & View Management State
  const [activeView, setActiveView] = useState('workspace'); // 'workspace' | 'dashboard'
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('agentic_auth_token') || null);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('agentic_user_profile');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('signin');

  const handleLoginSuccess = (token, user) => {
    setAuthToken(token);
    setCurrentUser(user);
    localStorage.setItem('agentic_auth_token', token);
    localStorage.setItem('agentic_user_profile', JSON.stringify(user));
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('agentic_auth_token');
    localStorage.removeItem('agentic_user_profile');
    setActiveView('workspace');
  };

  useEffect(() => {
    if (authToken) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      .then(res => {
        if (!res.ok) throw new Error('Invalid token');
        return res.json();
      })
      .then(data => {
        if (data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('agentic_user_profile', JSON.stringify(data.user));
        }
      })
      .catch(() => {
        setAuthToken(null);
        setCurrentUser(null);
        localStorage.removeItem('agentic_auth_token');
        localStorage.removeItem('agentic_user_profile');
      });
    }
  }, [authToken]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      setUploadStatus('Uploading & parsing dataset...');
      const res = await fetch('/api/upload-dataset', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.db) setDbInfo(data.db);
      setUploadStatus(data.message || 'Dataset loaded successfully!');
      setTimeout(() => setUploadStatus(null), 5000);
      handleNewChat();
    } catch (err) {
      setUploadStatus('Upload failed: ' + err.message);
      setTimeout(() => setUploadStatus(null), 5000);
    }
  };

  const handleResetDb = async () => {
    try {
      setUploadStatus('Resetting database...');
      const res = await fetch('/api/reset-dataset', { method: 'POST' });
      const data = await res.json();
      if (data.db) setDbInfo(data.db);
      setUploadStatus('Restored default e-commerce database.');
      setTimeout(() => setUploadStatus(null), 4000);
      handleNewChat();
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch target DB info and active agent routing on mount
  useEffect(() => {
    fetch('/api/info')
      .then(res => res.json())
      .then(data => {
        if (data.db) setDbInfo(data.db);
        if (data.available_providers) setAvailableProviders(data.available_providers);
        if (data.providers && data.models) {
          setRoutingSettings({
            providers: { ...data.providers },
            models: { ...data.models }
          });
        }
      })
      .catch(() => {
        setDbInfo({ dialect: 'SQLite', tables: [], status: 'ready' });
      });
  }, []);

  // Auto-scroll to bottom as messages or progress change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentProgress, isLoading]);

  const toggleViewMode = (msgId, mode) => {
    setViewModes(prev => ({ ...prev, [msgId]: mode }));
  };

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadCSV = (data, filename = 'export.csv') => {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]);
    const csvRows = [
      keys.join(','),
      ...data.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNewChat = () => {
    setSession(null);
    setMessages([]);
    setInput('');
    setIsLoading(false);
    setCurrentProgress('');
    setViewModes({});
    setExpandedSections({});
    inputRef.current?.focus();
  };

  const handleRoutingChange = (role, field, value) => {
    setRoutingSettings(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [role]: value
      }
    }));
  };

  const executeQuery = (questionText) => {
    const q = questionText.trim();
    if (!q || isLoading) return;

    const userMsgId = 'user_' + Math.random().toString(36).slice(2, 11);
    setMessages(prev => [...prev, {
      id: userMsgId,
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    setInput('');
    setIsLoading(true);
    setCurrentProgress('Initiating multi-agent pipeline...');

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.host}/api/query/stream`;
    let receivedResult = false;

    // HTTP fallback if websocket connection drops
    const fallbackHttp = () => {
      if (receivedResult) return;
      receivedResult = true;
      setCurrentProgress('Connecting via HTTP endpoint...');

      fetch('/api/query/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          question: q,
          session_id: session,
          user_id: currentUser?.id,
          models: routingSettings.models,
          providers: routingSettings.providers
        })
      })
      .then(async res => {
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.detail || `HTTP error ${res.status}`);
        }
        return res.json();
      })
      .then(resultData => {
        handleCompletedResult(resultData);
      })
      .catch(err => {
        handleErrorResult(err.message);
      });
    };

    const handleCompletedResult = (resultData) => {
      receivedResult = true;
      if (!session && resultData.session_id) {
        setSession(resultData.session_id);
      }

      const asstMsgId = 'asst_' + Date.now();
      const isError = resultData.status === 'error';

      setMessages(prev => [...prev, {
        id: asstMsgId,
        role: 'assistant',
        content: resultData.explanation || (isError ? resultData.error : 'Query completed.'),
        sql: resultData.sql,
        result: resultData.result,
        chart_type: resultData.chart_type || 'table',
        confidence: resultData.confidence,
        memory_exemplars: resultData.memory_exemplars,
        plan: resultData.plan,
        steps: resultData.steps,
        models_used: resultData.models_used,
        providers_used: resultData.providers_used,
        isError,
        error: resultData.error,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);

      if (resultData.result && resultData.result.length > 0 && resultData.chart_type !== 'table') {
        setViewModes(prev => ({ ...prev, [asstMsgId]: 'chart' }));
      } else {
        setViewModes(prev => ({ ...prev, [asstMsgId]: 'table' }));
      }

      setIsLoading(false);
      setCurrentProgress('');
    };

    const handleErrorResult = (errText) => {
      receivedResult = true;
      const asstMsgId = 'asst_' + Date.now();
      setMessages(prev => [...prev, {
        id: asstMsgId,
        role: 'assistant',
        content: `Error executing query: ${errText}`,
        isError: true,
        error: errText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setIsLoading(false);
      setCurrentProgress('');
    };

    try {
      wsRef.current = new WebSocket(wsUrl);
    } catch {
      fallbackHttp();
      return;
    }

    wsRef.current.onopen = () => {
      wsRef.current.send(JSON.stringify({
        question: q,
        session_id: session,
        user_id: currentUser?.id,
        token: authToken,
        models: routingSettings.models,
        providers: routingSettings.providers
      }));
    };

    wsRef.current.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'progress') {
          setCurrentProgress(payload.data.message);
        } else if (payload.type === 'result') {
          handleCompletedResult(payload.data);
        } else if (payload.type === 'error') {
          handleErrorResult(payload.error);
        }
      } catch (err) {
        console.error("Failed to parse message:", err);
      }
    };

    wsRef.current.onerror = () => {
      if (!receivedResult) fallbackHttp();
    };

    wsRef.current.onclose = () => {
      if (!receivedResult) fallbackHttp();
    };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    executeQuery(input);
  };

  const getFollowUpSuggestions = (msg) => {
    if (msg.isError) {
      return ["Try rephrasing query", "Check available tables"];
    }
    return [
      "Why is this the leading category?",
      "Show breakdown by month",
      "Which products have the highest margins?",
      "Compare with overall total"
    ];
  };

  const getChartConfig = (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    const sample = data[0];
    const allKeys = Object.keys(sample);
    if (allKeys.length === 0) return null;

    // Identify numeric keys (columns where values can be parsed as valid numbers)
    const numericKeys = allKeys.filter(k => {
      return data.some(row => {
        const val = row[k];
        return val !== null && val !== undefined && val !== '' && !isNaN(Number(val)) && typeof val !== 'boolean';
      });
    });

    // Identify categorical / text keys
    const nonNumericKeys = allKeys.filter(k => !numericKeys.includes(k));

    // Choose Y-Key (numeric metric to plot as height/slice)
    const metricPreference = ['profit', 'spent', 'revenue', 'rev', 'total', 'amount', 'sales', 'cost', 'price', 'avg', 'count', 'val', 'qty', 'quantity'];
    let yKey = numericKeys.find(k => metricPreference.some(pref => k.toLowerCase().includes(pref)))
           || numericKeys.find(k => !k.toLowerCase().endsWith('_id') && k.toLowerCase() !== 'id')
           || numericKeys[0]
           || allKeys[allKeys.length - 1];

    // Choose X-Key (categorical label for X-axis)
    const labelPreference = ['name', 'category', 'country', 'status', 'title', 'date', 'month', 'year'];
    let xKey = nonNumericKeys.find(k => labelPreference.some(pref => k.toLowerCase().includes(pref)))
           || nonNumericKeys[0]
           || allKeys.find(k => k !== yKey)
           || allKeys[0];

    const hasFirstLast = allKeys.includes('first_name') && allKeys.includes('last_name');

    // Clean and transform rows so Recharts receives guaranteed numeric types
    const chartData = data.map((row, idx) => {
      const clean = { ...row };
      numericKeys.forEach(k => {
        clean[k] = Number(row[k]) || 0;
      });
      if (hasFirstLast) {
        clean['display_label'] = `${row.first_name || ''} ${row.last_name || ''}`.trim() || `Customer ${idx + 1}`;
      } else {
        clean['display_label'] = String(row[xKey] ?? `Item ${idx + 1}`);
      }
      return clean;
    });

    const activeXKey = hasFirstLast ? 'display_label' : xKey;
    const formattedLabel = (yKey || 'Value').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return {
      chartData,
      xKey: activeXKey,
      yKey,
      labelName: formattedLabel
    };
  };

  const renderInlineVisualization = (msg) => {
    const rawData = msg.result;
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return null;

    const currentMode = viewModes[msg.id] || (msg.chart_type === 'table' ? 'table' : 'chart');
    const allKeys = Object.keys(rawData[0]);
    if (allKeys.length === 0) return null;

    if (currentMode === 'table') {
      return (
        <div className="table-scroll-container">
          <table className="modern-data-table">
            <thead>
              <tr>
                {allKeys.map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>)}
              </tr>
            </thead>
            <tbody>
              {rawData.map((row, i) => (
                <tr key={i}>
                  {allKeys.map(k => (
                    <td key={k}>
                      {typeof row[k] === 'number' 
                        ? Number(row[k]).toLocaleString() 
                        : String(row[k] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    const config = getChartConfig(rawData);
    if (!config || !config.yKey) {
      // Fallback to table if no valid metric exists to chart
      return (
        <div className="table-scroll-container">
          <table className="modern-data-table">
            <thead>
              <tr>
                {allKeys.map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>)}
              </tr>
            </thead>
            <tbody>
              {rawData.map((row, i) => (
                <tr key={i}>
                  {allKeys.map(k => <td key={k}>{String(row[k] ?? '-')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    const { chartData, xKey, yKey, labelName } = config;
    const chartType = msg.chart_type || 'bar';

    if (chartType === 'pie') {
      return (
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={290}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={4}
                dataKey={yKey}
                nameKey={xKey}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(val) => [typeof val === 'number' ? val.toLocaleString() : val, labelName]}
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  borderRadius: '10px', 
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  fontSize: '12px'
                }} 
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartType === 'line') {
      return (
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={290}>
            <LineChart data={chartData} margin={{ top: 15, right: 20, left: 15, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey={xKey} stroke="#64748B" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis 
                stroke="#64748B" 
                tick={{ fontSize: 12 }} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => typeof val === 'number' ? (val >= 1000 ? `${(val/1000).toFixed(1)}k` : val) : val}
              />
              <Tooltip 
                formatter={(val) => [typeof val === 'number' ? val.toLocaleString() : val, labelName]}
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  borderRadius: '10px', 
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  fontSize: '12px'
                }} 
              />
              <Line 
                type="monotone" 
                dataKey={yKey} 
                stroke="#4F46E5" 
                strokeWidth={3} 
                dot={{ r: 5, fill: '#4F46E5', strokeWidth: 2, stroke: '#FFFFFF' }}
                activeDot={{ r: 7, fill: '#4338CA' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return (
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={290}>
          <BarChart data={chartData} margin={{ top: 15, right: 20, left: 15, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey={xKey} stroke="#64748B" tick={{ fontSize: 12 }} tickLine={false} />
            <YAxis 
              stroke="#64748B" 
              tick={{ fontSize: 12 }} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(val) => typeof val === 'number' ? (val >= 1000 ? `${(val/1000).toFixed(1)}k` : val) : val}
            />
            <Tooltip 
              formatter={(val) => [typeof val === 'number' ? val.toLocaleString() : val, labelName]}
              contentStyle={{ 
                backgroundColor: '#FFFFFF', 
                borderRadius: '10px', 
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: '12px'
              }} 
            />
            <Bar dataKey={yKey} fill="#4F46E5" radius={[6, 6, 0, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const starterPrompts = [
    {
      title: "Sales by Category",
      desc: "Total revenue aggregated across product lines",
      query: "Show total sales by category",
      icon: <BarChart2 size={18} color="#4F46E5" />
    },
    {
      title: "Top 5 Customers",
      desc: "Highest spending customers ranked by volume",
      query: "Who are the top 5 customers by spending?",
      icon: <TrendingUp size={18} color="#10B981" />
    },
    {
      title: "Product Profitability",
      desc: "Price vs unit cost margin analysis",
      query: "Which products have the highest profit margins?",
      icon: <PieIcon size={18} color="#F59E0B" />
    },
    {
      title: "Order Fulfillment",
      desc: "Order status distribution and counts",
      query: "Show count of orders grouped by status",
      icon: <Database size={18} color="#EC4899" />
    }
  ];

  return (
    <div className="app-container">
      {/* Top Bright Navigation Header */}
      <header className="top-nav">
        <div className="brand-section">
          <div className="brand-icon-wrapper">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="brand-title">Agentic Data Analyst</h1>
            <p className="brand-subtitle">Autonomous Multi-Agent Analytics</p>
          </div>
        </div>

        {/* View Switcher: Workspace vs My Dashboard */}
        <div className="nav-view-switcher">
          <button 
            type="button"
            className={`nav-view-btn ${activeView === 'workspace' ? 'active' : ''}`}
            onClick={() => setActiveView('workspace')}
          >
            <Sparkles size={14} />
            <span>Workspace</span>
          </button>
          <button 
            type="button"
            className={`nav-view-btn ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              if (!currentUser) {
                setAuthModalMode('signin');
                setIsAuthModalOpen(true);
              } else {
                setActiveView('dashboard');
              }
            }}
          >
            <LayoutDashboard size={14} />
            <span>My Dashboard</span>
          </button>
        </div>

        <div className="nav-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.sqlite,.db,.sqlite3"
            style={{ display: 'none' }}
          />

          <div className="status-badge" title="Active Target Database">
            <div className="status-dot" />
            <span>{dbInfo.dialect}</span>
            {dbInfo.tables?.length > 0 && (
              <span style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>
                ({dbInfo.tables.length} tables)
              </span>
            )}
          </div>

          <button 
            type="button" 
            className="model-pill" 
            onClick={() => fileInputRef.current?.click()}
            style={{ cursor: 'pointer', border: 'none' }}
            title="Upload custom CSV or SQLite database to query dynamically"
          >
            <Upload size={14} />
            <span>Upload Data</span>
          </button>

          <button 
            type="button" 
            className="model-pill" 
            onClick={() => setIsRoutingModalOpen(true)}
            style={{ cursor: 'pointer', border: 'none' }}
            title="Configure LLM APIs & Models for each Agent"
          >
            <Layers size={14} />
            <span>Multi-API Agents</span>
            <Settings size={12} style={{ marginLeft: '4px', opacity: 0.7 }} />
          </button>

          {activeView === 'workspace' && (
            <button 
              type="button" 
              className="btn-new-chat" 
              onClick={handleNewChat}
              title="Start a fresh conversation session"
            >
              <RotateCcw size={15} />
              <span>New Chat</span>
            </button>
          )}

          {/* User Authentication Status / Profile Chip */}
          {currentUser ? (
            <div className="user-profile-chip" title={`Signed in as ${currentUser.email}`}>
              <div className="user-avatar-badge">
                {currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'A'}
              </div>
              <span className="user-name-text">{currentUser.username}</span>
              <span className="user-role-tag">{currentUser.role || 'Analyst'}</span>
              <button className="btn-logout" onClick={handleLogout} title="Sign Out">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button"
                className="btn-auth-signin" 
                onClick={() => { setAuthModalMode('signin'); setIsAuthModalOpen(true); }}
              >
                Sign In
              </button>
              <button 
                type="button"
                className="btn-auth-signup" 
                onClick={() => { setAuthModalMode('signup'); setIsAuthModalOpen(true); }}
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      {uploadStatus && (
        <div style={{
          backgroundColor: 'var(--brand-primary)',
          color: '#ffffff',
          padding: '8px 16px',
          fontSize: '0.82rem',
          fontWeight: '500',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <Sparkles size={14} />
          <span>{uploadStatus}</span>
          <button 
            onClick={handleResetDb} 
            style={{
              marginLeft: '12px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            Reset to Default DB
          </button>
        </div>
      )}

      {/* Dynamic View Switch: Personal Analytics Dashboard vs Workspace */}
      {activeView === 'dashboard' && currentUser ? (
        <UserDashboard
          authToken={authToken}
          currentUser={currentUser}
          onOpenWorkspace={() => setActiveView('workspace')}
          onRunQuery={(q) => {
            setActiveView('workspace');
            executeQuery(q);
          }}
          onResumeSession={(sessId) => {
            setSession(sessId);
            setActiveView('workspace');
          }}
        />
      ) : (
        <>
          {/* Main Chat Stream Container */}
          <main className="chat-viewport">
        <div className="chat-column">
          {/* Welcome Screen when no messages */}
          {messages.length === 0 && (
            <div className="welcome-container">
              <div className="welcome-badge">
                <Sparkles size={14} />
                <span>Conversational Multi-API Analytics</span>
              </div>
              <h2 className="welcome-heading">
                Ask anything about your data.
              </h2>
              <p className="welcome-subheading">
                Route different agents to different LLM APIs (Groq, OpenAI, Anthropic, Gemini, Ollama). 
                Generate SQL, view instant charts, and ask follow-up questions to understand <em>why</em>.
              </p>

              <div className="quick-prompts-grid">
                {starterPrompts.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="quick-prompt-card"
                    onClick={() => executeQuery(item.query)}
                  >
                    <div className="quick-prompt-title">
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                    <p className="quick-prompt-desc">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation History */}
          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="message-row user">
                  <div className="user-bubble">
                    {msg.content}
                  </div>
                </div>
              );
            }

            const hasData = msg.result && Array.isArray(msg.result) && msg.result.length > 0;
            const currentMode = viewModes[msg.id] || (msg.chart_type === 'table' ? 'table' : 'chart');
            const isSqlExpanded = expandedSections[`${msg.id}_sql`];
            const isReasoningExpanded = expandedSections[`${msg.id}_reasoning`];

            return (
              <div key={msg.id} className="message-row assistant">
                <div className={`assistant-card ${msg.isError ? 'error' : ''}`}>
                  {/* Card Header */}
                  <div className="assistant-header">
                    <div className="assistant-identity">
                      <div className="assistant-avatar">
                        <Bot size={18} />
                      </div>
                      <span className="assistant-name">Senior Data Analyst</span>
                      <span className={`assistant-badge ${msg.isError ? 'error' : ''}`}>
                        {msg.isError ? 'Error' : 'Verified Insight'}
                      </span>
                      {msg.confidence && (
                        <span className="assistant-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }} title="Execution Confidence Score">
                          {Math.round(msg.confidence * 100)}% Confidence
                        </span>
                      )}
                      {msg.memory_exemplars && msg.memory_exemplars.length > 0 && (
                        <span className="assistant-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.3)' }} title="Recalled verified golden pattern from Analyst Experience Memory Bank">
                          🧠 Memory Match
                        </span>
                      )}
                    </div>

                    <div className="assistant-actions">
                      {hasData && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            className={`btn-pill-toggle ${currentMode === 'chart' ? 'active' : ''}`}
                            onClick={() => toggleViewMode(msg.id, 'chart')}
                            title="View Chart Visualization"
                          >
                            <BarChart2 size={13} />
                            <span>Chart</span>
                          </button>
                          <button
                            type="button"
                            className={`btn-pill-toggle ${currentMode === 'table' ? 'active' : ''}`}
                            onClick={() => toggleViewMode(msg.id, 'table')}
                            title="View Data Table"
                          >
                            <TableIcon size={13} />
                            <span>Table ({msg.result.length})</span>
                          </button>
                          <button
                            type="button"
                            className="btn-pill-toggle"
                            onClick={() => downloadCSV(msg.result, `query_result_${msg.id}.csv`)}
                            title="Export data as CSV file"
                          >
                            <Download size={13} />
                            <span>CSV</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Plain-English Explanation / Takeaways */}
                  <div className="assistant-explanation">
                    {msg.content}
                  </div>

                  {/* Inline Visualization */}
                  {hasData && (
                    <div className="chart-container-card">
                      <div className="chart-header">
                        <div className="chart-title">
                          <TrendingUp size={16} color="var(--brand-primary)" />
                          <span>Data Insights Visualization</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {msg.result.length} row{msg.result.length === 1 ? '' : 's'} returned
                        </span>
                      </div>
                      {renderInlineVisualization(msg)}
                    </div>
                  )}

                  {/* Collapsible SQL Query Box */}
                  {msg.sql && (
                    <div className="collapsible-wrapper">
                      <button
                        type="button"
                        className="collapsible-trigger"
                        onClick={() => toggleSection(`${msg.id}_sql`)}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Code2 size={15} color="var(--brand-primary)" />
                          Generated SQL Query ({dbInfo.dialect})
                        </span>
                        {isSqlExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>

                      {isSqlExpanded && (
                        <div className="sql-code-box">
                          <code className="sql-code-text">{msg.sql}</code>
                          <button
                            type="button"
                            className="btn-copy-code"
                            onClick={() => copyToClipboard(msg.sql, msg.id)}
                            title="Copy SQL to Clipboard"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check size={13} color="#34d399" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={13} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Collapsible Agent Workflow with Multi-API Routing Badges */}
                  {msg.plan && (
                    <div className="collapsible-wrapper">
                      <button
                        type="button"
                        className="collapsible-trigger"
                        onClick={() => toggleSection(`${msg.id}_reasoning`)}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Layers size={15} color="var(--brand-primary)" />
                          Agent Reasoning & API Routing ({msg.plan.length} step{msg.plan.length === 1 ? '' : 's'})
                        </span>
                        {isReasoningExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>

                      {isReasoningExpanded && (
                        <div className="reasoning-body">
                          {/* Agent Routing Badges */}
                          <div className="agent-routing-summary">
                            <div className="agent-route-tag">
                              <span>🔗 Linker:</span>
                              <strong>{msg.providers_used?.schema_linker || routingSettings.providers.schema_linker}</strong>
                            </div>
                            <div className="agent-route-tag">
                              <span>📝 Planner:</span>
                              <strong>{msg.providers_used?.query_planner || routingSettings.providers.query_planner}</strong>
                            </div>
                            <div className="agent-route-tag">
                              <span>⚡ SQL Gen:</span>
                              <strong>{msg.providers_used?.sql_generator || routingSettings.providers.sql_generator}</strong>
                            </div>
                            <div className="agent-route-tag">
                              <span>🛡️ Validator:</span>
                              <strong>{msg.providers_used?.validator || routingSettings.providers.validator}</strong>
                            </div>
                          </div>

                          {msg.plan.map((step, idx) => (
                            <div key={idx} className="reasoning-step-item">
                              <span className="step-num-badge">Step {idx + 1}</span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Conversational Follow-up Suggestions */}
                  {!msg.isError && (
                    <div className="followup-chips">
                      {getFollowUpSuggestions(msg).map((suggestion, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          className="followup-chip"
                          onClick={() => executeQuery(suggestion)}
                        >
                          <span>{suggestion}</span>
                          <ArrowRight size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Live Progress / Streaming Indicator */}
          {isLoading && (
            <div className="message-row assistant">
              <div className="thinking-card">
                <Loader2 size={20} className="thinking-spinner" />
                <div className="thinking-content">
                  <span className="thinking-title">Analyzing your data...</span>
                  <span className="thinking-step">{currentProgress || 'Processing query...'}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} style={{ height: '50px', flexShrink: 0 }} />
        </div>
      </main>

      {/* Floating Bottom Input Bar */}
      <div className="bottom-input-container">
        <div className="input-inner-wrapper">
          <form className="chat-input-box" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              className="chat-textarea"
              placeholder="Ask a question or follow up (e.g., 'Show total sales by category' or 'Why did that happen?')..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
            <button
              type="submit"
              className="btn-send"
              disabled={!input.trim() || isLoading}
              title="Send Query"
            >
              {isLoading ? <Loader2 size={18} className="thinking-spinner" /> : <Send size={18} />}
            </button>
          </form>

          <p className="input-footer-note">
            Multi-Agent AI Analyst • Supports specialized LLM APIs (Groq, OpenAI, Anthropic, Gemini, Ollama) per agent.
          </p>
        </div>
      </div>
        </>
      )}

      {/* Multi-API Agent Routing Configuration Modal */}
      {isRoutingModalOpen && (
        <div className="routing-modal-backdrop" onClick={() => setIsRoutingModalOpen(false)}>
          <div className="routing-modal" onClick={(e) => e.stopPropagation()}>
            <div className="routing-modal-header">
              <div className="routing-modal-title">
                <Cpu size={20} color="var(--brand-primary)" />
                <span>Multi-LLM Agent API Routing</span>
              </div>
              <button 
                type="button" 
                onClick={() => setIsRoutingModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="routing-modal-body">
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Assign different LLM APIs and specialized models to each agent role. The pipeline executes each step using its assigned provider.
              </p>

              {AGENT_ROLES.map(({ key, name, role }) => (
                <div key={key} className="agent-config-card">
                  <div className="agent-config-header">
                    <span className="agent-config-name">{name}</span>
                    <span className="agent-config-role">{role}</span>
                  </div>

                  <div className="agent-config-inputs">
                    <select
                      className="agent-select"
                      value={routingSettings.providers[key] || 'groq'}
                      onChange={(e) => handleRoutingChange(key, 'providers', e.target.value)}
                    >
                      {availableProviders.map(p => (
                        <option key={p} value={p}>{p.toUpperCase()}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      className="agent-input-model"
                      placeholder="Model name (e.g. gpt-4o, claude-3-5-sonnet, openai/gpt-oss-120b)"
                      value={routingSettings.models[key] || ''}
                      onChange={(e) => handleRoutingChange(key, 'models', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="routing-modal-footer">
              <button
                type="button"
                className="btn-pill-toggle active"
                onClick={() => setIsRoutingModalOpen(false)}
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}
              >
                Save & Apply Routing
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Authentication Dialog Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
        initialMode={authModalMode}
      />
    </div>
  );
}

export default App;
