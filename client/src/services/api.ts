const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export class ApiError extends Error {
  constructor(message: string, public status: number, public fields?: Record<string, string[]>) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('healthroute_token');
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError('Unable to connect. Check your connection and try again.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token && !['/auth/login', '/auth/register'].includes(path) && localStorage.getItem('healthroute_token') === token) {
      localStorage.removeItem('healthroute_token');
      window.dispatchEvent(new Event('healthroute-session-ended'));
    }
    throw new ApiError(data.error || 'We could not complete your request. Please try again.', response.status, data.fields);
  }
  return data;
}
