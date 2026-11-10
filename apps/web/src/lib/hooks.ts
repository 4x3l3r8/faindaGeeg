import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addLeadActivity,
  createLead,
  createSkill,
  generateOutreachDraft,
  generateServiceIdeaForCluster,
  getCluster,
  getDashboardSummary,
  getDigest,
  getLead,
  getOpportunity,
  listClusters,
  listConnectors,
  listIngestionRuns,
  listLeads,
  listOpportunities,
  listServiceIdeas,
  listSkills,
  listSources,
  patchLead,
  patchOpportunityStatus,
  patchSkill,
  postFeedback,
  rebuildClusters,
  submitOpportunity,
  triggerIngestion,
} from './api';
import type {
  ActivityInput,
  ClusteringSummary,
  CreateLeadInput,
  Feedback,
  FeedbackInput,
  IngestionRunSummary,
  Lead,
  LeadActivity,
  LeadPatchInput,
  ListIngestionRunsParams,
  ListOpportunitiesParams,
  OpportunityStatus,
  OutreachDraft,
  ServiceIdea,
  SkillInput,
  SkillPatchInput,
  SubmitInput,
  TriggerIngestionInput,
} from './types';

/**
 * Central query-key factory. Every key is built from these helpers so that
 * mutations can invalidate the right cache slices without string duplication.
 */
export const queryKeys = {
  dashboard: () => ['dashboard'] as const,
  digest: (sinceHours?: number) => ['dashboard', 'digest', sinceHours ?? null] as const,
  opportunities: {
    all: () => ['opportunities'] as const,
    list: (params?: ListOpportunitiesParams) => ['opportunities', 'list', params ?? {}] as const,
    detail: (id: string) => ['opportunities', 'detail', id] as const,
  },
  leads: {
    all: () => ['leads'] as const,
    list: (status?: OpportunityStatus) => ['leads', 'list', status ?? null] as const,
    detail: (id: string) => ['leads', 'detail', id] as const,
  },
  skills: {
    all: () => ['skills'] as const,
    list: () => ['skills', 'list'] as const,
  },
  sources: {
    all: () => ['sources'] as const,
    list: () => ['sources', 'list'] as const,
  },
  ingestion: {
    all: () => ['ingestion-runs'] as const,
    connectors: () => ['ingestion', 'connectors'] as const,
    runs: (params?: ListIngestionRunsParams) =>
      ['ingestion-runs', 'list', params ?? {}] as const,
  },
  clusters: {
    all: () => ['problem-clusters'] as const,
    list: (limit?: number) => ['problem-clusters', 'list', limit ?? null] as const,
    detail: (id: string) => ['problem-clusters', 'detail', id] as const,
  },
  serviceIdeas: {
    all: () => ['service-ideas'] as const,
    list: () => ['service-ideas', 'list'] as const,
  },
} as const;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: getDashboardSummary,
  });
}

export function useDigest(sinceHours?: number) {
  return useQuery({
    queryKey: queryKeys.digest(sinceHours),
    queryFn: () => getDigest(sinceHours),
  });
}

export function useOpportunities(params: ListOpportunitiesParams = {}) {
  return useQuery({
    queryKey: queryKeys.opportunities.list(params),
    queryFn: () => listOpportunities(params),
  });
}

export function useOpportunity(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.opportunities.detail(id ?? ''),
    queryFn: () => getOpportunity(id as string),
    enabled: Boolean(id),
  });
}

export function useLeads(status?: OpportunityStatus) {
  return useQuery({
    queryKey: queryKeys.leads.list(status),
    queryFn: () => listLeads(status),
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.leads.detail(id ?? ''),
    queryFn: () => getLead(id as string),
    enabled: Boolean(id),
  });
}

export function useSkills() {
  return useQuery({
    queryKey: queryKeys.skills.list(),
    queryFn: listSkills,
  });
}

export function useSources() {
  return useQuery({
    queryKey: queryKeys.sources.list(),
    queryFn: listSources,
  });
}

export function useConnectors() {
  return useQuery({
    queryKey: queryKeys.ingestion.connectors(),
    queryFn: listConnectors,
  });
}

export function useIngestionRuns(params: ListIngestionRunsParams = {}) {
  return useQuery({
    queryKey: queryKeys.ingestion.runs(params),
    queryFn: () => listIngestionRuns(params),
  });
}

export function useClusters(limit?: number) {
  return useQuery({
    queryKey: queryKeys.clusters.list(limit),
    queryFn: () => listClusters(limit),
  });
}

export function useCluster(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.clusters.detail(id ?? ''),
    queryFn: () => getCluster(id as string),
    enabled: Boolean(id),
  });
}

export function useServiceIdeas() {
  return useQuery({
    queryKey: queryKeys.serviceIdeas.list(),
    queryFn: listServiceIdeas,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useSubmit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitInput) => submitOpportunity(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useSetOpportunityStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { id: string; status: OpportunityStatus }) =>
      patchOpportunityStatus(variables.id, variables.status),
    onSuccess: (
      _data: { id: string; status: OpportunityStatus },
      variables: { id: string; status: OpportunityStatus },
    ) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opportunities.detail(variables.id),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useSendFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { id: string; input: FeedbackInput }) =>
      postFeedback(variables.id, variables.input),
    onSuccess: (_data: Feedback, variables: { id: string; input: FeedbackInput }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opportunities.detail(variables.id),
      });
    },
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLeadInput) => createLead(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function usePatchLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { id: string; patch: LeadPatchInput }) =>
      patchLead(variables.id, variables.patch),
    onSuccess: (_data: Lead, variables: { id: string; patch: LeadPatchInput }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.id) });
    },
  });
}

export function useAddActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { id: string; input: ActivityInput }) =>
      addLeadActivity(variables.id, variables.input),
    onSuccess: (_data: LeadActivity, variables: { id: string; input: ActivityInput }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.all() });
    },
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SkillInput) => createSkill(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.skills.all() });
    },
  });
}

export function usePatchSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { id: string; patch: SkillPatchInput }) =>
      patchSkill(variables.id, variables.patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.skills.all() });
    },
  });
}

export function useTriggerIngestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TriggerIngestionInput = {}) => triggerIngestion(input),
    onSuccess: (_data: IngestionRunSummary) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ingestion.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sources.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useGenerateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opportunityId: string) => generateOutreachDraft(opportunityId),
    onSuccess: (_data: OutreachDraft, opportunityId: string) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opportunities.detail(opportunityId),
      });
    },
  });
}

export function useRebuildClusters() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (similarityThreshold?: number) => rebuildClusters(similarityThreshold),
    onSuccess: (_data: ClusteringSummary) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clusters.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useGenerateServiceIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clusterId: string) => generateServiceIdeaForCluster(clusterId),
    onSuccess: (_data: ServiceIdea, clusterId: string) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clusters.detail(clusterId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.serviceIdeas.all() });
    },
  });
}
