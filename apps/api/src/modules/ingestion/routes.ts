import type { FastifyPluginAsync } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { listConnectorNames } from './connectors/index.js';
import { listRuns, listSources, type ListRunsParams } from './repository.js';
import { runIngestion } from './run.js';

const errorResponse = z.object({
  error: z.object({ message: z.string(), statusCode: z.number() }),
});

const dataResponse = z.object({ data: z.any() });

const listResponse = z.object({ data: z.array(z.any()) });

const runsQuery = z.object({
  sourceId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const runBody = z.object({
  sourceName: z.string().optional(),
  maxRecords: z.coerce.number().int().min(1).max(100).default(25),
});

const ingestionRoutes: FastifyPluginAsync = async (app) => {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    '/ingestion/runs',
    {
      schema: {
        tags: ['ingestion'],
        summary: 'List ingestion runs',
        description: 'Returns recent ingestion runs, most recent first, optionally filtered by source.',
        querystring: runsQuery,
        response: {
          200: listResponse,
        },
      },
    },
    async (request) => {
      const params: ListRunsParams = { limit: request.query.limit };
      if (request.query.sourceId !== undefined) params.sourceId = request.query.sourceId;

      const rows = await listRuns(params);
      return { data: rows };
    },
  );

  server.post(
    '/ingestion/runs',
    {
      schema: {
        tags: ['ingestion'],
        summary: 'Trigger an ingestion run',
        description:
          'Runs a source connector synchronously in-process and returns the run summary.',
        body: runBody,
        response: {
          201: dataResponse,
          400: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const { sourceName, maxRecords } = request.body;

      const options: { sourceName?: string; maxRecords: number } = { maxRecords };
      if (sourceName !== undefined) options.sourceName = sourceName;

      const summary = await runIngestion(options);
      return reply.status(201).send({ data: summary });
    },
  );

  server.get(
    '/sources',
    {
      schema: {
        tags: ['sources'],
        summary: 'List sources',
        description: 'Returns every configured ingestion source, ordered by name.',
        response: {
          200: listResponse,
        },
      },
    },
    async () => {
      const rows = await listSources();
      return { data: rows };
    },
  );

  server.get(
    '/ingestion/connectors',
    {
      schema: {
        tags: ['ingestion'],
        summary: 'List ingestion connectors',
        description: 'Returns the names of the source connectors available to the ingestion engine.',
        response: {
          200: listResponse,
        },
      },
    },
    async () => {
      return { data: listConnectorNames() };
    },
  );
};

export default ingestionRoutes;
