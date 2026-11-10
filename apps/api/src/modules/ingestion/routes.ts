import type { FastifyPluginAsync } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { listConnectorNames } from './connectors/index.js';
import { acceptInbound, inboundBodySchema, normalizeInboundBody } from './inbound.js';
import { listRuns, listSources, type ListRunsParams } from './repository.js';
import { startIngestion } from './run.js';

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
          'Starts a source connector ingestion in the background and returns immediately with the run id so progress can be polled.',
        body: runBody,
        response: {
          202: dataResponse,
          400: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const { sourceName, maxRecords } = request.body;

      const options: { sourceName?: string; maxRecords: number } = { maxRecords };
      if (sourceName !== undefined) options.sourceName = sourceName;

      const started = await startIngestion(options);
      return reply.status(202).send({ data: started });
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

  server.post(
    '/ingestion/inbound',
    {
      schema: {
        tags: ['ingestion'],
        summary: 'Accept inbound webhook records',
        description:
          'Accepts externally pushed source records authenticated with the shared webhook secret header. Records are persisted and queued for processing.',
        body: inboundBodySchema,
        response: {
          202: dataResponse,
          401: errorResponse,
          503: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const expectedSecret = env.INGEST_WEBHOOK_SECRET;
      if (expectedSecret === undefined || expectedSecret === '') {
        return reply
          .status(503)
          .send({ error: { message: 'Inbound ingestion is disabled', statusCode: 503 } });
      }

      if (request.headers['x-webhook-secret'] !== expectedSecret) {
        return reply
          .status(401)
          .send({ error: { message: 'Invalid webhook secret', statusCode: 401 } });
      }

      const records = normalizeInboundBody(request.body);
      const summary = await acceptInbound(records);
      return reply.status(202).send({ data: summary });
    },
  );
};

export default ingestionRoutes;
