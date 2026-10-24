import { z } from "zod";
import { EpisodeNo, Id } from "./common";

// ---- works/<作品>/work.yaml

export const Work = z.strictObject({
  id: Id,
  title: z.string(),
  status: z.enum(["構想中", "連載中", "休載", "完結"]),
  publish: z
    .array(
      z.strictObject({
        site: z.enum(["narou", "kakuyomu"]),
        ncode: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
      }),
    )
    .default([]),
  schedule: z.strictObject({
    cadence: z.enum(["weekly", "biweekly", "manual"]),
    wip_limit: z.number().int().positive().default(1),
  }),
  /** 1 話の字数(空白を除いた文字数。check/text.ts の countChars)。値はここ 1 か所で変える */
  length: z
    .strictObject({
      target_chars: z.number().int().positive(),
      /** これを超える本文・字数予算は CI が落とす */
      max_chars: z.number().int().positive(),
    })
    .refine((l) => l.target_chars <= l.max_chars, "target_chars は max_chars 以下にする"),
  /**
   * 版。current がちょうど 1 つ。現行版の話は works/<作品>/episodes/、旧版は archive/editions/<id>/ に置き、
   * 旧版は照合・ルーティン・読者向け一覧の対象にしない(参照資料)
   */
  editions: z
    .array(
      z.strictObject({
        id: Id,
        status: z.enum(["current", "archived"]),
        title: z.string(),
        started: z.string().optional(),
        episodes: z.tuple([EpisodeNo, EpisodeNo]).nullable().optional(),
        path: z.string().optional(),
        doc: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .refine(
      (es) => es.filter((e) => e.status === "current").length === 1,
      "current の版はちょうど 1 つ",
    )
    .optional(),
  chapters: z.array(
    z.strictObject({
      no: z.number().int().positive(),
      title: z.string(),
      episodes: z.tuple([EpisodeNo, EpisodeNo]),
    }),
  ),
});
export type Work = z.infer<typeof Work>;

// ---- works/<作品>/arcs.yaml(章構成)

export const Arcs = z.strictObject({
  scale: z.string().optional(),
  policy: z.array(z.string()).optional(),
  chapters: z.array(
    z.strictObject({
      no: z.number().int().positive(),
      title: z.string(),
      status: z.enum(["確定", "仮"]),
      theme: z.string(),
      closing_type: z.string().nullable().optional(),
      arcs: z
        .array(
          z.strictObject({
            name: z.string(),
            episodes: z.tuple([EpisodeNo, EpisodeNo]),
            summary: z.string(),
          }),
        )
        .optional(),
      episodes: z
        .array(
          z.strictObject({
            ep: EpisodeNo,
            title: z.string().nullable().optional(),
            sketch: z.string(),
            hook: z.string().nullable().optional(),
          }),
        )
        .optional(),
      notes: z.array(z.string()).optional(),
    }),
  ),
  engines: z.array(z.string()).optional(),
});
export type Arcs = z.infer<typeof Arcs>;

// ---- works/<作品>/handoff.yaml(申し送り)

export const Handoff = z.strictObject({
  items: z.array(
    z.strictObject({
      id: Id,
      /** 対象の話。null は「話をまたいで持続する原則」 */
      target: EpisodeNo.nullable(),
      kind: z.enum(["原則", "弱点", "資源", "温存", "表現", "事務", "構成"]),
      text: z.string(),
      source: z.string().optional(),
      status: z.enum(["open", "consumed", "kept", "dropped"]),
      resolved_in: EpisodeNo.nullable().optional(),
    }),
  ),
});
export type Handoff = z.infer<typeof Handoff>;

// ---- craft/ledger.yaml, works/<作品>/ledger.yaml(再発防止規則。旧・指摘台帳)

export const Ledger = z.strictObject({
  rules: z.array(
    z.strictObject({
      id: z.string().regex(/^R-[0-9A-Z]+$/),
      kind: z.enum(["禁止", "維持"]),
      group: z.string(),
      text: z.string(),
      /** 機械で拾えるならパターン(正規表現)。lint が本文全体に当てる */
      pattern: z.string().optional(),
      check: z.enum(["pattern", "lint", "review"]),
      origin: z.string().optional(),
      date: z.string().optional(),
    }),
  ),
});
export type Ledger = z.infer<typeof Ledger>;

// ---- works/<作品>/feedback/NNN.yaml(PR コメントの記録)

export const FeedbackTag = z
  .string()
  .regex(/^(vocab|punctuation|structure|canon|praise|taste|layout|voice:[A-Za-z0-9._-]+)$/);

export const Feedback = z.strictObject({
  episode: EpisodeNo,
  pr: z.number().int().positive().nullable(),
  rounds: z.number().int().nonnegative(),
  items: z.array(
    z.strictObject({
      id: z.string(),
      source: z.string(),
      comment_id: z.number().int().nullable().optional(),
      round: z.number().int().nonnegative(),
      path: z.string().optional(),
      lines: z.array(z.number().int()).optional(),
      quote: z.string().optional(),
      body: z.string(),
      tags: z.array(FeedbackTag),
      decision: z.enum(["採用", "却下", "保留", "依頼者決定"]),
      reason: z.string().nullable().optional(),
      change: z.strictObject({ before: z.string(), after: z.string() }).optional(),
      rule_ref: z.string().nullable().optional(),
      /** vocab に分類したとき、足した辞書のパターン(CI が辞書にあるか確かめる) */
      vocab_pattern: z.string().optional(),
      created_at: z.string().optional(),
    }),
  ),
  reviews: z
    .array(z.strictObject({ reviewer: z.string(), round: z.number().int(), summary: z.string() }))
    .default([]),
  retro: z
    .array(z.strictObject({ rule: z.string(), decision: z.string(), why: z.string() }))
    .default([]),
});
export type Feedback = z.infer<typeof Feedback>;
