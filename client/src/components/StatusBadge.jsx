import React from 'react';

export function StatusBadge({ status, type = 'info', children }) {
  const badgeClass = `badge badge-${type}`;
  return (
    <span className={badgeClass}>
      {children || status}
    </span>
  );
}

export default StatusBadge;
