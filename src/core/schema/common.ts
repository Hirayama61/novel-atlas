import { z } from "zod";

/** 確定は照合で食い違えば CI を落とす。仮は警告だけ */
export const Status = z.enum(["確定", "仮"]);
export type Status = z.infer<typeof Status>;

/** canon の事実の ID。ドット・ハイフン区切りの ASCII */
export const Id = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "ID は ASCII の英数字と . _ - で書く");

/** 出典。行番号は持たず、本文の部分文字列で持つ(改稿で行がずれても切れない) */
export const Source = z.strictObject({
  ep: z.number().int().positive(),
  quote: z.string().min(1),
});
export type Source = z.infer<typeof Source>;

export const EpisodeNo = z.number().int().positive();

/** すべての事実が持つ項目 */
export const factFields = {
  id: Id,
  status: Status,
  since: EpisodeNo.nullable().optional(),
  sources: z.array(Source).optional(),
  note: z.string().optional(),
};
