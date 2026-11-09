import type { FastifyPluginAsync } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { createSkill, listSkills, type SkillPatch, updateSkill } from './repository.js';

const errorResponse = z.object({
  error: z.object({ message: z.string(), statusCode: z.number() }),
});

const dataResponse = z.object({ data: z.any() });

const listResponse = z.object({ data: z.array(z.any()) });

const idParams = z.object({ id: z.string().uuid() });

const createBody = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  proficiency: z.number().int().nullish(),
  isEnabled: z.boolean().optional(),
});

const patchBody = z.object({
  isEnabled: z.boolean().optional(),
  proficiency: z.number().int().nullish(),
  category: z.string().min(1).optional(),
  aliases: z.array(z.string()).optional(),
});

const skillsRoutes: FastifyPluginAsync = async (app) => {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    '/skills',
    {
      schema: {
        tags: ['skills'],
        summary: 'List skills',
        description: 'Returns every skill in the profile, ordered by category and name.',
        response: {
          200: listResponse,
        },
      },
    },
    async () => {
      const rows = await listSkills();
      return { data: rows };
    },
  );

  server.post(
    '/skills',
    {
      schema: {
        tags: ['skills'],
        summary: 'Create a skill',
        description: 'Adds a skill to the profile. Existing skills with the same name are returned.',
        body: createBody,
        response: {
          201: dataResponse,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const skill = await createSkill({
        name: body.name,
        category: body.category,
        ...(body.aliases === undefined ? {} : { aliases: body.aliases }),
        ...(body.proficiency === undefined ? {} : { proficiency: body.proficiency }),
        ...(body.isEnabled === undefined ? {} : { isEnabled: body.isEnabled }),
      });
      return reply.status(201).send({ data: skill });
    },
  );

  server.patch(
    '/skills/:id',
    {
      schema: {
        tags: ['skills'],
        summary: 'Update a skill',
        description: 'Toggles a skill or updates its proficiency, category, or aliases.',
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
      const patch: SkillPatch = {};
      if (body.isEnabled !== undefined) patch.isEnabled = body.isEnabled;
      if (body.proficiency !== undefined) patch.proficiency = body.proficiency;
      if (body.category !== undefined) patch.category = body.category;
      if (body.aliases !== undefined) patch.aliases = body.aliases;

      const skill = await updateSkill(request.params.id, patch);
      if (skill === null) {
        return reply.status(404).send({
          error: { message: 'Skill not found', statusCode: 404 },
        });
      }
      return { data: skill };
    },
  );
};

export default skillsRoutes;
