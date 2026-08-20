import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { departmentService } from '../../services/departmentService';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, Plus, Filter, Users, FolderKanban, Activity } from 'lucide-react';
import { Spinner, Button } from '../../components/ui';
import DepartmentModal from './DepartmentModal';

export default function DepartmentsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await departmentService.getDepartments();
      return res.data;
    }
  });

  const filteredDepartments = departments?.filter((d: any) => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.code && d.code.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const totalEmployees = departments?.reduce((acc: number, d: any) => acc + (d.employee_count || 0), 0) || 0;
  const activeDepartments = departments?.filter((d: any) => d.status === 'active').length || 0;
  const departmentsWithHeads = departments?.filter((d: any) => !!d.head).length || 0;

  return (
    <div className="w-full px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <Building2 size={20} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Departments</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Organize people, teams, responsibilities, and department workload.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64"
            />
          </div>
          <button className="p-2 text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <Filter size={18} />
          </button>
          <Button onClick={() => setIsModalOpen(true)} variant="primary" className="flex items-center gap-2 rounded-xl">
            <Plus size={16} />
            <span>Add Department</span>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Departments</p>
          <p className="text-3xl font-bold text-slate-800">{departments?.length || 0}</p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Employees</p>
          <p className="text-3xl font-bold text-slate-800">{totalEmployees}</p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active</p>
          <p className="text-3xl font-bold text-emerald-600">{activeDepartments}</p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Heads</p>
          <p className="text-3xl font-bold text-slate-800">{departmentsWithHeads}</p>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : filteredDepartments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-xs">
          <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">No departments found</h3>
          <p className="text-sm text-slate-500 mb-4">Create departments to organize your employees.</p>
          <Button onClick={() => setIsModalOpen(true)} variant="primary">Add Department</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepartments.map((dept: any) => (
            <div key={dept.id} className="bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col h-full">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg line-clamp-1">{dept.name}</h3>
                      {dept.code && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{dept.code}</span>}
                    </div>
                  </div>
                  {dept.status === 'active' ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" title="Active"></span>
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shadow-sm" title="Inactive"></span>
                  )}
                </div>
                
                <p className="text-sm text-slate-500 line-clamp-2 mb-6 h-10">
                  {dept.description || 'No description provided for this department.'}
                </p>

                <div className="grid grid-cols-3 gap-2 py-4 border-y border-slate-100 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                      <Users size={14} />
                    </div>
                    <p className="text-sm font-bold text-slate-800">{dept.employee_count || 0}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Employees</p>
                  </div>
                  <div className="text-center border-x border-slate-100">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                      <FolderKanban size={14} />
                    </div>
                    <p className="text-sm font-bold text-slate-800">{dept.active_project_count || 0}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Projects</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                      <Activity size={14} />
                    </div>
                    <p className="text-sm font-bold text-indigo-600">{dept.utilization || 0}%</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Utilization</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {dept.head ? (
                    <>
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                        {dept.head.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Department Head</p>
                        <p className="text-sm font-semibold text-slate-800 line-clamp-1">{dept.head.name}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center text-xs">
                        ?
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Department Head</p>
                        <p className="text-sm font-medium text-slate-500 italic">Not Assigned</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                <button 
                  onClick={() => navigate(`/departments/${dept.id}`)}
                  className="w-full py-2 bg-white border border-slate-200 text-sm font-bold text-slate-700 rounded-xl hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-xs"
                >
                  View Department
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <DepartmentModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        orgId={1} // Assuming orgId 1 for now, or fetch from auth context if available
      />
    </div>
  );
}
