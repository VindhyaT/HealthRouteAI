import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../database';
import { auth, AuthRequest, signUser } from '../middleware/authMiddleware';

export const authRouter = Router();
const email = z.string().trim().email('Enter a valid email address.').max(254).transform(value => value.toLowerCase());
const password = z.string().refine(value => !!value.trim(), 'Enter your password.').pipe(z.string().min(8, 'Use at least 8 characters for your password.').refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes.'));
const registration = z.object({ name: z.string().trim().min(2, 'Enter your full name (at least 2 characters).').max(100), email, password }).strict();
const login = z.object({ email, password: z.string().min(1, 'Enter your password.').max(1024).refine(value => !!value.trim(), 'Enter your password.') }).strict();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' } });
// Equal-cost password check when an email does not exist.
const dummyHash = bcrypt.hashSync('not-a-real-account-password', 12);
authRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!pool) return res.status(503).json({ error: 'Sign-in requires PostgreSQL. Please initialize the database.' });
  next();
});
authRouter.post('/register', limiter, async (req, res, next) => {
  try {
    const body = registration.parse(req.body);
    const hash = await bcrypt.hash(body.password, 12);
    const client = await pool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'patient') RETURNING id,name,email,role", [body.name, body.email, hash]);
      const user = result.rows[0];
      const token = await signUser(user, client);
      await client.query('COMMIT');
      res.status(201).json({ user, token });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    next(error);
  }
});
authRouter.post('/login', limiter, async (req, res, next) => {
  try {
    const body = login.parse(req.body);
    const result = await pool!.query('SELECT id,name,email,role,password_hash FROM users WHERE lower(email)=$1', [body.email]);
    const row = result.rows[0];
    const matches = await bcrypt.compare(body.password, row?.password_hash || dummyHash);
    if (!row || !matches) return res.status(401).json({ error: 'Email or password is incorrect.' });
    const { id, name, email, role } = row;
    const user = { id, name, email, role };
    res.json({ user, token: await signUser(user) });
  } catch (error) { next(error); }
});
authRouter.get('/me', auth, (req: AuthRequest, res) => res.json({ user: req.user }));
authRouter.post('/logout', auth, async (req: AuthRequest, res, next) => {
  try {
    await pool!.query('DELETE FROM auth_sessions WHERE id=$1', [req.sessionId]);
    res.json({ message: 'You have been signed out.' });
  } catch (error) { next(error); }
});
