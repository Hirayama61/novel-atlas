import { expect, test } from "@playwright/test";
import { mockGitHub } from "./fixture";

test("同期して作品を開き、本文を縦書きで読む", async ({ page }) => {
  await mockGitHub(page);
  await page.goto("./");
  await page.getByRole("link", { name: "灯台守の娘" }).click();
  await page.getByRole("link", { name: "灯台の夜" }).click();
  await expect(page.getByText("父の目はもう灯を追えない。")).toBeVisible();
  await page.getByRole("button", { name: "縦書き" }).click();
  await expect(page.locator(".text.vertical")).toBeVisible();
  await page.getByRole("link", { name: "← 一覧" }).click();
  await page.getByRole("link", { name: "人物" }).click();
  await expect(page.getByText("ミオ")).toBeVisible();
});

test("PR の本文の段落にコメントを書き、まとめて 1 件のレビューとして送る", async ({ page }) => {
  const state = await mockGitHub(page);
  await page.goto("./#/pulls");
  await page.getByRole("button", { name: /第3話 灯を消す/ }).click();
  await expect(page.getByText("父は灯を点けなかった。")).toBeVisible();

  await page.getByText("嵐が来た。").click();
  await page.getByRole("button", { name: "段落ごと選ぶ" }).click();
  await page.getByPlaceholder("コメント").fill("父の沈黙をもう一拍");
  await page.getByRole("button", { name: "下書きに足す" }).click();

  await page.getByText("ミオは灯を消した。").click();
  await page.getByPlaceholder("コメント").fill("ここは良い");
  await page.getByRole("button", { name: "下書きに足す" }).click();

  await page.getByRole("button", { name: "まとめて送る(2)" }).click();
  await expect(page.getByText("2 件を送りました")).toBeVisible();

  const review = state.reviews[0] as {
    commit_id: string;
    event: string;
    comments: { path: string; line: number; start_line?: number; body: string }[];
  };
  expect(review.commit_id).toBe("branch_c");
  expect(review.event).toBe("COMMENT");
  expect(review.comments[0]).toMatchObject({
    path: "works/lh/episodes/003/text.md",
    start_line: 3,
    line: 4,
  });
  expect(review.comments[0]!.body).toContain("> 嵐が来た。");
  expect(review.comments[0]!.body).toContain('<!-- atlas:{"ep":3,"lines":[3,4]');
  expect(review.comments[1]).toMatchObject({ line: 6 });
});

test("設計書タブを読み、設計を承認する", async ({ page }) => {
  const state = await mockGitHub(page);
  state.labels.splice(0, state.labels.length, "stage:design");
  await page.goto("./#/pulls");
  await page.getByRole("button", { name: /第3話 灯を消す/ }).click();
  await page.getByRole("button", { name: "設計書" }).click();
  await expect(page.getByText("消えた灯と娘の影")).toBeVisible();
  await page.getByRole("button", { name: "設計を承認" }).click();
  await expect(page.getByText("design-approved を付けました")).toBeVisible();
  expect(state.labels).toContain("design-approved");
});
