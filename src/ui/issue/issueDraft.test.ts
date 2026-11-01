// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { GitHubError } from "../../sync/github";
import {
  canSubmitIssue,
  clearIssueDraft,
  isPermissionError,
  loadIssueDraft,
  saveIssueDraft,
} from "./issueDraft";

describe("isPermissionError", () => {
  it("403 と 404 を権限不足として扱う", () => {
    expect(isPermissionError(new GitHubError("x", 403))).toBe(true);
    expect(isPermissionError(new GitHubError("x", 404))).toBe(true);
  });
  it("それ以外の失敗は権限不足として扱わない", () => {
    expect(isPermissionError(new GitHubError("x", 401))).toBe(false);
    expect(isPermissionError(new GitHubError("x", 422))).toBe(false);
    expect(isPermissionError(new Error("network"))).toBe(false);
  });
  it("レート制限の 403 は権限不足として扱わない", () => {
    expect(isPermissionError(new GitHubError("x", 403, { resetAt: undefined }))).toBe(false);
  });
});

describe("canSubmitIssue", () => {
  it("題があれば送れる", () => {
    expect(canSubmitIssue({ title: "読書画面の改善", body: "" })).toBe(true);
  });
  it("題が空白だけなら送れない", () => {
    expect(canSubmitIssue({ title: "  ", body: "本文" })).toBe(false);
  });
});

describe("下書きの保存", () => {
  afterEach(() => clearIssueDraft());

  it("保存した下書きを読み戻す", () => {
    saveIssueDraft({ title: "題", body: "本文" });
    expect(loadIssueDraft()).toEqual({ title: "題", body: "本文" });
  });
  it("消したあとは空の下書きを返す", () => {
    saveIssueDraft({ title: "題", body: "本文" });
    clearIssueDraft();
    expect(loadIssueDraft()).toEqual({ title: "", body: "" });
  });
});
