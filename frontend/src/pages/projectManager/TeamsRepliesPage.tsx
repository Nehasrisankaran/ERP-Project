import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { MessageSquare, AlertTriangle, Eye } from 'lucide-react';

export default function TeamsRepliesPage() {
  const [selectedReply, setSelectedReply] = useState<any | null>(null);

  const { data: repliesRes, isLoading, error, refetch } = useQuery({
    queryKey: ['pmTeamsReplies'],
    queryFn: () => projectManagerService.getTeamsReplies().then((res) => res.data),
  });

  const replies = repliesRes?.history || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Teams Replies History</h1>
          <p className="text-sm text-slate-500">Recorded responses from Microsoft Teams bot reminder DMs</p>
        </div>
        <button
          onClick={() => refetch()}
          className="self-start md:self-auto px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-medium text-sm rounded-lg shadow-sm"
        >
          Refresh History
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4 mx-auto"></div>
          <div className="h-4 bg-slate-200 rounded w-1/3 mx-auto"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-semibold mb-2">Unable to load replies.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : replies.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <MessageSquare size={40} className="text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Teams replies recorded yet</h3>
          <p className="text-sm text-slate-500">Replies sent by employees over Teams will appear here automatically.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Reply Excerpt</th>
                  <th className="py-3.5 px-4">Replied At</th>
                  <th className="py-3.5 px-4">SharePoint Written</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {replies.map((r: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{r.assignee}</td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs font-mono">{r.email}</td>
                    <td className="py-3.5 px-4 text-slate-800 max-w-md truncate">{r.reply_text}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-xs">{r.replied_at || '-'}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          r.sharepoint_written ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.sharepoint_written ? 'Written' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedReply(r)}
                        className="text-xs text-violet-600 hover:text-violet-800 font-semibold px-2 py-1 hover:bg-violet-50 rounded transition-colors flex items-center gap-1 ml-auto"
                      >
                        <Eye size={14} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedReply && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-600">Teams Reply Detail</span>
                <button
                  onClick={() => setSelectedReply(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1 rounded-md"
                >
                  ✕ Close
                </button>
              </div>

              <h2 className="text-lg font-bold text-slate-900 mb-1">{selectedReply.assignee}</h2>
              <p className="text-xs text-slate-500 font-mono mb-4">{selectedReply.email}</p>

              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-slate-500 font-medium block mb-1">Replied At</span>
                  <div className="font-mono text-slate-800 text-xs">{selectedReply.replied_at || '-'}</div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block mb-1">SharePoint Write-Back Status</span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ${
                      selectedReply.sharepoint_written ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedReply.sharepoint_written ? 'Success' : 'Not Written'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block mb-1">Full Reply Message</span>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 leading-relaxed font-sans">
                    {selectedReply.reply_text}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedReply(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
