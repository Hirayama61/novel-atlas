/** 引用照合用に本文を 1 本の文字列にする(改行と行頭の字下げは文の一部ではない) */
export function flatten(text: string): string {
  return text.replace(/^[ 　]+/gm, "").replace(/\r?\n/g, "");
}

/** 引用を含む本文の行番号(1 始まり)。見つからなければ null */
export function lineOf(text: string, quote: string): number | null {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) if (lines[i]!.includes(quote)) return i + 1;
  // 行をまたぐ引用
  const flat = flatten(text);
  if (!flat.includes(quote)) return null;
  const at = flat.indexOf(quote);
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    acc += lines[i]!.replace(/^[ 　]+/, "").length;
    if (acc > at) return i + 1;
  }
  return null;
}

export function containsQuote(text: string, quote: string): boolean {
  return text.includes(quote) || flatten(text).includes(quote);
}

/**
 * 本文の字数。novel-analytics の extract.strip_markdown + count_chars と同じ定義:
 * 見出し行(前後の空白を除いて # で始まる行)を除き、Markdown 記号 *_`~># を除き、NFKC で正規化し、空白を除いた文字数。
 */
export function countChars(text: string): number {
  const body = text
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n")
    .replace(/[*_`~>#]/g, "")
    .normalize("NFKC");
  return [...body.replace(/\s|　/g, "")].length;
}
