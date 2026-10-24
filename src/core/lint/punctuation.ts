// 句読点・改行の機械検査(日本語表現規範 §2/§4)。旧 novel-hoshiyomi の check.pl の移植。
// 1 行に複数文が入る組版なので、行単位でなく文単位に割ってから数える。

export interface VocabEntry {
  pattern: RegExp;
  source: string;
  suggest: string;
  note: string;
}

export interface PunctuationHit {
  kind: "S4" | "VOCAB" | "FRAG" | "TTE" | "C2";
  line: number;
  text: string;
  /** VOCAB: 当たった語と推奨。C2: 読点の数と実字数 */
  detail?: string;
}

/** perl 正規表現の TSV(パターン<TAB>推奨<TAB>備考)を読む。# 行と空行は飛ばす */
export function parseVocab(tsv: string): VocabEntry[] {
  const out: VocabEntry[] = [];
  for (const raw of tsv.split(/\r?\n/)) {
    if (!raw.trim() || raw.startsWith("#")) continue;
    const [pat = "", suggest = "", note = ""] = raw.split("\t");
    out.push({ pattern: new RegExp(pat, "u"), source: pat, suggest, note });
  }
  return out;
}

export function lintPunctuation(text: string, vocab: VocabEntry[]): PunctuationHit[] {
  const hits: PunctuationHit[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const ln = i + 1;
    if (line.startsWith("#") || !line.trim() || /^　?◇/.test(line)) return;

    if (/、$/.test(line)) hits.push({ kind: "S4", line: ln, text: line });

    for (const v of vocab) {
      const m = v.pattern.exec(line);
      if (m)
        hits.push({
          kind: "VOCAB",
          line: ln,
          text: line,
          detail: `「${m[0]}」→ ${v.suggest} (${v.note})`,
        });
    }

    const t = line.replace(/^[　「『]+/, "");
    for (let sent of t.split(/(?<=[。！？!?])/)) {
      sent = sent.replace(/[」』\s]+$/, "");
      if (!sent) continue;
      if (/、(?:と|な|か)[。！？!?]?$/.test(sent))
        hits.push({ kind: "FRAG", line: ln, text: sent });
      if (/、って/.test(sent)) hits.push({ kind: "TTE", line: ln, text: sent });
      const commas = (sent.match(/、/g) ?? []).length;
      if (commas >= 2) {
        const plain = sent.replace(/[。！？!?、—…「」『』\s]/g, "");
        hits.push({
          kind: "C2",
          line: ln,
          text: sent,
          detail: `読点${commas} 実${[...plain].length}字`,
        });
      }
    }
  });
  return hits;
}

/** S4・VOCAB・FRAG はゼロであること(CI を落とす)。TTE・C2 は分類のための候補 */
export const FAILING_KINDS = new Set<PunctuationHit["kind"]>(["S4", "VOCAB", "FRAG"]);
