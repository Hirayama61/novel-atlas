import { z } from "zod";
import { EpisodeNo, Id } from "./common";

// ---- episodes/NNN/design.yaml(話設計書)

export const EpisodeStatus = z.enum(["designing", "approved", "drafting", "reading", "published"]);

const KnowledgeUse = z.strictObject({ who: Id, fact: Id, note: z.string().optional() });

const Scene = z.strictObject({
  id: Id,
  place: Id.nullable().optional(),
  characters: z.array(Id),
  beats: z.array(z.string()).min(1),
  knowledge_use: z.array(KnowledgeUse).optional(),
});

const Part = z.strictObject({
  part: z.string(),
  target_chars: z.number().int().nonnegative(),
  summary: z.string().min(1),
  scenes: z.array(Scene).min(1),
});

const ThreadRef = z.strictObject({ id: Id, note: z.string().optional() });

export const Design = z.strictObject({
  work: Id,
  episode: EpisodeNo,
  title: z.strictObject({
    working: z.string(),
    final: z.string().nullable(),
    rejected: z.array(z.strictObject({ text: z.string(), why: z.string() })).optional(),
  }),
  position: z.strictObject({
    chapter: z.number().int().positive(),
    arc: z.string().nullable().optional(),
    role: z.string(),
  }),
  status: EpisodeStatus,
  emotion_goal: z.string().min(1),
  core: z.string().min(1),
  type: z.strictObject({
    label: z.string().min(1),
    recent: z.array(z.strictObject({ ep: EpisodeNo, label: z.string() })).optional(),
    breaks: z.array(z.strictObject({ who: Id, habit: z.string(), instead: z.string() })).optional(),
  }),
  time: z
    .strictObject({
      start: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      span: z
        .strictObject({ days: z.number().optional(), approx: z.string().optional() })
        .optional(),
      new_events: z.array(Id).optional(),
      flashback: z.boolean().optional(),
    })
    .optional(),
  synopsis: z.array(Part).min(1),
  hook: z.strictObject({ scene: Id, text: z.string().min(1), why: z.string().min(1) }),
  showpieces: z.array(z.strictObject({ scene: Id, picture: z.string().min(1) })),
  texture: z.array(
    z.strictObject({
      kind: z.string(),
      element: z.string().min(1),
      scene: Id.nullable().optional(),
    }),
  ),
  cast: z.array(
    z.strictObject({
      who: Id,
      desire: z.string(),
      action: z.string(),
      new_facet: z.string(),
    }),
  ),
  threads: z.strictObject({
    plant: z.array(ThreadRef).default([]),
    advance: z.array(ThreadRef).default([]),
    payoff: z.array(ThreadRef).default([]),
    keep: z.array(Id).default([]),
  }),
  ability_checks: z
    .array(
      z.strictObject({
        scene: Id.nullable().optional(),
        utterance: z.string(),
        kind: z.string(),
        expect_fire: z.boolean(),
        drift: z.string().nullable().optional(),
        lands_on: z.string().optional(),
      }),
    )
    .default([]),
  budget: z.strictObject({
    total: z.number().int().positive(),
    emotional_core: z.strictObject({ scenes: z.array(Id), chars: z.number().int().positive() }),
  }),
  handoff_in: z
    .array(
      z.strictObject({
        id: Id,
        action: z.enum(["consume", "defer", "drop"]),
        how: z.string().optional(),
        to: EpisodeNo.optional(),
        why: z.string().optional(),
      }),
    )
    .default([]),
  references: z
    .array(z.strictObject({ work: z.string(), item: z.string(), note: z.string().optional() }))
    .optional(),
  rejected: z
    .array(z.strictObject({ what: z.string(), why: z.string(), source: z.string().optional() }))
    .default([]),
  revisions: z
    .array(z.strictObject({ version: z.string(), date: z.string(), summary: z.string() }))
    .optional(),
  /** 移行前の設計書のうち、どの欄にも収まらなかった散文(移行した話だけが持つ) */
  legacy_notes: z.string().optional(),
});
export type Design = z.infer<typeof Design>;

// ---- episodes/NNN/claims.yaml(本文から抽出した事実。自動生成)

const Q = z.string().min(1);

export const Claims = z.strictObject({
  text_sha: z.string(),
  extractor: z.strictObject({ model: z.string(), prompt_version: z.number().int() }),
  speakers: z
    .array(z.strictObject({ line: z.number().int().positive(), who: Id.nullable() }))
    .default([]),
  names: z.array(z.strictObject({ quote: Q, resolves_to: Id.nullable() })).default([]),
  facts: z
    .array(
      z.strictObject({
        about: Id,
        value: z.union([z.string(), z.number(), z.boolean()]),
        quote: Q,
      }),
    )
    .default([]),
  events: z.array(z.strictObject({ id: Id, quote: Q })).default([]),
  time_markers: z
    .array(
      z.strictObject({
        quote: Q,
        relative_to: Id.nullable().optional(),
        gap_days: z.number().nullable().optional(),
        calendar: Id.optional(),
        day: z.number().int().optional(),
      }),
    )
    .default([]),
  knowledge_use: z.array(z.strictObject({ who: Id, fact: Id, quote: Q })).default([]),
  ability_use: z
    .array(
      z.strictObject({
        who: Id,
        quote: Q,
        kind: z.string(),
        fired: z.boolean(),
        drift: z.string().nullable().optional(),
      }),
    )
    .default([]),
  threads: z
    .array(
      z.strictObject({ id: Id, kind: z.enum(["plant", "advance", "payoff", "echo"]), quote: Q }),
    )
    .default([]),
  design_realization: z.array(z.strictObject({ item: z.string(), quote: Q })).default([]),
});
export type Claims = z.infer<typeof Claims>;

// ---- episodes/NNN/lint-allow.yaml

export const LintAllow = z.strictObject({
  allow: z.array(
    z.strictObject({
      rule: z.string(),
      quote: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
});
export type LintAllow = z.infer<typeof LintAllow>;
