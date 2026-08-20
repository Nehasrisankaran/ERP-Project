
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, CheckSquare, Clock, FolderKanban, 
  AlertTriangle, Users, Activity, MessageSquare, 
  Settings, FileSpreadsheet, PieChart, Target 
} from 'lucide-react';
import { cn } from '../../utils';

const PM_NAVIGATION = [
  {
    group: 'Overview',
    items: [
      { label: 'Project Dashboard', path: '/project-manager', icon: <LayoutDashboard size={18} /> },
    ]
  },
  {
    group: 'Work',
    items: [
      { label: 'All Tasks', path: '/project-manager/all-tasks', icon: <CheckSquare size={18} /> },
      { label: 'Pending Today', path: '/project-manager/pending-today', icon: <Clock size={18} /> },
    ]
  },
  {
    group: 'Projects',
    items: [
      { label: 'Milestones', path: '/project-manager/milestones', icon: <Target size={18} /> },
      { label: 'Sprint Delays', path: '/project-manager/delivery-risks', icon: <AlertTriangle size={18} /> },
    ]
  },
  {
    group: 'People',
    items: [
      { label: 'Resource Utilization', path: '/project-manager/resource-utilization', icon: <Users size={18} /> },
      { label: 'Employee Evaluation', path: '/project-manager/employee-evaluation', icon: <Activity size={18} /> },
    ]
  },
  {
    group: 'Communication',
    items: [
      { label: 'Teams Replies', path: '/project-manager/teams-replies', icon: <MessageSquare size={18} /> },
      { label: 'Reminder History', path: '/project-manager/reminder-history', icon: <Clock size={18} /> },
    ]
  },
  {
    group: 'Insights',
    items: [
      { label: 'Executive Summary', path: '/project-manager/executive-summary', icon: <PieChart size={18} /> },
    ]
  },
  {
    group: 'System',
    items: [
      { label: 'Activity Log', path: '/project-manager/activity-log', icon: <Activity size={18} /> },
      { label: 'Excel Viewer', path: '/project-manager/excel-viewer', icon: <FileSpreadsheet size={18} /> },
    ]
  }
];

export default function PMLayout() {
  const location = useLocation();

  return (
    <div className="flex h-full w-full bg-slate-50 overflow-hidden">
      {/* Module Sidebar */}
      <div className="w-64 flex-shrink-0 bg-white border-r border-slate-200 h-full flex flex-col overflow-y-auto custom-scrollbar">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-violet-700">
            <FolderKanban size={24} className="flex-shrink-0" />
            <h2 className="font-bold text-sm tracking-wide">Project Manager</h2>
          </div>
        </div>
        
        <nav className="flex-1 p-3 space-y-6">
          {PM_NAVIGATION.map((group, idx) => (
            <div key={idx}>
              <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.group}
              </h3>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const isActive = location.pathname === item.path || (item.path === '/project-manager' && location.pathname === '/project-manager/overview');
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group",
                        isActive 
                          ? "bg-violet-50 text-violet-800 font-semibold"
                          : "text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100"
                      )}
                    >
                      <span className={cn("transition-colors", isActive ? "text-violet-600" : "text-slate-400 group-hover:text-slate-600")}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Module Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        <Outlet />
      </div>
    </div>
  );
}
