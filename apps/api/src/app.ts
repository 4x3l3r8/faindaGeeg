import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyError } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import { env } from './config/env.js';
import clusterRoutes from './modules/clusters/routes.js';
import dashboardRoutes from './modules/dashboard/routes.js';
import healthRoutes from './modules/health/routes.js';
import ingestionRoutes from './modules/ingestion/routes.js';
import leadsRoutes from './modules/leads/routes.js';
import opportunitiesRoutes from './modules/opportunities/routes.js';
import skillsRoutes from './modules/skills/routes.js';

const PUBLIC_PATHS = new Set<string>(['/health', '/health/db']);

function isPublicRoute(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  if (PUBLIC_PATHS.has(path)) {
    return true;
  }
  return path === '/docs' || path.startsWith('/docs/');
}

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? {
            level: env.LOG_LEVEL,
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss.l',
                ignore: 'pid,hostname',
              },
            },
          }
        : { level: env.LOG_LEVEL },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: env.NODE_ENV === 'development' });

  await app.register(swagger, {
    openapi: {
      info: {
        title: '@toi/api',
        description: 'Tech Opportunity Intelligence System API',
        version: '0.0.0',
      },
      tags: [
        { name: 'health', description: 'Liveness and database readiness probes' },
        { name: 'opportunities', description: 'Opportunity inbox, detail, review, and feedback' },
        { name: 'leads', description: 'Client lead tracking and outreach activities' },
        { name: 'skills', description: 'Skills profile management' },
        { name: 'dashboard', description: 'Aggregated dashboard metrics' },
        { name: 'ingestion', description: 'Ingestion runs and source connectors' },
        { name: 'sources', description: 'Configured ingestion sources' },
        {
          name: 'clusters',
          description: 'Problem clusters and generated service ideas',
        },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  if (env.API_AUTH_TOKEN !== undefined) {
    const expectedToken = `Bearer ${env.API_AUTH_TOKEN}`;
    app.addHook('onRequest', async (request, reply) => {
      if (isPublicRoute(request.url)) {
        return;
      }
      if (request.headers.authorization !== expectedToken) {
        await reply.status(401).send({
          error: { message: 'Unauthorized', statusCode: 401 },
        });
      }
    });
  }

  app.setNotFoundHandler((request, reply) => {
    request.log.warn({ url: request.url }, 'Route not found');
    reply.status(404).send({ error: { message: 'Route not found', statusCode: 404 } });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'Request failed');
    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;
    const message = statusCode >= 500 ? 'Internal Server Error' : error.message;
    reply.status(statusCode).send({ error: { message, statusCode } });
  });

  await app.register(healthRoutes);

  await app.register(opportunitiesRoutes, { prefix: '/api' });
  await app.register(leadsRoutes, { prefix: '/api' });
  await app.register(skillsRoutes, { prefix: '/api' });
  await app.register(dashboardRoutes, { prefix: '/api' });
  await app.register(ingestionRoutes, { prefix: '/api' });
  await app.register(clusterRoutes, { prefix: '/api' });

  return app;
}
