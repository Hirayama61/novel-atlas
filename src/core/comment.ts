// PR の行コメントの本文の組み立てと読み取り。
// ビューアから送るコメントには、選んだ文の引用と隠し印を付ける。ルーティンが push して行がずれても、
// 引用と blob SHA から元の位置を引ける。ルーティンの返信は依頼者と同じアカウントから出るので、印で区別する。

export const BOT_MARK = "<!-- atlas:bot -->";

export interface CommentMeta {
  ep: number;
  lines: [number, number];
  blob: string;
}

export function buildCommentBody(body: string, quote: string, meta: CommentMeta): string {
  const q = quote
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  return `${q}\n\n${body.trim()}\n\n<!-- atlas:${JSON.stringify(meta)} -->`;
}

export function parseCommentMeta(body: string): CommentMeta | null {
  const m = /<!-- atlas:(\{.*?\}) -->/.exec(body);
  if (!m) return null;
  try {
    const v = JSON.parse(m[1]!) as CommentMeta;
    return typeof v.ep === "number" && Array.isArray(v.lines) ? v : null;
  } catch {
    return null;
  }
}

export function isBotComment(body: string): boolean {
  return body.includes(BOT_MARK);
}

/** 表示用: 引用と隠し印を外した本文 */
export function commentText(body: string): string {
  return body
    .replace(/<!-- atlas:.*? -->/g, "")
    .split("\n")
    .filter((l) => !l.startsWith("> "))
    .join("\n")
    .trim();
}
