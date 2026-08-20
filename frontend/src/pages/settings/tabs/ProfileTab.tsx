import { useState } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { authApi } from '../../../services/api';
import { Avatar, Button } from '../../../components/ui';

export default function ProfileTab() {
  const { user, setUser } = useAuthStore();
  
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await authApi.updateMe({ full_name: fullName });
      setUser(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Profile</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your personal information.</p>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Profile Photo</h3>
        <div className="flex items-center gap-6">
          <Avatar name={user?.full_name} size="lg" className="w-20 h-20 text-2xl" />
          <Button variant="secondary" size="sm" className="text-xs">Change Photo</Button>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Personal Information</h3>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Full Name</label>
            <input 
              type="text" 
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition-all"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              Email Address
            </label>
            <input 
              type="email" 
              value={user?.email || ''}
              disabled
              className="w-full bg-slate-50 border border-slate-200 text-slate-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">Managed by your organization.</p>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Role</label>
            <input 
              type="text" 
              value={(user?.role || '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              disabled
              className="w-full bg-slate-50 border border-slate-200 text-slate-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">Managed by your organization.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6 flex items-center justify-end gap-3">
        {saved && <span className="text-sm font-medium text-emerald-600 mr-2">Changes saved</span>}
        <Button 
          variant="primary" 
          onClick={handleSave} 
          loading={saving}
          disabled={fullName === user?.full_name || !fullName.trim()}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
