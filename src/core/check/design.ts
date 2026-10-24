import type { Design } from "../schema";
import type { Finding, WorkData } from "../data/work";
import { episodeDir } from "../data/files";
import { collectIds } from "./canon";
import { containsQuote, countChars } from "./text";

/** 04 の「設計段階の CI」。published(移行した確定話)は欄の欠けを警告に落とす */
export function checkDesign(w: WorkData, d: Design): Finding[] {
  const out: Finding[] = [];
  const path = `works/${w.id}/episodes/${episodeDir(d.episode)}/design.yaml`;
  const legacy = d.status === "published";
  const add = (level: Finding["level"], check: string, message: string) =>
    out.push({
      level: legacy && level === "error" && check !== "参照" ? "warning" : level,
      check,
      path,
      message,
    });
  const ids = collectIds(w);

  const scenes = d.synopsis.flatMap((p) => p.scenes);
  const sceneIds = new Set(scenes.map((s) => s.id));

  if (d.showpieces.length === 0) add("error", "見せ場", "showpieces が 0 件");
  if (d.texture.length < 2) add("error", "テクスチャ", "texture が 2 件未満");
  else if (new Set(d.texture.map((t) => t.kind)).size < 2)
    add("error", "テクスチャ", "texture が全件同じ kind");

  const castIds = new Set(d.cast.map((c) => c.who));
  for (const s of scenes) {
    for (const c of s.characters) {
      if (!ids.characters.has(c)) add("error", "参照", `${s.id}: 未登録のキャラ ${c}`);
      if (!castIds.has(c)) add("error", "キャスト", `${s.id} に出る ${c} が cast に無い`);
    }
    if (s.place && !ids.places.has(s.place))
      add("error", "参照", `${s.id}: 未登録の場所 ${s.place}`);
  }
  for (const c of d.cast) {
    if (!ids.characters.has(c.who)) add("error", "参照", `cast: 未登録のキャラ ${c.who}`);
    if (!c.desire.trim() || !c.new_facet.trim())
      add("error", "キャスト", `${c.who}: desire か new_facet が空`);
  }

  const refScene = (label: string, id: string | null | undefined) => {
    if (id && !sceneIds.has(id)) add("error", "参照", `${label}: 未定義の場面 ${id}`);
  };
  refScene("hook", d.hook.scene);
  d.showpieces.forEach((s, i) => refScene(`showpieces[${i}]`, s.scene));
  d.texture.forEach((t, i) => refScene(`texture[${i}]`, t.scene));
  d.budget.emotional_core.scenes.forEach((s) => refScene("budget.emotional_core", s));

  // 型の反復(直近 2 話)
  for (const prev of [d.episode - 1, d.episode - 2]) {
    const pd = w.episodes.get(prev)?.design;
    if (pd && pd.type.label === d.type.label)
      add("warning", "型の反復", `第${prev}話と同じ型: ${d.type.label}`);
    if (pd && prev === d.episode - 1) {
      for (const c of d.cast) {
        const before = pd.cast.find((x) => x.who === c.who);
        if (before && before.action === c.action)
          add("warning", "同じビート", `${c.who}: 前話と同じ action`);
      }
    }
  }

  // 伏線
  const th = new Map(w.threads.map((t) => [t.id, t] as const));
  for (const kind of ["plant", "advance", "payoff"] as const) {
    for (const r of d.threads[kind])
      if (!th.has(r.id)) add("error", "参照", `threads.${kind}: 未登録の伏線 ${r.id}`);
  }
  for (const r of d.threads.payoff) {
    const t = th.get(r.id);
    const planted = t?.planted?.ep ?? t?.events?.find((e) => e.kind === "plant")?.ep;
    if (
      t &&
      (planted === undefined || planted >= d.episode) &&
      !d.threads.plant.some((p) => p.id === r.id)
    )
      add("error", "伏線", `${r.id}: 撒いていない伏線を回収する`);
    if (t?.reveal?.not_before && d.episode < t.reveal.not_before)
      add(
        t.status === "確定" ? "error" : "warning",
        "伏線",
        `${r.id}: 第${t.reveal.not_before}話より前に回収する`,
      );
  }
  for (const k of d.threads.keep) {
    if ([...d.threads.advance, ...d.threads.payoff].some((r) => r.id === k))
      add("error", "伏線", `${k}: keep と advance/payoff の両方にある`);
  }

  // 異能
  const ab = w.rules?.abilities[0];
  if (ab) {
    for (const a of d.ability_checks) {
      const fires = ab.trigger.kinds.includes(a.kind);
      const noFire = ab.no_trigger.kinds.includes(a.kind);
      if (a.expect_fire && noFire) add("error", "異能", `「${a.utterance}」: ${a.kind} は不発条件`);
      if (!a.expect_fire && fires)
        add("warning", "異能", `「${a.utterance}」: ${a.kind} は発動条件に入る`);
      if (a.expect_fire && ab.drift.required && !a.drift)
        add("error", "異能", `「${a.utterance}」: 発動するのにズレが無い`);
    }
  }

  // 知識
  const chars = new Map(w.characters.map((c) => [c.id, c] as const));
  for (const s of scenes) {
    for (const k of s.knowledge_use ?? []) {
      const kn = chars.get(k.who)?.knowledge?.find((x) => x.fact === k.fact);
      if (!kn) add("warning", "知識", `${s.id}: ${k.who} の ${k.fact} の知識状態が未定義`);
      else if (kn.from === null || kn.from > d.episode)
        add(
          kn.status === "確定" ? "error" : "warning",
          "知識",
          `${s.id}: ${k.who} は第${d.episode}話時点で ${k.fact} を知らない`,
        );
    }
  }

  // 字数
  const max = w.work?.length.max_chars;
  if (max && d.budget.total > max)
    add("error", "字数", `budget.total ${d.budget.total} 字が上限 ${max} 字(work.yaml)を超える`);
  if (d.budget.emotional_core.chars > d.budget.total)
    add("error", "字数", `感情の核 ${d.budget.emotional_core.chars} 字が budget.total を超える`);
  const sum = d.synopsis.reduce((a, p) => a + p.target_chars, 0);
  if (Math.abs(sum - d.budget.total) > d.budget.total * 0.1)
    add(
      "error",
      "字数",
      `各部の target_chars の合計 ${sum} が budget.total ${d.budget.total} と 10% 以上ずれる`,
    );

  // 申し送り
  for (const h of w.handoff?.items ?? []) {
    if (h.target === d.episode && h.status === "open" && !d.handoff_in.some((x) => x.id === h.id))
      add("error", "申し送り", `${h.id} がこの話向けの未消化の申し送りなのに handoff_in に無い`);
  }
  for (const x of d.handoff_in)
    if (!ids.handoff.has(x.id)) add("error", "参照", `handoff_in: 未登録の申し送り ${x.id}`);

  return out;
}

