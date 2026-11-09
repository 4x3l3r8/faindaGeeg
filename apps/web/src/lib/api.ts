// Base URL for the Fastify API. Falls back to the local default when
// `VITE_API_BASE_URL` is not provided in the environment.
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export interface HealthResponse {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

export interface DbHealthResponse {
  status: 'ok' | 'error';
  database: {
    ok: boolean;
    latencyMs?: number;
  };
}

function buildUrl(path: string): string {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

async function request(path: string): Promise<Response> {
  return fetch(buildUrl(path), {
    headers: { Accept: 'application/json' },
  });
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await request(path);
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export function getHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>('/health');
}

export async function getDbHealth(): Promise<DbHealthResponse> {
  const response = await request('/health/db');
  // A 503 is an expected, well-formed response signalling the database is down;
  // surface it instead of throwing so the UI can render a degraded state.
  if (response.status === 503) {
    return (await response.json()) as DbHealthResponse;
  }
  if (!response.ok) {
    throw new Error(
      `Request to /health/db failed with ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as DbHealthResponse;
}
