// GitHub REST の薄いラッパー。データリポジトリの読み出し(Git Trees + blobs)と、PR へのコメント・ラベル。

export interface DataRepoConfig {
  owner: string;
  repo: string;
  /** Fine-grained PAT。対象は novel-atlas-data。Contents: Read and write、Pull requests: Read and write */
  token: string;
  /** false のときはトークンを localStorage に保存しない */
  remember: boolean;
}

const STORAGE_KEY = "novel-atlas.dataRepo";
const SESSION_TOKEN_KEY = "novel-atlas.dataRepo.token";

export const DEFAULT_CONFIG: DataRepoConfig = {
  owner: "Hirayama61",
  repo: "novel-atlas-data",
  token: "",
  remember: true,
};

export function loadConfig(): DataRepoConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const base = saved
      ? { ...DEFAULT_CONFIG, ...(JSON.parse(saved) as Partial<DataRepoConfig>) }
      : { ...DEFAULT_CONFIG };
    if (!base.token) base.token = sessionStorage.getItem(SESSION_TOKEN_KEY) ?? "";
    return base;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: DataRepoConfig): void {
  try {
    const { token, ...rest } = config;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config.remember ? { ...rest, token } : rest));
    if (config.remember) sessionStorage.removeItem(SESSION_TOKEN_KEY);
    else sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    // ストレージが使えない環境では何もしない
  }
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

async function request<T>(
  config: DataRepoConfig,
  path: string,
  init: { method?: string; body?: unknown; accept?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: init.accept ?? "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const raw = init.accept?.includes("raw") || init.accept === "application/vnd.github.sha";
  const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail =
      res.status === 401
        ? "トークンが無効です"
        : res.status === 403
          ? "権限が足りないか、レート制限です"
          : res.status === 422
            ? `受け付けられません: ${await res.text()}`
            : res.statusText;
    throw new GitHubError(`${path}: ${res.status} ${detail}`, res.status);
  }
  if (raw) return (await res.text()) as T;
  return (await res.json()) as T;
}

export interface TreeEntry {
  path: string;
  sha: string;
  type: "blob" | "tree" | "commit";
}

/** ref(ブランチ名か SHA)の全ファイル。同期の対象だけに絞る */
export async function getTree(
  config: DataRepoConfig,
  ref: string,
): Promise<{ sha: string; entries: TreeEntry[] }> {
  const t = await request<{ sha: string; tree: TreeEntry[]; truncated: boolean }>(
    config,
    `/git/trees/${encodeURIComponent(ref)}?recursive=1`,
  );
  if (t.truncated) throw new GitHubError("ファイルが多すぎて tree が切り詰められました", 0);
  return { sha: t.sha, entries: t.tree.filter((e) => e.type === "blob" && isSyncTarget(e.path)) };
}

/**
 * 同期するファイル。参考作品は作品情報(meta.json)・本文(episodes/)・分析を持ってくる。
 * 取得の記録(fetch-state.json など)は読書に要らないので持ってこない。
 */
export function isSyncTarget(path: string): boolean {
  if (path === "index.json" || path === "references/works.csv") return true;
  if (/^references\/[^/]+\/(meta\.json$|episodes\/|analysis\/)/.test(path)) return true;
  // 旧版(archive/)と移行前の散文(legacy/)は読者向けの対象外なので同期しない
  if (path.startsWith("works/"))
    return /\.(ya?ml|md)$/.test(path) && !path.includes("/legacy/") && !path.includes("/archive/");
  return false;
}

/** ref が指すコミットの SHA */
export function getCommitSha(config: DataRepoConfig, ref: string): Promise<string> {
  return request<string>(config, `/commits/${encodeURIComponent(ref)}`, {
    accept: "application/vnd.github.sha",
  }).then((s) => s.trim());
}

export function getBlob(config: DataRepoConfig, sha: string): Promise<string> {
  return request<string>(config, `/git/blobs/${sha}`, {
    accept: "application/vnd.github.raw+json",
  });
}

// ---- Contents API(参考作品の一覧を書く)

export interface FileContent {
  /** 今の blob の SHA。書き戻すときに渡す */
  sha: string;
  text: string;
}

/** ファイルが無いことを表す状態 */
const NOT_FOUND = 404;

/** main のファイルを 1 つ読む。無ければ `null` */
export async function getFileContent(c: DataRepoConfig, path: string): Promise<FileContent | null> {
  try {
    const f = await request<{ sha: string; content: string }>(
      c,
      `/contents/${encodeContentsPath(path)}?ref=main`,
    );
    return { sha: f.sha, text: decodeBase64Utf8(f.content) };
  } catch (e) {
    const isNotFound = e instanceof GitHubError && e.status === NOT_FOUND;
    if (isNotFound) return null;
    throw e;
  }
}

