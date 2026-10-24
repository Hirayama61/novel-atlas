import type { WorkData } from "../core/data/work";
import { countChars } from "../core/check/text";
import { titleFromText } from "../core/index-file";
import { CanonViews } from "./CanonViews";
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

function EpisodeList({ w, refName }: { w: WorkData; refName: string }) {
  const eps = [...w.episodes.values()]
    .filter((e) => e.text || e.design)
    .sort((a, b) => a.no - b.no);
  return (
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
        {eps.map((e) => (
          <tr key={e.no}>
            <td>{e.no}</td>
            <td>
              <a href={href({ page: "reader", work: w.id, ep: e.no, ref: refName, pr: null })}>
                {e.design?.title.final ??
                  (e.text ? titleFromText(e.text) : null) ??
                  e.design?.title.working ??
                  "(無題)"}
              </a>
            </td>
            <td>{e.text ? countChars(e.text).toLocaleString() : "—"}</td>
            <td>{e.design?.status ?? (e.text ? "本文のみ" : "")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
