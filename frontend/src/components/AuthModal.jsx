import React, { useState } from 'react';
import { X, Sparkles, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onSuccess, initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Data Analyst');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const payload = mode === 'signup'
      ? { username, email, password, role }
      : { username_or_email: username, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed. Please check your credentials.');
      }

      onSuccess(data.token, data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setIsLoading(true);
    // Attempt login as demo analyst; if not existing, sign up demo user
    try {
      let res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username_or_email: 'demo_analyst',
          password: 'Password123!'
        })
      });

      if (!res.ok) {
        // Create demo analyst
        res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'demo_analyst',
            email: 'demo_analyst@agentic-ai.io',
            password: 'Password123!',
            role: 'Lead Data Analyst'
          })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Demo login failed');
      }

      onSuccess(data.token, data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="auth-card-header">
          <div>
            <h3 className="auth-card-title">
              {mode === 'signup' ? 'Create Analyst Account' : 'Welcome Back'}
            </h3>
            <p className="auth-card-subtitle">
              {mode === 'signup'
                ? 'Sign up to access your personal analytics dashboard & saved queries'
                : 'Sign in to access your saved sessions and personal analytics metrics'}
            </p>
          </div>
          <button className="auth-close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="auth-tabs-bar">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => { setMode('signin'); setError(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(null); }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-card-body">
          {error && (
            <div className="auth-error-banner">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="auth-input-group">
            <label className="auth-label">Username {mode === 'signin' ? 'or Email' : ''}</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="auth-input"
                placeholder={mode === 'signup' ? 'e.g. alex_chen' : 'Enter your username or email'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          {mode === 'signup' && (
            <>
              <div className="auth-input-group">
                <label className="auth-label">Email Address</label>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="analyst@organization.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="auth-input-group">
                <label className="auth-label">Professional Role</label>
                <select
                  className="auth-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="Data Analyst">Data Analyst</option>
                  <option value="Lead Data Analyst">Lead Data Analyst</option>
                  <option value="Business Intelligence Engineer">Business Intelligence Engineer</option>
                  <option value="Executive Researcher">Executive Researcher</option>
                </select>
              </div>
            </>
          )}

          <div className="auth-input-group">
            <label className="auth-label">Password</label>
            <input
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="spinner" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>{mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <div className="auth-demo-divider">
            <span>or instant access</span>
          </div>

          <button
            type="button"
            className="auth-demo-btn"
            onClick={handleDemoLogin}
            disabled={isLoading}
          >
            <Sparkles size={15} />
            <span>Try as Demo Analyst (1-Click)</span>
          </button>
        </form>
      </div>
    </div>
  );
}
