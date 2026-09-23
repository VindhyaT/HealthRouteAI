// Administrative directory synonyms, not symptom triage or medical advice.
const preferredNames = ['radiology', 'cardiology', 'physical therapy', 'laboratory', 'dermatology', 'urgent care', 'orthopedics'];
const concepts = [
  ['xray', 'radiology', 'diagnostic imaging'],
  ['heart doctor', 'heart specialist', 'cardiologist', 'cardiology', 'heart'],
  ['physical therapy', 'physiotherapy', 'physio', 'rehabilitation', 'rehab'],
  ['blood test', 'blood tests', 'blood work', 'bloodwork', 'laboratory', 'lab'],
  ['skin doctor', 'skin specialist', 'dermatologist', 'dermatology', 'skin'],
  ['urgent care', 'walk in', 'same day'],
  ['bone doctor', 'bone specialist', 'orthopedics', 'orthopaedics', 'orthopedist', 'orthopaedist'],
];
export function normalizeSearch(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/x[\s‐‑–—-]*rays?\b/g, 'xray').replace(/[^a-z0-9]+/g, ' ').trim();
}
const stopWords = new Set('i a an the need want find looking for where can is are me my to get book appointment please doctor specialist'.split(' '));
function contains(text: string, term: string) { return ` ${text} `.includes(` ${term} `); }
export function relevance(query: string, name: string, description = '', tags: string[] = []) {
  const q = normalizeSearch(query);
  if (!q) return 0;
  const title = normalizeSearch(name);
  const text = normalizeSearch([name, description, ...tags].join(' '));
  let score = title === q ? 200 : contains(title, q) ? 140 : contains(text, q) ? 80 : 0;
  for (const [index, group] of concepts.entries()) {
    if (group.some(term => contains(q, term)) && group.some(term => contains(text, term))) {
      score += 100;
      if (contains(title, preferredNames[index])) score += 60;
    }
  }
  const words = q.split(' ').filter(word => !stopWords.has(word));
  if (words.length && words.every(word => text.split(' ').some(token => token.startsWith(word)))) {
    score += 30 + words.filter(word => title.includes(word)).length * 10;
  }
  return score;
}
type SearchableService = { name: string; description: string; department: string; tags: string[] };
export function serviceRelevance(service: SearchableService, query: string) {
  const normalizedQuery = normalizeSearch(query);
  const department = normalizeSearch(service.department);
  const preferredDepartment = concepts.some((group, index) =>
    group.some(term => contains(normalizedQuery, term)) && contains(department, preferredNames[index]));
  return relevance(query, service.name, `${service.department} ${service.description}`, service.tags)
    + relevance(query, service.department) * 0.2 + (preferredDepartment ? 80 : 0);
}
export function rankServices<T extends SearchableService>(services: T[], query: string) {
  const searching = Boolean(query.trim());
  return services.map(service => ({ service, score: serviceRelevance(service, query) }))
    .filter(item => !searching || item.score > 0)
    .sort((a, b) => b.score - a.score || a.service.name.localeCompare(b.service.name))
    .map(item => item.service);
}
