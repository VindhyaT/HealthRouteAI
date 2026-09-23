import { pool } from '../database';
import { faqs as demoFaqs, locations as demoLocations } from '../database/demoData';
import { matchHealthcareServices } from './serviceMatching';
import { normalizeSearch } from './directorySearch';
import { unsafeGeneratedAdvice } from './navigationSafety';

export type ContextDocument = { id: string; kind: 'department' | 'service' | 'location' | 'faq' | 'appointment_guidance'; title: string; text: string };
export type NavigationContext = Awaited<ReturnType<typeof retrieveNavigationContext>>;
const noise = new Set('i a an the need want find looking for where can is are me my to get book please doctor specialist what which should go performs department service services how do does at of in with it'.split(' '));
function keywords(question: string) { return [...new Set(normalizeSearch(question).split(' ').filter(word => word.length > 1 && !noise.has(word)))].slice(0, 24); }

export async function retrieveNavigationContext(question: string) {
  const recommendations = (await matchHealthcareServices(question)).filter(match =>
    !unsafeGeneratedAdvice([match.department.name, match.department.description, match.service.name, match.service.description,
      match.service.appointmentInfo, ...match.appointmentGuidance.map(a => `${a.title} ${a.instructions} ${a.how_to_schedule || ''} ${a.arrival_guidance || ''} ${(a.documents_to_bring || []).join(' ')}`)].join(' ')));

  const words = keywords(question);
  const tsQuery = words.join(' | '); // normalized alphanumeric lexemes, always passed as a SQL parameter
  const [faqs, locations] = pool && words.length ? await Promise.all([
    pool.query(`SELECT id,question,answer FROM faqs WHERE to_tsvector('english', question || ' ' || answer) @@ to_tsquery('english',$1)
      ORDER BY ts_rank_cd(to_tsvector('english',question || ' ' || answer),to_tsquery('english',$1)) DESC, question LIMIT 3`, [tsQuery]).then(r => r.rows as { id: string; question: string; answer: string }[]),
    pool.query(`SELECT id,name,address,phone,hours FROM locations WHERE to_tsvector('english',name || ' ' || address) @@ to_tsquery('english',$1)
      ORDER BY ts_rank_cd(to_tsvector('english',name || ' ' || address),to_tsquery('english',$1)) DESC, name LIMIT 3`, [tsQuery]).then(r => r.rows as typeof demoLocations)
  ]) : pool ? [[], []] : [
    demoFaqs.filter(f => words.some(word => normalizeSearch(f.question + ' ' + f.answer).split(' ').includes(word))).slice(0, 3),
    demoLocations.filter(l => words.some(word => normalizeSearch(l.name + ' ' + l.address).split(' ').includes(word))).slice(0, 3)
  ];
  const documents: ContextDocument[] = [];
  let contextCharacters = 0;
  function add(kind: ContextDocument['kind'], id: string, title: string, text: string) {
    const sourceId = `${kind}:${id}`;
    if (documents.some(d => d.id === sourceId) || documents.length >= 24) return;
    const limitedText = text.slice(0, 1600);
    if (unsafeGeneratedAdvice(title + ' ' + limitedText) || contextCharacters + limitedText.length + title.length > 20000) return;
    documents.push({ id: sourceId, kind, title: title.slice(0, 200), text: limitedText });
    contextCharacters += limitedText.length + title.length;
  }
  for (const match of recommendations) {
    add('department', match.department.id, match.department.name, match.department.description);
    add('service', match.service.id, match.service.name, `Department: ${match.department.name}. ${match.service.description} Appointment information: ${match.service.appointmentInfo}`);
    for (const l of match.locations.slice(0, 3)) add('location', l.id, l.name, `Department: ${match.department.name}. Address: ${l.address}. Phone: ${l.phone}. Hours: ${l.hours}.`);
    for (const a of match.appointmentGuidance.slice(0, 3)) add('appointment_guidance', a.id, a.title, `${a.is_demo ? 'Demo administrative information only. ' : ''}${a.instructions} Appointment recommended: ${a.appointment_recommended === true ? 'yes' : a.appointment_recommended === false ? 'no; confirm walk-in availability' : 'not specified'}. How to schedule: ${a.how_to_schedule || 'not published'}. Documents to bring: ${(a.documents_to_bring || []).join('; ') || 'not published'}. Arrival: ${a.arrival_guidance || 'not published'}.`);
  }
  for (const f of faqs) add('faq', f.id, f.question, f.answer);
  for (const l of locations) add('location', l.id, l.name, `Address: ${l.address}. Phone: ${l.phone}. Hours: ${l.hours}.`);
  return { recommendations, documents };
}
export function localNavigationAnswer(context: NavigationContext) {
  const best = context.recommendations[0];
  if (best) {
    const location = best.locations[0];
    return `You can contact ${best.department.name} for ${best.service.name}. ${location ? `${location.name} is at ${location.address}. Call ${location.phone}. Hours: ${location.hours}. ` : 'Contact details have not been published yet. '}${best.appointmentGuidance[0]?.instructions || best.service.appointmentInfo}`;
  }
  const document = context.documents.find(d => d.kind === 'faq') || context.documents.find(d => d.kind === 'location');
  return document ? `${document.title}: ${document.text}` : 'No matching service was found. Try a service or department such as heart doctor, X-ray, skin doctor, blood test, rehab, or bone doctor.';
}
