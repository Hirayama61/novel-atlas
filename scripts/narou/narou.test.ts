// なろうの取得処理のテスト。HTTP はモックし、本文は架空の作品「灯台守の娘」の文だけを使う。

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectReferences,
  FETCH_STATE_PATH,
  getCurrentGone,
  getEpisodesToFetch,
  getStopReason,
} from "./collect";
import { extractEpisodeText, getEpisodePath, getEpisodeUrl } from "./episode-html";
import { getNovelMetaUrl, parseNovelMeta } from "./novel-api";
import {
  type Clock,
  createPoliteClient,
  type FetchFn,
  getWaitMs,
  REQUEST_INTERVAL_MS,
} from "./polite-client";

/** 架空の ncode。実在の作品を指さない */
const NCODE = "n0000aa";
const NCODE_2 = "n0000ab";

const META_URL = getNovelMetaUrl(NCODE);
const META_URL_2 = getNovelMetaUrl(NCODE_2);

function metaBody(count: number, noveltype = 1): string {
  return JSON.stringify([
    { allcount: 1 },
    { title: "灯台守の娘", ncode: NCODE.toUpperCase(), general_all_no: count, noveltype },
  ]);
}

function episodeHtml(lines: string[]): string {
  const ps = lines.map((line, i) => `<p id="L${i + 1}">${line}</p>`).join("\n");
  return [
    "<html><body>",
    '<div class="p-novel__text p-novel__text--preface"><p id="Lp1">前書き</p></div>',
    `<div class="js-novel-text p-novel__text">\n${ps}\n</div>`,
    '<div class="p-novel__text p-novel__text--afterword"><p id="La1">後書き</p></div>',
    "</body></html>",
  ].join("\n");
}

const EPISODE_1 = episodeHtml(["　灯室の窓が赤く割れた。", "<br />", "「潮は今夜引く」"]);
const EPISODE_2 = episodeHtml(["　ミオは港へ下りた。"]);
const EPISODE_3 = episodeHtml(["　父の目はもう灯を追えない。"]);

/** 送った時刻を記録する偽の時計。sleep は時刻を進めるだけ */
function fakeClock(start = 1_000_000): Clock & { sentAt: number[] } {
  let now = start;
  return {
    sentAt: [],
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
  };
}

/** URL ごとの応答を返す fetch。表に無い URL は 404 */
function routeFetch(routes: Record<string, Response | Error>, clock: Clock & { sentAt: number[] }) {
  return vi.fn<FetchFn>(async (url) => {
    clock.sentAt.push(clock.now());
    const route = routes[url];
    if (route instanceof Error) throw route;
    if (route === undefined) return new Response("Not Found", { status: 404 });
    return route.clone();
  });
}

const ok = (body: string) => new Response(body, { status: 200 });

const LONG_BUDGET = { maxEpisodes: 100, deadline: Number.POSITIVE_INFINITY };

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "narou-"));
  mkdirSync(join(dataDir, "references"), { recursive: true });
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

function writeWorks(ncodes: string[]) {
  const lines = ["ncode,title,volumes,note", ...ncodes.map((n) => `${n},,,`)];
  writeFileSync(join(dataDir, "references/works.csv"), `${lines.join("\n")}\n`);
}

function readData(relPath: string): string {
  return readFileSync(join(dataDir, relPath), "utf8");
}

function hasData(relPath: string): boolean {
  return existsSync(join(dataDir, relPath));
}

describe("作品情報を読む", () => {
  it("全年齢の API だけを使う", () => {
    expect(META_URL).toBe(`https://api.syosetu.com/novelapi/api/?out=json&ncode=${NCODE}`);
  });

  it("話数と連載か短編かを読む", () => {
    const result = parseNovelMeta(metaBody(12, 2));
    expect(result).toMatchObject({ kind: "ok", episodeCount: 12, isShortStory: true });
  });

  it("API に無い作品(年齢制限を含む)は失敗にする", () => {
    const result = parseNovelMeta(JSON.stringify([{ allcount: 0 }]));
    expect(result.kind).toBe("error");
  });

  it("JSON でない応答は失敗にする", () => {
    expect(parseNovelMeta("<html>").kind).toBe("error");
  });
});

