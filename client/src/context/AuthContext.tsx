import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import { api, ApiError } from '../services/api';

type AuthContextValue = {
  user: User | null; loading: boolean; signingOut: boolean; error: string;
  signIn: (user: User, token: string) => void; signOut: () => Promise<void>;
};
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const ended = () => { setUser(null); setError('Your session has ended. Please sign in again.'); };
    window.addEventListener('healthroute-session-ended', ended);
    localStorage.removeItem('healthroute_user');
    function restoreSession() {
      const token = localStorage.getItem('healthroute_token');
      setUser(null);
      if (!token) { setLoading(false); return; }
      setLoading(true);
      api<{ user: User }>('/auth/me').then(data => {
        if (active && localStorage.getItem('healthroute_token') === token) { setUser(data.user); setError(''); }
      }).catch(e => { if (active && localStorage.getItem('healthroute_token') === token) setError(e.message); })
        .finally(() => { if (active) setLoading(false); });
    }
    const storageChanged = (event: StorageEvent) => {
      if (event.key === 'healthroute_token' || event.key === null) restoreSession();
    };
    window.addEventListener('storage', storageChanged);
    restoreSession();
    return () => {
      active = false;
      window.removeEventListener('healthroute-session-ended', ended);
      window.removeEventListener('storage', storageChanged);
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('healthroute_token');
    try {
      const payload = JSON.parse(atob(token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const timer = window.setTimeout(() => {
        localStorage.removeItem('healthroute_token');
        window.dispatchEvent(new Event('healthroute-session-ended'));
      }, Math.max(0, payload.exp * 1000 - Date.now()));
      return () => clearTimeout(timer);
    } catch { localStorage.removeItem('healthroute_token'); setUser(null); }
  }, [user]);
  function signIn(next: User, token: string) { localStorage.setItem('healthroute_token', token); setUser(next); setError(''); }
  async function signOut() {
    setSigningOut(true); setError('');
    try {
      await api('/auth/logout', { method: 'POST' });
      localStorage.removeItem('healthroute_token'); setUser(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { localStorage.removeItem('healthroute_token'); setUser(null); }
      else setError('Unable to sign out. Please check your connection and try again.');
    } finally { setSigningOut(false); }
  }
  return <AuthContext.Provider value={{ user, loading, signingOut, error, signIn, signOut }}>{children}</AuthContext.Provider>;
}
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used inside AuthProvider');
  return context;
}
