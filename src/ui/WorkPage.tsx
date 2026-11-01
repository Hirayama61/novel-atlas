import type { Episode, WorkData } from "../core/data/work";
import { countChars } from "../core/check/text";
import { titleFromText } from "../core/index-file";
import type { EpisodePull } from "../core/turn";
import { CanonViews } from "./CanonViews";
import { useEpisodePulls } from "./hooks/useEpisodePulls";
import { href, type Route } from "./router";
import { useData } from "./useData";

type Tab = Extract<Route, { page: "work" }>["tab"];
const TABS: [Tab, string][] = [
  ["episodes", "話"],
  ["characters", "人物"],
  ["timeline", "時系列"],
  ["threads", "伏線"],
  ["knowledge", "知識表"],
];

export function WorkPage({ work, tab, branch: ref }: { work: string; tab: Tab; branch: string }) {
  const { data, loading, error, sync, progress } = useData(ref);
  const w = data?.works.get(work);
  if (loading) return <p className="muted">読み込み中…</p>;
  if (!w)
    return <p className="error">{error ?? `作品 ${work} が見つかりません。同期してください。`}</p>;
  return (
    <div>
      <h2>{w.work?.title ?? w.id}</h2>
      <nav className="tabs">
        {TABS.map(([t, label]) => (
          <a
            key={t}
            className={t === tab ? "on" : ""}
            href={href({ page: "work", work, tab: t, ref })}
          >
            {label}
          </a>
        ))}
        <button onClick={() => void sync()} disabled={!!progress}>
          {progress ?? "同期"}
        </button>
      </nav>
      {ref !== "main" ? <p className="muted">ブランチ: {ref}</p> : null}
      {tab === "episodes" ? (
        <EpisodeList w={w} refName={ref} />
      ) : (
        <CanonViews w={w} tab={tab} refName={ref} />
      )}
    </div>
  );
}

/** 一覧の 1 行。main の話か、進行中の PR にだけある話 */
interface EpisodeRow {
  no: number;
  title: string;
  chars: string;
  status: string;
  /** 進行中の PR。あればコメントできる読書画面で開く */
  pull: EpisodePull | undefined;
}

/** 字数が無いときの表記 */
const NO_CHARS = "—";

function toMainRow(e: Episode, pull: EpisodePull | undefined): EpisodeRow {
  const title =
    e.design?.title.final ??
    (e.text ? titleFromText(e.text) : null) ??
    e.design?.title.working ??
    "(無題)";
  const chars = e.text ? countChars(e.text).toLocaleString() : NO_CHARS;
  const status = e.design?.status ?? (e.text ? "本文のみ" : "");
  return { no: e.no, title, chars, status, pull };
}

function toPullRow(no: number, pull: EpisodePull): EpisodeRow {
  return { no, title: pull.title, chars: NO_CHARS, status: "", pull };
}

/** PR の状態の表記。stage と design-approved のラベルだけを出す */
function getPullStatus(pull: EpisodePull): string {
  const stages = pull.labels.filter((l) => l.startsWith("stage:") || l === "design-approved");
  return [`PR #${pull.number}`, ...stages].join(" ");
}

function getEpisodeRows(w: WorkData, pulls: Map<number, EpisodePull>): EpisodeRow[] {
  const mainEps = [...w.episodes.values()].filter((e) => e.text || e.design);
  const mainNos = new Set(mainEps.map((e) => e.no));
  const mainRows = mainEps.map((e) => toMainRow(e, pulls.get(e.no)));
  const pullRows = [...pulls]
    .filter(([no]) => !mainNos.has(no))
    .map(([no, pull]) => toPullRow(no, pull));
  return [...mainRows, ...pullRows].sort((a, b) => a.no - b.no);
}

const goTo = (to: string) => window.location.assign(to);

function EpisodeList({ w, refName }: { w: WorkData; refName: string }) {
  const { pulls, error, opening, open } = useEpisodePulls(w.id, goTo);
  const rows = getEpisodeRows(w, pulls);
  return (
    <>
      {error ? <p className="error">進行中の PR を取れませんでした: {error}</p> : null}
      <table className="episodes">
        <thead>
          <tr>
            <th>話</th>
            <th>題</th>
            <th>字数</th>
            <th>状態</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <EpisodeRowView
              key={r.no}
              row={r}
              work={w.id}
              refName={refName}
              isOpening={opening === r.no}
              onOpen={open}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}

/** 一覧の状態の欄。進行中の PR があれば PR の状態を出す */
function getRowStatus(row: EpisodeRow): string {
  if (!row.pull) return row.status;
  return getPullStatus(row.pull);
}

function EpisodeRowView(props: {
  row: EpisodeRow;
  work: string;
  refName: string;
  isOpening: boolean;
  onOpen: (ep: number, pull: EpisodePull) => Promise<void>;
}) {
  const { row, work, refName, isOpening, onOpen } = props;
  const statusLabel = getRowStatus(row);
  return (
    <tr>
      <td>{row.no}</td>
      <td>
        <EpisodeTitle
          row={row}
          work={work}
          refName={refName}
          isOpening={isOpening}
          onOpen={onOpen}
        />
        {isOpening ? <span className="muted"> 同期中…</span> : null}
      </td>
      <td>{row.chars}</td>
      <td>{statusLabel}</td>
    </tr>
  );
}

/** 題の欄。進行中の PR があれば、ブランチを同期してコメントできる読書画面で開く */
function EpisodeTitle(props: {
  row: EpisodeRow;
  work: string;
  refName: string;
  isOpening: boolean;
  onOpen: (ep: number, pull: EpisodePull) => Promise<void>;
}) {
  const { row, work, refName, isOpening, onOpen } = props;
  const { pull } = row;
  if (!pull)
    return (
      <a href={href({ page: "reader", work, ep: row.no, ref: refName, pr: null })}>{row.title}</a>
    );
  return (
    <button className="link" onClick={() => void onOpen(row.no, pull)} disabled={isOpening}>
      {row.title}
    </button>
  );
}
