import { parse as parseYaml } from "yaml";

/**
 * 設計承認のゲート。承認後の push で、話設計書の設計部が変わったかを判定する。
 * 本文段階で設計を本文に合わせて直してよいのは、場面の beats の文言・ability_checks の drift・状態と題名・rejected に限る。
 */
const FREE_KEYS = new Set([
  "status",
  "title",
  "rejected",
  "revisions",
  "legacy_notes",
  "references",
]);

function normalize(design: Record<string, unknown>): unknown {
  const d = structuredClone(design);
  for (const k of FREE_KEYS) delete d[k];
  const synopsis = d.synopsis as { scenes?: { beats?: unknown }[] }[] | undefined;
  for (const part of synopsis ?? []) for (const s of part.scenes ?? []) delete s.beats;
  for (const a of (d.ability_checks as { drift?: unknown }[] | undefined) ?? []) delete a.drift;
  return d;
}

/** before / after は design.yaml の中身(無ければ null)。設計部が変わったら true */
export function designChanged(before: string | null, after: string | null): boolean {
  if (before === null || after === null) return before !== after;
  const a = parseYaml(before) as Record<string, unknown>;
  const b = parseYaml(after) as Record<string, unknown>;
  return JSON.stringify(normalize(a)) !== JSON.stringify(normalize(b));
}
