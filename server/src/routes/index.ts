import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/authMiddleware';
import { faqs, locations } from '../database/demoData';
import { pool, searchServices, searchDepartments, usingDemoData } from '../database';
import { answerNavigationQuestion } from '../controllers/assistantController';
import { authRouter } from './auth';
import { adminRouter } from './admin';

export const router = Router();
router.get('/health', (_req, res) => res.json({ ok: true, mode: usingDemoData ? 'demo' : 'postgres' }));
router.use('/auth', authRouter);
router.use('/admin', adminRouter);
router.get('/departments', async (req, res, next) => {
  try {
    const query = z.string().max(200, 'Search must be 200 characters or fewer.').parse(req.query.q ?? '');
    res.json({ departments: await searchDepartments(query) });
  } catch (error) { next(error); }
});
router.get('/services', async (req, res, next) => {
  try { res.json({ services: await searchServices(z.string().max(200, 'Search must be 200 characters or fewer.').parse(req.query.q ?? '')) }); }
  catch (error) { next(error); }
});
router.get('/locations', async (_req, res, next) => {
  try {
    if (!pool) return res.json({ locations });
    res.json({ locations: (await pool.query(`SELECT l.*, ARRAY(SELECT d.name FROM department_locations dl JOIN departments d ON d.id=dl.department_id WHERE dl.location_id=l.id ORDER BY d.name) AS services FROM locations l ORDER BY l.name`)).rows });
  } catch (error) { next(error); }
});
router.get('/faqs', async (_req, res, next) => {
  try { res.json({ faqs: pool ? (await pool.query('SELECT * FROM faqs ORDER BY question')).rows : faqs }); }
  catch (error) { next(error); }
});
router.get('/appointment-guidance', async (_req, res, next) => {
  try { res.json({ guidance: pool ? (await pool.query('SELECT a.*,s.name AS service FROM appointment_guidance a JOIN services s ON s.id=a.service_id ORDER BY a.title')).rows : [] }); }
  catch (error) { next(error); }
});
router.post('/assistant', auth, answerNavigationQuestion);
