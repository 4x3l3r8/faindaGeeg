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
import healthRoutes from './modules/health/routes.js';

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
      tags: [{ name: 'health', description: 'Liveness and database readiness probes' }],
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

  return app;
}
