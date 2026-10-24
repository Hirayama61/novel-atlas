import type { z } from "zod";
import {
  Arcs,
  Character,
  Claims,
  Design,
  Feedback,
  Handoff,
  Ledger,
  LintAllow,
  Places,
  Premise,
  Rules,
  Threads,
  Timeline,
  Work,
} from "../schema";

/** データリポジトリ内のパスと、それを検証するスキーマの対応 */
const ROUTES: [RegExp, z.ZodType][] = [
  [/^craft\/ledger\.yaml$/, Ledger],
  [/^works\/[^/]+\/work\.yaml$/, Work],
  [/^works\/[^/]+\/arcs\.yaml$/, Arcs],
  [/^works\/[^/]+\/handoff\.yaml$/, Handoff],
  [/^works\/[^/]+\/ledger\.yaml$/, Ledger],
  [/^works\/[^/]+\/canon\/characters\/[^/]+\.yaml$/, Character],
  [/^works\/[^/]+\/canon\/timeline\.yaml$/, Timeline],
  [/^works\/[^/]+\/canon\/threads\.yaml$/, Threads],
  [/^works\/[^/]+\/canon\/rules\.yaml$/, Rules],
  [/^works\/[^/]+\/canon\/places\.yaml$/, Places],
  [/^works\/[^/]+\/canon\/premise\.yaml$/, Premise],
  [/^works\/[^/]+\/episodes\/\d{3}\/design\.yaml$/, Design],
  [/^works\/[^/]+\/episodes\/\d{3}\/claims\.yaml$/, Claims],
  [/^works\/[^/]+\/episodes\/\d{3}\/lint-allow\.yaml$/, LintAllow],
  [/^works\/[^/]+\/feedback\/\d{3}\.yaml$/, Feedback],
];

export function schemaFor(path: string): z.ZodType | null {
  for (const [re, schema] of ROUTES) if (re.test(path)) return schema;
  return null;
}

export function episodeDir(no: number): string {
  return String(no).padStart(3, "0");
}
