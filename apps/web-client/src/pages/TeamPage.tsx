import { useEffect, useState } from 'react';
import type { TeamInviteDto, TeamMemberDto } from '@ai-consultant/shared-types';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/EmptyState';
import { extractErrorMessage } from '../lib/errors';
import {
  fetchTeamInvites,
  fetchTeamMembers,
  inviteTeamMember,
  revokeTeamInvite,
  revokeTeamMember,
} from '../lib/team';
import { useAuth } from '../lib/auth';
import { showToast } from '../components/Toast';

export function TeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMemberDto[]>([]);
  const [invites, setInvites] = useState<TeamInviteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, i] = await Promise.all([fetchTeamMembers(), fetchTeamInvites()]);
      setMembers(m);
      setInvites(i);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      await inviteTeamMember({ email: email.trim(), role: 'manager' });
      setEmail('');
      showToast('Приглашение отправлено', 'success');
      await load();
    } catch (err: unknown) {
      showToast(extractErrorMessage(err), 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (id: string) => {
    if (!confirm('Отозвать приглашение?')) return;
    try {
      await revokeTeamInvite(id);
      await load();
    } catch (err: unknown) {
      showToast(extractErrorMessage(err), 'error');
    }
  };

  const handleRevokeMember = async (id: string) => {
    if (!confirm('Отозвать доступ у сотрудника?')) return;
    try {
      await revokeTeamMember(id);
      await load();
    } catch (err: unknown) {
      showToast(extractErrorMessage(err), 'error');
    }
  };

  if (loading) return <LoadingState message="Загрузка команды…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Команда"
        description="Пригласите менеджеров для работы с CRM и чатами"
      />

      <section className="lk-card">
        <h2 className="text-lg font-semibold text-slate-900">Пригласить менеджера</h2>
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={handleInvite}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@company.ru"
            className="lk-input min-w-[240px] flex-1"
            required
          />
          <button type="submit" disabled={inviting} className="lk-btn-primary">
            {inviting ? 'Отправка…' : 'Отправить приглашение'}
          </button>
        </form>
      </section>

      {invites.length > 0 && (
        <section className="lk-card mt-6">
          <h2 className="text-lg font-semibold text-slate-900">Ожидают принятия</h2>
          <ul className="mt-4 divide-y divide-slate-100">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <span>{invite.email}</span>
                <button
                  type="button"
                  onClick={() => handleRevokeInvite(invite.id)}
                  className="text-red-600 hover:underline"
                >
                  Отозвать
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="lk-card mt-6">
        <h2 className="text-lg font-semibold text-slate-900">Участники</h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-slate-900">{member.email}</p>
                <p className="text-slate-500">
                  {member.role === 'client' ? 'Владелец' : 'Менеджер'}
                </p>
              </div>
              {member.role !== 'client' && member.id !== user?.id && (
                <button
                  type="button"
                  onClick={() => handleRevokeMember(member.id)}
                  className="text-red-600 hover:underline"
                >
                  Отозвать доступ
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
