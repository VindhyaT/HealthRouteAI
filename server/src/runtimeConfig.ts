export function validateRuntimeConfig() {
  const port = Number(process.env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  if (process.env.TRUST_PROXY && !['0', '1'].includes(process.env.TRUST_PROXY)) throw new Error('TRUST_PROXY must be 0 or 1.');
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in production.');
    try {
      const url = new URL(process.env.DATABASE_URL);
      if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
    } catch { throw new Error('DATABASE_URL must be a PostgreSQL URL.'); }
    try {
      const url = new URL(process.env.CLIENT_URL || '');
      if (url.protocol !== 'https:' || url.origin !== process.env.CLIENT_URL || url.username || url.password) throw new Error();
    } catch { throw new Error('CLIENT_URL must be an HTTPS origin without a trailing slash in production.'); }
  }
  return port;
}
