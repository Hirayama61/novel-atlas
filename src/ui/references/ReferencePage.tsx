import { getReferenceShelf } from "../../core/reference-shelf";
import { href } from "../router";
import { useData } from "../useData";

interface OwnProps {
  ncode: string;
}

/**
 * 参考作品の話の一覧。同期済みの本文がある話だけを並べる。
 *
 * @remarks
 * 取得(なろうからの収集)は持たない。収集は別のルーティンが行う。
 */
export function ReferencePage(props: OwnProps) {
  const { ncode } = props;
  const { files, loading, error, sync, progress } = useData("main");
  if (loading) return <p className="muted">読み込み中…</p>;
  const work = getReferenceShelf(files ?? new Map()).find((w) => w.ncode === ncode);
  if (work === undefined)
    return (
      <p className="error">{error ?? `参考作品 ${ncode} が見つかりません。同期してください。`}</p>
    );
  return (
    <div>
      <h2>
        <span className="tag">参考</span>
        {work.title}
      </h2>
      <nav className="tabs">
        <a href={href({ page: "library" })}>← ライブラリ</a>
        <button onClick={() => void sync()} disabled={!!progress}>
          {progress ?? "同期"}
        </button>
      </nav>
      <ul className="works">
        {work.episodes.map((ep) => (
          <li key={ep}>
            <a href={href({ page: "referenceReader", ncode, ep })}>第{ep}話</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
