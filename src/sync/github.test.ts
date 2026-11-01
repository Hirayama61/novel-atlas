import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CONFIG,
  formatClock,
  getRateLimit,
  getRateLimitMessage,
  getTree,
  GitHubError,
  isSyncTarget,
} from "./github";

describe("isSyncTarget", () => {
  it("参考作品の作品情報・本文・分析を同期する", () => {
    expect(isSyncTarget("references/works.csv")).toBe(true);
    expect(isSyncTarget("references/n1111aa/meta.json")).toBe(true);
    expect(isSyncTarget("references/n1111aa/episodes/001.md")).toBe(true);
    expect(isSyncTarget("references/n1111aa/analysis/notes.md")).toBe(true);
  });
  it("参考作品の取得の記録は同期しない", () => {
    expect(isSyncTarget("references/n1111aa/fetch-state.json")).toBe(false);
    expect(isSyncTarget("references/n1111aa/fetch-log.csv")).toBe(false);
  });
  it("自作の旧版と移行前の散文は同期しない", () => {
    expect(isSyncTarget("works/lh/episodes/001/text.md")).toBe(true);
    expect(isSyncTarget("works/lh/archive/001.md")).toBe(false);
    expect(isSyncTarget("works/lh/legacy/001.md")).toBe(false);
  });
});

const NOW = new Date(2026, 10, 1, 14, 0, 0);
/** 2026-11-01 15:05(端末の時刻)の UNIX 秒 */
const RESET_SECONDS = String(new Date(2026, 10, 1, 15, 5, 0).getTime() / 1000);

describe("getRateLimit", () => {
  it("残りが 0 の 403 は x-ratelimit-reset の時刻に解除される", () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": RESET_SECONDS,
    });
    expect(getRateLimit(403, headers, "", NOW)?.resetAt).toEqual(new Date(2026, 10, 1, 15, 5, 0));
  });
  it("retry-after があれば、今から retry-after 秒後を優先する", () => {
    const headers = new Headers({
      "retry-after": "120",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": RESET_SECONDS,
    });
    expect(getRateLimit(403, headers, "", NOW)?.resetAt).toEqual(new Date(2026, 10, 1, 14, 2, 0));
  });
  it("ヘッダの無い 429 は解除時刻の分からないレート制限とする", () => {
    expect(getRateLimit(429, new Headers(), "", NOW)).toEqual({ resetAt: undefined });
  });
  it("残りのある 403 はレート制限としない", () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "4999",
      "x-ratelimit-reset": RESET_SECONDS,
    });
    expect(getRateLimit(403, headers, "", NOW)).toBeUndefined();
  });
  it("ヘッダで識別できない二次的な制限は、本文から解除時刻の分からないレート制限とする", () => {
    const headers = new Headers({ "x-ratelimit-remaining": "4999" });
    const body = JSON.stringify({ message: "You have exceeded a secondary rate limit." });
    expect(getRateLimit(403, headers, body, NOW)).toEqual({ resetAt: undefined });
  });
  it("403 と 429 以外はレート制限としない", () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": RESET_SECONDS,
    });
    expect(getRateLimit(404, headers, "", NOW)).toBeUndefined();
  });
});

describe("formatClock", () => {
  it("端末の時刻を 0 埋めの HH:MM にする", () => {
    expect(formatClock(new Date(2026, 10, 1, 9, 5, 0))).toBe("09:05");
  });
});

describe("getRateLimitMessage", () => {
  it("解除時刻が分かれば HH:MM を出す", () => {
    expect(getRateLimitMessage({ resetAt: new Date(2026, 10, 1, 15, 5, 0) })).toBe(
      "GitHub の上限に当たりました。15:05 に解除されます。",
    );
  });
  it("解除時刻が分からなければ、待つように出す", () => {
    expect(getRateLimitMessage({ resetAt: undefined })).toBe(
      "GitHub の上限に当たりました。しばらく待ってから操作し直してください。",
    );
  });
});

describe("request の失敗", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function getTreeError(status: number, headers: Record<string, string>): Promise<unknown> {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status, headers })),
    );
    return getTree(DEFAULT_CONFIG, "main").catch((e: unknown) => e);
  }

  it("レート制限の 403 は解除時刻を含む文を出す", async () => {
    const error = await getTreeError(403, {
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": RESET_SECONDS,
    });
    expect(error).toBeInstanceOf(GitHubError);
    expect((error as GitHubError).rateLimit).toBeDefined();
    expect((error as GitHubError).message).toContain(
      "GitHub の上限に当たりました。15:05 に解除されます。",
    );
  });
  it("レート制限の 429 も上限に当たったと出す", async () => {
    const error = await getTreeError(429, {});
    expect((error as GitHubError).message).toContain("GitHub の上限に当たりました。");
  });
  it("権限不足の 403 はトークンの権限の文を出す", async () => {
    const error = await getTreeError(403, { "x-ratelimit-remaining": "4999" });
    expect((error as GitHubError).rateLimit).toBeUndefined();
    expect((error as GitHubError).message).toContain("トークンに権限がありません");
    expect((error as GitHubError).message).not.toContain("上限");
  });
});
