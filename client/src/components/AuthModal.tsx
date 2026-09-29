import { useEffect, useRef, useState } from 'react';
import { ArrowRight, HeartPulse, LoaderCircle, X } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { User } from '../types';

export default function AuthModal({ onAuth, onClose }: { onAuth: (user: User, token: string) => void; onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    element?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (loading) return; setError('');
    const errors: Record<string, string[]> = {};
    if (mode === 'register' && (name.trim().length < 2 || name.trim().length > 100)) errors.name = ['Enter your full name (2–100 characters).'];
    if (!email.trim()) errors.email = ['Enter your email address.'];
    else if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = ['Enter a valid email address, such as name@example.com.'];
    if (!password.trim()) errors.password = ['Enter your password.'];
    else if (mode === 'register' && password.length < 8) errors.password = ['Use at least 8 characters for your password.'];
    else if (new TextEncoder().encode(password).length > 72) errors.password = ['Use a password of at most 72 UTF-8 bytes (some characters use multiple bytes).'];
    else if (password.length > 1024) errors.password = ['Password must be 1,024 characters or fewer.'];
    setFields(errors);
    if (Object.keys(errors).length) { dialog.current?.querySelector<HTMLElement>(`[name="${Object.keys(errors)[0]}"]`)?.focus(); return; }
    setLoading(true);
    try {
      const body = mode === 'register' ? { name: name.trim(), email: email.trim(), password } : { email: email.trim(), password };
      const result = await api<{ user: User; token: string }>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) });
      onAuth(result.user, result.token);
    } catch (e) { setError((e as Error).message); if (e instanceof ApiError) setFields(e.fields || (e.status === 409 ? { email: [e.message] } : {})); }
    finally { setLoading(false); }
  }
  return <dialog ref={dialog} className="modal auth-dialog" aria-label="Account access" onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')).filter(control => !control.closest('fieldset:disabled'));
    const first = controls[0]; const last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }} onCancel={event => { event.preventDefault(); if (!loading) onClose(); }}>
    <button className="icon-button close" disabled={loading} onClick={onClose} aria-label="Close"><X aria-hidden="true" size={20}/></button><span className="auth-mark"><HeartPulse aria-hidden="true" size={26}/></span><span className="eyebrow">YOUR HEALTHROUTE ACCOUNT</span><h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2><p className="muted">Sign in for personalized service navigation and appointment information.</p>
    <form noValidate aria-label={mode === 'login' ? 'Sign in' : 'Create account'} onSubmit={submit}><fieldset disabled={loading}>
      {mode === 'register' && <label>Full name<input name="name" aria-label="Full name" aria-invalid={!!fields.name} aria-describedby={fields.name ? 'auth-name-error' : undefined} required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={e => { setName(e.target.value); setFields(current => { const next = { ...current }; delete next.name; return next; }); }} placeholder="Alex Morgan" />{fields.name && <span className="field-error" id="auth-name-error" role="alert">{fields.name.join(" ")}</span>}</label>}
      <label>Email address<input name="email" aria-label="Email address" aria-invalid={!!fields.email} aria-describedby={fields.email ? 'auth-email-error' : undefined} required maxLength={254} autoComplete="email" type="email" value={email} onChange={e => { setEmail(e.target.value); setFields(current => { const next = { ...current }; delete next.email; return next; }); }} placeholder="you@example.com" />{fields.email && <span className="field-error" id="auth-email-error" role="alert">{fields.email.join(" ")}</span>}</label>
      <label>Password<input name="password" aria-label="Password" aria-invalid={!!fields.password} aria-describedby={[fields.password ? 'auth-password-error' : '', mode === 'register' ? 'password-hint' : ''].filter(Boolean).join(' ') || undefined} required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} type="password" value={password} onChange={e => { setPassword(e.target.value); setFields(current => { const next = { ...current }; delete next.password; return next; }); }}/>{fields.password && <span className="field-error" id="auth-password-error" role="alert">{fields.password.join(" ")}</span>}</label>
      {mode === 'register' && <p className="field-hint" id="password-hint">Use at least 8 characters.</p>}
      {loading && <p role="status">Connecting to your account…</p>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary-button full" disabled={loading}>{loading ? <><LoaderCircle aria-hidden="true" size={16} className="loading-spinner"/>Connecting...</> : <>{mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight aria-hidden="true" size={16}/></>}</button>
    </fieldset></form>
    <button className="text-button" disabled={loading} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setFields({}); }}>{mode === 'login' ? 'New to HealthRoute? Create an account' : 'Already have an account? Sign in'}</button><p className="demo-hint">New accounts have patient access. Staff access is managed by your administrator.</p>
  </dialog>;
}
