import React from 'react';
import { Layers, Bell, BellOff, Plus, Radio } from 'lucide-react';

interface HeaderProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenNewTaskModal: () => void;
  isConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  soundEnabled,
  onToggleSound,
  onOpenNewTaskModal,
  isConnected,
}) => {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-icon">
          <Layers size={22} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="brand-title">Loopback</h1>
          <p className="brand-subtitle">Agent Task Inbox & Verification</p>
        </div>
      </div>

      <div className="header-actions">
        <div
          title={isConnected ? 'Connected to live stream' : 'Reconnecting...'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.75rem',
            padding: '0.35rem 0.65rem',
            borderRadius: '9999px',
            background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: isConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <Radio size={13} className={isConnected ? '' : 'animate-pulse'} />
          <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
        </div>

        <button
          className={`btn-icon ${soundEnabled ? 'active' : ''}`}
          onClick={onToggleSound}
          title={soundEnabled ? 'Chime sound enabled on new reports' : 'Sound muted'}
          aria-label="Toggle chime sound"
        >
          {soundEnabled ? <Bell size={18} /> : <BellOff size={18} />}
        </button>

        <button className="btn btn-primary" onClick={onOpenNewTaskModal}>
          <Plus size={16} />
          <span>New Task</span>
        </button>
      </div>
    </header>
  );
};
