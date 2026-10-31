// なろうの話のページ(ncode.syosetu.com)の URL と、HTML からの本文の取り出し。

/** 全年齢の作品ページのホスト */
const NAROU_ORIGIN = "https://ncode.syosetu.com";

/**
 * 本文の入れ物の開きタグ。前書き(`--preface`)・後書き(`--afterword`)は本文に含めない。
 * 今の画面は `p-novel__text`、旧画面は `id="novel_honbun"`。
 */
const BODY_OPEN_RE =
  /<div\b[^>]*(?:class="[^"]*\bp-novel__text\b(?![^"]*--(?:preface|afterword))[^"]*"|id="novel_honbun")[^>]*>/;

const PARAGRAPH_RE = /<p\b[^>]*>([\s\S]*?)<\/p>/g;

/** ルビ。`<rb>` の有無の両方。括弧の `<rp>` は捨てる */
const RUBY_RE =
  /<ruby\b[^>]*>(?:<rb\b[^>]*>)?([\s\S]*?)(?:<\/rb>)?(?:<rp\b[^>]*>[\s\S]*?<\/rp>)?<rt\b[^>]*>([\s\S]*?)<\/rt>(?:<rp\b[^>]*>[\s\S]*?<\/rp>)?<\/ruby>/g;

const TAG_RE = /<[^>]+>/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** 話の URL。短編は話番号の無い作品ページが本文 */
export function getEpisodeUrl(ncode: string, episode: number, isShortStory: boolean): string {
  if (isShortStory) return `${NAROU_ORIGIN}/${ncode}/`;
  return `${NAROU_ORIGIN}/${ncode}/${episode}/`;
}

/** データリポジトリ内の話のパス。話番号は 3 桁ゼロ詰め */
export function getEpisodePath(ncode: string, episode: number): string {
  return `references/${ncode}/episodes/${String(episode).padStart(3, "0")}.md`;
}

/**
 * 話のページの HTML から本文だけを取り出す。1 段落 1 行、ルビはなろう記法(`｜親文字《るび》`)。
 *
 * @remarks
 * 前書き・後書き・挿絵は持たない。本文の入れ物が見つからなければ `null`(画面の作りが変わった)。
 */
export function extractEpisodeText(html: string): string | null {
  const open = BODY_OPEN_RE.exec(html);
  if (open === null) return null;
  const start = open.index + open[0].length;
  const end = html.indexOf("</div>", start);
  const hasEnd = end >= 0;
  if (!hasEnd) return null;
  const inner = html.slice(start, end);
  const lines = Array.from(inner.matchAll(PARAGRAPH_RE), (m) => toPlainLine(m[1] ?? ""));
  const isEmpty = lines.every((line) => line.trim() === "");
  if (isEmpty) return null;
  return `${lines.join("\n")}\n`;
}

function toPlainLine(paragraph: string): string {
  const withRuby = paragraph.replace(RUBY_RE, (_m, base: string, reading: string) =>
    toNarouRuby(stripTags(base), stripTags(reading)),
  );
  return decodeEntities(stripTags(withRuby));
}

function toNarouRuby(base: string, reading: string): string {
  return `｜${base}《${reading}》`;
}

function stripTags(text: string): string {
  return text.replace(TAG_RE, "");
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(parseInt(lower.slice(1), 10));
    return NAMED_ENTITIES[lower] ?? whole;
  });
}
