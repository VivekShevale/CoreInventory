import React from 'react';
import { statusColor } from '../lib/utils';

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor(status)}`}>
      {status}
    </span>
  );
}
