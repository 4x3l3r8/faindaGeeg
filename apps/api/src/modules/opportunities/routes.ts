import type { FastifyPluginAsync } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { generateOutreachDraft, getAiProvider } from '../../ai/index.js';
import {
  buyingIntentSchema,
  opportunityStatusSchema,
  opportunityTypeSchema,
  paginationQuerySchema,
} from '../../shared/index.js';
import {
  getOpportunityDetail,
  insertFeedback,
  type ListOpportunitiesParams,
  listOpportunities,
  updateOpportunityStatus,
} from './persistence.js';
import { SubmissionError, submitManual } from './submit.js';

const errorResponse = z.object({
  error: z.object({ message: z.string(), statusCode: z.number() }),
});

const dataResponse = z.object({ data: z.any() });

const listResponse = z.object({
  data: z.array(z.any()),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
  }),
});

const idParams = z.object({ id: z.string().uuid() });

const submitBody = z.object({
  text: z.string().optional(),
  url: z.string().optional(),
});

const listQuery = paginationQuerySchema.extend({
  opportunityType: opportunityTypeSchema.optional(),
  status: opportunityStatusSchema.optional(),
  buyingIntent: buyingIntentSchema.optional(),
  minScore: z.coerce.number().optional(),
  sourceId: z.string().optional(),
  search: z.string().optional(),
});

const statusBody = z.object({ status: opportunityStatusSchema });

const feedbackBody = z.object({
  isRelevant: z.boolean().nullish(),
  rating: z.number().int().nullish(),
  notes: z.string().nullish(),
});

const opportunitiesRoutes: FastifyPluginAsync = async (app) => {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    '/opportunities/submit',
    {
      schema: {
        tags: ['opportunities'],
        summary: 'Submit an opportunity manually',
        description: 'Accepts raw opportunity text or a URL and runs extraction, scoring, and persistence.',
        body: submitBody,
        response: {
          200: dataResponse,
          400: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const { text, url } = request.body;
      if ((text === undefined || text.trim() === '') && (url === undefined || url.trim() === '')) {
        return reply.status(400).send({
          error: { message: 'Provide a non-empty text or url', statusCode: 400 },
        });
      }

      try {
        const input: { text?: string; url?: string } = {};
        if (text !== undefined) input.text = text;
        if (url !== undefined) input.url = url;
        const result = await submitManual(input);
        return { data: result };
      } catch (error) {
        if (error instanceof SubmissionError) {
          return reply.status(400).send({
            error: { message: error.message, statusCode: 400 },
          });
        }
        throw error;
      }
    },
  );

  server.get(
    '/opportunities',
    {
      schema: {
        tags: ['opportunities'],
        summary: 'List opportunities',
        description: 'Returns a paginated list of scored opportunities with optional filters.',
        querystring: listQuery,
        response: {
          200: listResponse,
        },
      },
    },
    async (request) => {
      const query = request.query;
      const params: ListOpportunitiesParams = { page: query.page, pageSize: query.pageSize };
      if (query.opportunityType !== undefined) params.opportunityType = query.opportunityType;
      if (query.status !== undefined) params.status = query.status;
      if (query.buyingIntent !== undefined) params.buyingIntent = query.buyingIntent;
      if (query.minScore !== undefined) params.minScore = query.minScore;
      if (query.sourceId !== undefined) params.sourceId = query.sourceId;
      if (query.search !== undefined) params.search = query.search;

      const { rows, total } = await listOpportunities(params);
      return {
        data: rows,
        pagination: { page: query.page, pageSize: query.pageSize, total },
      };
    },
  );

  server.get(
    '/opportunities/:id',
    {
      schema: {
        tags: ['opportunities'],
        summary: 'Get opportunity detail',
        description: 'Returns an opportunity with its evidence, matched skills, and latest lead score.',
        params: idParams,
        response: {
          200: dataResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const detail = await getOpportunityDetail(request.params.id);
      if (detail === null) {
        return reply.status(404).send({
          error: { message: 'Opportunity not found', statusCode: 404 },
        });
      }
      return { data: detail };
    },
  );

  server.patch(
    '/opportunities/:id',
    {
      schema: {
        tags: ['opportunities'],
        summary: 'Update opportunity status',
        description: 'Updates the workflow status of an opportunity (qualify, reject, archive, etc.).',
        params: idParams,
        body: statusBody,
        response: {
          200: dataResponse,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { status } = request.body;
      await updateOpportunityStatus(id, status);
      return { data: { id, status } };
    },
  );

  server.post(
    '/opportunities/:id/feedback',
    {
      schema: {
        tags: ['opportunities'],
        summary: 'Record opportunity feedback',
        description: 'Stores relevance, rating, and notes feedback for an opportunity.',
        params: idParams,
        body: feedbackBody,
        response: {
          201: dataResponse,
        },
      },
    },
    async (request, reply) => {
      const feedback = await insertFeedback({
        opportunityId: request.params.id,
        isRelevant: request.body.isRelevant ?? null,
        rating: request.body.rating ?? null,
        notes: request.body.notes ?? null,
      });
      return reply.status(201).send({ data: feedback });
    },
  );

  server.post(
    '/opportunities/:id/outreach-drafts',
    {
      schema: {
        tags: ['opportunities'],
        summary: 'Generate an outreach draft',
        description:
          'Generates a human-reviewable outreach draft for an opportunity. Draft-only: nothing is sent or persisted.',
        params: idParams,
        response: {
          201: dataResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const detail = await getOpportunityDetail(request.params.id);
      if (detail === null) {
        return reply.status(404).send({
          error: { message: 'Opportunity not found', statusCode: 404 },
        });
      }

      const draft = await generateOutreachDraft(
        {
          title: detail.title,
          description: detail.description,
          opportunityType: detail.opportunityType,
          targetCustomer: detail.targetCustomer,
          buyingIntent: detail.buyingIntent,
          matchedSkills: detail.skills.map((skill) => skill.name),
        },
        getAiProvider(),
      );

      return reply.status(201).send({ data: draft });
    },
  );
};

export default opportunitiesRoutes;
