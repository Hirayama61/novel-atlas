import { GitHubError } from "../../sync/github";

export interface IssueDraft {
  title: string;
  body: string;
}

const DRAFT_KEY = "novel-atlas.issueDraft";

/** 下書きが無いこと */
export const EMPTY_DRAFT: IssueDraft = { title: "", body: "" };

/** トークンに足す権限。fine-grained PAT は対象外のリポジトリに 404 を返すので、403 と 404 で出す */
export const ISSUE_PERMISSION_HINT =
  "トークンに Hirayama61/novel-atlas の Issues: Read and write を足してください";

const PERMISSION_STATUSES = [403, 404];

/** 送信の失敗が権限不足によるものか */
export function isPermissionError(error: unknown): boolean {
  const isGitHubError = error instanceof GitHubError;
  if (!isGitHubError) return false;
  return PERMISSION_STATUSES.includes(error.status);
}

/** 題が空白だけでなければ送れる */
export function canSubmitIssue(draft: IssueDraft): boolean {
  return draft.title.trim() !== EMPTY_DRAFT.title;
}

/** 端末に残した下書き。読めなければ空の下書き */
export function loadIssueDraft(): IssueDraft {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved === null) return { ...EMPTY_DRAFT };
    return { ...EMPTY_DRAFT, ...(JSON.parse(saved) as Partial<IssueDraft>) };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

export function saveIssueDraft(draft: IssueDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ストレージが使えない環境では何もしない
  }
}

export function clearIssueDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ストレージが使えない環境では何もしない
  }
}
