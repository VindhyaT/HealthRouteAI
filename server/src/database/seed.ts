import '../env';
import bcrypt from 'bcryptjs';
import { pool } from '.';
import { demoAppointmentGuidance } from '../models/appointmentGuidance';
import { departments, locations, faqs } from './demoData';

async function seed() {
  if (!pool) throw new Error('DATABASE_URL is required to seed PostgreSQL. Run docker compose up -d postgres first.');
  const client = await pool.connect();
  try {
  await client.query('BEGIN');
  const password = await bcrypt.hash('DemoPass123!', 12);
  await client.query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role', ['Admin User', 'admin@healthroute.local', password, 'admin']);

  await client.query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING', ['Demo Patient', 'patient@healthroute.local', password, 'patient']);

  const departmentIds = new Map<string, string>();
  for (const department of departments) {
    const result = await client.query(`INSERT INTO departments(name,description,icon) VALUES($1,$2,$3) ON CONFLICT(name) DO UPDATE SET description=EXCLUDED.description, icon=EXCLUDED.icon RETURNING id`, [department.name, department.description, department.icon]);
    departmentIds.set(department.name, result.rows[0].id);
  }

  const locationIds = new Map<string, string>();
  for (const location of locations) {
    const result = await client.query(`INSERT INTO locations(name,address,phone,hours) VALUES($1,$2,$3,$4) ON CONFLICT(name) DO UPDATE SET address=EXCLUDED.address, phone=EXCLUDED.phone, hours=EXCLUDED.hours RETURNING id`, [location.name, location.address, location.phone, location.hours]);
    locationIds.set(location.name, result.rows[0].id);
  }

  for (const department of departments) {
    const departmentId = departmentIds.get(department.name)!;
    for (const service of department.services) {
      const result = await client.query(`INSERT INTO services(department_id,name,description,appointment_info,tags) VALUES($1,$2,$3,$4,$5) ON CONFLICT(department_id,name) DO UPDATE SET description=EXCLUDED.description, appointment_info=EXCLUDED.appointment_info, tags=EXCLUDED.tags RETURNING id`, [departmentId, service.name, service.description, service.appointmentInfo, service.tags]);
      const serviceId = result.rows[0].id;
      const guidance = demoAppointmentGuidance(service);
      await client.query(`INSERT INTO appointment_guidance(service_id,title,instructions,referral_required,booking_url,appointment_recommended,how_to_schedule,documents_to_bring,arrival_guidance,is_demo)
        VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8,TRUE)
        ON CONFLICT(service_id,title) DO UPDATE SET instructions=EXCLUDED.instructions, referral_required=EXCLUDED.referral_required,
          booking_url=EXCLUDED.booking_url, appointment_recommended=EXCLUDED.appointment_recommended, how_to_schedule=EXCLUDED.how_to_schedule,
          documents_to_bring=EXCLUDED.documents_to_bring, arrival_guidance=EXCLUDED.arrival_guidance, is_demo=EXCLUDED.is_demo`,
        [serviceId, guidance.title, guidance.instructions, false, guidance.appointment_recommended, guidance.how_to_schedule, guidance.documents_to_bring, guidance.arrival_guidance]);
    }
    for (const location of department.locations) {
      const locationId = locationIds.get(location.name);
      if (locationId) await client.query('INSERT INTO department_locations(department_id,location_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [departmentId, locationId]);
    }
  }

  for (const faq of faqs) await client.query('INSERT INTO faqs(question,answer) VALUES($1,$2) ON CONFLICT(question) DO UPDATE SET answer=EXCLUDED.answer', [faq.question, faq.answer]);
  await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  console.log(`Database seeded: ${departments.length} departments, ${departments.flatMap(department => department.services).length} services, ${locations.length} locations.`);
  console.log('Patient login: patient@healthroute.local / DemoPass123!');
  console.log('Admin login: admin@healthroute.local / DemoPass123!');
}

seed().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool?.end());
