import { EMBEDDING_DIM, getEmbedder } from '../../ai/index.js';
import {
  addClusterMember,
  clearEmbeddingsAndClusters,
  createCluster,
  findNearestCluster,
  getClusterMemberEmbeddings,
  getOpportunitiesNeedingEmbedding,
  getUnclusteredOpportunities,
  recomputeClusterMetrics,
  setOpportunityEmbedding,
} from './repository.js';

export interface ClusteringOptions {
  similarityThreshold?: number;
  embedBatch?: number;
  reembed?: boolean;
}

export interface ClusteringResult {
  opportunitiesEmbedded: number;
  clustersCreated: number;
  membersAdded: number;
  clustersTouched: number;
}

function meanNormalize(vectors: number[][]): number[] {
  const mean = new Array<number>(EMBEDDING_DIM).fill(0);

  for (const vector of vectors) {
    const length = Math.min(vector.length, EMBEDDING_DIM);
    for (let i = 0; i < length; i += 1) {
      mean[i] = (mean[i] ?? 0) + (vector[i] ?? 0);
    }
  }

  const count = vectors.length;
  if (count === 0) {
    return mean;
  }

  for (let i = 0; i < EMBEDDING_DIM; i += 1) {
    mean[i] = (mean[i] ?? 0) / count;
  }

  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i += 1) {
    const value = mean[i] ?? 0;
    norm += value * value;
  }

  if (norm === 0) {
    return mean;
  }

  const magnitude = Math.sqrt(norm);
  for (let i = 0; i < EMBEDDING_DIM; i += 1) {
    mean[i] = (mean[i] ?? 0) / magnitude;
  }

  return mean;
}

export async function runClustering(opts?: ClusteringOptions): Promise<ClusteringResult> {
  const threshold = opts?.similarityThreshold ?? 0.45;
  const batch = opts?.embedBatch ?? 100;
  const reembed = opts?.reembed ?? false;

  let opportunitiesEmbedded = 0;
  let clustersCreated = 0;
  let membersAdded = 0;

  if (reembed) {
    await clearEmbeddingsAndClusters();
  }

  const embedder = getEmbedder();
  for (;;) {
    const rows = await getOpportunitiesNeedingEmbedding(batch);
    if (rows.length === 0) {
      break;
    }

    const vectors = await embedder.embed(
      rows.map((row) => `${row.title}\n\n${row.description ?? ''}`.trim()),
    );

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const vector = vectors[i];
      if (row === undefined || vector === undefined) {
        continue;
      }
      await setOpportunityEmbedding(row.id, vector);
    }

    opportunitiesEmbedded += rows.length;

    if (rows.length < batch) {
      break;
    }
  }

  const pending = await getUnclusteredOpportunities();
  const touchedClusterIds = new Set<string>();

  for (const opportunity of pending) {
    let nearest: Awaited<ReturnType<typeof findNearestCluster>>;
    try {
      nearest = await findNearestCluster(opportunity.embedding);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('dimensions') || message.includes('different vector dimensions')) {
        throw new Error(
          'Embedding dimension changed; re-run with reembed:true to rebuild with the current model.',
        );
      }
      throw error;
    }

    if (nearest !== null && nearest.similarity >= threshold) {
      await addClusterMember(nearest.id, opportunity.id, nearest.similarity);
      touchedClusterIds.add(nearest.id);
    } else {
      const created = await createCluster({
        title: opportunity.title,
        description: opportunity.description ?? null,
        centroid: opportunity.embedding,
        firstObservedAt:
          opportunity.firstSeenAt instanceof Date
            ? opportunity.firstSeenAt
            : new Date(opportunity.firstSeenAt),
      });
      await addClusterMember(created.id, opportunity.id, 1);
      clustersCreated += 1;
      touchedClusterIds.add(created.id);
    }

    membersAdded += 1;
  }

  for (const clusterId of touchedClusterIds) {
    const embeddings = await getClusterMemberEmbeddings(clusterId);
    if (embeddings.length === 0) {
      continue;
    }
    const centroid = meanNormalize(embeddings);
    await recomputeClusterMetrics(clusterId, centroid);
  }

  return {
    opportunitiesEmbedded,
    clustersCreated,
    membersAdded,
    clustersTouched: touchedClusterIds.size,
  };
}
