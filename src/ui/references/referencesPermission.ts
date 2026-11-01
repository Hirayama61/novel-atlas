import { GitHubError } from "../../sync/github";

/** 一覧を書くのに足す権限 */
export const REFERENCES_PERMISSION_HINT =
  "トークンに novel-atlas-data の Contents: Read and write を足してください";

/** 書き込み権限の無いトークンが返す状態 */
const PERMISSION_STATUSES = [403];

/** 書き込みの失敗が権限不足によるものか */
export function isWritePermissionError(error: unknown): boolean {
  const isGitHubError = error instanceof GitHubError;
  if (!isGitHubError) return false;
  const isRateLimited = error.rateLimit !== undefined;
  if (isRateLimited) return false;
  return PERMISSION_STATUSES.includes(error.status);
}

/**
 * 一覧への書き込みは済んだが、そのあとの同期に失敗したときの文言。
 *
 * @remarks
 * 手元の一覧は古いままなので、成功とは出さない。同期し直すのは利用者が「同期」を押す。
 */
export function getSyncFailedMessage(done: string, reason: string): string {
  return `${done}が、手元の同期に失敗したので一覧が古いままです。「同期」を押して同期し直してください(${reason})`;
}
