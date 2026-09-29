import { ChevronDown, Clock3, MapPin, Phone } from 'lucide-react';
import { useApiData } from '../hooks/useApiData';
import { Location } from '../types';
import { LoadingState } from './LoadingState';

export function LocationsSection() {
  const { data, loading, error, retry } = useApiData<{ locations: Location[] }>('/locations');
  return <section className="locations section" id="locations" aria-labelledby="locations-heading">
    <div className="section-heading"><div><span className="eyebrow">LOCATIONS & CONTACT</span><h2 id="locations-heading">Find a convenient location.</h2></div><p>Addresses, phone numbers, and hours in one place.</p></div>
    {loading ? <LoadingState label="Loading locations..."/> : error ? <div className="feedback-error" role="alert"><h3>Locations are unavailable.</h3><p>{error}</p><button className="secondary-button" onClick={retry}>Try again</button></div> : !data?.locations.length ? <div className="content-empty"><MapPin aria-hidden="true" size={26}/><h3>No locations published yet</h3><p>Clinic details will appear here when they are available.</p></div> : <div className="location-grid">{data.locations.map(location => <article className="location-card" key={location.id}>
      <div className="location-top"><span className="location-icon"><MapPin aria-hidden="true" size={22}/></span></div><h3>{location.name}</h3><p>{location.address}</p><div className="location-detail"><Clock3 aria-hidden="true" size={16}/><span>{location.hours}</span></div>
      {location.services.length > 0 && <div className="location-service-tags">{location.services.slice(0, 3).map(name => <span key={name}>{name}</span>)}</div>}
      <a href={`tel:${location.phone.replace(/[^+\d]/g, '')}`} className="phone-link"><Phone aria-hidden="true" size={16}/>{location.phone}</a>
    </article>)}</div>}
  </section>;
}
export function FaqSection() {
  const { data, loading, error, retry } = useApiData<{ faqs: { id: string; question: string; answer: string }[] }>('/faqs');
  return <section className="faq-band section" id="faqs" aria-labelledby="faq-heading"><div><span className="eyebrow">HERE TO HELP</span><h2 id="faq-heading">Common questions.</h2><p className="section-description">A little information can make your next step easier.</p></div><div className="faq-list">
    {loading ? <LoadingState label="Loading frequently asked questions..."/> : error ? <div className="feedback-error" role="alert"><h3>Questions are unavailable.</h3><p>{error}</p><button className="secondary-button" onClick={retry}>Try again</button></div> : !data?.faqs.length ? <div className="content-empty"><h3>No questions published yet</h3><p>Please check back for helpful navigation information.</p></div> : data.faqs.map(faq => <details key={faq.id}><summary>{faq.question}<ChevronDown aria-hidden="true" size={18}/></summary><p>{faq.answer}</p></details>)}
  </div></section>;
}
