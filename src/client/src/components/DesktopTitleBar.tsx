import React from 'react';
import { ExternalLink, Minus, X, Bell, BellOff, Plus, Radio } from 'lucide-react';

interface DesktopTitleBarProps {
  pendingCount: number;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onOpenNewTaskModal?: () => void;
  isConnected?: boolean;
}

export const DesktopTitleBar: React.FC<DesktopTitleBarProps> = ({
  pendingCount,
  soundEnabled,
  onToggleSound,
  onOpenNewTaskModal,
  isConnected,
}) => {
  const isElectron = Boolean(window.electronAPI?.isElectron);

  if (!isElectron) return null;

  const handleMinimize = () => {
    window.electronAPI?.minimizeToTray();
  };

  const handleClose = () => {
    window.electronAPI?.hideWindow();
  };

  const handleOpenBrowser = () => {
    window.electronAPI?.openInBrowser();
  };

  return (
    <div className="desktop-titlebar">
      <div className="desktop-titlebar-drag">
        <div className="desktop-titlebar-brand">
          <div className="desktop-logo-dot" />
          <span className="desktop-app-title">Loopback</span>
          <span className="desktop-app-badge">Tray</span>
          {pendingCount > 0 && (
            <span className="desktop-counter-badge">{pendingCount}</span>
          )}

          {isConnected !== undefined && (
            <div
              className={`live-status-pill ${isConnected ? 'live' : 'offline'}`}
              title={isConnected ? 'Connected to live SSE stream' : 'Reconnecting...'}
            >
              <Radio size={10} className={isConnected ? '' : 'animate-pulse'} />
              <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
            </div>
          )}
        </div>
      </div>

      <div className="desktop-titlebar-controls">
        {onToggleSound && (
          <button
            className={`titlebar-btn titlebar-action-btn ${soundEnabled ? 'active' : ''}`}
            onClick={onToggleSound}
            title={soundEnabled ? 'Chime sound enabled on new reports' : 'Sound muted'}
            aria-label="Toggle chime sound"
          >
            {soundEnabled ? <Bell size={13} /> : <BellOff size={13} />}
          </button>
        )}

        {onOpenNewTaskModal && (
          <button
            className="titlebar-btn-new-task"
            onClick={onOpenNewTaskModal}
            title="Create a new task record"
          >
            <Plus size={12} />
            <span>New Task</span>
          </button>
        )}

        <div className="titlebar-divider" />

        <button
          className="titlebar-btn"
          onClick={handleOpenBrowser}
          title="Open Full Web Dashboard in Browser (http://localhost:3700)"
          aria-label="Open in browser"
        >
          <ExternalLink size={13} />
        </button>

        <button
          className="titlebar-btn"
          onClick={handleMinimize}
          title="Minimize to System Tray"
          aria-label="Minimize to tray"
        >
          <Minus size={13} />
        </button>

        <button
          className="titlebar-btn titlebar-btn-close"
          onClick={handleClose}
          title="Hide to System Tray"
          aria-label="Close to tray"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};
