import React from 'react';
import { Clock, CheckCircle2, FolderGit2 } from 'lucide-react';
import { Stats } from '../types';

interface StatsBarProps {
  stats: Stats;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  return (
    <div className="stats-bar">
      <div className="stat-card pending" title={`${stats.pending} task${stats.pending === 1 ? '' : 's'} waiting for verification`}>
        <div className="stat-icon-wrapper pending">
          <Clock size={13} />
        </div>
        <span className="stat-label">To Verify</span>
        <span className="stat-value pending">{stats.pending}</span>
      </div>

      <div className="stat-card reviewed" title={`${stats.reviewed} task${stats.reviewed === 1 ? '' : 's'} verified and archived`}>
        <div className="stat-icon-wrapper reviewed">
          <CheckCircle2 size={13} />
        </div>
        <span className="stat-label">Reviewed</span>
        <span className="stat-value reviewed">{stats.reviewed}</span>
      </div>

      <div className="stat-card projects" title={`${stats.projects.length} active project${stats.projects.length === 1 ? '' : 's'}`}>
        <div className="stat-icon-wrapper projects">
          <FolderGit2 size={13} />
        </div>
        <span className="stat-label">Active Projects</span>
        <span className="stat-value projects">{stats.projects.length}</span>
      </div>
    </div>
  );
};
