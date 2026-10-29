import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Database,
  Bot,
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
  Settings as SettingsIcon,
  Upload,
  Download,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Sun,
  Moon,
  FileSpreadsheet,
  Paperclip
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import PromptBar from './components/PromptBar';
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

function App() {
  // Theme state: dark (default ChatGPT/Gemini obsidian) or light
  const [theme, setTheme] = useState(() => localStorage.getItem('agentic_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('agentic_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return localStorage.getItem('agentic_sidebar_open') !== 'false';
  });

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('agentic_sidebar_open', String(next));
      return next;
    });
  };

  // Sessions list for Left Sidebar
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState('');
  const [dbInfo, setDbInfo] = useState({ dialect: 'Database', tables: [], status: 'connecting' });
  const [copiedId, setCopiedId] = useState(null);
  const [viewModes, setViewModes] = useState({}); // messageId -> 'chart' | 'table'
  const [expandedSections, setExpandedSections] = useState({}); // `${msgId}_sql` or `${msgId}_reasoning`

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');

  // Per-Agent Multi-API Routing State
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

  // Load Sessions for Left Sidebar
  const fetchSessions = useCallback(async () => {
    try {
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const res = await fetch('/api/auth/sessions', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.sessions) {
          // Merge with any local sessions
          const localRaw = localStorage.getItem('agentic_local_sessions');
          const localList = localRaw ? JSON.parse(localRaw) : [];
          const combined = [...data.sessions];
          localList.forEach(ls => {
            if (!combined.some(s => s.id === ls.id)) {
              combined.push(ls);
            }
          });
          setSessions(combined);
          return;
        }
      }
    } catch (e) {
      console.warn("Could not fetch backend sessions, using local:", e);
    }

    // Fallback to local sessions
    try {
      const localRaw = localStorage.getItem('agentic_local_sessions');
      if (localRaw) {
        setSessions(JSON.parse(localRaw));
      }
    } catch {
      // ignore
    }
  }, [authToken]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleLoginSuccess = (token, user) => {
    setAuthToken(token);
    setCurrentUser(user);
    localStorage.setItem('agentic_auth_token', token);
    localStorage.setItem('agentic_user_profile', JSON.stringify(user));
    setIsAuthModalOpen(false);
    fetchSessions();
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('agentic_auth_token');
    localStorage.removeItem('agentic_user_profile');
    setActiveView('workspace');
    fetchSessions();
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

  // Upload Dataset Logic
  const uploadDatasetFile = async (file) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append('file', file);
    try {
      setUploadStatus(`Uploading & analyzing ${file.name}...`);
      const res = await fetch('/api/upload-dataset', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.db) setDbInfo(data.db);
      setUploadStatus(data.message || 'Dataset loaded successfully!');
      setTimeout(() => setUploadStatus(null), 5000);
      return data;
    } catch (err) {
      setUploadStatus('Upload failed: ' + err.message);
      setTimeout(() => setUploadStatus(null), 5000);
      throw err;
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
    setAttachedFile(null);
    setIsLoading(false);
    setCurrentProgress('');
    setViewModes({});
    setExpandedSections({});
    setActiveView('workspace');
    inputRef.current?.focus();
  };

  const handleSelectSession = async (sessionId) => {
    if (isLoading) return;
    setSession(sessionId);
    setActiveView('workspace');
    setIsLoading(true);
    setCurrentProgress('Loading conversation history...');

    try {
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const res = await fetch(`/api/auth/sessions/${sessionId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          setIsLoading(false);
          setCurrentProgress('');
          return;
        }
      }
    } catch (e) {
      console.warn("Could not load backend session details:", e);
    }

    // Try loading from localStorage session cache
    try {
      const cacheRaw = localStorage.getItem(`agentic_session_${sessionId}`);
      if (cacheRaw) {
        const cachedMsgs = JSON.parse(cacheRaw);
        setMessages(cachedMsgs);
      }
    } catch {
      // ignore
    }

    setIsLoading(false);
    setCurrentProgress('');
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Delete this conversation?')) return;
    try {
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers
      });
    } catch (e) {
      console.error(e);
    }

    // Update local state and storage
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    try {
      const localRaw = localStorage.getItem('agentic_local_sessions');
      if (localRaw) {
        const list = JSON.parse(localRaw).filter(s => s.id !== sessionId);
        localStorage.setItem('agentic_local_sessions', JSON.stringify(list));
      }
      localStorage.removeItem(`agentic_session_${sessionId}`);
    } catch {
      // ignore
    }

    if (session === sessionId) {
      handleNewChat();
    }
  };

  const handleRenameSession = async (sessionId, newTitle) => {
    try {
      await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ title: newTitle })
      });
    } catch (e) {
      console.error(e);
    }

    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
    try {
      const localRaw = localStorage.getItem('agentic_local_sessions');
      if (localRaw) {
        const list = JSON.parse(localRaw).map(s => s.id === sessionId ? { ...s, title: newTitle } : s);
        localStorage.setItem('agentic_local_sessions', JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  };

  const handleClearHistory = () => {
    localStorage.removeItem('agentic_local_sessions');
    setSessions([]);
    handleNewChat();
    setIsSettingsOpen(false);
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

  // Execute analytical pipeline for a question
  const executeQuery = (questionText, attachedFileName = null) => {
    const q = questionText.trim();
    if (!q || isLoading) return;

    const userMsgId = 'user_' + Math.random().toString(36).slice(2, 11);
    const newMsg = {
      id: userMsgId,
      role: 'user',
      content: q,
      attached_filename: attachedFileName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setIsLoading(true);
    setCurrentProgress('Initiating multi-agent consensus pipeline...');

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
      const targetSessionId = session || resultData.session_id;
      if (!session && resultData.session_id) {
        setSession(resultData.session_id);
      }

      // Add to sessions sidebar list
      const sessionTitle = q.length > 38 ? q.slice(0, 38) + '...' : q;
      setSessions(prev => {
        if (!prev.some(s => s.id === targetSessionId)) {
          const newSessionItem = {
            id: targetSessionId,
            title: sessionTitle,
            message_count: 2,
            updated_at: new Date().toISOString()
          };
          const updated = [newSessionItem, ...prev];
          try {
            localStorage.setItem('agentic_local_sessions', JSON.stringify(updated.slice(0, 40)));
          } catch {
            // ignore
          }
          return updated;
        }
        return prev;
      });

      const asstMsgId = 'asst_' + Date.now();
      const isError = resultData.status === 'error';

      const asstMsg = {
        id: asstMsgId,
        role: 'assistant',
        question: q,
        content: resultData.explanation || (isError ? resultData.error : 'Query completed.'),
        sql: resultData.sql,
        result: resultData.result,
        chart_type: resultData.chart_type || 'table',
        confidence: resultData.confidence,
        memory_exemplars: resultData.memory_exemplars,
        plan: resultData.plan,
        steps: resultData.steps,
        suggestions: resultData.suggestions,
        models_used: resultData.models_used,
        providers_used: resultData.providers_used,
        isError,
        error: resultData.error,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => {
        const nextMsgs = [...prev, asstMsg];
        try {
          if (targetSessionId) {
            localStorage.setItem(`agentic_session_${targetSessionId}`, JSON.stringify(nextMsgs));
          }
        } catch {
          // ignore
        }
        return nextMsgs;
      });

      // Automatically determine optimal view mode: only default to chart if multiple rows & numbers exist
      const hasNumbers = resultData.result && Array.isArray(resultData.result) && resultData.result.length >= 2 && resultData.chart_type !== 'table' && resultData.chart_type !== 'none';
      if (hasNumbers) {
        const cfg = getChartConfig(resultData.result);
        if (cfg && cfg.yKey) {
          setViewModes(prev => ({ ...prev, [asstMsgId]: 'chart' }));
        } else {
          setViewModes(prev => ({ ...prev, [asstMsgId]: 'table' }));
        }
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

  // Handle Prompt Submission (supports attached file + text)
  const handlePromptSubmit = async (e) => {
    e?.preventDefault();
    const q = input.trim();
    const file = attachedFile;

    if (!q && !file) return;

    if (file) {
      setIsLoading(true);
      setCurrentProgress(`Uploading and indexing ${file.name}...`);
      try {
        const uploadResult = await uploadDatasetFile(file);
        setAttachedFile(null);

        if (!q) {
          // User uploaded file without question: welcome them to the new dataset!
          const filename = file.name;
          const tableList = uploadResult?.db?.tables?.join(', ') || 'tables';
          const asstMsgId = 'asst_' + Date.now();
          setMessages(prev => [
            ...prev,
            {
              id: 'user_' + Date.now(),
              role: 'user',
              content: `Uploaded dataset: ${filename}`,
              attached_filename: filename,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            },
            {
              id: asstMsgId,
              role: 'assistant',
              content: `Dataset **${filename}** has been successfully uploaded and loaded into SQLite.\n\n` +
                       `**Active Tables:** ${tableList}\n\n` +
                       `You can now ask questions about this data, generate analytical queries, or request instant chart visualizations.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          setIsLoading(false);
          setCurrentProgress('');
          return;
        }

        // User typed a question along with the file
        executeQuery(q, file.name);
      } catch (err) {
        setIsLoading(false);
        setCurrentProgress('');
        setMessages(prev => [...prev, {
          id: 'asst_err_' + Date.now(),
          role: 'assistant',
          content: `Failed to upload dataset: ${err.message}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } else {
      executeQuery(q);
    }
  };

  const getFollowUpSuggestions = (msg, msgIdx) => {
    if (msg.isError) {
      return ["Try rephrasing query with specific columns", "Check available database tables"];
    }

    if (msg.suggestions && Array.isArray(msg.suggestions) && msg.suggestions.length > 0) {
      return msg.suggestions;
    }

    let questionText = msg.question || '';
    if (!questionText && msgIdx !== undefined && messages) {
      for (let i = msgIdx - 1; i >= 0; i--) {
        if (messages[i]?.role === 'user') {
          questionText = messages[i].content;
          break;
        }
      }
    }
    const q = (questionText || '').toLowerCase();
    const dataKeys = (msg.result && msg.result.length > 0) ? Object.keys(msg.result[0]).map(k => k.toLowerCase()) : [];
    const firstRow = (msg.result && msg.result.length > 0) ? msg.result[0] : null;

    if (q.includes('customer') || dataKeys.some(k => k.includes('customer') || k.includes('first_name') || k.includes('last_name'))) {
      return [
        "Which products do these customers buy most frequently?",
        "Break down their order volume by month",
        "Which countries do these customers come from?",
        "Compare their spending with overall store revenue"
      ];
    }

    if (q.includes('category') || dataKeys.some(k => k.includes('category'))) {
      const topCat = firstRow?.category ? `in ${firstRow.category}` : "in the leading category";
      return [
        `Which products drive the highest revenue ${topCat}?`,
        "Show monthly revenue trend for categories",
        "Which category has the highest average profit margin?",
        "Compare with overall total"
      ];
    }

    if (q.includes('profit') || q.includes('margin') || dataKeys.some(k => k.includes('margin') || k.includes('cost') || k.includes('profit'))) {
      return [
        "Which products have the lowest profit margins?",
        "Show total units sold for high-margin items",
        "Break down profit margin by product category",
        "Compare product cost vs selling price"
      ];
    }

    if (q.includes('month') || q.includes('trend') || q.includes('date') || q.includes('time') || dataKeys.some(k => k.includes('month') || k.includes('date'))) {
      return [
        "Which category experienced the highest growth during the peak month?",
        "What is the average order value per month?",
        "Show top 5 customers during the highest sales month",
        "Compare first half vs second half performance"
      ];
    }

    if (q.includes('product') || dataKeys.some(k => k.includes('product') || k.includes('item'))) {
      return [
        "What is the total profit generated by each product?",
        "Which category does each top product belong to?",
        "Show order count per product over time",
        "Compare product sales to overall store revenue"
      ];
    }

    if (q.includes('country') || dataKeys.some(k => k.includes('country'))) {
      return [
        "What is the average order value per country?",
        "Which product categories sell best in each country?",
        "Who are the top customers in each country?",
        "Compare country revenue against overall total"
      ];
    }

    return [
      "Break these results down by category",
      "Show trend over time by month",
      "Who are the top contributors?",
      "Compare with overall total"
    ];
  };

  const hasVisualizableData = (msg) => {
    if (!msg || !msg.result || !Array.isArray(msg.result) || msg.result.length === 0) return false;
    if (msg.chart_type === 'none') return false;

    // Single-row scalar check:
    if (msg.result.length === 1) {
      const keys = Object.keys(msg.result[0] || {});
      // If single column (e.g. scalar answer like {'capital': 'Paris'} or {'count': 100})
      if (keys.length <= 1) return false;
      // If multiple columns (e.g. detailed single profile record), only show if explicitly set to 'table'
      return msg.chart_type === 'table';
    }

    return true;
  };

  const canRenderChart = (msg) => {
    if (!msg || !msg.result || !Array.isArray(msg.result) || msg.result.length < 2) return false;
    if (msg.chart_type === 'none' || msg.chart_type === 'table') return false;
    const config = getChartConfig(msg.result);
    return config !== null && config.yKey !== null;
  };

  const getChartConfig = (data) => {
    if (!data || !Array.isArray(data) || data.length < 2) return null;
    const sample = data[0];
    if (!sample || typeof sample !== 'object') return null;
    const allKeys = Object.keys(sample);
    if (allKeys.length === 0) return null;

    // Identify numeric keys (columns where values can be parsed as valid numbers)
    const numericKeys = allKeys.filter(k => {
      return data.some(row => {
        const val = row[k];
        return val !== null && val !== undefined && val !== '' && !isNaN(Number(val)) && typeof val !== 'boolean';
      });
    });

    // CRITICAL: If there are NO numeric keys, a chart CANNOT be rendered!
    if (numericKeys.length === 0) return null;

    const nonNumericKeys = allKeys.filter(k => !numericKeys.includes(k));

    const metricPreference = ['profit', 'spent', 'revenue', 'rev', 'total', 'amount', 'sales', 'cost', 'price', 'avg', 'count', 'val', 'qty', 'quantity'];
    let yKey = numericKeys.find(k => metricPreference.some(pref => k.toLowerCase().includes(pref)))
           || numericKeys.find(k => !k.toLowerCase().endsWith('_id') && k.toLowerCase() !== 'id')
           || numericKeys[0];

    if (!yKey) return null;

    const labelPreference = ['name', 'category', 'country', 'status', 'title', 'date', 'month', 'year'];
    let xKey = nonNumericKeys.find(k => labelPreference.some(pref => k.toLowerCase().includes(pref)))
           || nonNumericKeys[0]
           || allKeys.find(k => k !== yKey)
           || 'item';

    const hasFirstLast = allKeys.includes('first_name') && allKeys.includes('last_name');

    const chartData = data.map((row, idx) => {
      const clean = { ...row };
      numericKeys.forEach(k => {
        clean[k] = Number(row[k]) || 0;
      });
      if (hasFirstLast) {
        clean['display_label'] = `${row.first_name || ''} ${row.last_name || ''}`.trim() || `Item ${idx + 1}`;
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
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke={theme === 'dark' ? '#1e1f20' : '#ffffff'} strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(val) => [typeof val === 'number' ? val.toLocaleString() : val, labelName]}
                contentStyle={{ 
                  backgroundColor: theme === 'dark' ? '#1e1f20' : '#ffffff', 
                  color: theme === 'dark' ? '#e3e3e3' : '#0f172a',
                  borderRadius: '10px', 
                  border: theme === 'dark' ? '1px solid #333537' : '1px solid #e2e8f0',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
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
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#2a2b2e' : '#f1f5f9'} vertical={false} />
              <XAxis dataKey={xKey} stroke="#94a3b8" tick={{ fill: theme === 'dark' ? '#c4c7c5' : '#64748b', fontSize: 12 }} tickLine={false} />
              <YAxis 
                stroke="#94a3b8" 
                tick={{ fill: theme === 'dark' ? '#c4c7c5' : '#64748b', fontSize: 12 }} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => typeof val === 'number' ? (val >= 1000 ? `${(val/1000).toFixed(1)}k` : val) : val}
              />
              <Tooltip 
                formatter={(val) => [typeof val === 'number' ? val.toLocaleString() : val, labelName]}
                contentStyle={{ 
                  backgroundColor: theme === 'dark' ? '#1e1f20' : '#ffffff', 
                  color: theme === 'dark' ? '#e3e3e3' : '#0f172a',
                  borderRadius: '10px', 
                  border: theme === 'dark' ? '1px solid #333537' : '1px solid #e2e8f0',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                  fontSize: '12px'
                }} 
              />
              <Line 
                type="monotone" 
                dataKey={yKey} 
                stroke="#4F46E5" 
                strokeWidth={3} 
                dot={{ r: 5, fill: '#4F46E5', strokeWidth: 2, stroke: '#FFFFFF' }}
                activeDot={{ r: 7, fill: '#4338CA', stroke: '#FFFFFF', strokeWidth: 2 }}
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
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#2a2b2e' : '#f1f5f9'} vertical={false} />
            <XAxis dataKey={xKey} stroke="#94a3b8" tick={{ fill: theme === 'dark' ? '#c4c7c5' : '#64748b', fontSize: 12 }} tickLine={false} />
            <YAxis 
              stroke="#94a3b8" 
              tick={{ fill: theme === 'dark' ? '#c4c7c5' : '#64748b', fontSize: 12 }} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(val) => typeof val === 'number' ? (val >= 1000 ? `${(val/1000).toFixed(1)}k` : val) : val}
            />
            <Tooltip 
              formatter={(val) => [typeof val === 'number' ? val.toLocaleString() : val, labelName]}
              contentStyle={{ 
                backgroundColor: theme === 'dark' ? '#1e1f20' : '#ffffff', 
                color: theme === 'dark' ? '#e3e3e3' : '#0f172a',
                borderRadius: '10px', 
                border: theme === 'dark' ? '1px solid #333537' : '1px solid #e2e8f0',
                boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
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
    <div className="app-layout-root">
      {/* Hidden File Input for header/modal upload actions */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            uploadDatasetFile(file);
          }
        }}
        accept=".csv,.sqlite,.db,.sqlite3"
        style={{ display: 'none' }}
      />

      {/* Left Collapsible Sidebar (ChatGPT & Gemini Style) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        sessions={sessions}
        activeSessionId={session}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onOpenSettings={(tab = 'general') => {
          setSettingsTab(tab);
          setIsSettingsOpen(true);
        }}
        onOpenDashboard={() => {
          if (!currentUser) {
            setAuthModalMode('signin');
            setIsAuthModalOpen(true);
          } else {
            setActiveView('dashboard');
          }
        }}
        activeView={activeView}
        dbInfo={dbInfo}
        currentUser={currentUser}
        onOpenAuth={(mode) => {
          setAuthModalMode(mode);
          setIsAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
        onUploadClick={() => fileInputRef.current?.click()}
      />

      {/* Main Content Area */}
      <div className="main-content-area">
        {/* Gemini / ChatGPT Top Navigation Bar */}
        <header className="top-bar-gemini">
          <div className="top-bar-left">
            <button
              type="button"
              className="btn-sidebar-toggle-header"
              onClick={toggleSidebar}
              title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <PanelLeft size={18} />
            </button>

            {/* Model Selector Pill (Gemini/ChatGPT Style) */}
            <button
              type="button"
              className="model-selector-pill"
              onClick={() => {
                setSettingsTab('routing');
                setIsSettingsOpen(true);
              }}
              title="Click to configure LLM providers & models for each agent"
            >
              <Sparkles size={15} className="model-sparkle" />
              <span>Agentic Analyst 2.0</span>
              <span style={{ fontSize: '0.72rem', opacity: 0.6, marginLeft: '2px' }}>• Multi-LLM</span>
              <ChevronDown size={14} style={{ opacity: 0.6 }} />
            </button>
          </div>

          <div className="top-bar-right">
            {/* View Switcher: Workspace vs My Dashboard */}
            <div className="nav-view-switcher">
              <button 
                type="button"
                className={`nav-view-btn ${activeView === 'workspace' ? 'active' : ''}`}
                onClick={() => setActiveView('workspace')}
              >
                <Sparkles size={13} />
                <span>Chat</span>
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
                <LayoutDashboard size={13} />
                <span>Dashboard</span>
              </button>
            </div>

            {/* Database indicator */}
            <div 
              className="status-badge" 
              onClick={() => {
                setSettingsTab('database');
                setIsSettingsOpen(true);
              }}
              style={{ cursor: 'pointer' }}
              title="Connected Database (Click to explore)"
            >
              <div className="status-dot" />
              <span>{dbInfo.dialect}</span>
              {dbInfo.tables?.length > 0 && (
                <span style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>
                  ({dbInfo.tables.length})
                </span>
              )}
            </div>

            {/* Quick Upload Button */}
            <button
              type="button"
              className="btn-icon-top"
              onClick={() => fileInputRef.current?.click()}
              title="Upload CSV or SQLite dataset"
            >
              <Upload size={16} />
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              className="btn-icon-top"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Settings Button */}
            <button
              type="button"
              className="btn-icon-top"
              onClick={() => {
                setSettingsTab('general');
                setIsSettingsOpen(true);
              }}
              title="Settings"
            >
              <SettingsIcon size={16} />
            </button>

            {/* User Profile / Auth buttons */}
            {currentUser ? (
              <div className="user-profile-chip" title={`Signed in as ${currentUser.email}`}>
                <div className="user-avatar-badge">
                  {currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'A'}
                </div>
                <span className="user-name-text">{currentUser.username}</span>
                <button className="btn-logout" onClick={handleLogout} title="Sign Out">
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '6px' }}>
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
            padding: '7px 16px',
            fontSize: '0.82rem',
            fontWeight: '500',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            zIndex: 30
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

        {/* View Switch: Personal Dashboard vs Workspace */}
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
              handleSelectSession(sessId);
            }}
          />
        ) : (
          <>
            {/* Main Chat Scroll Viewport */}
            <main 
              className="chat-viewport-gemini"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setAttachedFile(file);
                }
              }}
            >
              <div className="chat-column-gemini">
                {/* Gemini / ChatGPT Style Welcome Screen when empty */}
                {messages.length === 0 && (
                  <div className="gemini-welcome-box">
                    <h2 className="gemini-greeting-gradient">
                      Hello, {currentUser?.username || 'Analyst'}
                    </h2>
                    <h3 className="gemini-greeting-sub">
                      How can I help analyze your data today?
                    </h3>

                    <div className="gemini-dataset-pill">
                      <Database size={15} color="var(--brand-primary)" />
                      <span>Connected Engine: <strong>{dbInfo.dialect}</strong></span>
                      <span>•</span>
                      <span>{dbInfo.tables?.length || 0} tables indexed</span>
                    </div>

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

                    <div className={`gemini-dropzone-hint ${isDragOver ? 'active' : ''}`}>
                      <Paperclip size={18} />
                      <span>
                        Tip: Attach a CSV or SQLite file using the paperclip button on the prompt bar below, or drop files directly here to query custom datasets.
                      </span>
                    </div>
                  </div>
                )}

                {/* Conversation Message Stream */}
                {messages.map((msg, idx) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="message-row user">
                        <div className="user-msg-container">
                          {msg.attached_filename && (
                            <div className="user-attached-file-badge">
                              <FileSpreadsheet size={13} color="var(--brand-primary)" />
                              <span>{msg.attached_filename}</span>
                            </div>
                          )}
                          <div className="user-bubble">
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const showData = hasVisualizableData(msg);
                  const isChartable = canRenderChart(msg);
                  const currentMode = viewModes[msg.id] || (isChartable ? (msg.chart_type || 'chart') : 'table');
                  const isSqlExpanded = expandedSections[`${msg.id}_sql`];
                  const isReasoningExpanded = expandedSections[`${msg.id}_reasoning`];
                  const hasRealSql = msg.sql && msg.sql.trim().length > 0 && !msg.sql.trim().toLowerCase().startsWith("select '");

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
                            {showData && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {isChartable && (
                                  <button
                                    type="button"
                                    className={`btn-pill-toggle ${currentMode === 'chart' ? 'active' : ''}`}
                                    onClick={() => toggleViewMode(msg.id, 'chart')}
                                    title="View Chart Visualization"
                                  >
                                    <BarChart2 size={13} />
                                    <span>Chart</span>
                                  </button>
                                )}
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

                        {/* Plain-English Explanation / Insights */}
                        <div className="assistant-explanation">
                          {msg.content}
                        </div>

                        {/* Inline Visualization */}
                        {showData && (
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
                        {hasRealSql && (
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
                        {msg.plan && msg.plan.length > 0 && (
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

                                {msg.plan.map((step, sIdx) => (
                                  <div key={sIdx} className="reasoning-step-item">
                                    <span className="step-num-badge">Step {sIdx + 1}</span>
                                    <span>{step}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Follow-up Suggestion Chips */}
                        {!msg.isError && (
                          <div className="followup-chips">
                            {getFollowUpSuggestions(msg, idx).map((suggestion, sIdx) => (
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

            {/* ChatGPT / Gemini Style Prompt Bar with File Attachment */}
            <PromptBar
              input={input}
              setInput={setInput}
              attachedFile={attachedFile}
              setAttachedFile={setAttachedFile}
              isLoading={isLoading}
              onSubmit={handlePromptSubmit}
              inputRef={inputRef}
              isDragOver={isDragOver}
              setIsDragOver={setIsDragOver}
            />
          </>
        )}
      </div>

      {/* ChatGPT & Gemini Style Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsTab}
        theme={theme}
        onSetTheme={setTheme}
        routingSettings={routingSettings}
        onRoutingChange={handleRoutingChange}
        availableProviders={availableProviders}
        dbInfo={dbInfo}
        onUploadClick={() => fileInputRef.current?.click()}
        onResetDb={handleResetDb}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenAuth={(mode) => {
          setAuthModalMode(mode);
          setIsAuthModalOpen(true);
        }}
        onClearHistory={handleClearHistory}
      />

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
