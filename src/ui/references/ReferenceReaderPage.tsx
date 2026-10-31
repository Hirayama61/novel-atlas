import {
  getNextEpisode,
  getReferenceEpisodePath,
  getReferenceShelf,
} from "../../core/reference-shelf";
import { useReadingPosition } from "../hooks/useReadingPosition";
import { ReaderSettingsControls } from "../ReaderSettingsControls";
import { useReaderSettings } from "../readerSettings";
import { href } from "../router";
import { TextView } from "../TextView";
import { useData } from "../useData";

/** 参考作品は main だけを読む */
const REFERENCE_REF = "main";

interface OwnProps {
  ncode: string;
  ep: number;
}

/**
 * 参考作品の 1 話を、自作と同じ表示の設定と読了位置で読む。末尾から続きの話へ進める。
 *
 * @remarks
 * 投稿用のコピー・PR のコメント・設計書は持たない(自作の読書画面だけが持つ)。
 */
export function ReferenceReaderPage(props: OwnProps) {
  const { ncode, ep } = props;
  const { files, loading, error, sync, progress } = useData(REFERENCE_REF);
  const [settings, update] = useReaderSettings();
  const path = getReferenceEpisodePath(ncode, ep);
  const { savedLine, onTopLine } = useReadingPosition(`${REFERENCE_REF}:${path}`);
  if (loading) return <p className="muted">読み込み中…</p>;
  const text = files?.get(path) ?? null;
  const work = getReferenceShelf(files ?? new Map()).find((w) => w.ncode === ncode);
  const next = getNextEpisode(work?.episodes ?? [], ep);
  const hasNext = next !== null;
  const hasText = text !== null;
  return (
    <div className="reader">
      <div className="toolbar">
        <a href={href({ page: "reference", ncode })}>← 一覧</a>
        <ReaderSettingsControls settings={settings} onChange={update} />
        <button onClick={() => void sync()} disabled={!!progress}>
          {progress ?? "同期"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {hasText ? (
        <TextView text={text} settings={settings} onTopLine={onTopLine} initialLine={savedLine} />
      ) : (
        <p className="muted">この話の本文はまだありません。</p>
      )}
      {hasNext ? (
        <p className="toolbar">
          <a href={href({ page: "referenceReader", ncode, ep: next })}>続きの話へ(第{next}話)</a>
        </p>
      ) : null}
    </div>
  );
}
