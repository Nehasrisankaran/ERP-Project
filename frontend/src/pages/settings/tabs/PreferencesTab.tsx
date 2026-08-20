import { useState, useEffect } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { authApi } from '../../../services/api';
import { Button } from '../../../components/ui';

export default function PreferencesTab() {
  const { user, setUser } = useAuthStore();
  
  // Need to parse preferences from user object, or use defaults
  const [preferences, setPreferences] = useState({
    theme: 'system',
    density: 'comfortable',
    defaultLandingPage: 'home',
    defaultTaskView: 'board',
  });

  useEffect(() => {
    if (user && (user as any).preferences) {
      setPreferences((user as any).preferences);
    }
  }, [user]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await authApi.updateMe({ preferences });
      setUser(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePref = (key: string, val: string) => {
    setPreferences(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Preferences</h2>
        <p className="text-sm text-slate-500 mt-1">Control your personal WORKMATE experience.</p>
      </div>

      <div className="border-t border-slate-200 pt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Appearance</h3>
            <div className="flex bg-slate-100 p-1 rounded-lg w-max">
              {['light', 'dark', 'system'].map(t => (
                <button
                  key={t}
                  onClick={() => updatePref('theme', t)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${preferences.theme === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Density</h3>
            <div className="flex bg-slate-100 p-1 rounded-lg w-max">
              {['comfortable', 'compact'].map(d => (
                <button
                  key={d}
                  onClick={() => updatePref('density', d)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${preferences.density === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Default Landing Page</h3>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={preferences.defaultLandingPage === 'home'} onChange={() => updatePref('defaultLandingPage', 'home')} className="text-violet-600 focus:ring-violet-500" />
                <span className="text-sm text-slate-700">Home</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={preferences.defaultLandingPage === 'my_work'} onChange={() => updatePref('defaultLandingPage', 'my_work')} className="text-violet-600 focus:ring-violet-500" />
                <span className="text-sm text-slate-700">My Work</span>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Default Task View</h3>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={preferences.defaultTaskView === 'list'} onChange={() => updatePref('defaultTaskView', 'list')} className="text-violet-600 focus:ring-violet-500" />
                <span className="text-sm text-slate-700">List</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={preferences.defaultTaskView === 'board'} onChange={() => updatePref('defaultTaskView', 'board')} className="text-violet-600 focus:ring-violet-500" />
                <span className="text-sm text-slate-700">Board (Kanban)</span>
              </label>
            </div>
          </div>

        </div>
      </div>

      <div className="border-t border-slate-200 pt-6 flex items-center justify-end gap-3">
        {saved && <span className="text-sm font-medium text-emerald-600 mr-2">Preferences saved</span>}
        <Button 
          variant="primary" 
          onClick={handleSave} 
          loading={saving}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
