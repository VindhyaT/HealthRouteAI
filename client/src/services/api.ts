const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export class ApiError extends Error {
  constructor(message: string, public status: number, public fields?: Record<string, string[]>) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('healthroute_token');
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
  let response: Response;
  let data: any;

  try {
    response = await fetch(`${API}${path}`, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
    try { data = await response.json(); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      if (response.ok) throw new ApiError('The service returned an unreadable response. Please try again.', response.status);
      data = {};
    }
  } catch (error) {
    if (timedOut) throw new ApiError('The request took too long. Please try again. If you were saving changes, refresh the list first to check whether they were saved.', 408);
    if (options.signal?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError('Unable to connect. Check your connection and try again.', 0);
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError('The service returned an unexpected response. Please try again.', response.status);
  if (!response.ok) {
    if (response.status === 401 && token && !['/auth/login', '/auth/register'].includes(path) && localStorage.getItem('healthroute_token') === token) {
      localStorage.removeItem('healthroute_token');
      window.dispatchEvent(new Event('healthroute-session-ended'));
    }
    throw new ApiError(response.status >= 500 ? 'The service is temporarily unavailable. Please try again shortly.' : typeof data.error === 'string' ? data.error : 'We could not complete your request. Please try again.', response.status, response.status < 500 && data.fields && typeof data.fields === 'object' ? Object.fromEntries(Object.entries(data.fields).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every(value => typeof value === 'string'))) : undefined);
  }
  const route = path.split('?')[0];
  const listKey = route === '/departments' ? 'departments' : route === '/services' ? 'services' : route === '/locations' ? 'locations' : route === '/faqs' ? 'faqs' : route === '/appointment-guidance' ? 'guidance' : route.startsWith('/admin/') && route !== '/admin/summary' && (!options.method || options.method === 'GET') ? 'items' : null;
  const invalid = listKey && !Array.isArray(data[listKey])
    || ['/auth/me', '/auth/login', '/auth/register'].includes(route) && (!data.user || !['patient', 'admin'].includes(data.user.role) || typeof data.user.name !== 'string')
    || ['/auth/login', '/auth/register'].includes(route) && typeof data.token !== 'string'
    || route === '/assistant' && (typeof data.answer !== 'string' || !Array.isArray(data.recommendations) || !Array.isArray(data.sources));
  if (invalid) throw new ApiError('The service returned incomplete information. Please try again.', response.status);
  return data;
}
