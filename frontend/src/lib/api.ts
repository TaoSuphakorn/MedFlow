import { announceSessionChange } from './session-events';
export type User = {
  userId: number;
  name: string;
  role: 'Doctor' | 'Nurse' | 'Administrator';
  aiMode: 'Demo' | 'Live';
};
export type Note = {
  id: number;
  patientId: number;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  status: 'Draft' | 'Confirmed';
  aiGenerated: boolean;
  aiMode: string | null;
  kind: 'soap' | 'summary';
  summary: string | null;
  missingInformation: string | null;
  uncertainty: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
};
export type Patient = {
  id: number;
  identifier: string;
  name: string;
  thaiName: string;
  age: number;
  gender: string;
  category: string;
  color: string;
  lastVisit: string | null;
  draftCount: number;
  visitCount: number;
  bloodType: string;
  allergies: string;
  history: string;
  notes: Note[];
};
export type Soap = Pick<Note, 'subjective' | 'objective' | 'assessment' | 'plan'>;
let token: string | undefined;
export function resetCsrf() {
  token = undefined;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function csrf() {
  const r = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  token = (await r.json()).token;
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (method !== 'GET' && !token) await csrf();
  const r = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { 'X-CSRF-TOKEN': token! } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new ApiError(
      r.status,
      data.error ||
        (r.status === 401
          ? 'Your session has ended. Sign in again.'
          : r.status === 403
            ? 'Your role cannot perform this action.'
            : r.status === 429
              ? 'Too many requests. Please wait a minute.'
              : 'Something went wrong. Please try again.'),
    );
  }
  if (method === 'POST' && (path === '/auth/login' || path === '/auth/logout'))
    announceSessionChange();
  return r.status === 204 ? (undefined as T) : r.json();
}
export const initials = (name: string) =>
  name
    .replace(/^Dr\. /, '')
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('');
export const date = (value?: string | null, locale = 'en-GB') =>
  value
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Bangkok',
      }).format(new Date(value))
    : locale.startsWith('th')
      ? 'ยังไม่มีการรับบริการ'
      : 'No visit yet';
