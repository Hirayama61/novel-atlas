import type { Finding, WorkData, DataSet } from "../data/work";
import { episodeDir } from "../data/files";
import { FAILING_KINDS, lintPunctuation, parseVocab, type VocabEntry } from "../lint/punctuation";

export interface LintInput {
  data: DataSet;
  /** craft/lint/vocab.tsv の中身 */
  commonVocab?: string;
  /** 作品 ID → works/<作品>/lint/vocab.tsv の中身 */
  workVocab: Map<string, string>;
}

/** 本文の lint。only を渡すとその話だけ */
export function lintWork(w: WorkData, input: LintInput, only?: number): Finding[] {
  const out: Finding[] = [];
  let vocab: VocabEntry[] = [];
  try {
    vocab = [
      ...parseVocab(input.commonVocab ?? ""),
      ...parseVocab(input.workVocab.get(w.id) ?? ""),
    ];
  } catch (e) {
    return [
      {
        level: "error",
        check: "lint",
        path: `works/${w.id}/lint/vocab.tsv`,
        message: `辞書の正規表現が不正: ${(e as Error).message}`,
      },
    ];
  }
  const patternRules = [
    ...(input.data.craftLedger?.rules ?? []),
    ...(w.ledger?.rules ?? []),
  ].filter((r) => r.check === "pattern" && r.pattern && r.kind === "禁止");

  for (const [no, ep] of w.episodes) {
    if (only !== undefined && no !== only) continue;
    if (!ep.text) continue;
    const path = `works/${w.id}/episodes/${episodeDir(no)}/text.md`;
    const allow = ep.lintAllow?.allow ?? [];
    const allowed = (rule: string, line: string) =>
      allow.some((a) => a.rule === rule && line.includes(a.quote));
    const lines = ep.text.split(/\r?\n/);

    for (const h of lintPunctuation(ep.text, vocab)) {
      if (!FAILING_KINDS.has(h.kind)) continue;
      if (allowed(h.kind, lines[h.line - 1] ?? "")) continue;
      out.push({
        level: "error",
        check: `lint:${h.kind}`,
        path,
        line: h.line,
        message: h.detail ?? h.text,
      });
    }
    for (const r of patternRules) {
      const re = new RegExp(r.pattern!, "u");
      lines.forEach((l, i) => {
        if (re.test(l) && !allowed(r.id, l))
          out.push({ level: "error", check: `lint:${r.id}`, path, line: i + 1, message: r.text });
      });
    }
  }
  return out;
}

/** 候補(TTE・C2)の件数。punctuation-reviewer の分類の入力にする */
export function lintCandidates(text: string, vocab: VocabEntry[]) {
  return lintPunctuation(text, vocab).filter((h) => !FAILING_KINDS.has(h.kind));
}

/** feedback: vocab に分類した項目は辞書に行がある、lint-allow には理由がある */
export function checkFeedback(w: WorkData, input: LintInput): Finding[] {
  const out: Finding[] = [];
  const tsv = `${input.commonVocab ?? ""}\n${input.workVocab.get(w.id) ?? ""}`;
  const patterns = new Set(
    tsv
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.startsWith("#"))
      .map((l) => l.split("\t")[0]),
  );
  for (const [no, fb] of w.feedback) {
    const path = `works/${w.id}/feedback/${episodeDir(no)}.yaml`;
    for (const it of fb.items) {
      if (!it.tags.includes("vocab") || it.decision === "却下" || it.source === "legacy-log")
        continue;
      if (!it.vocab_pattern)
        out.push({
          level: "error",
          check: "feedback",
          path,
          message: `${it.id}: vocab に分類したのに vocab_pattern が無い`,
        });
      else if (!patterns.has(it.vocab_pattern))
        out.push({
          level: "error",
          check: "feedback",
          path,
          message: `${it.id}: 辞書に「${it.vocab_pattern}」の行が無い`,
        });
    }
  }
  return out;
}
