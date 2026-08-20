import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../stores/authStore';
import { orgApi } from '../../services/api';
import { Avatar, Badge, Spinner, EmptyState, Modal, PageShell, PageHeader, Button, Input } from '../../components/ui';
import type { Team, Employee } from '../../types';
import { UsersRound, Mail, Briefcase, Search, UserCheck, Plus, Trash2, UserPlus, AlertCircle } from 'lucide-react';

export default function TeamsPage() {
  const { orgId, user } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEmployeeToAdd, setSelectedEmployeeToAdd] = useState<string>('');

  // New team form state
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');

  const isManagerOrAdmin = ['admin', 'super_admin', 'manager'].includes(user?.role || '');

  // ── Queries ──────────────────────────────────────────────
  const { data: rawTeams, isLoading } = useQuery<Team[]>({
    queryKey: ['teams', orgId],
    queryFn: async () => {
      const r = await orgApi.teams(orgId!);
      return Array.isArray(r.data) ? r.data : [];
    },
    enabled: !!orgId,
  });

  const { data: rawEmployees = [] } = useQuery<Employee[]>({
    queryKey: ['employees', orgId],
    queryFn: async () => {
      const r = await orgApi.employees(orgId!);
      return Array.isArray(r.data) ? r.data : [];
    },
    enabled: !!orgId,
  });

  const teams = Array.isArray(rawTeams) ? rawTeams : [];

  // Sync selectedTeam with fresh query data if open
  const currentTeam = teams.find(t => t.id === selectedTeam?.id) || selectedTeam;

  // ── Mutations ────────────────────────────────────────────
  const createTeamMutation = useMutation({
    mutationFn: async () => {
      return await orgApi.createTeam({
        name: newTeamName,
        description: newTeamDesc || null,
        organization_id: orgId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', orgId] });
      setIsCreateOpen(false);
      setNewTeamName('');
      setNewTeamDesc('');
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      return await orgApi.deleteTeam(teamId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', orgId] });
      setSelectedTeam(null);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ teamId, empId }: { teamId: number; empId: number }) => {
      const r = await orgApi.addTeamMember(teamId, empId);
      return r.data;
    },
    onSuccess: (updatedTeam) => {
      queryClient.invalidateQueries({ queryKey: ['teams', orgId] });
      queryClient.invalidateQueries({ queryKey: ['employees', orgId] });
      setSelectedTeam(updatedTeam);
      setSelectedEmployeeToAdd('');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, empId }: { teamId: number; empId: number }) => {
      const r = await orgApi.removeTeamMember(teamId, empId);
      return r.data;
    },
    onSuccess: (updatedTeam) => {
      queryClient.invalidateQueries({ queryKey: ['teams', orgId] });
      queryClient.invalidateQueries({ queryKey: ['employees', orgId] });
      setSelectedTeam(updatedTeam);
    },
  });

  // Filter members in selected team
  const filteredMembers = currentTeam?.members?.filter(m =>
    m.full_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.designation?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email?.toLowerCase().includes(memberSearch.toLowerCase())
  ) || [];

  // Employees available to add (not currently in the team)
  const currentMemberIds = new Set(currentTeam?.members?.map(m => m.id) || []);
  const availableEmployees = rawEmployees.filter(emp => !currentMemberIds.has(emp.id));

  const handleAddMember = () => {
    if (!currentTeam || !selectedEmployeeToAdd) return;
    addMemberMutation.mutate({ teamId: currentTeam.id, empId: Number(selectedEmployeeToAdd) });
  };

  const handleRemoveMember = (empId: number) => {
    if (!currentTeam) return;
    if (confirm('Are you sure you want to remove this employee from the team?')) {
      removeMemberMutation.mutate({ teamId: currentTeam.id, empId });
    }
  };

  const handleDeleteTeam = () => {
    if (!currentTeam) return;
    if (confirm(`Are you sure you want to delete the team "${currentTeam.name}"? This action cannot be undone.`)) {
      deleteTeamMutation.mutate(currentTeam.id);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Teams"
        subtitle={`${teams.length} team${teams.length !== 1 ? 's' : ''} in your organization`}
        action={
          isManagerOrAdmin ? (
            <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} /> Create Team
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : teams.length === 0 ? (
        <EmptyState
          icon={<UsersRound size={22} />}
          title="No teams yet"
          description="Teams help organize employees around shared goals and projects."
          action={
            isManagerOrAdmin ? (
              <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
                <Plus size={16} /> Create First Team
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {teams.map(team => {
            const members = team.members || [];
            return (
              <div
                key={team.id}
                onClick={() => { setSelectedTeam(team); setMemberSearch(''); }}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-violet-200 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                      <UsersRound size={20} className="text-violet-600" />
                    </div>
                    <Badge className="bg-slate-100 text-slate-600 font-medium">
                      {members.length} member{members.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-slate-800 text-base mb-1 group-hover:text-violet-700 transition-colors">{team.name}</h3>
                  {team.description && <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">{team.description}</p>}
                </div>

                {/* Team member avatars stack */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-2">
                  <div className="flex items-center -space-x-2 overflow-hidden">
                    {members.slice(0, 4).map((m, idx) => (
                      <Avatar key={m.id || idx} name={m.full_name} size="xs" className="ring-2 ring-white" />
                    ))}
                    {members.length > 4 && (
                      <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-semibold text-slate-500">
                        +{members.length - 4}
                      </div>
                    )}
                    {members.length === 0 && <span className="text-xs text-slate-400 italic">No members assigned</span>}
                  </div>
                  <span className="text-xs text-violet-600 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    Manage Team →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Team Modal ─────────────────────────────────────── */}
      {isCreateOpen && (
        <Modal
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create New Team"
          size="md"
        >
          <div className="p-6 space-y-4">
            <Input
              label="Team Name *"
              placeholder="e.g. Core Infrastructure"
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
            />
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="What is this team responsible for?"
                value={newTeamDesc}
                onChange={e => setNewTeamDesc(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-violet-400 text-slate-800 placeholder:text-slate-400"
              />
            </div>
            {createTeamMutation.isError && (
              <p className="text-xs text-red-500 bg-red-50 p-2.5 rounded-lg flex items-center gap-1.5">
                <AlertCircle size={14} /> Failed to create team. Please try again.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!newTeamName.trim()}
                loading={createTeamMutation.isPending}
                onClick={() => createTeamMutation.mutate()}
              >
                Create Team
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Team Member Detail & Management Modal ─────────────────── */}
      {currentTeam && (
        <Modal
          open={!!currentTeam}
          onClose={() => setSelectedTeam(null)}
          title={`Team Workspace — ${currentTeam.name}`}
          size="lg"
        >
          <div className="p-6 space-y-5">
            {/* Team header description & actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">{currentTeam.name}</p>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                  {currentTeam.description || 'No description provided for this team.'}
                </p>
              </div>
              {isManagerOrAdmin && (
                <Button
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 text-xs self-start sm:self-center flex-shrink-0"
                  loading={deleteTeamMutation.isPending}
                  onClick={handleDeleteTeam}
                >
                  <Trash2 size={14} /> Delete Team
                </Button>
              )}
            </div>

            {/* Manager Action: Add Member to Team */}
            {isManagerOrAdmin && (
              <div className="bg-violet-50/50 border border-violet-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-violet-900 mb-2 flex items-center gap-1.5">
                  <UserPlus size={14} className="text-violet-600" /> Add Employee to Team
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedEmployeeToAdd}
                    onChange={e => setSelectedEmployeeToAdd(e.target.value)}
                    className="flex-1 text-sm border border-slate-200 bg-white rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    <option value="">— Select an employee to add —</option>
                    {availableEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name || 'Employee'} ({emp.designation || emp.email || 'No title'})
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="primary"
                    disabled={!selectedEmployeeToAdd}
                    loading={addMemberMutation.isPending}
                    onClick={handleAddMember}
                    className="text-xs py-2"
                  >
                    <Plus size={14} /> Add
                  </Button>
                </div>
                {availableEmployees.length === 0 && (
                  <p className="text-[11px] text-slate-400 mt-1.5 italic">
                    All employees in the organization are already members of this team.
                  </p>
                )}
              </div>
            )}

            {/* Member Search */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
              <Search size={15} className="text-slate-400" />
              <input
                type="text"
                placeholder="Search team members by name, role, email..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="text-sm text-slate-700 placeholder:text-slate-400 bg-transparent outline-none flex-1"
              />
            </div>

            {/* Member list */}
            {filteredMembers.length === 0 ? (
              <EmptyState
                icon={<UserCheck size={20} />}
                title="No members found"
                description={currentTeam.members?.length ? "No members match your search filter." : "This team currently has no members assigned."}
              />
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {filteredMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-violet-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.full_name} size="md" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{m.full_name || 'Team Member'}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Briefcase size={12} className="text-slate-400" />
                          {m.designation || 'No designation specified'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {m.email && (
                        <a href={`mailto:${m.email}`} className="text-xs text-slate-400 hover:text-violet-600 flex items-center gap-1">
                          <Mail size={12} /> {m.email}
                        </a>
                      )}
                      <Badge className="bg-green-50 text-green-700 font-medium capitalize">
                        {m.status || 'Active'}
                      </Badge>
                      {isManagerOrAdmin && (
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          title="Remove from team"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </PageShell>
  );
}
