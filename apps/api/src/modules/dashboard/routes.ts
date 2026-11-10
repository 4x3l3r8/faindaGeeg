import type { FastifyPluginAsync } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { getDailyDigest, getDashboardSummary } from './repository.js';

const dataResponse = z.object({ data: z.any() });

const digestQuery = z.object({
  sinceHours: z.coerce.number().int().min(1).max(168).default(24),
});

const dashboardRoutes: FastifyPluginAsync = async (app) => {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    '/dashboard/summary',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get dashboard summary',
        description: 'Aggregate counts, breakdowns, and recent opportunities for the dashboard.',
        response: {
          200: dataResponse,
        },
      },
    },
    async () => {
      const summary = await getDashboardSummary();
      return { data: summary };
    },
  );

  server.get(
    '/dashboard/digest',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get daily digest',
        description:
          'Returns newly created and high-priority opportunities plus leads with follow-ups due.',
        querystring: digestQuery,
        response: {
          200: dataResponse,
        },
      },
    },
    async (request) => {
      const digest = await getDailyDigest({ sinceHours: request.query.sinceHours });
      return { data: digest };
    },
  );
};

export default dashboardRoutes;
