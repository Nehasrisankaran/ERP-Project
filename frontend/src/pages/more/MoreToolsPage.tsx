import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { Spinner } from '../../components/ui';
import {
  MessageSquare,
  History,
  Activity,
  FileSpreadsheet,
  Settings,
  Wrench,
} from 'lucide-react';

export default function MoreToolsPage() {
  const [activeTab, setActiveTab] = useState<
    'teams_replies' | 'reminder_history' | 'activity_log' | 'excel_viewer' | 'pm_config'
  >('teams_replies');

  const { data: repliesData, isLoading: repliesLoading } = useQuery({
    queryKey: ['pmTeamsReplies'],
    queryFn: async () => (await projectManagerService.getTeamsReplies()).data,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['pmReminderHistory'],
    queryFn: async () => (await projectManagerService.getReminderHistory()).data,
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['pmActivityLog'],
    queryFn: async () => (await projectManagerService.getActivityLog()).data,
  });

  const { data: excelData, isLoading: excelLoading } = useQuery({
    queryKey: ['pmExcelData'],
    queryFn: async () => (await projectManagerService.getExcelData()).data,
  });

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['pmConfig'],
    queryFn: async () => (await projectManagerService.getConfig()).data,
  });

  return (
    <div className="w-full px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="p-2 bg-violet-50 text-violet-700 rounded-lg">
          <Wrench size={20} />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">More Tools & Utilities</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Teams bot interactions, reminder logs, background activity, Excel inspection, and Project Manager configuration.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { key: 'teams_replies', label: 'Teams Replies', icon: <MessageSquare size={15} /> },
          { key: 'reminder_history', label: 'Reminder History', icon: <History size={15} /> },
          { key: 'activity_log', label: 'Activity Log', icon: <Activity size={15} /> },
          { key: 'excel_viewer', label: 'Excel Viewer', icon: <FileSpreadsheet size={15} /> },
          { key: 'pm_config', label: 'PM Configuration', icon: <Settings size={15} /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all ${
              activeTab === tab.key
                ? 'bg-violet-50 text-violet-700 border-b-2 border-violet-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {activeTab === 'teams_replies' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-4">Teams Bot Replies</h3>
            {repliesLoading ? <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div> : (
              <pre className="text-xs bg-slate-50 p-5 rounded-xl border border-slate-100 overflow-x-auto text-slate-700 font-mono leading-relaxed">
                {JSON.stringify(repliesData, null, 2)}
              </pre>
            )}
          </div>
        )}

        {activeTab === 'reminder_history' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-4">Reminder Execution Log</h3>
            {historyLoading ? <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div> : (
              <pre className="text-xs bg-slate-50 p-5 rounded-xl border border-slate-100 overflow-x-auto text-slate-700 font-mono leading-relaxed">
                {JSON.stringify(historyData, null, 2)}
              </pre>
            )}
          </div>
        )}

        {activeTab === 'activity_log' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-4">System Activity Audit Trail</h3>
            {activityLoading ? <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div> : (
              <pre className="text-xs bg-slate-50 p-5 rounded-xl border border-slate-100 overflow-x-auto text-slate-700 font-mono leading-relaxed">
                {JSON.stringify(activityData, null, 2)}
              </pre>
            )}
          </div>
        )}

        {activeTab === 'excel_viewer' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-4">SharePoint Excel Sheet Raw Data</h3>
            {excelLoading ? <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div> : (
              <pre className="text-xs bg-slate-50 p-5 rounded-xl border border-slate-100 overflow-x-auto text-slate-700 font-mono leading-relaxed">
                {JSON.stringify(excelData, null, 2)}
              </pre>
            )}
          </div>
        )}

        {activeTab === 'pm_config' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-4">Project Manager Bot Settings</h3>
            {configLoading ? <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div> : (
              <pre className="text-xs bg-slate-50 p-5 rounded-xl border border-slate-100 overflow-x-auto text-slate-700 font-mono leading-relaxed">
                {JSON.stringify(configData, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

