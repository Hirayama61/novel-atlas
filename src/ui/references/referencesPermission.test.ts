import { describe, expect, it } from "vitest";
import { GitHubError } from "../../sync/github";
import { getSyncFailedMessage, isWritePermissionError } from "./referencesPermission";

describe("isWritePermissionError", () => {
  it("権限不足の 403 は書き込み権限の不足として扱う", () => {
    expect(isWritePermissionError(new GitHubError("x", 403))).toBe(true);
  });
  it("レート制限の 403 は書き込み権限の不足として扱わない", () => {
    expect(isWritePermissionError(new GitHubError("x", 403, { resetAt: undefined }))).toBe(false);
  });
});

describe("getSyncFailedMessage", () => {
  it("書き込みは済んだことと、同期し直すことと、理由を出す", () => {
    const message = getSyncFailedMessage("n1234ab を登録しました", "HTTP 500");
    expect(message).toBe(
      "n1234ab を登録しましたが、手元の同期に失敗したので一覧が古いままです。「同期」を押して同期し直してください(HTTP 500)",
    );
  });
});
