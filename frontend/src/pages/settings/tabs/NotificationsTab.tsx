import { useState, useEffect } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { authApi } from '../../../services/api';
import { Button } from '../../../components/ui';

const NOTIF_CATEGORIES = [
  {
    title: 'TASKS',
    items: [
      { id: 'task_assigned', label: 'Task assigned to me' },
      { id: 'task_due_soon', label: 'Task due soon' },
      { id: 'task_overdue', label: 'Task overdue' },
      { id: 'task_status_changed', label: 'Task status changed' },
    ]
  },
  {
    title: 'PROJECTS',
    items: [
      { id: 'project_updates', label: 'Project updates' },
      { id: 'project_deadline', label: 'Project deadline approaching' },
    ]
  }
];

export default function NotificationsTab() {
  const { user, setUser } = useAuthStore();
  
  // default all to true
  const [notifs, setNotifs] = useState<Record<string, { inApp: boolean, email: boolean }>>({});

  useEffect(() => {
    const prefs = (user as any)?.preferences?.notifications || {};
    const defaultNotifs: any = {};
    NOTIF_CATEGORIES.forEach(cat => {
      cat.items.forEach(item => {
        defaultNotifs[item.id] = prefs[item.id] || { inApp: true, email: true };
      });
    });
    setNotifs(defaultNotifs);
  }, [user]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const currentPrefs = (user as any)?.preferences || {};
      const res = await authApi.updateMe({ preferences: { ...currentPrefs, notifications: notifs } });
      setUser(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      alert('Failed to save notifications');
    } finally {
      setSaving(false);
    }
  };

  const toggleNotif = (id: string, channel: 'inApp' | 'email') => {
    setNotifs(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [channel]: !prev[id][channel]
      }
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Notifications</h2>
        <p className="text-sm text-slate-500 mt-1">Control how and when you receive alerts.</p>
      </div>

      <div className="space-y-8">
        {NOTIF_CATEGORIES.map((cat) => (
          <div key={cat.title} className="border-t border-slate-200 pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">{cat.title}</h3>
            
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {cat.items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-4">
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notifs[item.id]?.inApp || false} 
                        onChange={() => toggleNotif(item.id, 'inApp')}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-xs font-medium text-slate-600">In-App</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notifs[item.id]?.email || false} 
                        onChange={() => toggleNotif(item.id, 'email')}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-xs font-medium text-slate-600">Email</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 pt-6 flex items-center justify-end gap-3">
        {saved && <span className="text-sm font-medium text-emerald-600 mr-2">Notifications saved</span>}
        <Button variant="primary" onClick={handleSave} loading={saving}>Save Changes</Button>
      </div>
    </div>
  );
}
