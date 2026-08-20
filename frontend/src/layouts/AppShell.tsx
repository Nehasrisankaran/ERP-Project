import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Avatar } from '../components/ui';
import {
  LayoutDashboard, CheckSquare, Briefcase, UsersRound, Users,
  Building2, Settings, Search, Bell, Plus, LogOut, ChevronLeft, ChevronRight,
  ChevronDown, Clock, FolderKanban
} from 'lucide-react';


import { cn } from '../utils';

interface NavItemDef {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles?: string[]; // If undefined, accessible to all
}

interface NavSectionDef {
  title: string;
  items: NavItemDef[];
  roles?: string[];
}

const NAVIGATION: NavSectionDef[] = [
  {
    title: 'WORKMATE',
    items: [
      { label: 'Dashboard', to: '/', icon: <LayoutDashboard size={18} /> },
      { label: 'My Work', to: '/my-work', icon: <CheckSquare size={18} /> },
      { label: 'Projects', to: '/projects', icon: <Briefcase size={18} /> },
      { label: 'Team', to: '/teams', icon: <UsersRound size={18} /> },
      { label: 'Departments', to: '/departments', icon: <Building2 size={18} /> },
      { label: 'Employees', to: '/people', icon: <Users size={18} /> },
      { label: 'Calendar', to: '/calendar', icon: <Clock size={18} /> },
      { label: 'Project Manager', to: '/project-manager', icon: <FolderKanban size={18} />, roles: ['admin', 'manager', 'super_admin'] },
      { label: 'Reports', to: '/reports', icon: <Building2 size={18} /> },
      { label: 'More', to: '/more', icon: <Plus size={18} /> },
    ]
  },
  {
    title: 'ACCOUNT',
    items: [
      { label: 'Settings', to: '/settings', icon: <Settings size={18} /> },
    ]
  }
];





function checkAccess(allowedRoles?: string[], userRole?: string) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

function NavItem({ item, collapsed }: { item: NavItemDef; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group relative',
          isActive
            ? 'bg-violet-50 text-violet-800 font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-violet-600 before:rounded-r-full'
            : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100'
        )
      }
      title={collapsed ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          <span className={cn("flex-shrink-0 transition-colors", isActive ? "text-violet-600" : "text-slate-400 group-hover:text-slate-600")}>
            {item.icon}
          </span>
          {!collapsed && <span>{item.label}</span>}
          
          {/* Tooltip for collapsed mode */}
          {collapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
              {item.label}
            </div>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  // Check local storage for preferred sidebar state
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('workmate_sidebar_collapsed');
    return saved === 'true';
  });
  
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'New Task Assigned', desc: 'You were assigned to "Build Kanban board UI"', time: '10m ago', unread: true },
  ]);

  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // Save preference
  useEffect(() => {
    localStorage.setItem('workmate_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  const handleLogout = () => { logout(); navigate('/login'); };
  const unreadCount = notifications.filter(n => n.unread).length;
  const markAllRead = () => setNotifications(list => list.map(n => ({ ...n, unread: false })));

  const userRole = user?.role;

  return (
    <div className="flex h-screen bg-[#f8f9fc] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={cn(
        'flex flex-col bg-white border-r border-slate-200 transition-all duration-300 flex-shrink-0 relative z-20',
        collapsed ? 'w-[72px]' : 'w-64'
      )}>
        {/* Toggle Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-6 bg-white border border-slate-200 text-slate-400 hover:text-slate-600 w-6 h-6 rounded-full flex items-center justify-center shadow-sm z-30 transition-transform hover:scale-110"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Organization Switcher Area */}
        <div className={cn("flex flex-col justify-center h-20 border-b border-slate-100", collapsed ? "px-2 items-center" : "px-5")}>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-6 h-6 bg-violet-600 rounded-md flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">W</span>
            </div>
            {!collapsed && (
              <span className="font-bold text-slate-900 tracking-tight select-none">
                WORKMATE
              </span>
            )}
          </div>
          {!collapsed && (
            <button className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors text-left pl-8 group">
              <span className="truncate max-w-[140px]">Fanam Digitals</span>

              <ChevronDown size={12} className="text-slate-400 group-hover:text-slate-600" />
            </button>
          )}
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-6 custom-scrollbar">
          {NAVIGATION.map((section, idx) => {
            if (!checkAccess(section.roles, userRole)) return null;

            const visibleItems = section.items.filter(item => checkAccess(item.roles, userRole));
            if (visibleItems.length === 0) return null;

            return (
              <div key={idx} className={cn("flex flex-col", collapsed ? "px-3" : "px-4")}>
                {!collapsed && (
                  <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {visibleItems.map(item => (
                    <NavItem key={item.to} item={item} collapsed={collapsed} />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="border-t border-slate-100 p-4">

          
          <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "")}>
            <div 
              onClick={() => navigate('/settings')}
              className="cursor-pointer group flex items-center gap-3 flex-1 min-w-0"
              title="View Settings & Profile"
            >
              <Avatar name={user?.full_name} size="sm" className="ring-2 ring-white group-hover:ring-violet-300 transition-all shadow-sm flex-shrink-0" />
              {!collapsed && (
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-sm font-bold text-slate-700 group-hover:text-violet-700 transition-colors truncate leading-tight">{user?.full_name}</p>
                  <p className="text-xs text-slate-500 capitalize truncate">{user?.role?.replace('_', ' ')}</p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50" title="Logout">
                <LogOut size={16} />
              </button>
            )}
          </div>

        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          {/* Search Hint */}
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-80 cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-all text-slate-400 focus-within:ring-2 focus-within:ring-violet-100 focus-within:border-violet-300">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search tasks, projects, people..." 
              className="bg-transparent border-none focus:outline-none text-sm text-slate-700 w-full placeholder:text-slate-400"
            />
            <span className="ml-auto text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono shadow-sm flex-shrink-0">⌘K</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}

            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-violet-600 hover:text-violet-700 font-medium">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {notifications.map(n => (
                      <div key={n.id} className={cn('p-4 hover:bg-slate-50 transition-colors cursor-pointer', n.unread ? 'bg-violet-50/30' : '')}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={cn("text-xs", n.unread ? "font-semibold text-slate-800" : "font-medium text-slate-600")}>{n.title}</p>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">{n.time}</span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{n.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto h-full">
          {children}
        </main>
      </div>
    </div>
  );
}
