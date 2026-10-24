import type { Source } from "../schema";
import type { Finding, WorkData } from "../data/work";
import { episodeDir } from "../data/files";
import { containsQuote, lineOf } from "./text";

const base = (w: WorkData) => `works/${w.id}`;

/** 作品内で参照できる ID の一覧(種類ごと) */
export function collectIds(w: WorkData) {
  const characters = new Set(w.characters.map((c) => c.id));
  const places = new Set((w.places?.places ?? []).map((p) => p.id));
  const threads = new Set(w.threads.map((t) => t.id));
  const facts = new Set<string>([...characters, ...places, ...threads]);
  for (const c of w.characters) {
    for (const a of c.attributes ?? []) facts.add(a.id);
    for (const k of c.core ?? []) facts.add(k.id);
  }
  for (const a of w.timeline?.anchors ?? []) facts.add(a.id);
  for (const e of w.timeline?.events ?? []) facts.add(e.id);
  for (const a of w.rules?.abilities ?? []) facts.add(a.id);
  for (const c of w.rules?.constraints ?? []) facts.add(c.id);
  const calendars = new Set((w.timeline?.calendars ?? []).map((c) => c.id));
  const anchors = new Set(
    [...(w.timeline?.anchors ?? []), ...(w.timeline?.events ?? [])].map((e) => e.id),
  );
  const handoff = new Set((w.handoff?.items ?? []).map((h) => h.id));
  return { characters, places, threads, facts, calendars, anchors, handoff };
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}

/** 参照: 存在しない ID・重複 ID */
export function checkReferences(w: WorkData): Finding[] {
  const out: Finding[] = [];
  const ids = collectIds(w);
  const err = (path: string, message: string) =>
    out.push({ level: "error", check: "参照", path, message });

  const all: string[] = [];
  for (const c of w.characters) {
    all.push(c.id, ...(c.attributes ?? []).map((a) => a.id), ...(c.core ?? []).map((k) => k.id));
  }
  all.push(...w.threads.map((t) => t.id), ...(w.places?.places ?? []).map((p) => p.id));
  all.push(
    ...(w.timeline?.events ?? []).map((e) => e.id),
    ...(w.timeline?.anchors ?? []).map((a) => a.id),
  );
  all.push(
    ...(w.rules?.abilities ?? []).map((a) => a.id),
    ...(w.rules?.constraints ?? []).map((c) => c.id),
  );
  for (const d of duplicates(all)) err(`${base(w)}/canon`, `ID が重複している: ${d}`);

  for (const c of w.characters) {
    const p = `${base(w)}/canon/characters/${c.id}.yaml`;
    for (const r of c.relations ?? [])
      if (!ids.characters.has(r.to)) err(p, `relations.to が未登録のキャラ: ${r.to}`);
    for (const k of c.knowledge ?? [])
      if (!ids.facts.has(k.fact)) err(p, `knowledge.fact が未登録の事実: ${k.fact}`);
  }
  const tl = `${base(w)}/canon/timeline.yaml`;
  for (const e of [...(w.timeline?.events ?? []), ...(w.timeline?.anchors ?? [])]) {
    for (const when of [e.when, "also" in e ? e.also : undefined]) {
      if (!when) continue;
      if ("calendar" in when && when.calendar && !ids.calendars.has(when.calendar))
        err(tl, `${e.id}: 未登録のカレンダー ${when.calendar}`);
      for (const k of ["after", "before"] as const) {
        const ref = k in when ? (when as Record<string, string | undefined>)[k] : undefined;
        if (ref && !ids.anchors.has(ref)) err(tl, `${e.id}: ${k} が未登録の出来事 ${ref}`);
      }
    }
    if ("participants" in e) {
      for (const pid of e.participants ?? [])
        if (!ids.characters.has(pid)) err(tl, `${e.id}: 未登録のキャラ ${pid}`);
      for (const pl of e.places ?? [])
        if (!ids.places.has(pl)) err(tl, `${e.id}: 未登録の場所 ${pl}`);
    }
  }
  for (const pl of w.places?.places ?? []) {
    if (pl.parent && !ids.places.has(pl.parent))
      err(`${base(w)}/canon/places.yaml`, `${pl.id}: parent が未登録 ${pl.parent}`);
  }
  for (const a of w.rules?.abilities ?? []) {
    if (!ids.characters.has(a.holder))
      err(`${base(w)}/canon/rules.yaml`, `${a.id}: holder が未登録 ${a.holder}`);
  }
  return out;
}

