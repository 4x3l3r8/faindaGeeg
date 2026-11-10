import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateSkill, usePatchSkill, useSkills } from '@/lib/hooks';
import type { Skill, SkillInput } from '@/lib/types';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function parseProficiency(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) return undefined;
  return parsed;
}

function SkillRow({ skill }: { skill: Skill }) {
  const patch = usePatchSkill();
  const [proficiency, setProficiency] = useState<string>(
    skill.proficiency === null ? '' : String(skill.proficiency),
  );

  useEffect(() => {
    setProficiency(skill.proficiency === null ? '' : String(skill.proficiency));
  }, [skill.proficiency]);

  function commitProficiency() {
    const parsed = parseProficiency(proficiency);
    if (parsed === undefined) {
      setProficiency(skill.proficiency === null ? '' : String(skill.proficiency));
      return;
    }
    if (parsed === skill.proficiency) return;
    patch.mutate({ id: skill.id, patch: { proficiency: parsed } });
  }

  function toggleEnabled() {
    patch.mutate({ id: skill.id, patch: { isEnabled: !skill.isEnabled } });
  }

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 ${
        skill.isEnabled ? '' : 'opacity-50'
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{skill.name}</span>
          {skill.isEnabled ? null : <span className="text-xs text-muted-foreground">Disabled</span>}
        </div>
        {skill.aliases.length > 0 ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{skill.aliases.join(', ')}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Proficiency</span>
          <input
            type="number"
            min={1}
            max={5}
            className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            value={proficiency}
            onChange={(event) => setProficiency(event.target.value)}
            onBlur={commitProficiency}
            disabled={patch.isPending}
          />
        </label>

        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={skill.isEnabled}
            onChange={toggleEnabled}
            disabled={patch.isPending}
          />
          <span className="text-xs text-muted-foreground">Enabled</span>
        </label>
      </div>

      {patch.isError ? (
        <p className="w-full text-sm text-destructive">{errorMessage(patch.error)}</p>
      ) : null}
    </li>
  );
}

function AddSkillCard() {
  const create = useCreateSkill();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [proficiency, setProficiency] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim() === '' || category.trim() === '') return;

    const input: SkillInput = { name: name.trim(), category: category.trim() };
    const parsed = parseProficiency(proficiency);
    if (parsed !== undefined && parsed !== null) input.proficiency = parsed;

    create.mutate(input, {
      onSuccess: () => {
        setName('');
        setCategory('');
        setProficiency('');
      },
    });
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Add skill</CardTitle>
        <CardDescription>Skills drive skill-fit scoring for incoming opportunities.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <input
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                placeholder="e.g. TypeScript"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={create.isPending}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Category</span>
              <input
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                placeholder="e.g. Languages"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={create.isPending}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Proficiency (1-5)</span>
              <input
                type="number"
                min={1}
                max={5}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                value={proficiency}
                onChange={(event) => setProficiency(event.target.value)}
                disabled={create.isPending}
              />
            </label>
          </div>

          <div>
            <Button
              type="submit"
              disabled={create.isPending || name.trim() === '' || category.trim() === ''}
            >
              {create.isPending ? 'Adding…' : 'Add skill'}
            </Button>
          </div>

          {create.error ? (
            <p className="text-sm text-destructive">{errorMessage(create.error)}</p>
          ) : null}
          {create.isSuccess ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Skill added.</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

export function SkillsPage() {
  const skills = useSkills();

  const grouped = new Map<string, Skill[]>();
  for (const skill of skills.data ?? []) {
    const list = grouped.get(skill.category) ?? [];
    list.push(skill);
    grouped.set(skill.category, list);
  }
  const categories = [...grouped.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Skills &amp; Profile</h1>
        <p className="text-sm text-muted-foreground">
          Describe your skills and focus to sharpen recommendations.
        </p>
      </div>

      <AddSkillCard />

      {skills.isPending ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Loading skills…
          </CardContent>
        </Card>
      ) : null}

      {skills.isError ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-destructive">
            {errorMessage(skills.error)}
          </CardContent>
        </Card>
      ) : null}

      {skills.data && skills.data.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No skills yet — add one above
          </CardContent>
        </Card>
      ) : null}

      {categories.map((category) => (
        <Card key={category}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">{category}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <ul className="space-y-2">
              {(grouped.get(category) ?? []).map((skill) => (
                <SkillRow key={skill.id} skill={skill} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
