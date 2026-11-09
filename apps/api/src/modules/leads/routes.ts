import type { FastifyPluginAsync } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  opportunityStatusSchema,
  outreachActivityTypeSchema,
} from '../../shared/index.js';
import {
  addActivity,
  createLeadFromOpportunity,
  getLead,
  type LeadListParams,
  type LeadPatch,
  listLeads,
  updateLead,
} from './repository.js';

const errorResponse = z.object({
  error: z.object({ message: z.string(), statusCode: z.number() }),
});

const dataResponse = z.object({ data: z.any() });

const listResponse = z.object({ data: z.array(z.any()) });

const idParams = z.object({ id: z.string().uuid() });

const createBody = z.object({
  opportunityId: z.string().uuid(),
  status: opportunityStatusSchema.optional(),
});

const listQuery = z.object({
  status: opportunityStatusSchema.optional(),
});

const patchBody = z.object({
  status: opportunityStatusSchema.optional(),
  notes: z.string().nullish(),
  nextActionAt: z.string().datetime().nullish(),
});

const activityBody = z.object({
  activityType: outreachActivityTypeSchema,
  content: z.string().nullish(),
  outcome: z.string().nullish(),
});

const leadsRoutes: FastifyPluginAsync = async (app) => {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    '/leads',
    {
      schema: {
        tags: ['leads'],
        summary: 'Create a lead from an opportunity',
        description: 'Promotes an opportunity into a tracked client lead.',
        body: createBody,
        response: {
          201: dataResponse,
        },
      },
    },
    async (request, reply) => {
      const { opportunityId, status } = request.body;
      const lead =
        status === undefined
          ? await createLeadFromOpportunity(opportunityId)
          : await createLeadFromOpportunity(opportunityId, status);
      return reply.status(201).send({ data: lead });
    },
  );

  server.get(
    '/leads',
    {
      schema: {
        tags: ['leads'],
        summary: 'List leads',
        description: 'Returns tracked client leads, optionally filtered by status.',
        querystring: listQuery,
        response: {
          200: listResponse,
        },
      },
    },
    async (request) => {
      const params: LeadListParams = {};
      if (request.query.status !== undefined) params.status = request.query.status;
      const rows = await listLeads(params);
      return { data: rows };
    },
  );

  server.get(
    '/leads/:id',
    {
      schema: {
        tags: ['leads'],
        summary: 'Get lead detail',
        description: 'Returns a client lead with its opportunity summary and outreach activities.',
        params: idParams,
        response: {
          200: dataResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const lead = await getLead(request.params.id);
      if (lead === null) {
        return reply.status(404).send({
          error: { message: 'Lead not found', statusCode: 404 },
        });
      }
      return { data: lead };
    },
  );

  server.patch(
    '/leads/:id',
    {
      schema: {
        tags: ['leads'],
        summary: 'Update a lead',
        description: 'Updates lead status, notes, or the next scheduled action.',
        params: idParams,
        body: patchBody,
        response: {
          200: dataResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const patch: LeadPatch = {};
      if (body.status !== undefined) patch.status = body.status;
      if (body.notes !== undefined) patch.notes = body.notes;
      if (body.nextActionAt !== undefined) {
        patch.nextActionAt = body.nextActionAt === null ? null : new Date(body.nextActionAt);
      }

      const lead = await updateLead(request.params.id, patch);
      if (lead === null) {
        return reply.status(404).send({
          error: { message: 'Lead not found', statusCode: 404 },
        });
      }
      return { data: lead };
    },
  );

  server.post(
    '/leads/:id/activities',
    {
      schema: {
        tags: ['leads'],
        summary: 'Add a lead activity',
        description: 'Records an outreach activity against a client lead.',
        params: idParams,
        body: activityBody,
        response: {
          201: dataResponse,
        },
      },
    },
    async (request, reply) => {
      const activity = await addActivity(request.params.id, {
        activityType: request.body.activityType,
        content: request.body.content ?? null,
        outcome: request.body.outcome ?? null,
      });
      return reply.status(201).send({ data: activity });
    },
  );
};

export default leadsRoutes;
