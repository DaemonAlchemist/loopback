import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { CreateTaskInput } from '../types';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: CreateTaskInput) => Promise<void>;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [project, setProject] = useState('');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [filesInput, setFilesInput] = useState('');
  const [branch, setBranch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project.trim() || !title.trim()) return;

    setIsSubmitting(true);
    try {
      const files = filesInput
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);

      await onSubmit({
        project: project.trim(),
        title: title.trim(),
        details: details.trim() || undefined,
        files: files.length > 0 ? files : undefined,
        branch: branch.trim() || undefined,
      });

      setProject('');
      setTitle('');
      setDetails('');
      setFilesInput('');
      setBranch('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillSample = () => {
    setProject('current-site-2026/api');
    setTitle('Implemented refresh token rotation and session invalidation');
    setDetails('### Changes Overview\n- Added `/api/auth/refresh` endpoint\n- Implemented redis token blacklist with 7-day TTL\n- Unit tests pass with 94% coverage');
    setFilesInput('src/auth/jwt.service.ts\nsrc/auth/auth.controller.ts\ntests/auth.test.ts');
    setBranch('feature/refresh-tokens');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Record Completed Task</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Project / Repository Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. poser-hair-maker or current-site-2026/api"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Task Title / Headline *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Brief summary of what was completed"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Details / Verification Notes (Markdown supported)</label>
            <textarea
              className="form-textarea"
              placeholder="What was done, test results, verification steps..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Files Modified (one per line)</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: '60px' }}
              placeholder="src/fileA.ts&#10;src/fileB.tsx"
              value={filesInput}
              onChange={(e) => setFilesInput(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Git Branch (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. main or feature/something"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleFillSample}
              style={{ marginRight: 'auto', fontSize: '0.8rem' }}
            >
              <Sparkles size={14} />
              <span>Fill Sample</span>
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Record Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
