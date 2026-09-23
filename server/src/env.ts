import dotenv from 'dotenv';
import path from 'node:path';

// Identical paths for src and compiled dist; independent of the working directory.
// Existing shell/container settings win, followed by server/.env, then root .env.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
