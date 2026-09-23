import { useState } from 'react';
import { ArrowRight, Clock3, MapPin, Phone, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import AppointmentGuidancePanel from './AppointmentGuidancePanel';
import { AssistantResponse } from '../types';

export default function NavigationAssistant({ token, onLogin }: { token: string | null; onLogin: () => void }) {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [error, setError] = useState('');
  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return onLogin();
    if (loading) return;
    if (question.trim().length < 3 || question.trim().length > 500) { setQuestionError('Enter a navigation question of 3–500 characters.'); (event.currentTarget as HTMLFormElement).querySelector('textarea')?.focus(); return; }
    setQuestionError('');
    setLoading(true); setError(''); setResult(null);
    try { setResult(await api<AssistantResponse>('/assistant', { method: 'POST', body: JSON.stringify({ question }) })); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  return <section className="assistant-panel" id="assistant">
    <div className="assistant-copy"><span className="eyebrow light">NAVIGATION ASSISTANT</span><h2>Everyday words.<br/><em>A clear place to start.</em></h2><p>Try “heart doctor”, “X-ray”, “skin doctor”, “blood test”, “rehab”, or “bone doctor”. Find a service, where to go, and how to arrange your visit.</p><div className="guardrail"><ShieldCheck size={17}/><span>Navigation guidance only. No diagnosis or treatment advice.</span></div></div>
    <div className="assistant-form"><div className="spark"><Sparkles size={17}/> HealthRoute AI</div>{!token ? <div className="assistant-signin"><p>Sign in to find your recommended department and appointment details.</p><button className="light-button" onClick={onLogin}>Sign in to use the assistant <ArrowRight size={17}/></button></div> : <form noValidate onSubmit={ask}><textarea disabled={loading} required minLength={3} maxLength={500} aria-label="Your navigation question" aria-invalid={!!questionError} aria-describedby={questionError ? "question-error" : undefined} value={question} onChange={e => { setQuestion(e.target.value); setQuestionError(''); }} placeholder="For example: I’m looking for a bone doctor" rows={3}/>{questionError && <p className="form-error" id="question-error" role="alert">{questionError}</p>}<button className="light-button" disabled={loading}>{loading ? 'Finding your route...' : 'Find my route'} <ArrowRight size={17}/></button></form>}
    {loading && <p role="status">Looking up directory information and preparing your response...</p>}
    {error && <p className="form-error" role="alert">{error} Please try again.</p>}
    {result && <div className="matching-results" aria-live="polite"><p className="matching-intro">{result.answer}</p>{result.sources?.length > 0 && <details className="answer-sources"><summary>Directory sources</summary><ul>{result.sources.map(source => <li key={source.id}>{source.title}</li>)}</ul></details>}{result.recommendations.map((match, index) => <article className="recommendation-card" key={match.service.id}>
      <span className="eyebrow">{index === 0 ? 'Recommended department' : 'Another relevant service'}</span><h3>{match.department.name}</h3><h4>{match.service.name}</h4><p>{match.service.description}</p>
      <h4><MapPin size={16}/> Locations</h4>{match.locations.length ? match.locations.map(location => <div className="recommendation-location" key={location.id}><strong>{location.name}</strong><p>{location.address}</p><a href={`tel:${location.phone.replace(/[^+\d]/g, '')}`}><Phone size={14}/>{location.phone}</a><p className="recommendation-hours"><Clock3 size={14}/>{location.hours}</p></div>) : <p>Location, phone, and hours have not been published for this service yet.</p>}
      <AppointmentGuidancePanel guidance={match.appointmentGuidance}/>
    </article>)}<p className="matching-disclaimer">{result.disclaimer}</p></div>}
    </div>
  </section>;
}
