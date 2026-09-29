import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, HeartPulse, LogOut, MapPin, Menu, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import AdminPage from './AdminPage';
import AuthModal from '../components/AuthModal';
import NavigationAssistant from '../components/NavigationAssistant';
import DepartmentDirectory from '../components/DepartmentDirectory';
import { FaqSection, LocationsSection } from '../components/ClinicInformation';
import { User } from '../types';

export default function HomePage() {
  const { user, loading: authLoading, signingOut, error: authError, signIn, signOut } = useAuthContext();
  const [modal, setModal] = useState(false);
  const [menu, setMenu] = useState(false);
  const [view, setView] = useState<'home' | 'admin'>('home');
  const [notice, setNotice] = useState('');
  useEffect(() => { setView(user?.role === 'admin' ? 'admin' : 'home'); }, [user?.id, user?.role]);
  useEffect(() => {
    if (view !== 'home' || !window.location.hash) return;
    const frame = requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [view]);
  useEffect(() => {
    function escape(event: KeyboardEvent) { if (event.key === 'Escape' && menu) { setMenu(false); document.querySelector<HTMLButtonElement>('.menu-button')?.focus(); } }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [menu]);
  function browse() { setMenu(false); setView('home'); }
  function authenticate(next: User, token: string) { signIn(next, token); setModal(false); setNotice(`Welcome, ${next.name}. You are signed in.`); }
  async function logout() { await signOut(); if (!localStorage.getItem('healthroute_token')) setNotice('You have been signed out successfully.'); }
  const isAdmin = view === 'admin' && user?.role === 'admin';
  return <div className="app">
    <a className="skip-link" href={isAdmin ? '#admin-main' : '#top'}>Skip to main content</a>
    <header className="topbar">
      <a className="brand" href="#top" onClick={browse} aria-label="HealthRoute AI home"><span className="brand-mark"><HeartPulse aria-hidden="true" size={23}/></span><span>HealthRoute<span className="brand-accent"> AI</span></span></a>
      <nav id="primary-navigation" aria-label="Primary navigation" className={menu ? 'nav open' : 'nav'}>
        <a href="#directory" onClick={browse}>Find care</a><a href="#assistant" onClick={browse}>Navigation assistant</a><a href="#locations" onClick={browse}>Locations</a><a href="#faqs" onClick={browse}>FAQs</a>
      </nav>
      <div className="header-actions">
        {user?.role === 'admin' && <button className="admin-link" onClick={() => { setView(isAdmin ? 'home' : 'admin'); setMenu(false); }}>{isAdmin ? 'Browse directory' : 'Admin console'}</button>}
        {user ? <button className="profile" disabled={signingOut} onClick={logout} aria-label={signingOut ? 'Signing out' : 'Sign out'}><span aria-hidden="true">{user.name.charAt(0)}</span><LogOut aria-hidden="true" size={16}/><span className="signout-label">{signingOut ? 'Signing out...' : 'Sign out'}</span></button> : <button className="sign-in" disabled={authLoading} onClick={() => setModal(true)}>{authLoading ? 'Checking session...' : 'Sign in'}</button>}
        <button className="menu-button" onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu} aria-controls="primary-navigation">{menu ? <X aria-hidden="true" size={22}/> : <Menu aria-hidden="true" size={22}/>}</button>
      </div>
    </header>
    <div className="page-shell">
      <section className="access-banner" aria-label="Account access"><div><strong>{authLoading ? 'Checking your session...' : user?.role === 'admin' ? 'Administrator workspace' : user ? 'Patient workspace' : 'Guest access'}</strong><p>{authLoading ? 'Please wait while we verify your account.' : user?.role === 'admin' ? `Welcome, ${user.name}. Manage the information patients use to find care.` : user ? `Welcome, ${user.name}. Explore services or ask the navigation assistant.` : 'Explore our directory. Sign in when you’re ready to ask the navigation assistant.'}</p></div><span className="role-badge">{user?.role === 'admin' ? 'Admin' : user ? 'Patient' : 'Public directory'}</span></section>
      {notice && <div className="success-message session-notice" role="status"><CheckCircle2 aria-hidden="true" size={18}/><span>{notice}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X aria-hidden="true" size={17}/></button></div>}
      {authError && <p className="form-error session-notice" role="alert">{authError}</p>}
      {isAdmin ? <AdminPage /> : <main id="top" tabIndex={-1}>
        <section className="hero" aria-labelledby="welcome-heading"><div className="hero-text"><span className="eyebrow">YOUR GUIDE TO LOCAL HEALTHCARE</span><h1 id="welcome-heading">The right care starts<br/>with a clear direction.</h1><p>Find a department, explore services, and get practical information for your next visit.</p><div className="hero-actions"><a className="primary-button" href="#directory"><Search aria-hidden="true" size={18}/>Find a service</a><a className="secondary-button" href="#assistant"><Sparkles aria-hidden="true" size={18}/>Ask the assistant</a></div><div className="hero-note"><ShieldCheck aria-hidden="true" size={17}/> Healthcare navigation, not medical advice.</div></div><aside className="visit-overview" aria-label="Plan your visit"><span className="eyebrow">A LITTLE CLARITY, EVERY STEP</span><h2>Plan your next visit.</h2><div><span className="overview-icon"><Search aria-hidden="true" size={20}/></span><p><strong>Find the right service</strong><small>Search by name or everyday words.</small></p></div><div><span className="overview-icon"><MapPin aria-hidden="true" size={20}/></span><p><strong>Know where to go</strong><small>Check locations, hours, and phone numbers.</small></p></div><div><span className="overview-icon"><CalendarDays aria-hidden="true" size={20}/></span><p><strong>Know what to bring</strong><small>Review published appointment guidance.</small></p></div></aside></section>
        <DepartmentDirectory />
        <NavigationAssistant key={user?.id || 'guest'} token={user ? localStorage.getItem('healthroute_token') : null} onLogin={() => setModal(true)}/>
        <LocationsSection /><FaqSection />
      </main>}
      <footer><a className="brand" href="#top" onClick={browse}><span className="brand-mark"><HeartPulse aria-hidden="true" size={19}/></span><span>HealthRoute<span className="brand-accent"> AI</span></span></a><p>Healthcare navigation information, not medical advice.</p><span>© {new Date().getFullYear()} HealthRoute AI</span></footer>
    </div>
    {modal && <AuthModal onAuth={authenticate} onClose={() => setModal(false)}/>}
  </div>;
}