/** 04 の「本文段階の CI」。本文と claims が揃ったときだけ */
export function checkRealization(w: WorkData, d: Design, text: string): Finding[] {
  const out: Finding[] = [];
  const path = `works/${w.id}/episodes/${episodeDir(d.episode)}/text.md`;
  const total = countChars(text);
  if (Math.abs(total - d.budget.total) > d.budget.total * 0.25)
    out.push({
      level: "warning",
      check: "字数",
      path,
      message: `本文 ${total} 字。設計 ${d.budget.total} 字の ±25% を外れる`,
    });

  const claims = w.episodes.get(d.episode)?.claims;
  if (!claims) return out;
  const realized = new Set(claims.design_realization.map((r) => r.item));
  d.showpieces.forEach((_, i) => {
    if (!realized.has(`showpieces[${i}]`))
      out.push({
        level: "error",
        check: "設計の実現",
        path,
        message: `showpieces[${i}] の実現箇所が無い`,
      });
  });
  d.texture.forEach((_, i) => {
    if (!realized.has(`texture[${i}]`))
      out.push({
        level: "error",
        check: "設計の実現",
        path,
        message: `texture[${i}] の実現箇所が無い`,
      });
  });
  const named = new Set(claims.names.map((n) => n.resolves_to).filter(Boolean));
  for (const c of d.cast) {
    if (!named.has(c.who))
      out.push({
        level: "error",
        check: "設計の実現",
        path,
        message: `cast の ${c.who} が本文に出ない`,
      });
  }
  for (const r of claims.design_realization) {
    if (!containsQuote(text, r.quote))
      out.push({
        level: "error",
        check: "claims の引用",
        path,
        message: `${r.item}: 引用が本文に無い「${r.quote}」`,
      });
  }
  return out;
}
