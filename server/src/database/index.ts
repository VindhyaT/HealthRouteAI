import '../env';
import { Pool } from 'pg';
import { departments, Service, Department } from './demoData';
import { rankServices, relevance, serviceRelevance } from '../services/directorySearch';

export const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
export const usingDemoData = !pool;
export async function initializeDatabase() { if (pool) await (await import('./migrate.js')).migrate(); }
export async function searchServices(query = ''): Promise<Service[]> {
  const services: Service[] = pool
    ? (await pool.query(`SELECT s.*, s.appointment_info AS "appointmentInfo", d.name AS department,
      COALESCE((SELECT json_agg(json_build_object('id', a.id, 'title', a.title, 'instructions', a.instructions, 'appointment_recommended', a.appointment_recommended, 'how_to_schedule', a.how_to_schedule, 'documents_to_bring', a.documents_to_bring, 'arrival_guidance', a.arrival_guidance, 'is_demo', a.is_demo) ORDER BY a.title)
        FROM appointment_guidance a WHERE a.service_id=s.id), '[]'::json) AS "appointmentGuidance"
      FROM services s JOIN departments d ON d.id=s.department_id`)).rows
    : departments.flatMap(d => d.services);
  return rankServices(services, query);
}
export async function searchDepartments(query = '') {
  let directory: Department[] = departments;
  if (pool) {
    const [rows, services, links] = await Promise.all([
      pool.query('SELECT * FROM departments ORDER BY name'),
      searchServices(),
      pool.query('SELECT dl.department_id,l.* FROM department_locations dl JOIN locations l ON l.id=dl.location_id ORDER BY l.name')
    ]);
    directory = rows.rows.map(d => ({ ...d, services: services.filter(s => s.department === d.name), locations: links.rows.filter(l => l.department_id === d.id) }));
  }
  return directory.map(department => {
    const matches = query.trim() ? rankServices(department.services, query) : [];
    const score = Math.max(relevance(query, department.name, department.description), ...matches.map(s => serviceRelevance(s, query)));
    return { department: { ...department, services: [...matches, ...department.services.filter(s => !matches.includes(s))], matchingServiceIds: matches.map(s => s.id) }, score };
  }).filter(item => !query.trim() || item.score > 0)
    .sort((a, b) => b.score - a.score || a.department.name.localeCompare(b.department.name))
    .map(item => item.department);
}
