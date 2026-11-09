import { pingDatabase } from '@toi/db';
import type { FastifyPluginAsync } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

const livenessResponse = z.object({
  status: z.literal('ok'),
  uptime: z.number(),
  timestamp: z.string().datetime(),
});

const databaseOkResponse = z.object({
  status: z.literal('ok'),
  database: z.object({
    ok: z.literal(true),
    latencyMs: z.number(),
  }),
});

const databaseErrorResponse = z.object({
  status: z.literal('error'),
  database: z.object({
    ok: z.literal(false),
  }),
});

const healthRoutes: FastifyPluginAsync = async (app) => {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Liveness probe',
        description: 'Returns 200 while the process is running. Does not touch the database.',
        response: {
          200: livenessResponse,
        },
      },
    },
    async () => ({
      status: 'ok' as const,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
  );

  server.get(
    '/health/db',
    {
      schema: {
        tags: ['health'],
        summary: 'Database connectivity probe',
        description: 'Runs a lightweight `select 1` against Postgres via @toi/db.',
        response: {
          200: databaseOkResponse,
          503: databaseErrorResponse,
        },
      },
    },
    async (_request, reply) => {
      try {
        const { latencyMs } = await pingDatabase();
        return {
          status: 'ok' as const,
          database: { ok: true as const, latencyMs },
        };
      } catch (error) {
        app.log.error({ err: error }, 'Database health check failed');
        return reply.status(503).send({
          status: 'error' as const,
          database: { ok: false as const },
        });
      }
    },
  );
};

export default healthRoutes;
