import { z } from "zod";
import { Basis, EpisodeNo, Id, Source, Status, factFields } from "./common";

// ---- characters/<id>.yaml

const Attribute = z.strictObject({
  ...factFields,
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const CoreItem = z.strictObject({
  ...factFields,
  text: z.string(),
  reveal: z
    .strictObject({
      not_before: EpisodeNo.nullable().optional(),
      planned: z.string().nullable().optional(),
    })
    .optional(),
});

const AvoidItem = z.union([
  z.strictObject({ text: z.string(), note: z.string().optional() }),
  z.strictObject({ pattern: z.string(), note: z.string().optional() }),
]);

const Voice = z.strictObject({
  first_person: z.string().nullable().optional(),
  second_person: z
    .strictObject({
      default: z.string().nullable().optional(),
      toward: z.record(z.string(), z.string()).optional(),
      others: z.array(z.string()).optional(),
    })
    .optional(),
  endings: z.array(z.string()).optional(),
  vocabulary: z.array(z.string()).optional(),
  avoid: z.array(AvoidItem).optional(),
  established: z.strictObject({ endings: z.array(z.string()).optional() }).optional(),
  notes: z
    .array(
      z.strictObject({
        text: z.string(),
        evidence: z.array(z.string()).optional(),
        date: z.string().optional(),
      }),
    )
    .optional(),
});

const Relation = z.strictObject({
  to: Id,
  kind: z.string(),
  since: EpisodeNo.nullable().optional(),
  state: z.string().optional(),
  status: Status,
  basis: Basis.optional(),
});

const Knowledge = z.strictObject({
  fact: Id,
  /** この話から知っている。null は「知らない」を明示 */
  from: EpisodeNo.nullable(),
  until: EpisodeNo.nullable().optional(),
  how: z.string().optional(),
  /** 誤信。事実と違う理解で持っている */
  belief: z.string().optional(),
  status: Status,
  basis: Basis.optional(),
  note: z.string().optional(),
});

export const Character = z.strictObject({
  ...factFields,
  name: z.string(),
  aliases: z.array(z.string()).optional(),
  role: z.string().optional(),
  profile: z.record(z.string(), z.string()).optional(),
  attributes: z.array(Attribute).optional(),
  core: z.array(CoreItem).optional(),
  voice: Voice.optional(),
  relations: z.array(Relation).optional(),
  knowledge: z.array(Knowledge).optional(),
});
export type Character = z.infer<typeof Character>;

// ---- timeline.yaml

const When = z.union([
  z.strictObject({
    calendar: Id,
    day: z.number().int(),
    part: z.string().optional(),
    approx: z.string().optional(),
  }),
  z.strictObject({
    after: Id.optional(),
    before: Id.optional(),
    gap: z.strictObject({ days: z.number().optional(), approx: z.string().optional() }).optional(),
    approx: z.string().optional(),
  }),
  z.strictObject({ approx: z.string() }),
]);

export const Timeline = z.strictObject({
  calendars: z
    .array(
      z.strictObject({
        id: Id,
        label: z.string().optional(),
        length: z
          .strictObject({ days: z.number().optional(), approx: z.number().optional() })
          .optional(),
        note: z.string().optional(),
      }),
    )
    .default([]),
  anchors: z.array(z.strictObject({ ...factFields, label: z.string(), when: When })).default([]),
  events: z
    .array(
      z.strictObject({
        ...factFields,
        title: z.string(),
        when: When.optional(),
        also: When.optional(),
        episode: EpisodeNo.nullable().optional(),
        flashback: z.boolean().optional(),
        participants: z.array(Id).optional(),
        places: z.array(Id).optional(),
        detail: z.string().optional(),
      }),
    )
    .default([]),
});
export type Timeline = z.infer<typeof Timeline>;

// ---- threads.yaml

const ThreadEvent = z.strictObject({
  ep: EpisodeNo,
  kind: z.enum(["plant", "advance", "payoff", "echo"]),
  note: z.string().optional(),
  sources: z.array(Source).optional(),
});

export const Thread = z.strictObject({
  ...factFields,
  title: z.string(),
  kind: z.string(),
  planted: z
    .strictObject({ ep: EpisodeNo, sources: z.array(Source).optional() })
    .nullable()
    .optional(),
  answer: z.strictObject({ text: z.string(), status: Status }).optional(),
  reveal: z
    .strictObject({
      not_before: EpisodeNo.nullable().optional(),
      planned: z.string().nullable().optional(),
    })
    .optional(),
  sealed_terms: z.array(z.string()).optional(),
  events: z.array(ThreadEvent).optional(),
  options: z.array(z.string()).optional(),
  obligations: z
    .array(
      z.strictObject({
        text: z.string(),
        due: z
          .strictObject({
            by_episode: EpisodeNo.optional(),
            by_chapter: z.number().int().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  detail: z.string().optional(),
});
export const Threads = z.strictObject({ threads: z.array(Thread) });
export type Thread = z.infer<typeof Thread>;

// ---- rules.yaml

const Ability = z.strictObject({
  ...factFields,
  holder: Id,
  trigger: z.strictObject({ kinds: z.array(z.string()), weight: z.string().optional() }),
  no_trigger: z.strictObject({ kinds: z.array(z.string()), note: z.string().optional() }),
  effect: z.string(),
  drift: z.strictObject({ required: z.boolean(), kinds: z.array(z.string()) }),
  irreversible: z.boolean().optional(),
  scaling: z.string().optional(),
  stages: z.array(z.strictObject({ no: z.number().int(), text: z.string() })).optional(),
  guidance: z.array(z.string()).optional(),
});

const Constraint = z.strictObject({
  ...factFields,
  text: z.string(),
  forbidden_patterns: z.array(z.string()).optional(),
  review: z.string().optional(),
});

const SealedTerm = z.strictObject({
  pattern: z.string(),
  until: z
    .strictObject({ episode: EpisodeNo.optional(), chapter: z.number().int().optional() })
    .optional(),
  note: z.string().optional(),
});

const Lexicon = z.strictObject({
  prefer: z.string(),
  /** 避ける表記。正規表現(JavaScript、u フラグ) */
  avoid: z.array(z.string()),
  except: z.array(Source).optional(),
  note: z.string().optional(),
});

export const Rules = z.strictObject({
  abilities: z.array(Ability).default([]),
  constraints: z.array(Constraint).default([]),
  sealed_terms: z.array(SealedTerm).default([]),
  lexicon: z.array(Lexicon).default([]),
});
export type Rules = z.infer<typeof Rules>;

// ---- places.yaml / premise.yaml

export const Places = z.strictObject({
  places: z.array(
    z.strictObject({
      ...factFields,
      name: z.string(),
      aliases: z.array(z.string()).optional(),
      parent: Id.nullable().optional(),
      description: z.string().optional(),
    }),
  ),
});
export type Places = z.infer<typeof Places>;

const PremiseSection = z.record(z.string(), z.union([z.string(), z.array(z.string())]));
export const Premise = z.strictObject({
  surface: PremiseSection,
  hidden: PremiseSection,
});
export type Premise = z.infer<typeof Premise>;