/** main のファイルを書き換えて 1 コミットにする。新しく作るときは `sha` を `null` にする */
export const putFileContent = (
  c: DataRepoConfig,
  path: string,
  text: string,
  message: string,
  sha: string | null,
) =>
  request<unknown>(c, `/contents/${encodeContentsPath(path)}`, {
    method: "PUT",
    body: { message, content: encodeBase64Utf8(text), branch: "main", ...(sha ? { sha } : {}) },
  });

function encodeContentsPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
}

// ---- PR

export interface PullRequest {
  number: number;
  title: string;
  html_url: string;
  head: { ref: string; sha: string };
  labels: { name: string }[];
  updated_at: string;
  merged_at?: string | null;
}

export interface ReviewComment {
  id: number;
  body: string;
  path: string;
  line: number | null;
  start_line: number | null;
  original_line: number | null;
  in_reply_to_id?: number;
  user: { login: string; type: string };
  created_at: string;
  reactions?: { "+1": number; rocket: number; eyes: number; total_count: number };
}

export const listPulls = (c: DataRepoConfig) =>
  request<PullRequest[]>(c, "/pulls?state=open&per_page=50");
export const getPull = (c: DataRepoConfig, n: number) => request<PullRequest>(c, `/pulls/${n}`);
export const listPullFiles = (c: DataRepoConfig, n: number) =>
  request<{ filename: string; status: string }[]>(c, `/pulls/${n}/files?per_page=100`);
export const listReviewComments = (c: DataRepoConfig, n: number) =>
  request<ReviewComment[]>(c, `/pulls/${n}/comments?per_page=100`);

export interface DraftComment {
  path: string;
  line: number;
  start_line?: number;
  body: string;
}

/** 下書きをまとめて 1 件のレビューとして送る(event: COMMENT) */
export function submitReview(
  c: DataRepoConfig,
  n: number,
  commitId: string,
  comments: DraftComment[],
  body = "",
) {
  return request<{ id: number }>(c, `/pulls/${n}/reviews`, {
    method: "POST",
    body: {
      commit_id: commitId,
      event: "COMMENT",
      body,
      comments: comments.map((d) => ({
        path: d.path,
        line: d.line,
        side: "RIGHT",
        ...(d.start_line && d.start_line < d.line
          ? { start_line: d.start_line, start_side: "RIGHT" }
          : {}),
        body: d.body,
      })),
    },
  });
}

/** 1 件だけ送る。行コメントにできない(diff に無い行)ときは subject_type: file で送る */
export function postComment(
  c: DataRepoConfig,
  n: number,
  commitId: string,
  d: DraftComment,
  asFile = false,
) {
  return request<ReviewComment>(c, `/pulls/${n}/comments`, {
    method: "POST",
    body: asFile
      ? { commit_id: commitId, path: d.path, subject_type: "file", body: d.body }
      : {
          commit_id: commitId,
          path: d.path,
          line: d.line,
          side: "RIGHT",
          ...(d.start_line && d.start_line < d.line
            ? { start_line: d.start_line, start_side: "RIGHT" }
            : {}),
          body: d.body,
        },
  });
}

export const addLabel = (c: DataRepoConfig, n: number, label: string) =>
  request<unknown>(c, `/issues/${n}/labels`, { method: "POST", body: { labels: [label] } });

// ---- アプリの改善 Issue

/** 改善 Issue の送り先。設定画面の入力値は使わず、ここに固定する */
export const APP_REPO = { owner: "Hirayama61", repo: "novel-atlas" } as const;

export interface CreatedIssue {
  number: number;
  html_url: string;
}

/** 本体リポジトリに `ready` 付きの Issue を作る。トークンはデータリポジトリと同じものを使う */
export const createAppIssue = (c: DataRepoConfig, title: string, body: string) =>
  request<CreatedIssue>({ ...c, ...APP_REPO }, "/issues", {
    method: "POST",
    body: { title, body, labels: ["ready"] },
  });

export interface AppIssue {
  number: number;
  title: string;
  html_url: string;
  body?: string | null;
  labels: { name: string }[];
  pull_request?: unknown;
}

/** 本体リポジトリの open で `human` の Issue。Issues API は PR も返すので呼び出し側で除く */
export const listHumanIssues = (c: DataRepoConfig) =>
  request<AppIssue[]>({ ...c, ...APP_REPO }, "/issues?state=open&labels=human&per_page=100");
