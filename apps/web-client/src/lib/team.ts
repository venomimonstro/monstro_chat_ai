import { api } from './api';
import { withRetry } from './retry';
import type {
  AcceptInviteDto,
  InviteUserDto,
  TeamInviteDto,
  TeamMemberDto,
} from '@ai-consultant/shared-types';

export async function fetchTeamMembers(): Promise<TeamMemberDto[]> {
  return withRetry(() => api.get<TeamMemberDto[]>('/team/members').then((r) => r.data));
}

export async function fetchTeamInvites(): Promise<TeamInviteDto[]> {
  return withRetry(() => api.get<TeamInviteDto[]>('/team/invites').then((r) => r.data));
}

export async function inviteTeamMember(data: InviteUserDto) {
  await api.post('/team/invites', data);
}

export async function revokeTeamInvite(id: string) {
  await api.delete(`/team/invites/${id}`);
}

export async function revokeTeamMember(id: string) {
  await api.delete(`/team/members/${id}`);
}

export async function acceptTeamInvite(data: AcceptInviteDto) {
  const res = await api.post<{ success: boolean; email: string }>(
    '/team/accept-invite',
    data,
  );
  return res.data;
}
