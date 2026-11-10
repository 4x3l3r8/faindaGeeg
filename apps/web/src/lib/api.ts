import type {
  ActivityInput,
  CreateLeadInput,
  DashboardSummary,
  Feedback,
  FeedbackInput,
  IngestionRun,
  IngestionRunSummary,
  Lead,
  LeadActivity,
  LeadPatchInput,
  ListIngestionRunsParams,
  ListOpportunitiesParams,
  OpportunityDetail,
  OpportunityRow,
  OpportunityStatus,
  Pagination,
  Skill,
  SkillInput,
  SkillPatchInput,
  Source,
  SubmitInput,
  SubmitResult,
  TriggerIngestionInput,
} from './types';

// Base URL for the Fastify API. Falls back to the local default when
// `VITE_API_BASE_URL` is not provided in the environment. Health routes live at
// the root; every other route is mounted under `/api`.
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

function buildQueryString(params: ListOpportunitiesParams): string {
  const query = new URLSearchParams();

  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  if (params.opportunityType !== undefined) query.set('opportunityType', params.opportunityType);
  if (params.status !== undefined) query.set('status', params.status);
  if (params.buyingIntent !== undefined) query.set('buyingIntent', params.buyingIntent);
  if (params.minScore !== undefined) query.set('minScore', String(params.minScore));
  if (params.sourceId !== undefined) query.set('sourceId', params.sourceId);
  if (params.search !== undefined && params.search !== '') query.set('search', params.search);

  const qs = query.toString();
  return qs.length > 0 ? `?${qs}` : '';
}

/**
 * Fetch `path` and parse the JSON body. Throws an `Error` on any non-2xx
 * response, preferring the API's `{ error: { message } }` payload when present.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildUrl(path), { ...init, headers });

  if (!response.ok) {
    let message = `Request to ${path} failed with ${response.status} ${response.statusText}`;
    try {
      const body: unknown = await response.json();
      if (
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof (body as { error?: unknown }).error === 'object' &&
        (body as { error: { message?: unknown } }).error !== null
      ) {
        const inner = (body as { error: { message?: unknown } }).error;
        if (typeof inner.message === 'string') {
          message = inner.message;
        }
      }
    } catch {
      // Body was not JSON; keep the status-based message.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
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

// ---------------------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------------------

export async function submitOpportunity(input: SubmitInput): Promise<SubmitResult> {
  const { data } = await apiFetch<{ data: SubmitResult }>('/api/opportunities/submit', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data;
}

export async function listOpportunities(
  params: ListOpportunitiesParams = {},
): Promise<{ data: OpportunityRow[]; pagination: Pagination }> {
  return apiFetch<{ data: OpportunityRow[]; pagination: Pagination }>(
    `/api/opportunities${buildQueryString(params)}`,
  );
}

export async function getOpportunity(id: string): Promise<OpportunityDetail> {
  const { data } = await apiFetch<{ data: OpportunityDetail }>(
    `/api/opportunities/${encodeURIComponent(id)}`,
  );
  return data;
}

export async function patchOpportunityStatus(
  id: string,
  status: OpportunityStatus,
): Promise<{ id: string; status: OpportunityStatus }> {
  const { data } = await apiFetch<{ data: { id: string; status: OpportunityStatus } }>(
    `/api/opportunities/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
  return data;
}

export async function postFeedback(id: string, input: FeedbackInput): Promise<Feedback> {
  const { data } = await apiFetch<{ data: Feedback }>(
    `/api/opportunities/${encodeURIComponent(id)}/feedback`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return data;
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function listLeads(status?: OpportunityStatus): Promise<Lead[]> {
  const qs = status === undefined ? '' : `?status=${encodeURIComponent(status)}`;
  const { data } = await apiFetch<{ data: Lead[] }>(`/api/leads${qs}`);
  return data;
}

export async function getLead(id: string): Promise<Lead> {
  const { data } = await apiFetch<{ data: Lead }>(`/api/leads/${encodeURIComponent(id)}`);
  return data;
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const { data } = await apiFetch<{ data: Lead }>('/api/leads', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data;
}

export async function patchLead(id: string, patch: LeadPatchInput): Promise<Lead> {
  const { data } = await apiFetch<{ data: Lead }>(`/api/leads/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data;
}

export async function addLeadActivity(id: string, input: ActivityInput): Promise<LeadActivity> {
  const { data } = await apiFetch<{ data: LeadActivity }>(
    `/api/leads/${encodeURIComponent(id)}/activities`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return data;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export async function listSkills(): Promise<Skill[]> {
  const { data } = await apiFetch<{ data: Skill[] }>('/api/skills');
  return data;
}

export async function createSkill(body: SkillInput): Promise<Skill> {
  const { data } = await apiFetch<{ data: Skill }>('/api/skills', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data;
}

export async function patchSkill(id: string, patch: SkillPatchInput): Promise<Skill> {
  const { data } = await apiFetch<{ data: Skill }>(`/api/skills/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiFetch<{ data: DashboardSummary }>('/api/dashboard/summary');
  return data;
}

// ---------------------------------------------------------------------------
// Sources & ingestion
// ---------------------------------------------------------------------------

export async function listSources(): Promise<Source[]> {
  const { data } = await apiFetch<{ data: Source[] }>('/api/sources');
  return data;
}

export async function listConnectors(): Promise<string[]> {
  const { data } = await apiFetch<{ data: string[] }>('/api/ingestion/connectors');
  return data;
}

export async function listIngestionRuns(
  params: ListIngestionRunsParams = {},
): Promise<IngestionRun[]> {
  const query = new URLSearchParams();
  if (params.sourceId !== undefined) query.set('sourceId', params.sourceId);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const qs = query.toString();

  const { data } = await apiFetch<{ data: IngestionRun[] }>(
    `/api/ingestion/runs${qs.length > 0 ? `?${qs}` : ''}`,
  );
  return data;
}

export async function triggerIngestion(
  body: TriggerIngestionInput = {},
): Promise<IngestionRunSummary> {
  const { data } = await apiFetch<{ data: IngestionRunSummary }>('/api/ingestion/runs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data;
}
