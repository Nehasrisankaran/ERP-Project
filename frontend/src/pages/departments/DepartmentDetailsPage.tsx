import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { departmentService } from '../../services/departmentService';
import { ArrowLeft, Building2, Edit2, Users, FolderKanban, Activity, BarChart3, AlertTriangle } from 'lucide-react';
import { Spinner, Button } from '../../components/ui';
import DepartmentModal from './DepartmentModal';

export default function DepartmentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'people' | 'projects' | 'workload' | 'activity'>('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { data: dept, isLoading } = useQuery({
    queryKey: ['department', id],
    queryFn: async () => {
      const res = await departmentService.getDepartment(id as string);
      return res.data;
    },
    enabled: !!id
  });

  const { data: employees, isLoading: empLoading } = useQuery({
    queryKey: ['departmentEmployees', id],
    queryFn: async () => {
      const res = await departmentService.getDepartmentEmployees(id as string);
      return res.data;
    },
    enabled: !!id && activeTab === 'people'
  });

  const { data: projects, isLoading: projLoading } = useQuery({
    queryKey: ['departmentProjects', id],
    queryFn: async () => {
      const res = await departmentService.getDepartmentProjects(id as string);
      return res.data;
    },
    enabled: !!id && activeTab === 'projects'
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;
  }

  if (!dept) {
    return (
      <div className="w-full px-8 py-8 space-y-6">
        <button onClick={() => navigate('/departments')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm font-semibold">Back to Departments</span>
        </button>
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-xs">
          <AlertTriangle size={48} className="mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">Department not found</h3>
          <p className="text-sm text-slate-500">The department you are looking for does not exist or you don't have access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-8 py-8 space-y-6 max-w-[1400px] mx-auto">
      <button onClick={() => navigate('/departments')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft size={16} />
        <span className="text-sm font-semibold">Departments</span>
      </button>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
        
        <div className="flex justify-between items-start relative z-10">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Building2 size={32} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{dept.name}</h1>
                {dept.code && <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded uppercase">{dept.code}</span>}
                {dept.status === 'active' ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded uppercase tracking-wider">Active</span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded uppercase tracking-wider">Inactive</span>
                )}
              </div>
              <p className="text-slate-500 text-sm max-w-2xl">{dept.description || 'No description provided.'}</p>
            </div>
          </div>
          
          <Button variant="secondary" className="flex items-center gap-2" onClick={() => setIsEditModalOpen(true)}>
            <Edit2 size={14} />
            <span>Edit Department</span>
          </Button>
        </div>

        <div className="mt-8 flex items-center gap-12 border-t border-slate-100 pt-6">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Department Head</p>
            <div className="flex items-center gap-2">
              {dept.head ? (
                <>
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                    {dept.head.name.charAt(0)}
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{dept.head.name}</span>
                </>
              ) : (
                <span className="text-sm font-medium text-slate-500 italic">Not Assigned</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-8 pl-12 border-l border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Users size={16} />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{dept.employee_count || 0}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400">Employees</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <FolderKanban size={16} />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{dept.active_project_count || 0}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400">Projects</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <Activity size={16} />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{dept.utilization || 0}%</p>
                <p className="text-[10px] uppercase font-bold text-slate-400">Utilization</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {[
          { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
          { id: 'people', label: 'People', icon: <Users size={16} /> },
          { id: 'projects', label: 'Projects', icon: <FolderKanban size={16} /> },
          { id: 'workload', label: 'Workload', icon: <Activity size={16} /> },
          { id: 'activity', label: 'Activity', icon: <Activity size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            <div className="col-span-full lg:col-span-2 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 mb-4">Department Performance</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Completed</p>
                    <p className="text-2xl font-bold text-emerald-600">{dept.completed_project_count || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Projects delivered</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Active</p>
                    <p className="text-2xl font-bold text-indigo-600">{dept.active_project_count || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Projects running</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pending</p>
                    <p className="text-2xl font-bold text-slate-800">{dept.pending_tasks || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Total tasks assigned</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Overdue</p>
                    <p className="text-2xl font-bold text-red-600">{dept.overdue_tasks || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Tasks requiring attention</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 mb-4">Workload Distribution</h3>
                <div className="h-48 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl text-slate-400 text-sm font-medium">
                  Workload chart visualization (Requires real-time task capacity API)
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 mb-4">Top Active Projects</h3>
                <div className="space-y-4">
                  {dept.active_project_count > 0 ? (
                    <div className="text-center text-sm text-slate-500 italic py-4">Click Projects tab for details.</div>
                  ) : (
                    <div className="text-center text-sm text-slate-500 italic py-8">No active projects.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'people' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden animate-in fade-in duration-500">
            {empLoading ? (
              <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
            ) : !employees || employees.length === 0 ? (
              <div className="p-16 text-center">
                <Users size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">No employees assigned</h3>
                <p className="text-sm text-slate-500 mb-4">There are no employees currently in this department.</p>
                <Button onClick={() => navigate('/employees/new')}>Add Employee</Button>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium text-xs uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-6">Employee</th>
                    <th className="py-3 px-6">Job Title</th>
                    <th className="py-3 px-6">Manager</th>
                    <th className="py-3 px-6">Active Projects</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {employees.map((emp: any) => (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors cursor-pointer" onClick={() => navigate(`/people/${emp.user_id}`)}>
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-3">
                          {emp.avatar_url ? (
                            <img src={emp.avatar_url} alt={emp.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
                              {emp.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900">{emp.name}</p>
                            <p className="text-xs text-slate-500">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-6">{emp.designation || 'Not specified'}</td>
                      <td className="py-3 px-6">
                        {emp.manager ? (
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">{emp.manager.charAt(0)}</div>
                            {emp.manager}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-6">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs">
                          {emp.projects_count}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right">
                        <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800">View Profile</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="animate-in fade-in duration-500">
            {projLoading ? (
              <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
            ) : !projects || projects.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-xs">
                <FolderKanban size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">No active projects</h3>
                <p className="text-sm text-slate-500">This department is not currently involved in any projects.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((proj: any) => (
                  <div key={proj.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/projects/${proj.id}`)}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-900 text-lg line-clamp-1">{proj.name}</h4>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700">
                        {proj.status}
                      </span>
                    </div>
                    
                    <div className="flex-1 space-y-4 mt-2">
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                          <span>Progress</span>
                          <span>{proj.progress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${proj.progress}%` }}></div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <FolderKanban size={14} className="text-slate-400" />
                          <span>{proj.task_count} Tasks</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users size={14} className="text-slate-400" />
                          <span>{proj.department_involvement} Dept Members</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-end">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Manager</p>
                        <p className="text-sm font-semibold text-slate-800">{proj.manager || 'Unassigned'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Target</p>
                        <p className="text-sm font-semibold text-slate-800">
                          {proj.deadline ? new Date(proj.deadline).toLocaleDateString() : 'Not set'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(activeTab === 'workload' || activeTab === 'activity') && (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-xs animate-in fade-in duration-500">
            <Activity size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-1">Under Construction</h3>
            <p className="text-sm text-slate-500">This section is being wired up to the analytics engine.</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {dept && (
        <DepartmentModal 
          open={isEditModalOpen} 
          onClose={() => setIsEditModalOpen(false)} 
          department={dept} 
          orgId={1} // Assuming orgId 1 for now
        />
      )}
    </div>
  );
}
