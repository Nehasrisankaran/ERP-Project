import type { DashboardVisualization as VizType } from '../../types/dashboard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';

const COLORS = ['#8b5cf6', '#10b981', '#f43f5e', '#f59e0b', '#3b82f6'];

export function DashboardVisualization({ visualizations }: { visualizations: VizType[] }) {
  if (!visualizations || visualizations.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {visualizations.map(viz => {
        const isDistribution = viz.type === 'distribution';
        
        return (
          <div key={viz.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-80 flex flex-col p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-violet-500" />
              <h3 className="font-semibold text-slate-800 text-sm">{viz.title}</h3>
            </div>
            
            <div className="flex-grow min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                {isDistribution ? (
                  <PieChart>
                    <Pie
                      data={viz.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      nameKey="label"
                    >
                      {viz.data.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#334155', fontWeight: 500, fontSize: '12px' }}
                    />
                  </PieChart>
                ) : (
                  <BarChart data={viz.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <RechartsTooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#334155', fontWeight: 500, fontSize: '12px' }}
                    />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
