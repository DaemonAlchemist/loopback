import React from 'react';
import { Clock, CheckCircle2, FolderGit2 } from 'lucide-react';
import { Stats } from '../types';

interface StatsBarProps {
  stats: Stats;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-card-glow pending" />
        <div className="stat-info">
          <span className="stat-label">To Verify</span>
          <span className="stat-value">{stats.pending}</span>
        </div>
        <div className="stat-icon" style={{ color: 'var(--accent-cyan)' }}>
          <Clock size={22} />
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-card-glow reviewed" />
        <div className="stat-info">
          <span className="stat-label">Reviewed</span>
          <span className="stat-value">{stats.reviewed}</span>
        </div>
        <div className="stat-icon" style={{ color: 'var(--accent-emerald)' }}>
          <CheckCircle2 size={22} />
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-card-glow projects" />
        <div className="stat-info">
          <span className="stat-label">Active Projects</span>
          <span className="stat-value">{stats.projects.length}</span>
        </div>
        <div className="stat-icon" style={{ color: 'var(--accent-purple)' }}>
          <FolderGit2 size={22} />
        </div>
      </div>
    </div>
  );
};
