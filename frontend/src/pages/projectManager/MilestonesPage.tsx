import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { Flag, Plus, AlertTriangle } from 'lucide-react';

export default function MilestonesPage() {
  const queryClient = useQueryClient();
  const [projectFilter, setProjectFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    project: '',
    week_start_date: new Date().toISOString().split('T')[0],
    target_milestone: '',
    deadline: '',
    dependencies: '',
    achieved: false,
    achievement_notes: '',
    risks_faced: '',
  });

  const { data: milestonesRes, isLoading, error, refetch } = useQuery({
    queryKey: ['pmMilestones', projectFilter],
    queryFn: () => projectManagerService.getMilestones(projectFilter || undefined).then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectManagerService.createMilestone(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pmMilestones'] });
      setShowModal(false);
      setFormData({
        project: '',
        week_start_date: new Date().toISOString().split('T')[0],
        target_milestone: '',
        deadline: '',
        dependencies: '',
        achieved: false,
        achievement_notes: '',
        risks_faced: '',
      });
    },
  });

  const milestones = Array.isArray(milestonesRes) ? milestonesRes : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Milestones & Weekly Targets</h1>
          <p className="text-sm text-slate-500">Track key project deliverable goals, deadlines, and achievement status</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          <span>Add Target Milestone</span>
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase">Filter Project:</span>
        <input
          type="text"
          placeholder="Enter project name..."
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 w-64"
        />
      </div>

      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4 mx-auto"></div>
          <div className="h-4 bg-slate-200 rounded w-1/3 mx-auto"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-semibold mb-2">Unable to load milestones.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : milestones.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Flag size={40} className="text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No milestones logged yet</h3>
          <p className="text-sm text-slate-500">Create a new milestone target using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {milestones.map((m: any) => (
            <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold rounded-md">
                  {m.project}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                    m.achieved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {m.achieved ? 'Achieved' : 'In Progress'}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900">{m.target_milestone}</h3>

              <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                <div>Week Start: {m.week_start_date}</div>
                {m.deadline && <div>Deadline: {m.deadline}</div>}
              </div>

              {m.dependencies && (
                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="font-semibold text-slate-700">Dependencies:</span> {m.dependencies}
                </div>
              )}

              {m.risks_faced && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
                  <span className="font-semibold text-red-700">Risks:</span> {m.risks_faced}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Create Milestone Target</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={formData.project}
                  onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Week Start Date *</label>
                <input
                  type="date"
                  required
                  value={formData.week_start_date}
                  onChange={(e) => setFormData({ ...formData, week_start_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Milestone *</label>
                <textarea
                  required
                  rows={2}
                  value={formData.target_milestone}
                  onChange={(e) => setFormData({ ...formData, target_milestone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Deadline</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Dependencies</label>
                <input
                  type="text"
                  value={formData.dependencies}
                  onChange={(e) => setFormData({ ...formData, dependencies: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending || !formData.project || !formData.target_milestone}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-medium rounded-lg text-sm"
              >
                {createMutation.isPending ? 'Saving...' : 'Save Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
