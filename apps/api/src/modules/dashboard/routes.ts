import type { FastifyPluginAsync } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { getDashboardSummary } from './repository.js';

const dataResponse = z.object({ data: z.any() });

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
};

export default dashboardRoutes;
