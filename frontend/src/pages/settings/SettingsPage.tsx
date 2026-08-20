import { useState } from 'react';
import SettingsLayout from './SettingsLayout';
import ProfileTab from './tabs/ProfileTab';
import PreferencesTab from './tabs/PreferencesTab';
import NotificationsTab from './tabs/NotificationsTab';
import SecurityTab from './tabs/SecurityTab';
import WorkspaceGeneralTab from './tabs/WorkspaceGeneralTab';

import PMConfigurationPage from '../projectManager/PMConfigurationPage';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab />;
      case 'account':
        return <ProfileTab />;
      case 'preferences':
        return <PreferencesTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'security':
        return <SecurityTab />;
      case 'general':
      case 'organization':
        return <WorkspaceGeneralTab />;
      case 'integrations':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Connected Integrations</h3>
            <p className="text-sm text-slate-500">Manage external connections such as Microsoft Teams and SharePoint.</p>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              Microsoft Teams Bot & SharePoint Excel Sync are currently active.
            </div>
          </div>
        );
      case 'permissions':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Role Permissions & Access Control</h3>
            <p className="text-sm text-slate-500">Configure role-based access for Admin, Manager, and Employee tiers.</p>
          </div>
        );
      case 'pm_config':
        return <PMConfigurationPage />;
      default:
        return <div>Tab not found</div>;
    }
  };

  return (
    <SettingsLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTabContent()}
    </SettingsLayout>
  );
}

