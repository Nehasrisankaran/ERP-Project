import type { DashboardAttentionItem } from '../../types/dashboard';
import { AlertCircle, Clock, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils';

export function DashboardAttentionList({ items }: { items: DashboardAttentionItem[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 h-full flex flex-col items-center justify-center">
        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <Info size={20} className="text-slate-400" />
        </div>
        <p className="font-medium text-sm">All caught up!</p>
        <p className="text-xs mt-1">Nothing requires your immediate attention.</p>
      </div>
    );
  }

  const getSeverityStyles = (severity: string) => {
    switch(severity) {
      case 'critical': return 'bg-red-50 text-red-700 border-red-200';
      case 'high': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'low': return 'bg-slate-50 text-slate-700 border-slate-200';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getIcon = (severity: string) => {
    switch(severity) {
      case 'critical': return <AlertCircle size={16} />;
      case 'high': return <AlertTriangle size={16} />;
      case 'low': return <Info size={16} />;
      default: return <Clock size={16} />;
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-500" />
          Requires Attention
        </h3>
      </div>
      <div className="p-3 space-y-2 flex-grow overflow-y-auto">
        {items.map(item => (
          <div key={item.id} className={cn("p-3 rounded-lg border text-sm flex justify-between items-center", getSeverityStyles(item.severity))}>
             <div className="flex items-center gap-3">
               {getIcon(item.severity)}
               <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-xs opacity-80 capitalize">{item.type}</div>
               </div>
             </div>
             {item.due_date && <div className="text-xs font-semibold px-2 py-1 bg-white/50 rounded">{item.due_date}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
