import { useStore } from '../state/store';
import type { Conflict, ConflictSeverity } from '../types/conflicts';
import './ConflictList.css';

const severityIcons: Record<ConflictSeverity, string> = {
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export function ConflictList() {
  const conflicts = useStore((s) => s.conflicts);

  if (conflicts.length === 0) return null;

  return (
    <div className="conflict-list">
      <div className="conflict-header">
        Issues ({conflicts.length})
      </div>
      {conflicts.map((conflict) => (
        <div key={conflict.id} className={`conflict-item ${conflict.severity}`}>
          <span className="conflict-icon">{severityIcons[conflict.severity]}</span>
          <span className="conflict-message">{conflict.message}</span>
        </div>
      ))}
    </div>
  );
}
