import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Check,
  CheckCircle2,
  Clock,
  GitBranch,
  Copy,
  Trash2,
  RotateCcw,
  FileCode2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Task } from '../types';
import { openInAntigravity } from '../api';

interface TaskCardProps {
  task: Task;
  isNew?: boolean;
  isFocused?: boolean;
  defaultExpanded?: boolean;
  onMarkReviewed: (id: string) => void;
  onUnmarkReviewed: (id: string) => void;
  onDelete: (id: string) => void;
  onNotify?: (msg: string) => void;
}

// Deterministic pleasing color theme based on project string
function getProjectColor(project: string) {
  let hash = 0;
  for (let i = 0; i < project.length; i++) {
    hash = project.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [190, 160, 260, 32, 280, 340, 210];
  const hue = hues[Math.abs(hash) % hues.length];
  return {
    bg: `hsla(${hue}, 85%, 55%, 0.12)`,
    border: `hsla(${hue}, 85%, 55%, 0.28)`,
    text: `hsl(${hue}, 85%, 65%)`,
  };
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  return `${diffDays}d ago`;
}

/**
 * Extracts a concise 1-2 sentence short summary from markdown details
 */
export function getShortSummary(details?: string | null): string {
  if (!details || !details.trim()) return '';

  const lines = details
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const cleanLines: string[] = [];
  for (const line of lines) {
    if (
      line.startsWith('```') ||
      line.startsWith('---') ||
      line.startsWith('===') ||
      line.startsWith('***')
    ) {
      continue;
    }
    // Remove markdown headers, list markers, blockquotes, bold/italic, code, links
    const cleaned = line
      .replace(/^(#{1,6}\s*|[*\-+]\s*|\d+\.\s*|>\s*)/, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    // Skip redundant generic headers like "Summary:", "Overview:", etc.
    if (
      /^(summary|overview|changes|details|notes|description|verification|steps)(\s*of\s*changes)?:?$/i.test(
        cleaned
      )
    ) {
      continue;
    }

    if (cleaned.length > 0) {
      cleanLines.push(cleaned);
    }
  }

  if (cleanLines.length === 0) {
    return details.replace(/[#*`_~>[\]]/g, '').slice(0, 140).trim();
  }

  let result = cleanLines[0];
  if (result.length < 50 && cleanLines.length > 1) {
    result = `${result} — ${cleanLines[1]}`;
  }

  if (result.length > 190) {
    result = result.slice(0, 187).trim() + '...';
  }

  return result;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isNew,
  isFocused,
  defaultExpanded = false,
  onMarkReviewed,
  onUnmarkReviewed,
  onDelete,
  onNotify,
}) => {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isOpening, setIsOpening] = useState<boolean>(false);
  const isReviewed = task.status === 'reviewed';
  const projectColors = getProjectColor(task.project);

  useEffect(() => {
    if (defaultExpanded !== undefined) {
      setIsExpanded(defaultExpanded);
    }
  }, [defaultExpanded]);

  useEffect(() => {
    if (isFocused) {
      setIsExpanded(true);
    }
  }, [isFocused]);

  const handleCopyFile = (file: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(file);
    setCopiedFile(file);
    setTimeout(() => {
      setCopiedFile(null);
    }, 1500);
  };

  const handleGoToAntigravity = async (e: React.MouseEvent, specificFile?: string) => {
    e.stopPropagation();
    try {
      setIsOpening(true);
      const res = await openInAntigravity(task.project, specificFile);
      if (res.success) {
        onNotify?.(res.message || `Switched to Antigravity: [${task.project}]`);
      } else {
        onNotify?.(`Antigravity: ${res.error || 'Failed to switch workspace'}`);
      }
    } catch (err: any) {
      onNotify?.(`Failed to open Antigravity: ${err.message}`);
    } finally {
      setIsOpening(false);
    }
  };

  const shortSummary = getShortSummary(task.details);
  const hasDetails = Boolean(task.details && task.details.trim());
  const hasFiles = Boolean(task.files && task.files.length > 0);

  return (
    <div
      id={`task-card-${task.id}`}
      className={`task-card ${isReviewed ? 'reviewed' : ''} ${isNew ? 'new-arrival' : ''} ${isFocused ? 'toast-focused' : ''} ${isExpanded ? 'expanded' : 'compact'}`}
    >
      <div className="task-header">
        <div className="task-header-left">
          <div className="task-meta">
            <span
              className="project-tag"
              style={{
                backgroundColor: projectColors.bg,
                borderColor: projectColors.border,
                color: projectColors.text,
              }}
            >
              {task.project}
            </span>

            {task.branch && (
              <span className="branch-tag" title="Git Branch">
                <GitBranch size={12} />
                <span>{task.branch}</span>
              </span>
            )}

            <span className="time-tag" title={new Date(task.created_at).toLocaleString()}>
              <Clock size={12} />
              <span>{formatRelativeTime(task.created_at)}</span>
            </span>

            {isReviewed && task.reviewed_at && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--accent-emerald)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={13} />
                <span>Verified</span>
              </span>
            )}
          </div>

          <h2 className="task-title">{task.title}</h2>
        </div>

        <div className="task-actions">
          <button
            className={`btn btn-antigravity ${isOpening ? 'loading' : ''}`}
            onClick={(e) => handleGoToAntigravity(e)}
            title={`Switch to Antigravity workspace for [${task.project}]`}
          >
            <Sparkles size={14} className="antigravity-icon" />
            <span>Go to Antigravity</span>
          </button>

          {!isReviewed ? (
            <button
              className="btn btn-review"
              onClick={() => onMarkReviewed(task.id)}
              title="Mark this task as verified and done"
            >
              <Check size={16} strokeWidth={2.5} />
              <span>Verify & Done</span>
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={() => onUnmarkReviewed(task.id)}
              title="Move back to pending list"
              style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem' }}
            >
              <RotateCcw size={14} />
              <span>Reopen</span>
            </button>
          )}

          <button
            className="btn-icon"
            onClick={() => onDelete(task.id)}
            title="Delete task record"
            aria-label="Delete task"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Initial / Compact mode: Show only the short summary */}
      {!isExpanded && (hasDetails || hasFiles) && (
        <div
          className="task-summary-row"
          onClick={() => setIsExpanded(true)}
          title="Click to expand details and files"
        >
          {shortSummary ? (
            <p className="task-short-summary">{shortSummary}</p>
          ) : (
            <div className="files-compact-inline">
              <FileCode2 size={12} />
              <span>{task.files.length} file{task.files.length === 1 ? '' : 's'} modified:</span>
              <span className="files-preview-names">
                {task.files.slice(0, 3).join(', ')}{task.files.length > 3 ? ` +${task.files.length - 3} more` : ''}
              </span>
            </div>
          )}

          <div className="task-summary-actions" onClick={(e) => e.stopPropagation()}>
            {hasFiles && hasDetails && (
              <span className="files-compact-count" title={`${task.files.length} modified files`}>
                <FileCode2 size={12} />
                <span>{task.files.length} file{task.files.length === 1 ? '' : 's'}</span>
              </span>
            )}
            <button
              className="btn-toggle-expand"
              onClick={() => setIsExpanded(true)}
              title="Expand full details and files"
            >
              <span>Details</span>
              <ChevronDown size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <div className="task-expanded-content">
          {hasDetails && (
            <div className="task-details-wrapper">
              <div className="markdown-body">
                <ReactMarkdown>{task.details!}</ReactMarkdown>
              </div>
            </div>
          )}

          {hasFiles && (
            <div className="task-files">
              <span className="task-files-title">
                <FileCode2 size={13} />
                <span>Files Modified ({task.files.length})</span>
              </span>
              <div className="files-grid">
                {task.files.map((file, idx) => (
                  <div key={idx} className="file-chip-wrapper">
                    <button
                      className={`file-chip ${copiedFile === file ? 'copied' : ''}`}
                      onClick={(e) => handleCopyFile(file, e)}
                      title="Click to copy file path"
                    >
                      {copiedFile === file ? (
                        <>
                          <Check size={12} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>{file}</span>
                        </>
                      )}
                    </button>
                    <button
                      className="file-jump-btn"
                      onClick={(e) => handleGoToAntigravity(e, file)}
                      title={`Open ${file} in Antigravity`}
                      aria-label={`Open ${file} in Antigravity`}
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="task-collapse-footer">
            <button
              className="btn-collapse-compact"
              onClick={() => setIsExpanded(false)}
              title="Collapse to short summary"
            >
              <ChevronUp size={13} />
              <span>Collapse to summary</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
