import './env';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { router } from './routes';

export const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, message: { error: 'Too many requests. Please wait a few minutes and try again.' } }));
app.use('/api', router);
app.use((_req, res) => { res.status(404).json({ error: 'This endpoint was not found.' }); });
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Please check the information entered.', fields: err.flatten().fieldErrors });
  if (err.code === '23505') return res.status(409).json({ error: 'A record with these details already exists.' });
  if (err.code === '23503') return res.status(400).json({ error: 'The selected department, service, or location no longer exists. Refresh and try again.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request contains invalid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'This request is too large. Please shorten the content.' });
  console.error('Request failed:', err.code || err.name || 'Unknown error');
  res.status(500).json({ error: 'We could not complete your request. Please try again.' });
});
