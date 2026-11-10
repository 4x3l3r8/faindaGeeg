import type { FastifyPluginAsync } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  generateServiceIdea,
  getAiProvider,
  ServiceIdeaValidationError,
  type ServiceIdeaPromptInput,
} from '../../ai/index.js';
import { runClustering } from './clustering.js';
import {
  createServiceIdea,
  getClusterDetail,
  listClusters,
  listServiceIdeas,
} from './repository.js';

const errorResponse = z.object({
  error: z.object({ message: z.string(), statusCode: z.number() }),
});

const dataResponse = z.object({ data: z.any() });

const listResponse = z.object({ data: z.array(z.any()) });

const idParams = z.object({ id: z.string().uuid() });

const listClustersQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const rebuildBody = z
  .object({
    similarityThreshold: z.coerce.number().min(0).max(1).optional(),
  })
  .nullish()
  .transform((v) => v ?? {});

const MAX_EXCERPTS = 8;

function collectExcerpts(
  members: ReadonlyArray<{ title: string; evidenceExcerpt: string | null }>,
): string[] {
  const excerpts: string[] = [];

  for (const member of members) {
    if (excerpts.length >= MAX_EXCERPTS) {
      break;
    }
    const excerpt = member.evidenceExcerpt;
    if (excerpt !== null && excerpt.trim().length > 0) {
      excerpts.push(excerpt);
    }
  }

  if (excerpts.length === 0) {
    for (const member of members) {
      if (excerpts.length >= MAX_EXCERPTS) {
        break;
      }
      if (member.title.trim().length > 0) {
        excerpts.push(member.title);
      }
    }
  }

  return excerpts;
}

const clusterRoutes: FastifyPluginAsync = async (app) => {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    '/problem-clusters',
    {
      schema: {
        tags: ['clusters'],
        summary: 'List problem clusters',
        description: 'Returns problem clusters ordered by demand score, most relevant first.',
        querystring: listClustersQuery,
        response: {
          200: listResponse,
        },
      },
    },
    async (request) => {
      const rows = await listClusters({ limit: request.query.limit });
      return { data: rows };
    },
  );

  server.get(
    '/problem-clusters/:id',
    {
      schema: {
        tags: ['clusters'],
        summary: 'Get problem cluster detail',
        description: 'Returns a problem cluster with its members and generated service ideas.',
        params: idParams,
        response: {
          200: dataResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const detail = await getClusterDetail(request.params.id);
      if (detail === null) {
        return reply.status(404).send({
          error: { message: 'Problem cluster not found', statusCode: 404 },
        });
      }
      return { data: detail };
    },
  );

  server.post(
    '/problem-clusters/rebuild',
    {
      schema: {
        tags: ['clusters'],
        summary: 'Rebuild problem clusters',
        description:
          'Runs an in-process clustering pass and returns the summary of embedded, created, and linked records.',
        body: rebuildBody,
        response: {
          201: dataResponse,
        },
      },
    },
    async (request, reply) => {
      const options: { similarityThreshold?: number } = {};
      if (request.body.similarityThreshold !== undefined) {
        options.similarityThreshold = request.body.similarityThreshold;
      }

      const summary = await runClustering(options);
      return reply.status(201).send({ data: summary });
    },
  );

  server.post(
    '/problem-clusters/:id/service-ideas',
    {
      schema: {
        tags: ['clusters'],
        summary: 'Generate and save a service idea',
        description:
          'Generates a service idea from a problem cluster and persists it against that cluster.',
        params: idParams,
        response: {
          201: dataResponse,
          404: errorResponse,
          502: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const detail = await getClusterDetail(id);
      if (detail === null) {
        return reply.status(404).send({
          error: { message: 'Problem cluster not found', statusCode: 404 },
        });
      }

      const input: ServiceIdeaPromptInput = {
        clusterTitle: detail.title,
        clusterDescription: detail.description ?? null,
        independentSourceCount: detail.independentSourceCount,
        memberCount: detail.memberCount,
        excerpts: collectExcerpts(detail.members),
      };

      let result: Awaited<ReturnType<typeof generateServiceIdea>>;
      try {
        result = await generateServiceIdea(input, getAiProvider());
      } catch (error) {
        if (error instanceof ServiceIdeaValidationError) {
          return reply.status(502).send({
            error: {
              message: `AI service idea generation failed: ${error.message}`,
              statusCode: 502,
            },
          });
        }
        throw error;
      }

      const savedServiceIdea = await createServiceIdea(id, result.result);
      return reply.status(201).send({ data: savedServiceIdea });
    },
  );

  server.get(
    '/service-ideas',
    {
      schema: {
        tags: ['clusters'],
        summary: 'List service ideas',
        description: 'Returns generated service ideas, most recent first.',
        response: {
          200: listResponse,
        },
      },
    },
    async () => {
      const rows = await listServiceIdeas();
      return { data: rows };
    },
  );
};

export default clusterRoutes;