/** 出典: 引用が本文に見つかるか */
export function checkSources(w: WorkData): Finding[] {
  const out: Finding[] = [];
  const check = (path: string, owner: string, sources: Source[] | undefined) => {
    for (const s of sources ?? []) {
      const text = w.episodes.get(s.ep)?.text;
      if (text === undefined) {
        out.push({
          level: "error",
          check: "出典",
          path,
          message: `${owner}: 第${s.ep}話の本文が無い`,
        });
      } else if (!containsQuote(text, s.quote)) {
        out.push({
          level: "error",
          check: "出典",
          path,
          message: `${owner}: 第${s.ep}話に引用が見つからない「${s.quote}」`,
        });
      }
    }
  };
  for (const c of w.characters) {
    const p = `${base(w)}/canon/characters/${c.id}.yaml`;
    check(p, c.id, c.sources);
    for (const a of c.attributes ?? []) check(p, a.id, a.sources);
    for (const k of c.core ?? []) check(p, k.id, k.sources);
  }
  for (const e of [...(w.timeline?.events ?? []), ...(w.timeline?.anchors ?? [])])
    check(`${base(w)}/canon/timeline.yaml`, e.id, e.sources);
  for (const t of w.threads) {
    const p = `${base(w)}/canon/threads.yaml`;
    check(p, t.id, t.sources);
    check(p, `${t.id}.planted`, t.planted?.sources);
    for (const ev of t.events ?? []) check(p, `${t.id}.events`, ev.sources);
  }
  for (const pl of w.places?.places ?? []) check(`${base(w)}/canon/places.yaml`, pl.id, pl.sources);
  for (const a of w.rules?.abilities ?? []) check(`${base(w)}/canon/rules.yaml`, a.id, a.sources);
  for (const c of w.rules?.constraints ?? []) check(`${base(w)}/canon/rules.yaml`, c.id, c.sources);
  return out;
}

/** 章番号 → その章の最初の話 */
function chapterStart(w: WorkData, chapter: number): number | null {
  return w.work?.chapters.find((c) => c.no === chapter)?.episodes[0] ?? null;
}

/** 封印語・表記・描写の防衛線を本文に当てる */
export function checkTextAgainstCanon(w: WorkData, only?: number): Finding[] {
  const out: Finding[] = [];
  for (const [no, ep] of w.episodes) {
    if (only !== undefined && no !== only) continue;
    if (!ep.text) continue;
    const path = `${base(w)}/episodes/${episodeDir(no)}/text.md`;
    const hit = (re: RegExp, check: string, message: string, level: Finding["level"] = "error") => {
      ep.text!.split(/\r?\n/).forEach((l, i) => {
        if (re.test(l)) out.push({ level, check, path, line: i + 1, message });
      });
    };

    for (const s of w.rules?.sealed_terms ?? []) {
      const until =
        s.until?.episode ??
        (s.until?.chapter !== undefined ? chapterStart(w, s.until.chapter) : null) ??
        Infinity;
      if (no < until)
        hit(
          new RegExp(s.pattern),
          "封印語",
          `第${until === Infinity ? "?" : until}話まで出さない語: ${s.pattern}`,
        );
    }
    for (const t of w.threads) {
      const nb = t.reveal?.not_before;
      if (!nb || no >= nb) continue;
      const level = t.status === "確定" ? "error" : "warning";
      for (const term of t.sealed_terms ?? [])
        hit(new RegExp(term), "封印語", `${t.id} は第${nb}話まで明かさない: ${term}`, level);
    }
    for (const lx of w.rules?.lexicon ?? []) {
      for (const bad of lx.avoid) {
        // avoid は正規表現(「(?<!几)帳面」のように、別の語の一部を外せる)
        const re = new RegExp(bad, "u");
        ep.text.split(/\r?\n/).forEach((l, i) => {
          if (!re.test(l)) return;
          const excepted = (lx.except ?? []).some((e) => e.ep === no && l.includes(e.quote));
          if (!excepted)
            out.push({
              level: "error",
              check: "表記",
              path,
              line: i + 1,
              message: `「${bad}」は「${lx.prefer}」で書く`,
            });
        });
      }
    }
    for (const c of w.rules?.constraints ?? []) {
      const level = c.status === "確定" ? "error" : "warning";
      for (const p of c.forbidden_patterns ?? [])
        hit(new RegExp(p), "防衛線", `${c.id}: ${c.text}`, level);
    }
  }
  return out;
}

