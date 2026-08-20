import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { UserCheck, Sparkles, User, RefreshCw, Save } from 'lucide-react';

export default function EmployeeEvaluationPage() {
  const queryClient = useQueryClient();
  const [selectedEmp, setSelectedEmp] = useState<string>('');
  const [editStrengths, setEditStrengths] = useState('');
  const [editWeaknesses, setEditWeaknesses] = useState('');

  const { data: empRes, isLoading: loadingEmps } = useQuery({
    queryKey: ['pmEmployees'],
    queryFn: () => projectManagerService.getEmployees().then((res) => res.data),
  });

  const employees = empRes?.employees || [];

  const { data: skillsRes } = useQuery({
    queryKey: ['pmEmployeeSkills', selectedEmp],
    queryFn: () => {
      if (!selectedEmp) return Promise.resolve({ strengths: '', weaknesses: '' });
      return projectManagerService.getSkills(selectedEmp).then((res) => res.data);
    },
    enabled: !!selectedEmp,
  });

  const generateMutation = useMutation({
    mutationFn: (empName: string) => projectManagerService.generateSkills(empName),
    onSuccess: (res) => {
      setEditStrengths(res.data.strengths || '');
      setEditWeaknesses(res.data.weaknesses || '');
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: { employee_name: string; strengths: string; weaknesses: string }) =>
      projectManagerService.updateSkills(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pmEmployeeSkills', selectedEmp] });
    },
  });

  const handleSelectEmp = (name: string) => {
    setSelectedEmp(name);
    setEditStrengths('');
    setEditWeaknesses('');
  };

  React.useEffect(() => {
    if (skillsRes) {
      setEditStrengths(skillsRes.strengths || '');
      setEditWeaknesses(skillsRes.weaknesses || '');
    }
  }, [skillsRes]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Employee Evaluation & Skills Matrix</h1>
        <p className="text-sm text-slate-500">AI-assisted analysis of developer work history, strengths, and areas for improvement</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Employee Selection List */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Active Employees</h2>
          {loadingEmps ? (
            <div className="p-4 text-center text-sm text-slate-400">Loading employees...</div>
          ) : (
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {employees.map((e: any, idx: number) => {
                const name = e['Employee Name'];
                const isSelected = selectedEmp === name;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectEmp(name)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                      isSelected ? 'bg-violet-50 text-violet-800 font-bold border border-violet-200' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <User size={16} className={isSelected ? 'text-violet-600' : 'text-slate-400'} />
                      <span>{name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Skills Details & Generator */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          {!selectedEmp ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <UserCheck size={40} className="mx-auto text-slate-300" />
              <p className="font-semibold text-slate-600">Select an employee from the left panel to view or generate evaluations.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedEmp}</h2>
                  <p className="text-xs text-slate-500">Evaluation & Skills Record</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => generateMutation.mutate(selectedEmp)}
                    disabled={generateMutation.isPending}
                    className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-medium text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                  >
                    {generateMutation.isPending ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>Generate Evaluation</span>
                  </button>

                  <button
                    onClick={() =>
                      saveMutation.mutate({
                        employee_name: selectedEmp,
                        strengths: editStrengths,
                        weaknesses: editWeaknesses,
                      })
                    }
                    disabled={saveMutation.isPending}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-600 text-white font-medium text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                  >
                    <Save size={14} />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>

              {generateMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                  Evaluation generation failed: {(generateMutation.error as any)?.message}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Strengths & Accomplishments
                  </label>
                  <textarea
                    rows={8}
                    value={editStrengths}
                    onChange={(e) => setEditStrengths(e.target.value)}
                    placeholder="Bullet points of key technical strengths..."
                    className="w-full p-3 bg-emerald-50/40 border border-emerald-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  ></textarea>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider">
                    Areas for Growth & Skill Gaps
                  </label>
                  <textarea
                    rows={8}
                    value={editWeaknesses}
                    onChange={(e) => setEditWeaknesses(e.target.value)}
                    placeholder="Bullet points of development areas..."
                    className="w-full p-3 bg-amber-50/40 border border-amber-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  ></textarea>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
