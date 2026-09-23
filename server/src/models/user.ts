export type UserRole = 'patient' | 'admin';
export type User = { id: string; name: string; email: string; role: UserRole };