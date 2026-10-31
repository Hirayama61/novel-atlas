import type { ReaderSettings } from "./readerSettings";

/** 字詰めの選択肢 */
const CHARS_PER_LINE_OPTIONS = [20, 24, 28, 32, 36, 40, 48];
/** 文字の大きさ(px)の選択肢 */
const FONT_SIZE_OPTIONS = [14, 16, 18, 20, 22, 24];
/** 行間の選択肢 */
const LINE_HEIGHT_OPTIONS = [1.6, 1.8, 1.9, 2.1, 2.4];

interface OwnProps {
  settings: ReaderSettings;
  onChange: (s: Partial<ReaderSettings>) => void;
}

/**
 * 読書画面の表示の設定(縦横・字詰め・文字・行間)。自作と参考作品の読書画面が並べる。
 *
 * @remarks
 * 設定の保存は持たない(`useReaderSettings` が持つ)。
 */
export function ReaderSettingsControls(props: OwnProps) {
  const { settings, onChange } = props;
  const toggleLabel = settings.vertical ? "横書き" : "縦書き";
  return (
    <>
      <button onClick={() => onChange({ vertical: !settings.vertical })}>{toggleLabel}</button>
      <label>
        字詰め
        <select
          value={settings.charsPerLine}
          onChange={(e) => onChange({ charsPerLine: Number(e.target.value) })}
        >
          {CHARS_PER_LINE_OPTIONS.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <label>
        文字
        <select
          value={settings.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
        >
          {FONT_SIZE_OPTIONS.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <label>
        行間
        <select
          value={settings.lineHeight}
          onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
        >
          {LINE_HEIGHT_OPTIONS.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
    </>
  );
}
