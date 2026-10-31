import { REFERENCES_CSV_PATH, type CsvEdit } from "../core/references";
import { getFileContent, GitHubError, putFileContent, type DataRepoConfig } from "./github";

/** SHA が食い違ったとき(他の端末やルーティンが先に書いた)の状態 */
const CONFLICT = 409;

/** 取り直してやり直す回数の上限 */
const MAX_ATTEMPTS = 3;

export type EditResult = { kind: "ok" } | { kind: "error"; reason: string };

/**
 * 参考作品の一覧を読み、`edit` で書き換えて main に書き戻す。
 *
 * @remarks
 * 書き換えの中身は持たない(`edit` が決める)。SHA が食い違ったら読み直して `edit` をやり直す。
 */
export async function editReferencesCsv(
  config: DataRepoConfig,
  edit: (text: string | null) => CsvEdit,
  message: string,
): Promise<EditResult> {
  for (let attempt = 1; ; attempt++) {
    const current = await getFileContent(config, REFERENCES_CSV_PATH);
    const result = edit(current?.text ?? null);
    if (result.kind === "error") return result;
    try {
      await putFileContent(config, REFERENCES_CSV_PATH, result.text, message, current?.sha ?? null);
      return { kind: "ok" };
    } catch (e) {
      const isConflict = e instanceof GitHubError && e.status === CONFLICT;
      const canRetry = isConflict && attempt < MAX_ATTEMPTS;
      if (!canRetry) throw e;
    }
  }
}
