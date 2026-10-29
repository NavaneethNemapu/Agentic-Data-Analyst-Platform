import React, { useRef, useEffect } from 'react';
import {
  Paperclip,
  X,
  FileSpreadsheet,
  Database,
  FileText,
  Loader2,
  ArrowUp
} from 'lucide-react';

export default function PromptBar({
  input,
  setInput,
  attachedFile,
  setAttachedFile,
  isLoading,
  onSubmit,
  inputRef,
  isDragOver,
  setIsDragOver
}) {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync ref with parent if provided
  useEffect(() => {
    if (inputRef) {
      inputRef.current = textareaRef.current;
    }
  }, [inputRef]);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px';
    }
  }, [input]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
    // reset input so the same file can be chosen again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((input.trim() || attachedFile) && !isLoading) {
        onSubmit(e);
      }
    }
  };

  const getFileIcon = (filename = '') => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.csv')) {
      return <FileSpreadsheet size={16} className="file-chip-icon csv" />;
    }
    if (lower.endsWith('.sqlite') || lower.endsWith('.db') || lower.endsWith('.sqlite3')) {
      return <Database size={16} className="file-chip-icon db" />;
    }
    return <FileText size={16} className="file-chip-icon" />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canSubmit = (input.trim().length > 0 || attachedFile !== null) && !isLoading;

  return (
    <div 
      className={`gemini-prompt-wrapper ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver?.(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOver?.(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver?.(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
          setAttachedFile(file);
        }
      }}
    >
      <div className="prompt-container-pill">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".csv,.sqlite,.db,.sqlite3"
          style={{ display: 'none' }}
        />

        {/* Attached File Preview Chip */}
        {attachedFile && (
          <div className="attached-file-preview-strip">
            <div className="attached-file-badge">
              {getFileIcon(attachedFile.name)}
              <div className="attached-file-info">
                <span className="file-name" title={attachedFile.name}>
                  {attachedFile.name}
                </span>
                <span className="file-size">
                  {formatFileSize(attachedFile.size)} • Ready to upload & query
                </span>
              </div>
              <button
                type="button"
                className="btn-remove-attachment"
                onClick={() => setAttachedFile(null)}
                title="Remove attachment"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Prompt Input Row */}
        <form className="prompt-input-row" onSubmit={onSubmit}>
          {/* File Attachment Button */}
          <button
            type="button"
            className={`btn-attach-file ${attachedFile ? 'has-file' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            title={attachedFile ? `Attached: ${attachedFile.name} (Click to change)` : "Attach CSV or SQLite dataset"}
            disabled={isLoading}
          >
            <Paperclip size={18} />
          </button>

          {/* Growing Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            className="prompt-textarea"
            placeholder={
              attachedFile
                ? `Ask about ${attachedFile.name} (or leave blank to load & explore)...`
                : "Ask anything about your data... (e.g. 'Show total sales by category')"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            autoFocus
          />

          {/* Send / Execute Button */}
          <button
            type="submit"
            className={`btn-send-circular ${canSubmit ? 'active' : ''}`}
            disabled={!canSubmit}
            title={isLoading ? "Processing analytical query..." : "Send query (Enter)"}
          >
            {isLoading ? (
              <Loader2 size={18} className="thinking-spinner" />
            ) : (
              <ArrowUp size={18} />
            )}
          </button>
        </form>
      </div>

      <p className="prompt-disclaimer">
        Agentic AI Data Analyst • Multi-agent verified consensus engine. Verify critical business numbers.
      </p>
    </div>
  );
}
