import { getReferenceShelf } from "../core/reference-shelf";
import { REFERENCES_CSV_PATH } from "../core/references";
import { loadConfig } from "../sync/github";
import { ReferencesSection } from "./references/ReferencesSection";
import { href } from "./router";
import { TurnSection } from "./TurnSection";
import { useData } from "./useData";

export function LibraryPage() {
  const { data, files, loading, error, sync, progress } = useData("main");
  if (!loadConfig().token)
    return (
      <p>
        まず <a href={href({ page: "settings" })}>設定</a>{" "}
        でデータリポジトリのトークンを入れてください。
      </p>
    );
  if (loading) return <p className="muted">読み込み中…</p>;
  const works = [...(data?.works.values() ?? [])].filter((w) => w.work);
  const referencesCsv = files?.get(REFERENCES_CSV_PATH) ?? null;
  const workTitles = new Map(works.map((w) => [w.id, w.work!.title]));
  const shelf = getReferenceShelf(files ?? new Map());
  const isEmpty = !works.length && !shelf.length;
  return (
    <div>
      <TurnSection workTitles={workTitles} />
      <div className="toolbar">
        <h2>作品</h2>
        <button onClick={() => void sync()} disabled={!!progress}>
          {progress ?? "同期"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <ul className="works">
        {works.map((w) => {
          const eps = [...w.episodes.values()].filter((e) => e.text).length;
          return (
            <li key={w.id}>
              <a href={href({ page: "work", work: w.id, tab: "episodes", ref: "main" })}>
                {w.work!.title}
              </a>
              <span className="muted">
                {" "}
                {w.work!.status} / {eps} 話 / 人物 {w.characters.length} / 伏線 {w.threads.length}
              </span>
            </li>
          );
        })}
        {shelf.map((r) => (
          <li key={r.ncode}>
            <span className="tag">参考</span>
            <a href={href({ page: "reference", ncode: r.ncode })}>{r.title}</a>
            <span className="muted"> {r.episodes.length} 話</span>
          </li>
        ))}
      </ul>
      {isEmpty ? <p className="muted">作品がありません。同期してください。</p> : null}
      <ReferencesSection csvText={referencesCsv} onChanged={sync} />
    </div>
  );
}
