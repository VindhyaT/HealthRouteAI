import { AppointmentGuidance, Location } from '../types';

export const NAVIGATION_DISCLAIMER = 'HealthRoute AI provides healthcare navigation information, not medical advice.';
export default function AppointmentGuidancePanel({ guidance, locations = [] }: {
  guidance: AppointmentGuidance[];
  locations?: Pick<Location, 'id' | 'name' | 'address' | 'phone' | 'hours'>[];
}) {
  return <div className="appointment-guidance-panel">
    <h4>Appointment guidance</h4>
    {!guidance.length && <p>Scheduling details have not been published. Contact the listed location to confirm.</p>}
    {guidance.map(item => <section className="appointment-details" key={item.id} aria-label={item.title}>
      <strong className="guidance-title">{item.title}</strong>
      {item.is_demo && <p className="demo-administrative-label">Demo administrative information · Confirm details with the location.</p>}
      <dl>
        <dt>Appointment recommended</dt><dd>{item.appointment_recommended === true ? 'Yes — arrange a time before your visit.' : item.appointment_recommended === false ? 'No — see scheduling instructions and call to confirm availability.' : 'Not specified. Contact the location to confirm.'}</dd>
        <dt>How to schedule</dt><dd>{item.how_to_schedule || 'Contact the listed location for scheduling details.'}</dd>
        <dt>General documents to bring</dt><dd>{item.documents_to_bring?.length ? <ul>{item.documents_to_bring.map((document, i) => <li key={i}>{document}</li>)}</ul> : 'No document checklist has been published. Confirm with the scheduling team.'}</dd>
        <dt>Arrival guidance</dt><dd>{item.arrival_guidance || 'Confirm your check-in time and reception location with the scheduling team.'}</dd>
      </dl>
    </section>)}
    {!!locations.length && <div className="appointment-contact"><h4>Location, phone & hours</h4>{locations.map(location => <div key={location.id}><strong>{location.name}</strong><p>{location.address}</p><a href={`tel:${location.phone.replace(/[^+\d]/g, '')}`}>{location.phone}</a><p>Hours: {location.hours}</p></div>)}</div>}
    <p className="navigation-disclaimer">{NAVIGATION_DISCLAIMER}</p>
  </div>;
}
