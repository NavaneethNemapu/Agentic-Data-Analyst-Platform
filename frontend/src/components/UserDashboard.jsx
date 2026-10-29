import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  BarChart2,
  ShieldCheck,
  Activity,
  Bookmark,
  Star,
  Clock,
  ArrowRight,
  Database,
  RotateCcw,
  Search,
  ExternalLink,
  Trash2,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const CHART_PALETTE = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];

export default function UserDashboard({ authToken, currentUser, onOpenWorkspace, onRunQuery, onResumeSession }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  const fetchDashboard = useCallback(async () => {
    if (!authToken) {
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/auth/dashboard', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to load user dashboard data.');
      }
      const data = await res.json();
      setDashboardData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleTogglePin = async (queryId) => {
    try {
      const res = await fetch(`/api/auth/queries/${queryId}/pin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        // Refresh dashboard data locally
        fetchDashboard();
      }
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this analytical session?')) return;
    try {
      const res = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        fetchDashboard();
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  if (isLoading && !dashboardData) {
    return (
      <div className="dashboard-viewport" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Loading your personal analytics dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="dashboard-viewport" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <AlertTriangle size={36} color="var(--error)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: 6 }}>Dashboard Connection Issue</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>{error}</p>
          <button className="auth-submit-btn" onClick={fetchDashboard}>
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const { metrics, table_distribution, chart_distribution, recent_queries, pinned_insights, recent_sessions, user } = dashboardData;

  const filteredQueries = recent_queries.filter(q =>
    q.question.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (q.sql && q.sql.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="dashboard-viewport">
      <div className="dashboard-content">
        {/* Hero Banner */}
        <div className="dashboard-hero">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 className="dashboard-hero-title">
                Welcome back, {user?.username || currentUser?.username || 'Analyst'}
              </h2>
              <span className="user-role-tag">
                {user?.role || currentUser?.role || 'Data Analyst'}
              </span>
            </div>
            <p className="dashboard-hero-subtitle">
              Your autonomous multi-agent analytics command center, verification metrics, and saved insights.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn-auth-signin"
              onClick={fetchDashboard}
              title="Refresh Analytics Metrics"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RotateCcw size={14} />
              <span>Refresh</span>
            </button>
            <button
              className="dashboard-hero-btn"
              onClick={onOpenWorkspace}
            >
              <Sparkles size={16} />
              <span>Launch New Analysis</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Metric Cards */}
        <div className="dashboard-kpi-grid">
          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-label">Total Queries</span>
              <div className="kpi-icon-wrapper" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                <Activity size={18} />
              </div>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value">{metrics.total_queries}</span>
              <span className="kpi-badge" style={{ background: '#ECFDF5', color: '#10B981' }}>
                Pipeline Active
              </span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-label">Agent Verification</span>
              <div className="kpi-icon-wrapper" style={{ background: '#ECFDF5', color: '#10B981' }}>
                <ShieldCheck size={18} />
              </div>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value">{metrics.verified_rate}%</span>
              <span className="kpi-badge" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                Validator Approved
              </span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-label">Avg Confidence</span>
              <div className="kpi-icon-wrapper" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                <Sparkles size={18} />
              </div>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value">{(metrics.avg_confidence * 100).toFixed(0)}%</span>
              <span className="kpi-badge" style={{ background: '#FFFBEB', color: '#B45309' }}>
                High Precision
              </span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-label">Pinned Insights</span>
              <div className="kpi-icon-wrapper" style={{ background: '#FDF2F8', color: '#EC4899' }}>
                <Bookmark size={18} />
              </div>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value">{metrics.pinned_count}</span>
              <span className="kpi-badge" style={{ background: '#FDF2F8', color: '#BE185D' }}>
                Saved Charts
              </span>
            </div>
          </div>
        </div>

        {/* Visual Charts: Domain Distribution & Visualizations */}
        <div className="dashboard-two-col">
          <div className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">
                  <Database size={17} color="#4F46E5" />
                  Database Tables Queried
                </h3>
                <p className="panel-subtitle">Frequency of target schema tables referenced by agents</p>
              </div>
            </div>

            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={table_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="table" stroke="#64748B" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis stroke="#64748B" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]}>
                    {table_distribution.map((_, index) => (
                      <Cell key={`tbl-cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">
                  <BarChart2 size={17} color="#06B6D4" />
                  Chart Outputs
                </h3>
                <p className="panel-subtitle">Distribution of visualization formats rendered</p>
              </div>
            </div>

            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chart_distribution}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                  >
                    {chart_distribution.map((_, index) => (
                      <Cell key={`chart-cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px'
                    }}
                  />
                  <Legend verticalAlign="bottom" height={30} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Pinned Insights Gallery */}
        {pinned_insights.length > 0 && (
          <div className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">
                  <Star size={17} color="#F59E0B" fill="#F59E0B" />
                  Pinned Key Insights
                </h3>
                <p className="panel-subtitle">Highlighted analytical discoveries saved to your dashboard</p>
              </div>
            </div>

            <div className="pinned-insights-grid">
              {pinned_insights.map((item) => (
                <div key={item.id} className="pinned-card">
                  <div className="pinned-card-top">
                    <span className="pinned-question">{item.question}</span>
                    <button
                      className="btn-pin-toggle pinned"
                      onClick={() => handleTogglePin(item.id)}
                      title="Unpin Insight"
                    >
                      <Star size={16} fill="#F59E0B" color="#F59E0B" />
                    </button>
                  </div>

                  <div className="pinned-sql-preview" title={item.sql}>
                    {item.sql}
                  </div>

                  <div className="pinned-card-footer">
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className="kpi-badge" style={{ background: '#EEF2FF', color: '#4F46E5', textTransform: 'uppercase' }}>
                        {item.chart_type} Chart
                      </span>
                      <span className="kpi-badge" style={{ background: '#ECFDF5', color: '#10B981' }}>
                        {(item.confidence * 100).toFixed(0)}% Conf
                      </span>
                    </div>

                    <button
                      className="btn-open-workspace"
                      onClick={() => onRunQuery(item.question)}
                      title="Re-run this query in active analytical chat"
                    >
                      <span>Run Analysis</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Analytical Query History Table */}
        <div className="dashboard-panel">
          <div className="panel-header" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 className="panel-title">
                <Clock size={17} color="#4F46E5" />
                Analytical Query History
              </h3>
              <p className="panel-subtitle">Comprehensive log of multi-agent executed queries and verification statuses</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-light)' }} />
                <input
                  type="text"
                  placeholder="Filter queries..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="auth-input"
                  style={{ paddingLeft: 30, paddingBottom: 6, paddingTop: 6, fontSize: '0.8rem', width: 200 }}
                />
              </div>
            </div>
          </div>

          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Pin</th>
                  <th>Analytical Question</th>
                  <th>Generated SQL</th>
                  <th>Format</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueries.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No analytical queries found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredQueries.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <button
                          className={`btn-pin-toggle ${q.is_pinned ? 'pinned' : ''}`}
                          onClick={() => handleTogglePin(q.id)}
                          title={q.is_pinned ? 'Unpin query' : 'Pin to dashboard'}
                        >
                          <Star size={15} fill={q.is_pinned ? '#F59E0B' : 'none'} />
                        </button>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {q.question}
                      </td>
                      <td>
                        <div className="table-sql-snippet" title={q.sql}>
                          {q.sql}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                          {q.chart_type}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--brand-primary)', fontSize: '0.75rem' }}>
                          {(q.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td>
                        {q.status === 'success' ? (
                          <span className="badge-status-verified">
                            <CheckCircle2 size={12} />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="badge-status-failed">
                            <AlertTriangle size={12} />
                            <span>Error</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn-open-workspace"
                          onClick={() => onRunQuery(q.question)}
                          title="Open query in Workspace"
                        >
                          <span>Open</span>
                          <ExternalLink size={11} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Analytical Chat Sessions */}
        {recent_sessions && recent_sessions.length > 0 && (
          <div className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">
                  <MessageSquare size={17} color="#4F46E5" />
                  Analytical Sessions
                </h3>
                <p className="panel-subtitle">Resume previous chat conversations or clean up workspace sessions</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {recent_sessions.map((sess) => (
                <div
                  key={sess.id}
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {sess.title}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {sess.message_count} messages logged
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      className="btn-open-workspace"
                      onClick={() => onResumeSession(sess.id)}
                    >
                      <span>Resume Session</span>
                      <ArrowRight size={12} />
                    </button>

                    <button
                      onClick={() => handleDeleteSession(sess.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: 4 }}
                      title="Delete Session"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
