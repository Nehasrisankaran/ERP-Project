import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils';
import { useNavigate } from 'react-router-dom';
import { User, Sliders, Bell, Shield, Building2, Layers, Key, Settings, Globe, ArrowLeft } from 'lucide-react';

interface SettingsSection {
  title: string;
  items: {
    id: string;
    label: string;
    icon: React.ReactNode;
    roles?: string[];
  }[];
  roles?: string[];
}

const SETTINGS_NAVIGATION: SettingsSection[] = [
  {
    title: 'PERSONAL',
    items: [
      { id: 'profile', label: 'My Profile', icon: <User size={16} /> },
      { id: 'account', label: 'Account', icon: <Globe size={16} /> },
      { id: 'preferences', label: 'Preferences', icon: <Sliders size={16} /> },
      { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
      { id: 'security', label: 'Security', icon: <Shield size={16} /> },
    ],
  },
  {
    title: 'MANAGEMENT & WORKSPACE',
    items: [
      { id: 'organization', label: 'Organization', icon: <Building2 size={16} />, roles: ['admin', 'super_admin'] },
      { id: 'integrations', label: 'Integrations', icon: <Layers size={16} /> },
      { id: 'permissions', label: 'Permissions', icon: <Key size={16} />, roles: ['admin', 'super_admin'] },
      { id: 'pm_config', label: 'System Configuration', icon: <Settings size={16} />, roles: ['admin', 'super_admin'] },
    ],
  },
];


function checkAccess(allowedRoles?: string[], userRole?: string) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

interface SettingsLayoutProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
}

export default function SettingsLayout({ activeTab, onTabChange, children }: SettingsLayoutProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const userRole = user?.role;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Settings Header */}
      <div className="border-b border-slate-200 px-8 py-6 flex-shrink-0 flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="group flex items-center justify-center w-8 h-8 bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 rounded-full transition-all shadow-sm hover:shadow shrink-0 mt-0.5"
          title="Go Back"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your WORKMATE experience and organization.</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Compact Navigation */}
        <div className="w-64 border-r border-slate-200 bg-slate-50/50 flex-shrink-0 overflow-y-auto custom-scrollbar p-4 space-y-6">
          {SETTINGS_NAVIGATION.map((section) => {
            if (!checkAccess(section.roles, userRole)) return null;

            const visibleItems = section.items.filter((item) => checkAccess(item.roles, userRole));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className="flex flex-col">
                <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </h3>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                          isActive
                            ? 'bg-violet-100 text-violet-800 shadow-sm'
                            : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                        )}
                      >
                        <span className={cn(isActive ? 'text-violet-600' : 'text-slate-400')}>
                          {item.icon}
                        </span>
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-white p-8 custom-scrollbar">
          <div className="max-w-3xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
