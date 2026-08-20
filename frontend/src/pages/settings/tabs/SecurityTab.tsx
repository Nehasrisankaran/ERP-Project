import { useState } from 'react';
import { Button } from '../../../components/ui';

export default function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handlePasswordChange = () => {
    alert("Password change functionality would connect to an auth endpoint.");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Security</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your password and security settings.</p>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Change Password</h3>
        <div className="max-w-md space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Current Password</label>
            <input 
              type="password" 
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">New Password</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition-all"
            />
          </div>
          <div className="pt-2">
            <Button variant="primary" disabled={!currentPassword || !newPassword} onClick={handlePasswordChange}>
              Change Password
            </Button>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Two-Factor Authentication</h3>
            <p className="text-xs text-slate-500 mt-1">Status: Not configured</p>
          </div>
          <Button variant="secondary" size="sm">Enable 2FA</Button>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Active Sessions</h3>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Current Session</p>
              <p className="text-xs text-slate-500 mt-0.5">Windows • Chrome • Active now</p>
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">This device</span>
          </div>
        </div>
        <div className="mt-4">
          <Button variant="secondary" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300">
            Sign out all other sessions
          </Button>
        </div>
      </div>
    </div>
  );
}
