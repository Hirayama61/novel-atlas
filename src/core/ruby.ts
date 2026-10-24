// なろう記法のルビと傍点。
//   ｜親文字《るび》 / |親文字《るび》  … 親文字を明示
//   漢字《るび》                         … 直前の漢字の連なりが親文字
//   《《語》》                           … 傍点
// 漢字直後の丸括弧を自動でルビにするなろうの規則は採らない(本文の括弧書きを誤ってルビにしないため)。

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "ruby"; base: string; ruby: string }
  | { kind: "emphasis"; text: string };

const KANJI = /[\p{Script=Han}々〆ヶ]/u;

export function parseRuby(line: string): Segment[] {
  const out: Segment[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ kind: "text", text: buf });
    buf = "";
  };
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    let m = /^《《([^》]+)》》/.exec(rest);
    if (m) {
      flush();
      out.push({ kind: "emphasis", text: m[1]! });
      i += m[0].length;
      continue;
    }
    m = /^[｜|]([^｜|《》]{1,20})《([^《》]{1,20})》/.exec(rest);
    if (m) {
      flush();
      out.push({ kind: "ruby", base: m[1]!, ruby: m[2]! });
      i += m[0].length;
      continue;
    }
    m = /^《([^《》]{1,20})》/.exec(rest);
    if (m && buf) {
      const chars = [...buf];
      let k = chars.length;
      while (k > 0 && KANJI.test(chars[k - 1]!)) k--;
      if (k < chars.length) {
        const base = chars.slice(k).join("");
        buf = chars.slice(0, k).join("");
        flush();
        out.push({ kind: "ruby", base, ruby: m[1]! });
        i += m[0].length;
        continue;
      }
    }
    buf += line[i];
    i++;
  }
  flush();
  return out;
}

/** ルビ記法を外した文字列(字数を数えるとき・引用を作るとき) */
export function stripRuby(line: string): string {
  return parseRuby(line)
    .map((s) => (s.kind === "ruby" ? s.base : s.text))
    .join("");
}
