import type { Finding, WorkData } from "../data/work";
import { episodeDir } from "../data/files";
import { collectIds } from "./canon";
import { containsQuote } from "./text";

/**
 * claims.yaml(本文から LLM が抽出した事実)の検査。判定は決定的に行う。
 * shaOf は本文の git blob SHA を返す(Node では git と同じ計算、ブラウザでは tree の SHA)。
 * 投稿済み(design.status = published)の話は claims が無くてもよい。それ以外で本文がある話は必須。
 */
export function checkClaims(
  w: WorkData,
  shaOf: (text: string) => string,
  only?: number,
): Finding[] {
  const out: Finding[] = [];
  const ids = collectIds(w);
  const chars = new Map(w.characters.map((c) => [c.id, c] as const));
  for (const [no, ep] of w.episodes) {
    if (only !== undefined && no !== only) continue;
    if (!ep.text) continue;
    const path = `works/${w.id}/episodes/${episodeDir(no)}/claims.yaml`;
    const err = (check: string, message: string, line?: number) =>
      out.push({ level: "error", check, path, message, ...(line ? { line } : {}) });
    const c = ep.claims;
    if (!c) {
      if (ep.design && ep.design.status !== "published")
        err("claims の鮮度", "本文があるのに claims.yaml が無い");
      continue;
    }
    if (c.text_sha !== shaOf(ep.text))
      err("claims の鮮度", "本文が変わったのに claims を抽出し直していない(text_sha が違う)");

    const quotes: [string, string][] = [
      ...c.names.map((n) => ["names", n.quote] as [string, string]),
      ...c.facts.map((f) => ["facts", f.quote] as [string, string]),
      ...c.events.map((f) => ["events", f.quote] as [string, string]),
      ...c.time_markers.map((f) => ["time_markers", f.quote] as [string, string]),
      ...c.knowledge_use.map((f) => ["knowledge_use", f.quote] as [string, string]),
      ...c.ability_use.map((f) => ["ability_use", f.quote] as [string, string]),
      ...c.threads.map((f) => ["threads", f.quote] as [string, string]),
      ...c.design_realization.map((f) => ["design_realization", f.quote] as [string, string]),
    ];
    for (const [k, q] of quotes)
      if (!containsQuote(ep.text, q)) err("claims の引用", `${k}: 本文に無い引用「${q}」`);

    const ref = (k: string, id: string, set: Set<string>) => {
      if (!set.has(id)) err("参照", `${k}: 未登録の ID ${id}`);
    };
    for (const n of c.names)
      if (n.resolves_to) ref("names", n.resolves_to, new Set([...ids.characters, ...ids.places]));
    for (const s of c.speakers) if (s.who) ref("speakers", s.who, ids.characters);
    for (const f of c.facts) ref("facts", f.about, ids.facts);
    for (const t of c.threads) ref("threads", t.id, ids.threads);
    for (const k of c.knowledge_use) {
      ref("knowledge_use", k.who, ids.characters);
      ref("knowledge_use", k.fact, ids.facts);
    }

    const lines = ep.text.split(/\r?\n/);
    for (const s of c.speakers) {
      if (s.line > lines.length) err("claims の引用", `speakers: ${s.line} 行目は本文に無い`);
    }

    // 未登録の固有名
    for (const n of c.names) {
      if (n.resolves_to === null)
        out.push({
          level: "warning",
          check: "固有名",
          path,
          message: `未登録の固有名「${n.quote}」(新規なら canon に足す)`,
        });
    }

    // 知識: 知る前の話で知っている前提で動く
    for (const k of c.knowledge_use) {
      const kn = chars.get(k.who)?.knowledge?.find((x) => x.fact === k.fact);
      if (!kn) continue;
      if (kn.from === null || kn.from > no)
        out.push({
          level: kn.status === "確定" ? "error" : "warning",
          check: "知識",
          path,
          message: `${k.who} は第${no}話時点で ${k.fact} を知らない「${k.quote}」`,
        });
    }

    // 異能: 不発条件で発動、発動したのにズレ無し
    const ab = w.rules?.abilities[0];
    if (ab) {
      for (const a of c.ability_use) {
        if (a.fired && ab.no_trigger.kinds.includes(a.kind))
          err("異能", `「${a.quote}」: ${a.kind} は不発条件なのに発動している`);
        if (a.fired && ab.drift.required && !a.drift)
          err("異能", `「${a.quote}」: 発動したのにズレが無い`);
      }
    }

    // 口調: 話者の行に、そのキャラが使わない語が出る
    const textPath = `works/${w.id}/episodes/${episodeDir(no)}/text.md`;
    for (const s of c.speakers) {
      const ch = s.who ? chars.get(s.who) : undefined;
      const line = lines[s.line - 1] ?? "";
      for (const a of ch?.voice?.avoid ?? []) {
        if ("pattern" in a && new RegExp(a.pattern, "u").test(line))
          out.push({
            level: "error",
            check: "口調",
            path: textPath,
            line: s.line,
            message: `${ch!.name} は「${a.pattern}」を使わない`,
          });
      }
    }
  }
  return out;
}
