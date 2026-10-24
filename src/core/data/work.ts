import { parse as parseYaml } from "yaml";
import type { z } from "zod";
import { schemaFor } from "./files";
import type {
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
  Thread,
  Timeline,
  Work,
} from "../schema";

/** 検査の結果 1 行。error は CI を落とす、warning は落とさない */
export interface Finding {
  level: "error" | "warning";
  check: string;
  path: string;
  line?: number;
  message: string;
}

export interface Episode {
  no: number;
  text?: string;
  design?: Design;
  claims?: Claims;
  lintAllow?: LintAllow;
}

/** 1 作品ぶんのデータ。ブラウザ(Contents API)と Node(ファイル)の両方から組み立てる */
export interface WorkData {
  id: string;
  work?: Work;
  arcs?: Arcs;
  handoff?: Handoff;
  ledger?: Ledger;
  characters: Character[];
  timeline?: Timeline;
  threads: Thread[];
  rules?: Rules;
  places?: Places;
  premise?: Premise;
  episodes: Map<number, Episode>;
  feedback: Map<number, Feedback>;
}

export interface DataSet {
  craftLedger?: Ledger;
  works: Map<string, WorkData>;
}

/** パス → 中身 の一覧を、スキーマで検証しながら DataSet に組み立てる */
export function buildDataSet(files: Map<string, string>): { data: DataSet; findings: Finding[] } {
  const findings: Finding[] = [];
  const data: DataSet = { works: new Map() };

  const work = (id: string): WorkData => {
    let w = data.works.get(id);
    if (!w) {
      w = { id, characters: [], threads: [], episodes: new Map(), feedback: new Map() };
      data.works.set(id, w);
    }
    return w;
  };
  const episode = (w: WorkData, no: number): Episode => {
    let e = w.episodes.get(no);
    if (!e) {
      e = { no };
      w.episodes.set(no, e);
    }
    return e;
  };

  for (const [path, content] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const m = /^works\/([^/]+)\/(.+)$/.exec(path);
    if (m && m[2] && /^episodes\/\d{3}\/text\.md$/.test(m[2])) {
      episode(work(m[1]!), Number(m[2].slice(9, 12))).text = content;
      continue;
    }
    const schema = schemaFor(path);
    if (!schema) continue;
    let raw: unknown;
    try {
      raw = parseYaml(content);
    } catch (e) {
      findings.push({
        level: "error",
        check: "schema",
        path,
        message: `YAML として読めない: ${(e as Error).message}`,
      });
      continue;
    }
    const parsed = (schema as z.ZodType).safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        findings.push({
          level: "error",
          check: "schema",
          path,
          message: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
        });
      }
      continue;
    }
    const v = parsed.data as never;
    if (path === "craft/ledger.yaml") {
      data.craftLedger = v;
      continue;
    }
    if (!m) continue;
    const w = work(m[1]!);
    const rest = m[2]!;
    if (rest === "work.yaml") w.work = v;
    else if (rest === "arcs.yaml") w.arcs = v;
    else if (rest === "handoff.yaml") w.handoff = v;
    else if (rest === "ledger.yaml") w.ledger = v;
    else if (rest.startsWith("canon/characters/")) w.characters.push(v);
    else if (rest === "canon/timeline.yaml") w.timeline = v;
    else if (rest === "canon/threads.yaml") w.threads = (v as { threads: Thread[] }).threads;
    else if (rest === "canon/rules.yaml") w.rules = v;
    else if (rest === "canon/places.yaml") w.places = v;
    else if (rest === "canon/premise.yaml") w.premise = v;
    else if (rest.startsWith("feedback/")) w.feedback.set(Number(rest.slice(9, 12)), v);
    else if (rest.startsWith("episodes/")) {
      const e = episode(w, Number(rest.slice(9, 12)));
      if (rest.endsWith("design.yaml")) e.design = v;
      else if (rest.endsWith("claims.yaml")) e.claims = v;
      else if (rest.endsWith("lint-allow.yaml")) e.lintAllow = v;
    }
  }
  return { data, findings };
}
