import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role, User } from '../types';
import { api, ApiError } from './api';

const ME_KEY = ['me'];

export function homeFor(role: Role): string {
  return role === 'INSTRUCTOR' ? '/teach' : role === 'ADMIN' ? '/admin' : '/';
}

export function useAuth() {
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return (await api<{ user: User }>('/auth/me')).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  function startSession(user: User | null) {
    // Drop every cached query from the previous session. Keep the "me" query itself:
    // removing it would detach mounted useAuth() observers, so they would miss the new user.
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
    queryClient.setQueryData(ME_KEY, user);
  }

  return {
    user: me.data ?? null,
    isLoading: me.isLoading,
    async login(email: string, password: string) {
      startSession((await api<{ user: User }>('/auth/login', { method: 'POST', json: { email, password } })).user);
    },
    async register(input: { name: string; email: string; password: string }) {
      startSession((await api<{ user: User }>('/auth/register', { method: 'POST', json: input })).user);
    },
    async logout() {
      await api('/auth/logout', { method: 'POST' });
      startSession(null);
    },
  };
}
