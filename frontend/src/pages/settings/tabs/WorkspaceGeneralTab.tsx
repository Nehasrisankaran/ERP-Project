import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../stores/authStore';
import { orgApi } from '../../../services/api';
import { Button, Spinner } from '../../../components/ui';

export default function WorkspaceGeneralTab() {
  const { user } = useAuthStore();
  const orgId = user?.organization_id;
  
  const { data: orgData, isLoading } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const res = await orgApi.get(orgId);
      return res.data;
    },
    enabled: !!orgId
  });

  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    website: '',
  });

  useEffect(() => {
    if (orgData) {
      setFormData({
        name: orgData.name || '',
        industry: orgData.industry || '',
        website: orgData.website || '',
      });
    }
  }, [orgData]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!orgId) return;
    try {
      setSaving(true);
      await orgApi.update(orgId, formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      alert('Failed to save organization details');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="py-12 flex justify-center"><Spinner className="w-8 h-8" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Workspace General Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Configure your organization identity and defaults.</p>
      </div>

      <div className="border-t border-slate-200 pt-6 space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Organization Identity</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Company Name</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition-all"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Industry</label>
            <input 
              type="text" 
              value={formData.industry}
              onChange={e => setFormData({ ...formData, industry: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Website</label>
            <input 
              type="url" 
              value={formData.website}
              onChange={e => setFormData({ ...formData, website: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition-all"
              placeholder="https://"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6 flex items-center justify-end gap-3">
        {saved && <span className="text-sm font-medium text-emerald-600 mr-2">Changes saved</span>}
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={!formData.name.trim()}>Save Changes</Button>
      </div>
    </div>
  );
}
