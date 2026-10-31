// 参考作品の一覧(データリポジトリの `references/works.csv`)。登録の入力の読み取りと、行の追加・削除。

/** データリポジトリ内の一覧のパス */
export const REFERENCES_CSV_PATH = "references/works.csv";

/** 一覧の列。docs/design/01-data-repo.md の「ncode・題名・既刊巻数・注記」 */
export const REFERENCE_COLUMNS = ["ncode", "title", "volumes", "note"] as const;

export interface ReferenceWork {
  ncode: string;
  title: string;
  volumes: string;
  note: string;
}

export type NcodeResult = { kind: "ok"; ncode: string } | { kind: "error"; reason: string };

/** ncode の形。n + 数字 4 桁 + 英字 1〜2 文字 */
const NCODE_RE = /^n\d{4}[a-z]{1,2}$/;

/** 全年齢の作品ページのホスト */
const NAROU_HOST = "ncode.syosetu.com";

/** 年齢制限のある作品のホスト。取得作法で全年齢だけに限るので受け付けない */
const ADULT_HOSTS = ["novel18.syosetu.com"];

/** 一覧が空のときの中身 */
const EMPTY_CSV = "";

/** 入力が空白だけ */
const EMPTY_INPUT = "";

/**
 * 登録の入力(作品 URL か ncode)から ncode を取り出す。
 *
 * @remarks
 * 作品が実在するかは確かめない(なろうに問い合わせない)。形だけを見る。
 */
export function parseNcode(input: string): NcodeResult {
  const trimmed = input.trim();
  if (trimmed === EMPTY_INPUT) return { kind: "error", reason: "URL か ncode を入れてください" };
  const lower = trimmed.toLowerCase();
  if (NCODE_RE.test(lower)) return { kind: "ok", ncode: lower };
  const url = toUrl(trimmed);
  if (url === null)
    return {
      kind: "error",
      reason: "小説家になろうの作品 URL か ncode(例: n1234ab)ではありません",
    };
  const host = url.hostname.toLowerCase();
  const isAdult = ADULT_HOSTS.includes(host);
  if (isAdult) return { kind: "error", reason: "年齢制限のある作品は登録できません" };
  const isNarou = host === NAROU_HOST;
  if (!isNarou)
    return { kind: "error", reason: "小説家になろう(ncode.syosetu.com)の URL だけ登録できます" };
  const first = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? EMPTY_INPUT;
  const hasNcode = NCODE_RE.test(first);
  if (!hasNcode) return { kind: "error", reason: "URL に作品の ncode が見つかりません" };
  return { kind: "ok", ncode: first };
}

function toUrl(input: string): URL | null {
  const hasScheme = /^https?:\/\//i.test(input);
  const withScheme = hasScheme ? input : `https://${input}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

/** 一覧を読む。見出し行は飛ばし、ncode の無い行は捨てる */
export function parseReferencesCsv(text: string): ReferenceWork[] {
  return splitCsvRecords(text)
    .filter((r) => !r.isHeader)
    .map((r) => toReferenceWork(r.fields))
    .filter((w) => w.ncode !== EMPTY_INPUT);
}

function toReferenceWork(fields: string[]): ReferenceWork {
  const [ncode = "", title = "", volumes = "", note = ""] = fields;
  return { ncode: toNcodeKey(ncode), title, volumes, note };
}

function toNcodeKey(field: string): string {
  return field.trim().toLowerCase();
}

function toCsvLine(work: ReferenceWork): string {
  return [work.ncode, work.title, work.volumes, work.note].map(quoteCsvField).join(",");
}

function quoteCsvField(value: string): string {
  const needsQuote = /[",\n\r]/.test(value);
  if (!needsQuote) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

interface CsvRecord {
  fields: string[];
  /** 行の元の文字列(改行を含まない) */
  raw: string;
  isHeader: boolean;
}

/** RFC 4180 の CSV を行に分ける。行の元の文字列も持つ。空行は捨てる */
function splitCsvRecords(text: string): CsvRecord[] {
  const records: Omit<CsvRecord, "isHeader">[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let start = 0;
  const pushRecord = (end: number) => {
    fields.push(field);
    records.push({ fields, raw: text.slice(start, end) });
    fields = [];
    field = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      fields.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      pushRecord(i);
      if (ch === "\r" && text[i + 1] === "\n") i++;
      start = i + 1;
    } else field += ch;
  }
  pushRecord(text.length);
  return records
    .filter((r) => r.raw.trim() !== EMPTY_INPUT)
    .map((r, i) => ({ ...r, isHeader: i === 0 && isHeaderFields(r.fields) }));
}

function isHeaderFields(fields: string[]): boolean {
  return toNcodeKey(fields[0] ?? EMPTY_INPUT) === REFERENCE_COLUMNS[0];
}

function joinLines(lines: string[]): string {
  return `${lines.join("\n")}\n`;
}

export type CsvEdit = { kind: "ok"; text: string } | { kind: "error"; reason: string };

/** 一覧に ncode があるか */
export function hasReference(works: ReferenceWork[], ncode: string): boolean {
  return works.some((w) => w.ncode === ncode);
}

/**
 * 一覧の末尾に ncode の行を足す。既にあれば足さない。ファイルが無いときは `null` を渡す。
 *
 * @remarks
 * 既存の行は書き換えない(元の列や書き方をそのまま残す)。ファイルが無ければ見出し行から作る。
 */
export function addReference(text: string | null, ncode: string): CsvEdit {
  const records = splitCsvRecords(text ?? EMPTY_CSV);
  const works = parseReferencesCsv(text ?? EMPTY_CSV);
  const isRegistered = hasReference(works, ncode);
  if (isRegistered) return { kind: "error", reason: `${ncode} は登録済みです` };
  const hasHeader = records[0]?.isHeader ?? false;
  const header = hasHeader ? [] : [REFERENCE_COLUMNS.join(",")];
  const added = toCsvLine({ ncode, title: "", volumes: "", note: "" });
  return { kind: "ok", text: joinLines([...header, ...records.map((r) => r.raw), added]) };
}

/** 一覧から ncode の行を外す。本文(`references/<ncode>/`)は消さない。ほかの行は書き換えない */
export function removeReference(text: string | null, ncode: string): CsvEdit {
  const records = splitCsvRecords(text ?? EMPTY_CSV);
  const isTarget = (r: CsvRecord) =>
    !r.isHeader && toNcodeKey(r.fields[0] ?? EMPTY_INPUT) === ncode;
  const hasTarget = records.some(isTarget);
  if (!hasTarget) return { kind: "error", reason: `${ncode} は一覧にありません` };
  const rest = records.filter((r) => !isTarget(r)).map((r) => r.raw);
  return { kind: "ok", text: joinLines(rest) };
}
