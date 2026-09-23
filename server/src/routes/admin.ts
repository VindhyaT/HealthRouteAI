import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../database';
import { auth, adminOnly } from '../middleware/authMiddleware';

const text = (max = 5000) => z.string().trim().min(1, 'This field is required.').max(max);
const uuid = z.string().uuid('Choose a valid related record.');
const bookingUrl = z.string().trim().max(2000).refine(value => {
  if (!value || /^\/(?![\/\\])[^\s\\]*$/.test(value)) return true;
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) && !!url.hostname && !/\s/.test(value); } catch { return false; }
}, 'Enter a valid http(s) URL or a site path starting with /.').nullable().optional();
const definitions = {
  departments: z.object({ name: text(150), description: text(), icon: text(80).default('stethoscope'), location_ids: z.array(uuid).max(100).optional() }).strict(),
  services: z.object({ department_id: uuid, name: text(150), description: text(), appointment_info: text(), tags: z.array(text(80)).max(30).default([]) }).strict(),
  locations: z.object({ name: text(150), address: text(500), phone: text(80), hours: text(500) }).strict(),
  faqs: z.object({ question: text(500), answer: text() }).strict(),
  appointment_guidance: z.object({ service_id: uuid, title: text(200), instructions: text(), referral_required: z.boolean().default(false), booking_url: bookingUrl, appointment_recommended: z.boolean().nullable().optional(), how_to_schedule: z.string().trim().max(5000).nullable().optional(), documents_to_bring: z.array(text(300)).max(20).optional(), arrival_guidance: z.string().trim().max(5000).nullable().optional(), is_demo: z.boolean().optional() }).strict()
};
export const adminRouter = Router();
adminRouter.use(auth, adminOnly);
adminRouter.get('/summary', async (_req, res, next) => {
  try {
    const counts: Record<string, number> = {};
    for (const table of Object.keys(definitions)) counts[table] = Number((await pool!.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
    res.json(counts);
  } catch (error) { next(error); }
});
for (const [table, schema] of Object.entries(definitions)) {
  adminRouter.get(`/${table}`, async (_req, res, next) => {
    try {
      const query = table === 'departments'
        ? `SELECT d.*, ARRAY(SELECT location_id FROM department_locations WHERE department_id=d.id) AS location_ids FROM departments d ORDER BY name`
        : `SELECT * FROM ${table} ORDER BY ${table === 'faqs' ? 'question' : table === 'appointment_guidance' ? 'title' : 'name'}`;
      res.json({ items: (await pool!.query(query)).rows });
    } catch (error) { next(error); }
  });
  for (const method of ['post', 'put', 'patch'] as const) {
    adminRouter[method](`/${table}${method === 'post' ? '' : '/:id'}`, async (req, res, next) => {
      let client;
      try {
        const id = method === 'post' ? undefined : uuid.parse((req.params as { id?: string }).id);
        const body = (method === 'patch' ? schema.partial() : schema).parse(req.body) as Record<string, unknown>;
        if (!Object.keys(body).length) return res.status(400).json({ error: 'Provide at least one field to update.' });
        const { location_ids, ...fields } = body;
        // Table names and field names come exclusively from the fixed schemas above.
        const keys = Object.keys(fields);
        client = await pool!.connect();
        await client.query('BEGIN');
        let result;
        if (method === 'post') {
          result = await client.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, Object.values(fields));
        } else if (keys.length) {
          result = await client.query(`UPDATE ${table} SET ${keys.map((key, i) => `${key}=$${i + 1}`).join(',')} WHERE id=$${keys.length + 1} RETURNING *`, [...Object.values(fields), id]);
        } else {
          result = await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [id]);
        }
        if (!result.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'This record no longer exists. Refresh the list and try again.' });
        }
        const item = result.rows[0];
        if (table === 'departments' && location_ids !== undefined) {
          await client.query('DELETE FROM department_locations WHERE department_id=$1', [item.id]);
          for (const locationId of new Set(location_ids as string[])) {
            await client.query('INSERT INTO department_locations(department_id,location_id) VALUES($1,$2)', [item.id, locationId]);
          }
          item.location_ids = location_ids;
        }
        await client.query('COMMIT');
        res.status(method === 'post' ? 201 : 200).json({ item });
      } catch (error) {
        if (client) await client.query('ROLLBACK');
        next(error);
      } finally { client?.release(); }
    });
  }
  adminRouter.delete(`/${table}/:id`, async (req, res, next) => {
    try {
      const id = uuid.parse((req.params as { id?: string }).id);
      const result = await pool!.query(`DELETE FROM ${table} WHERE id=$1 RETURNING id`, [id]);
      if (!result.rowCount) return res.status(404).json({ error: 'This record no longer exists.' });
      res.json({ message: 'Record deleted.' });
    } catch (error) { next(error); }
  });
}
