import React, { useState } from 'react';
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
} from 'lucide-react';
import { Task } from '../types';

interface TaskCardProps {
  task: Task;
  isNew?: boolean;
  onMarkReviewed: (id: string) => void;
  onUnmarkReviewed: (id: string) => void;
  onDelete: (id: string) => void;
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

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isNew,
  onMarkReviewed,
  onUnmarkReviewed,
  onDelete,
}) => {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const isReviewed = task.status === 'reviewed';
  const projectColors = getProjectColor(task.project);

  const handleCopyFile = (file: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(file);
    setCopiedFile(file);
    setTimeout(() => {
      setCopiedFile(null);
    }, 1500);
  };

  const hasLongDetails = task.details && task.details.length > 300;

  return (
    <div className={`task-card ${isReviewed ? 'reviewed' : ''} ${isNew ? 'new-arrival' : ''}`}>
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

      {task.details && (
        <div className="task-details-wrapper">
          <div
            className="markdown-body"
            style={{
              maxHeight: !isExpanded && hasLongDetails ? '120px' : 'none',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <ReactMarkdown>{task.details}</ReactMarkdown>
          </div>

          {hasLongDetails && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                marginTop: '0.5rem',
                background: 'none',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontSize: '0.775rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={14} /> Show less
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> Show more
                </>
              )}
            </button>
          )}
        </div>
      )}

      {task.files && task.files.length > 0 && (
        <div className="task-files">
          <span className="task-files-title">
            <FileCode2 size={13} />
            <span>Files Modified ({task.files.length})</span>
          </span>
          <div className="files-grid">
            {task.files.map((file, idx) => (
              <button
                key={idx}
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
