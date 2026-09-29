import { useEffect, useState } from 'react';
import { Activity, Accessibility, Clock3, Flower2, HeartPulse, MapPin, Phone, ScanLine, Search, Siren, Stethoscope, SunMedium, TestTube, X } from 'lucide-react';
import { api } from '../services/api';
import AppointmentGuidancePanel, { NAVIGATION_DISCLAIMER } from './AppointmentGuidancePanel';
import { Department } from '../types';

const examples = ['X-ray', 'heart doctor', 'physical therapy', 'blood test', 'skin doctor', 'urgent care'];
const icons: Record<string, typeof Stethoscope> = { 'heart-pulse': HeartPulse, activity: Activity, accessibility: Accessibility, 'scan-line': ScanLine, 'sun-medium': SunMedium, 'test-tube': TestTube, siren: Siren, 'flower-2': Flower2 };
export default function DepartmentDirectory() {
  const [query, setQuery] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      api<{ departments: Department[] }>(`/departments?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then(data => { if (!controller.signal.aborted) setDepartments(data.departments); })
        .catch(e => { if (!controller.signal.aborted) { setDepartments([]); setError(e.message); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, retry]);
  return <section className="directory section" id="directory" aria-labelledby="directory-heading">
    <div className="section-heading"><div><span className="eyebrow">HEALTHCARE SERVICE DIRECTORY</span><h2 id="directory-heading">Find the right place for care.</h2></div><p>Explore our departments, discover available services, and find a location that works for you.</p></div>
    <div className="directory-search-panel"><label htmlFor="department-search">What service are you looking for?</label><div className="search-box"><Search aria-hidden="true" size={21}/><input id="department-search" type="search" value={query} maxLength={200} onChange={e => setQuery(e.target.value)} placeholder="Search a department, service, or everyday term" aria-describedby="directory-search-help"/>{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X aria-hidden="true" size={18}/></button>}</div><div className="search-examples" id="directory-search-help"><span>Try searching:</span>{examples.map(term => <button key={term} onClick={() => setQuery(term)}>{term}</button>)}</div></div>
    <div className="directory-result-count" role="status" aria-live="polite">{loading ? 'Finding departments...' : error ? 'Directory unavailable' : `${departments.length} department${departments.length === 1 ? '' : 's'}${query.trim() ? ` matching “${query.trim()}” · Most relevant first` : ' · Browse all care services'}`}</div>
    {loading ? <div className="department-grid" aria-hidden="true">{[1, 2, 3].map(n => <div className="department-skeleton" key={n}><div/><div/><div/><div/></div>)}</div> : error ? <div className="directory-state" role="alert"><h3>We couldn’t load the directory.</h3><p>{error}</p><button className="primary-button" onClick={() => setRetry(v => v + 1)}>Try again</button></div> : !departments.length ? <div className="directory-state"><Search aria-hidden="true" size={30}/><h3>{query.trim() ? 'No matching departments found' : 'The directory is being updated'}</h3><p>{query.trim() ? 'Try a service such as X-ray, a department name, or a simpler search term.' : 'Please check back soon for available departments and services.'}</p>{query.trim() ? <button className="primary-button" onClick={() => setQuery('')}>View all departments</button> : <button className="primary-button" onClick={() => setRetry(v => v + 1)}>Refresh directory</button>}</div> : <div className="department-grid">{departments.map((department, index) => {
      const Icon = icons[department.icon] || Stethoscope;
      return <article className="department-card" key={department.id} aria-labelledby={`department-${department.id}`}>
        <div className="department-card-top"><span className="department-icon"><Icon aria-hidden="true" size={24}/></span>{query.trim() && index === 0 && <span className="best-match">Top match</span>}</div>
        <h3 id={`department-${department.id}`}>{department.name}</h3><p className="department-description">{department.description}</p>
        <div className="department-services"><h4>Available services <span>{department.services.length}</span></h4>{department.services.length ? <ul>{department.services.map(service => <li key={service.id} className={query.trim() && department.matchingServiceIds.includes(service.id) ? 'matched-service' : ''}><details><summary>{service.name}</summary><p>{service.description}</p><AppointmentGuidancePanel guidance={service.appointmentGuidance || []} locations={department.locations}/></details></li>)}</ul> : <p>Service information will be available soon.</p>}</div>
        <div className="department-locations"><h4><MapPin aria-hidden="true" size={15}/> Locations & contact</h4>{department.locations.length ? department.locations.map(location => <div className="department-location" key={location.id}><strong>{location.name}</strong><p>{location.address}</p><a href={`tel:${location.phone.replace(/[^+\d]/g, '')}`}><Phone aria-hidden="true" size={14}/><span>{location.phone}</span></a><div className="department-hours"><Clock3 aria-hidden="true" size={14}/><span>{location.hours}</span></div></div>) : <p>Location and contact details will be available soon.</p>}</div>
      </article>;
    })}</div>}
    <p className="navigation-disclaimer directory-disclaimer">{NAVIGATION_DISCLAIMER}</p>
  </section>;
}
