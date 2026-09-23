import jwt from 'jsonwebtoken';
import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { pool } from '../database';
import { User } from '../models/user';

const issuer = 'healthroute-api';
const audience = 'healthroute-web';
export function validateAuthConfig() {
  if (!process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32)) {
    throw new Error('Set JWT_SECRET in .env (at least 32 characters in production).');
  }
}
export type AuthRequest = Request & { user?: User; sessionId?: string };
export async function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ error: 'Please sign in to continue.' });
  if (!pool) return res.status(503).json({ error: 'Sign-in is temporarily unavailable. Please try again later.' });
  let payload: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(match[1], process.env.JWT_SECRET!, { algorithms: ['HS256'], issuer, audience });
    if (typeof decoded === 'string' || !decoded.sub || !decoded.jti || !decoded.exp || !/^[0-9a-f-]{36}$/i.test(decoded.jti)) throw new Error('Invalid token');
    payload = decoded;
  } catch {
    return res.status(401).json({ error: 'Your session has expired or is invalid. Please sign in again.' });
  }
  try {
    const result = await pool.query(`SELECT u.id,u.name,u.email,u.role FROM auth_sessions s JOIN users u ON u.id=s.user_id
      WHERE s.id=$1 AND u.id::text=$2 AND s.expires_at > NOW()`, [payload.jti, payload.sub]);
    if (!result.rows[0]) return res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
    req.user = result.rows[0]; // Always use the current database role, not a stale JWT role.
    req.sessionId = payload.jti;
    next();
  } catch (error) { next(error); }
}
export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
  next();
}
export async function signUser(user: User, connection: Pool | PoolClient = pool!) {
  if (!pool) throw new Error('PostgreSQL is required for authentication.');
  validateAuthConfig();
  const sessionId = randomUUID();
  const token = jwt.sign({ role: user.role }, process.env.JWT_SECRET!, {
    algorithm: 'HS256', subject: user.id, jwtid: sessionId, issuer, audience, expiresIn: '1h'
  });
  const payload = jwt.decode(token) as jwt.JwtPayload;
  await connection.query('INSERT INTO auth_sessions(id,user_id,expires_at) VALUES($1,$2,$3)', [sessionId, user.id, new Date(payload.exp! * 1000)]);
  return token;
}