describe("話のページから本文を取り出す", () => {
  it("前書きと後書きを除き、1 段落 1 行にする", () => {
    expect(extractEpisodeText(EPISODE_1)).toBe("　灯室の窓が赤く割れた。\n\n「潮は今夜引く」\n");
  });

  it("ルビをなろう記法にし、文字参照を戻す", () => {
    const html = episodeHtml([
      "<ruby>灯室<rp>(</rp><rt>とうしつ</rt><rp>)</rp></ruby>の&lt;窓&gt;&#12354;",
    ]);
    expect(extractEpisodeText(html)).toBe("｜灯室《とうしつ》の<窓>あ\n");
  });

  it("旧画面の本文の入れ物も読む", () => {
    const html = '<div id="novel_honbun" class="novel_view"><p id="L1">　潮が引いた。</p></div>';
    expect(extractEpisodeText(html)).toBe("　潮が引いた。\n");
  });

  it("本文の入れ物が無ければ null", () => {
    expect(extractEpisodeText("<html><body><p>目次</p></body></html>")).toBeNull();
  });

  it("話の URL とパス。短編は作品ページを読む", () => {
    expect(getEpisodeUrl(NCODE, 3, false)).toBe(`https://ncode.syosetu.com/${NCODE}/3/`);
    expect(getEpisodeUrl(NCODE, 1, true)).toBe(`https://ncode.syosetu.com/${NCODE}/`);
    expect(getEpisodePath(NCODE, 7)).toBe(`references/${NCODE}/episodes/007.md`);
  });
});

describe("取得の間隔", () => {
  it("前のリクエストから 2.5 秒空ける", () => {
    expect(REQUEST_INTERVAL_MS).toBe(2500);
    expect(getWaitMs(1000, 2000)).toBe(1500);
    expect(getWaitMs(1000, 5000)).toBe(0);
  });

  it("ホストが違っても間隔を空けて送る", async () => {
    const clock = fakeClock();
    const fetchFn = routeFetch({ [META_URL]: ok(metaBody(1)) }, clock);
    const client = createPoliteClient(fetchFn, clock);
    await client.get(META_URL);
    await client.get(getEpisodeUrl(NCODE, 1, false));
    await client.get(META_URL);
    const gaps = clock.sentAt.slice(1).map((t, i) => t - (clock.sentAt[i] ?? 0));
    expect(gaps).toEqual([REQUEST_INTERVAL_MS, REQUEST_INTERVAL_MS]);
  });
});

describe("打ち切りの条件", () => {
  it("話数の上限と時間の上限", () => {
    expect(getStopReason({ maxEpisodes: 2, deadline: 100 }, 2, 0)).toContain("話数");
    expect(getStopReason({ maxEpisodes: 2, deadline: 100 }, 1, 100)).toContain("時間");
    expect(getStopReason({ maxEpisodes: 2, deadline: 100 }, 1, 99)).toBeNull();
  });
});

