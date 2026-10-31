import { describe, expect, it } from "vitest";
import { getSyncFailedMessage } from "./referencesPermission";

describe("getSyncFailedMessage", () => {
  it("書き込みは済んだことと、同期し直すことと、理由を出す", () => {
    const message = getSyncFailedMessage("n1234ab を登録しました", "HTTP 500");
    expect(message).toBe(
      "n1234ab を登録しましたが、手元の同期に失敗したので一覧が古いままです。「同期」を押して同期し直してください(HTTP 500)",
    );
  });
});
