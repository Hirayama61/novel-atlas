// references/works.csv の作品の未取得の話をなろうから取る。収集ルーティン(/collect-references)が呼ぶ。
//   DATA_DIR=... pnpm collect-references [--max-episodes 1000] [--max-minutes 50]
// git の操作はしない。取った本文は private のデータリポジトリにだけ置く。

import { parseArgs } from "node:util";
import { collectReferences } from "./narou/collect";
import { createPoliteClient, SYSTEM_CLOCK } from "./narou/polite-client";
import { requireDataDir } from "./lib/data-dir";

/** 1 回に取る話の上限の既定。2.5 秒/話で約 42 分 */
const DEFAULT_MAX_EPISODES = 1000;

/** 1 回の時間の上限の既定(分)。docs/design/05-writing-loop.md の「1 回 50 分まで」 */
const DEFAULT_MAX_MINUTES = 50;

const MS_PER_MINUTE = 60_000;

const { values } = parseArgs({
  options: {
    "max-episodes": { type: "string", default: String(DEFAULT_MAX_EPISODES) },
    "max-minutes": { type: "string", default: String(DEFAULT_MAX_MINUTES) },
  },
});
const maxEpisodes = Number(values["max-episodes"]);
const maxMinutes = Number(values["max-minutes"]);
const isValidLimit = Number.isInteger(maxEpisodes) && maxEpisodes > 0 && maxMinutes > 0;
if (!isValidLimit) {
  console.error("--max-episodes は正の整数、--max-minutes は正の数で指定してください");
  process.exit(2);
}

const dir = requireDataDir();
const deadline = SYSTEM_CLOCK.now() + maxMinutes * MS_PER_MINUTE;
const client = createPoliteClient(fetch, SYSTEM_CLOCK);
const summary = await collectReferences(dir, { maxEpisodes, deadline }, client, SYSTEM_CLOCK);

for (const [ncode, s] of Object.entries(summary.works)) {
  const total = s.episodes ?? "?";
  const parts = [ncode, s.status, `${s.fetched}/${total}`, s.reason].filter(isPresent);
  console.log(parts.join(" "));
}
console.log(`この回に取った話: ${summary.fetched}`);
if (summary.stoppedBy !== null) console.log(`打ち切り: ${summary.stoppedBy}`);

function isPresent(value: string | undefined): value is string {
  return value !== undefined;
}