describe("参考作品を集める", () => {
  it("未取得の話を取り、本文・作品情報・進捗を書く", async () => {
    writeWorks([NCODE]);
    const clock = fakeClock();
    const routes = {
      [META_URL]: ok(metaBody(2)),
      [getEpisodeUrl(NCODE, 1, false)]: ok(EPISODE_1),
      [getEpisodeUrl(NCODE, 2, false)]: ok(EPISODE_2),
    };
    const client = createPoliteClient(routeFetch(routes, clock), clock);
    const summary = await collectReferences(dataDir, LONG_BUDGET, client, clock);
    expect(summary.fetched).toBe(2);
    expect(readData(getEpisodePath(NCODE, 2))).toBe("　ミオは港へ下りた。\n");
    expect(JSON.parse(readData(`references/${NCODE}/meta.json`))).toMatchObject({
      general_all_no: 2,
    });
    const state = JSON.parse(readData(FETCH_STATE_PATH)) as { works: Record<string, unknown> };
    expect(state.works[NCODE]).toEqual({ status: "完了", episodes: 2, fetched: 2, gone: [] });
  });

  it("既に置いてある話は取り直さず、作品情報は取り直す", async () => {
    writeWorks([NCODE]);
    mkdirSync(join(dataDir, `references/${NCODE}/episodes`), { recursive: true });
    writeFileSync(join(dataDir, getEpisodePath(NCODE, 1)), "既存\n");
    const clock = fakeClock();
    const routes = {
      [META_URL]: ok(metaBody(2)),
      [getEpisodeUrl(NCODE, 2, false)]: ok(EPISODE_2),
    };
    const fetchFn = routeFetch(routes, clock);
    const client = createPoliteClient(fetchFn, clock);
    await collectReferences(dataDir, LONG_BUDGET, client, clock);
    const urls = fetchFn.mock.calls.map(([url]) => url);
    expect(urls).toEqual([META_URL, getEpisodeUrl(NCODE, 2, false)]);
    expect(readData(getEpisodePath(NCODE, 1))).toBe("既存\n");
  });

  it("話数の上限で打ち切り、残りの作品は未着手にする", async () => {
    writeWorks([NCODE, NCODE_2]);
    const clock = fakeClock();
    const routes = {
      [META_URL]: ok(metaBody(3)),
      [getEpisodeUrl(NCODE, 1, false)]: ok(EPISODE_1),
      [getEpisodeUrl(NCODE, 2, false)]: ok(EPISODE_2),
      [getEpisodeUrl(NCODE, 3, false)]: ok(EPISODE_3),
    };
    const client = createPoliteClient(routeFetch(routes, clock), clock);
    const budget = { maxEpisodes: 2, deadline: Number.POSITIVE_INFINITY };
    const summary = await collectReferences(dataDir, budget, client, clock);
    expect(summary.fetched).toBe(2);
    expect(summary.stoppedBy).toContain("話数");
    expect(summary.works[NCODE]).toMatchObject({ status: "途中", fetched: 2 });
    expect(summary.works[NCODE_2]).toMatchObject({ status: "未着手" });
    expect(hasData(getEpisodePath(NCODE, 3))).toBe(false);
  });

  it("失敗した作品は理由を残して次の作品へ進む", async () => {
    writeWorks([NCODE, NCODE_2]);
    const clock = fakeClock();
    const routes = {
      [META_URL]: ok(metaBody(1)),
      [getEpisodeUrl(NCODE, 1, false)]: ok("<html>メンテナンス中</html>"),
      [META_URL_2]: ok(metaBody(1, 2)),
      [getEpisodeUrl(NCODE_2, 1, true)]: ok(EPISODE_2),
    };
    const client = createPoliteClient(routeFetch(routes, clock), clock);
    const summary = await collectReferences(dataDir, LONG_BUDGET, client, clock);
    expect(summary.works[NCODE]).toMatchObject({ status: "失敗" });
    expect(readData(`references/${NCODE}/fetch-log.csv`)).toContain("本文が見つかりません");
    expect(summary.works[NCODE_2]).toMatchObject({ status: "完了", fetched: 1 });
  });

  it("通信の失敗も理由を残して次の作品へ進む", async () => {
    writeWorks([NCODE, NCODE_2]);
    const clock = fakeClock();
    const routes = {
      [META_URL]: new Error("socket hang up"),
      [META_URL_2]: ok(metaBody(1, 2)),
      [getEpisodeUrl(NCODE_2, 1, true)]: ok(EPISODE_2),
    };
    const client = createPoliteClient(routeFetch(routes, clock), clock);
    const summary = await collectReferences(dataDir, LONG_BUDGET, client, clock);
    expect(summary.works[NCODE]).toMatchObject({ status: "失敗" });
    expect(readData(`references/${NCODE}/fetch-log.csv`)).toContain("socket hang up");
    expect(summary.works[NCODE_2]).toMatchObject({ status: "完了" });
  });

  it("消えた話は記録して飛ばし、続きの話を取る", async () => {
    writeWorks([NCODE]);
    const clock = fakeClock();
    const routes = {
      [META_URL]: ok(metaBody(2)),
      [getEpisodeUrl(NCODE, 2, false)]: ok(EPISODE_2),
    };
    const client = createPoliteClient(routeFetch(routes, clock), clock);
    const summary = await collectReferences(dataDir, LONG_BUDGET, client, clock);
    expect(hasData(getEpisodePath(NCODE, 2))).toBe(true);
    expect(readData(`references/${NCODE}/fetch-log.csv`)).toContain("404");
    expect(summary.works[NCODE]).toMatchObject({ status: "完了", fetched: 1, gone: [1] });
  });

  it("消えた話は次の回に取りに行かず、記録も足さない", async () => {
    writeWorks([NCODE]);
    const clock = fakeClock();
    const routes = {
      [META_URL]: ok(metaBody(2)),
      [getEpisodeUrl(NCODE, 2, false)]: ok(EPISODE_2),
    };
    await collectReferences(
      dataDir,
      LONG_BUDGET,
      createPoliteClient(routeFetch(routes, clock), clock),
      clock,
    );
    const logAfterFirst = readData(`references/${NCODE}/fetch-log.csv`);
    const secondRoutes = { [META_URL]: ok(metaBody(2)) };
    const fetchFn = routeFetch(secondRoutes, clock);
    const summary = await collectReferences(
      dataDir,
      LONG_BUDGET,
      createPoliteClient(fetchFn, clock),
      clock,
    );
    const urls = fetchFn.mock.calls.map(([url]) => url);
    expect(urls).toEqual([META_URL]);
    expect(readData(`references/${NCODE}/fetch-log.csv`)).toBe(logAfterFirst);
    expect(summary.works[NCODE]).toMatchObject({ status: "完了", gone: [1] });
  });

  it("消えた話の欄が無い前回の進捗も読める", async () => {
    writeWorks([NCODE]);
    const previous = { works: { [NCODE]: { status: "途中", episodes: 1, fetched: 0 } } };
    mkdirSync(join(dataDir, "references"), { recursive: true });
    writeFileSync(join(dataDir, FETCH_STATE_PATH), JSON.stringify(previous));
    const clock = fakeClock();
    const routes = {
      [META_URL]: ok(metaBody(1)),
      [getEpisodeUrl(NCODE, 1, false)]: ok(EPISODE_1),
    };
    const summary = await collectReferences(
      dataDir,
      LONG_BUDGET,
      createPoliteClient(routeFetch(routes, clock), clock),
      clock,
    );
    expect(summary.works[NCODE]).toEqual({ status: "完了", episodes: 1, fetched: 1, gone: [] });
  });

  it("取得元が 503 を返したらこの回を止める", async () => {
    writeWorks([NCODE, NCODE_2]);
    const clock = fakeClock();
    const routes = { [META_URL]: new Response("busy", { status: 503 }) };
    const fetchFn = routeFetch(routes, clock);
    const client = createPoliteClient(fetchFn, clock);
    const summary = await collectReferences(dataDir, LONG_BUDGET, client, clock);
    expect(summary.stoppedBy).toContain("503");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(summary.works[NCODE_2]).toMatchObject({ status: "未着手" });
  });

  it("年齢制限のホストや形の違う ncode は取りに行かない", async () => {
    writeWorks(["https://novel18.syosetu.com/n0000ac/"]);
    const clock = fakeClock();
    const fetchFn = routeFetch({}, clock);
    const client = createPoliteClient(fetchFn, clock);
    const summary = await collectReferences(dataDir, LONG_BUDGET, client, clock);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(Object.values(summary.works)).toEqual([expect.objectContaining({ status: "失敗" })]);
  });
});

describe("getEpisodesToFetch", () => {
  it("置いていない話から消えた話を除く", () => {
    expect(getEpisodesToFetch([1, 3, 4], [3])).toEqual([1, 4]);
  });
});

describe("getCurrentGone", () => {
  it("話数が減って範囲の外になった話と、後から置いた話を落とす", () => {
    expect(getCurrentGone([2, 5, 9], [2, 3])).toEqual([2]);
  });
});