/** 伏線の義務(期限を過ぎた残債)と回収の順序 */
export function checkThreads(w: WorkData): Finding[] {
  const out: Finding[] = [];
  const path = `${base(w)}/canon/threads.yaml`;
  const published = Math.max(0, ...[...w.episodes.values()].filter((e) => e.text).map((e) => e.no));
  for (const t of w.threads) {
    const evs = t.events ?? [];
    const payoff = evs.find((e) => e.kind === "payoff");
    const plantEp = t.planted?.ep ?? evs.find((e) => e.kind === "plant")?.ep;
    if (payoff && plantEp !== undefined && payoff.ep < plantEp)
      out.push({
        level: "error",
        check: "伏線",
        path,
        message: `${t.id}: 撒く前(第${plantEp}話)に回収している(第${payoff.ep}話)`,
      });
    if (payoff && t.reveal?.not_before && payoff.ep < t.reveal.not_before)
      out.push({
        level: t.status === "確定" ? "error" : "warning",
        check: "伏線",
        path,
        message: `${t.id}: 第${t.reveal.not_before}話より前に回収している`,
      });
    for (const o of t.obligations ?? []) {
      const due =
        o.due?.by_episode ??
        (o.due?.by_chapter !== undefined ? chapterStart(w, o.due.by_chapter + 1) : null);
      if (due && !payoff && published >= due)
        out.push({
          level: "warning",
          check: "伏線",
          path,
          message: `${t.id}: 期限を過ぎた残債「${o.text}」`,
        });
    }
  }
  return out;
}

/**
 * 確定の根拠: basis が 本文 の事実は、現行版の本文の出典が付くまで 確定 にできない。
 * 旧版の本文で成り立っていた事実は、新版で書かれてマージされたとき(sync-merged)に 確定 へ戻る。
 */
export function checkBasis(w: WorkData): Finding[] {
  const out: Finding[] = [];
  const written = (ep: number | null | undefined) => ep != null && !!w.episodes.get(ep)?.text;
  const need = (path: string, id: string, ok: boolean) => {
    if (!ok)
      out.push({
        level: "error",
        check: "確定の根拠",
        path,
        message: `${id}: 本文で成り立つ事実(basis: 本文)が、現行版の出典なしで 確定 になっている。仮 に戻すか出典を付ける`,
      });
  };
  type F = { id: string; status: string; basis?: string; sources?: { ep: number }[] };
  const fact = (path: string, f: F) => {
    if (f.basis === "本文" && f.status === "確定")
      need(
        path,
        f.id,
        (f.sources ?? []).some((s) => written(s.ep)),
      );
  };
  for (const c of w.characters) {
    const p = `${base(w)}/canon/characters/${c.id}.yaml`;
    fact(p, c);
    for (const a of c.attributes ?? []) fact(p, a);
    for (const k of c.core ?? []) fact(p, k);
    for (const r of c.relations ?? [])
      if (r.basis === "本文" && r.status === "確定")
        need(p, `${c.id}.relations.${r.to}`, written(r.since));
    for (const k of c.knowledge ?? [])
      if (k.basis === "本文" && k.status === "確定")
        need(p, `${c.id}.knowledge.${k.fact}`, written(k.from));
  }
  for (const e of [...(w.timeline?.events ?? []), ...(w.timeline?.anchors ?? [])])
    fact(`${base(w)}/canon/timeline.yaml`, e);
  for (const t of w.threads)
    fact(`${base(w)}/canon/threads.yaml`, {
      ...t,
      sources: [...(t.sources ?? []), ...(t.planted?.sources ?? [])],
    });
  for (const pl of w.places?.places ?? []) fact(`${base(w)}/canon/places.yaml`, pl);
  for (const a of w.rules?.abilities ?? []) fact(`${base(w)}/canon/rules.yaml`, a);
  for (const c of w.rules?.constraints ?? []) fact(`${base(w)}/canon/rules.yaml`, c);
  return out;
}

export function checkCanon(w: WorkData): Finding[] {
  return [
    ...checkReferences(w),
    ...checkSources(w),
    ...checkBasis(w),
    ...checkTextAgainstCanon(w),
    ...checkThreads(w),
  ];
}

export { lineOf };
