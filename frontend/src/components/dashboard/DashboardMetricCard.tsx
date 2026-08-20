import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils';

export interface DashboardMetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  href?: string;
}

export function DashboardMetricCard({
  icon, label, value, sub, color, href,
}: DashboardMetricCardProps) {
  const inner = (
    <div className={cn(
      "bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-4 hover:shadow-sm transition-all h-full",
      href && "cursor-pointer hover:border-violet-200 group"
    )}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium group-hover:text-slate-700 transition-colors">{label}</p>
        <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  
  return href ? <Link to={href} className="block h-full">{inner}</Link> : inner;
}
