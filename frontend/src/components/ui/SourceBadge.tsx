import React from 'react';
import { cn } from '../../utils';


export type TaskSource = 'workmate' | 'sharepoint_task' | string;

interface SourceBadgeProps {
  source: TaskSource;
  className?: string;
  showIcon?: boolean;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source, className, showIcon = true }) => {
  const isSharePoint = source === 'sharepoint_task';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide border transition-all',
        isSharePoint
          ? 'bg-teal-50 text-teal-800 border-teal-200'
          : 'bg-violet-50 text-violet-800 border-violet-200',
        className
      )}
    >
      {showIcon && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            isSharePoint ? 'bg-teal-600' : 'bg-violet-600'
          )}
        />
      )}
      <span>{isSharePoint ? 'SharePoint Task' : 'WORKMATE'}</span>
    </span>
  );
};
