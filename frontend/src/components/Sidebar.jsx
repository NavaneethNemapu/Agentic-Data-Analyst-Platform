import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Search,
  Settings,
  LayoutDashboard,
  Trash2,
  Edit2,
  Check,
  X,
  Database,
  Sun,
  Moon,
  LogOut,
  User,
  PanelLeftClose
} from 'lucide-react';

export default function Sidebar({
  isOpen,
  onToggle,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onOpenSettings,
  onOpenDashboard,
  activeView,
  dbInfo,
  currentUser,
  onOpenAuth,
  onLogout,
  theme,
  onToggleTheme
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const handleStartRename = (e, session) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title || 'Analysis Session');
  };

  const handleSaveRename = (e, id) => {
    e?.stopPropagation();
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    onDeleteSession(id);
  };

  // Group sessions by date
  const filteredSessions = sessions.filter(s =>
    (s.title || 'Analysis Session').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupSessionsByTime = (list) => {
    const today = [];
    const yesterday = [];
    const pastWeek = [];
    const older = [];

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    list.forEach(s => {
      const date = s.updated_at ? new Date(s.updated_at) : (s.created_at ? new Date(s.created_at) : new Date());
      const diffTime = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / oneDay);

      if (diffDays === 0) {
        today.push(s);
      } else if (diffDays === 1) {
        yesterday.push(s);
      } else if (diffDays < 7) {
        pastWeek.push(s);
      } else {
        older.push(s);
      }
    });

    return [
      { label: 'Today', items: today },
      { label: 'Yesterday', items: yesterday },
      { label: 'Previous 7 Days', items: pastWeek },
      { label: 'Older', items: older }
    ].filter(g => g.items.length > 0);
  };

  const grouped = groupSessionsByTime(filteredSessions);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="sidebar-backdrop-mobile"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside className={`chat-sidebar ${isOpen ? 'open' : 'closed'}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <button
            type="button"
            className="btn-new-chat-prominent"
            onClick={onNewChat}
            title="Start fresh conversation (New Chat)"
          >
            <Plus size={18} />
            <span>New chat</span>
          </button>

          <button
            type="button"
            className="btn-sidebar-toggle-top"
            onClick={onToggle}
            title={isOpen ? "Close sidebar" : "Open sidebar"}
            aria-label="Toggle sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* Search Input for Conversations */}
        <div className="sidebar-search-container">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="sidebar-search-input"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              type="button" 
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Recent Conversations List */}
        <div className="sidebar-conversations-scroll">
          {grouped.length === 0 ? (
            <div className="sidebar-empty-history">
              <MessageSquare size={22} className="empty-icon" />
              <p className="empty-title">
                {searchQuery ? 'No matching chats found' : 'No conversation history'}
              </p>
              <p className="empty-sub">
                {searchQuery ? 'Try a different search keyword' : 'Your saved chats and insights will appear here.'}
              </p>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.label} className="session-group">
                <div className="session-group-label">{group.label}</div>
                <div className="session-group-list">
                  {group.items.map(session => {
                    const isActive = activeSessionId === session.id && activeView === 'workspace';
                    const isEditing = editingId === session.id;

                    return (
                      <div
                        key={session.id}
                        className={`sidebar-session-item ${isActive ? 'active' : ''}`}
                        onClick={() => !isEditing && onSelectSession(session.id)}
                        title={session.title || 'Analysis Session'}
                      >
                        <MessageSquare size={15} className="session-icon" />

                        {isEditing ? (
                          <div className="session-inline-edit" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              className="session-edit-input"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(e, session.id);
                                if (e.key === 'Escape') handleCancelRename(e);
                              }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="session-action-btn check"
                              onClick={(e) => handleSaveRename(e, session.id)}
                              title="Save"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              className="session-action-btn cancel"
                              onClick={handleCancelRename}
                              title="Cancel"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="session-title-text">
                              {session.title || 'Analysis Session'}
                            </span>

                            <div className="session-actions-hover">
                              <button
                                type="button"
                                className="session-action-btn"
                                onClick={(e) => handleStartRename(e, session)}
                                title="Rename conversation"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                className="session-action-btn delete"
                                onClick={(e) => handleDelete(e, session.id)}
                                title="Delete conversation"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Database Status Pill */}
        <div className="sidebar-db-status" onClick={() => onOpenSettings('database')} title="Click to view Database Explorer">
          <div className="db-status-icon-wrapper">
            <Database size={15} />
          </div>
          <div className="db-status-info">
            <span className="db-name">{dbInfo?.dialect || 'Database'}</span>
            <span className="db-sub">
              {dbInfo?.tables?.length ? `${dbInfo.tables.length} tables active` : 'Ready to query'}
            </span>
          </div>
          <div className="db-online-dot" />
        </div>

        {/* Bottom Sidebar Navigation Items */}
        <div className="sidebar-footer">
          {/* Personal Analytics Dashboard */}
          <button
            type="button"
            className={`sidebar-nav-btn ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={onOpenDashboard}
          >
            <LayoutDashboard size={16} />
            <span>Personal Dashboard</span>
          </button>

          {/* Settings Trigger */}
          <button
            type="button"
            className="sidebar-nav-btn"
            onClick={() => onOpenSettings('general')}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>

          {/* Theme Toggle (Dark / Light) */}
          <button
            type="button"
            className="sidebar-nav-btn"
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>

          {/* User Profile / Auth Section */}
          <div className="sidebar-user-section">
            {currentUser ? (
              <div className="sidebar-user-row">
                <div className="sidebar-user-avatar">
                  {currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="sidebar-user-details" onClick={() => onOpenSettings('account')}>
                  <span className="sidebar-username">{currentUser.username}</span>
                  <span className="sidebar-userrole">{currentUser.role || 'Analyst'}</span>
                </div>
                <button
                  type="button"
                  className="sidebar-logout-btn"
                  onClick={onLogout}
                  title="Sign out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div className="sidebar-auth-buttons">
                <button
                  type="button"
                  className="btn-sidebar-auth"
                  onClick={() => onOpenAuth('signin')}
                >
                  <User size={14} />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  className="btn-sidebar-signup"
                  onClick={() => onOpenAuth('signup')}
                >
                  <span>Sign Up</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
