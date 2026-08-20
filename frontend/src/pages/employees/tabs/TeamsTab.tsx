import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { peopleApi } from '../../../services/api';
import { Avatar, Spinner } from '../../../components/ui';
import { cn } from '../../../utils';
import { UsersRound, ChevronRight } from 'lucide-react';

export default function TeamsTab({ empId }: { empId: number }) {
  const navigate = useNavigate();
  const { data: teams = [], isLoading } = useQuery<any[]>({
    queryKey: ['emp-teams', empId],
    queryFn: async () => { const r = await peopleApi.teams(empId); return Array.isArray(r.data) ? r.data : []; },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner className="w-8 h-8" /></div>;

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <UsersRound size={22} className="text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No teams</p>
        <p className="text-xs text-slate-400 mt-1">This employee isn't a member of any team yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {teams.map((team: any) => (
        <div key={team.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Team header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                <UsersRound size={16} className="text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{team.name}</p>
                {team.description && <p className="text-xs text-slate-400">{team.description}</p>}
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p className="font-medium text-slate-600">{team.member_count} members</p>
              {team.lead && <p>Lead: {team.lead.full_name}</p>}
            </div>
          </div>

          {/* Members */}
          <div className="divide-y divide-slate-50">
            {(team.members || []).slice(0, 5).map((m: any) => (
              <div
                key={m.id}
                onClick={() => navigate(`/people/${m.id}`)}
                className="flex items-center gap-3 px-5 py-3 hover:bg-violet-50/30 cursor-pointer group transition-colors"
              >
                <Avatar name={m.full_name} src={m.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 group-hover:text-violet-700 transition-colors truncate">{m.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">{m.designation}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('w-1.5 h-1.5 rounded-full', m.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300')} />
                  <ChevronRight size={13} className="text-slate-300 group-hover:text-violet-400 transition-colors" />
                </div>
              </div>
            ))}
            {team.member_count > 5 && (
              <div className="px-5 py-2 text-xs text-slate-400 text-center">
                +{team.member_count - 5} more members
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
