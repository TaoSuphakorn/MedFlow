import { useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { api, ApiError, csrf, resetCsrf, type User } from '../lib/api';
import { onSessionChange } from '../lib/session-events';

export function useSessionSync(client: QueryClient, onIdentityChange: () => void) {
  const change = useRef(onIdentityChange);
  change.current = onIdentityChange;
  const retry = useRef<() => void>(() => {});
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let disposed = false,
      active = false,
      pending = false;
    async function reconcile() {
      if (active) {
        pending = true;
        return;
      }
      active = true;
      setChecking(true);
      setError(null);
      try {
        do {
          pending = false;
          let fresh: User | null;
          try {
            fresh = await api<User>('/auth/me');
          } catch (failure) {
            if (failure instanceof ApiError && failure.status === 401) fresh = null;
            else throw failure;
          }
          if (disposed) return;
          const previous = client.getQueryData<User | null>(['me']);
          if (previous?.userId !== fresh?.userId || previous?.role !== fresh?.role) {
            await client.cancelQueries();
            if (disposed) return;
            client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
            resetCsrf();
            change.current();
            await csrf();
          }
          if (disposed) return;
          client.setQueryData(['me'], fresh);
        } while (pending && !disposed);
      } catch (failure) {
        if (!disposed)
          setError(
            failure instanceof Error ? failure : new Error('Unable to verify your session.'),
          );
      } finally {
        active = false;
        if (!disposed) setChecking(false);
      }
    }
    const onFocus = () => {
      void reconcile();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reconcile();
    };
    const unsubscribe = onSessionChange(onFocus);
    retry.current = onFocus;
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [client]);
  return { checking, error, retry: () => retry.current() };
}
