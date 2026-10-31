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
  return PERMISSION_STATUSES.includes(error.status);
}
