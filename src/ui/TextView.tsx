import { Fragment, useEffect, useRef } from "react";
import { parseRuby } from "../core/ruby";
import type { ReaderSettings } from "./readerSettings";

export interface LineMark {
  /** 選択中の範囲 */
  selected?: boolean;
  /** その行で終わるコメントの数 */
  comments?: number;
}

interface Props {
  text: string;
  settings: ReaderSettings;
  marks?: Map<number, LineMark>;
  onLineTap?: (line: number) => void;
  /** 画面内の先頭の行が変わったとき */
  onTopLine?: (line: number) => void;
  initialLine?: number | null;
  /** 行の後ろに差し込む要素(コメントのスレッドなど) */
  renderAfter?: (line: number) => React.ReactNode;
}

function Line({ text }: { text: string }) {
  return (
    <>
      {parseRuby(text).map((s, i) =>
        s.kind === "ruby" ? (
          <ruby key={i}>
            {s.base}
            <rp>(</rp>
            <rt>{s.ruby}</rt>
            <rp>)</rp>
          </ruby>
        ) : s.kind === "emphasis" ? (
          <em key={i} className="boten">
            {s.text}
          </em>
        ) : (
          <Fragment key={i}>{tcy(s.text)}</Fragment>
        ),
      )}
    </>
  );
}

/** 縦書きで半角の !? を縦中横にする(CSS で横書き時は無効) */
function tcy(text: string): React.ReactNode {
  const parts = text.split(/([!?]{1,2})/);
  return parts.map((p, i) =>
    /^[!?]{1,2}$/.test(p) ? (
      <span key={i} className="tcy">
        {p}
      </span>
    ) : (
      p
    ),
  );
}

export function TextView({
  text,
  settings,
  marks,
  onLineTap,
  onTopLine,
  initialLine,
  renderAfter,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const lines = text.split(/\r?\n/);

  useEffect(() => {
    if (!initialLine || !root.current) return;
    root.current
      .querySelector(`[data-line="${initialLine}"]`)
      ?.scrollIntoView({ block: "start", inline: "start" });
  }, [initialLine, text]);

  useEffect(() => {
    if (!onTopLine || !root.current || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<number>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const n = Number((e.target as HTMLElement).dataset.line);
        if (e.isIntersecting) visible.add(n);
        else visible.delete(n);
      }
      if (visible.size) onTopLine(Math.min(...visible));
    });
    root.current.querySelectorAll("[data-line]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [onTopLine, text]);

  const style = {
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    ...(settings.vertical
      ? { height: `${settings.charsPerLine}em` }
      : { maxWidth: `${settings.charsPerLine}em` }),
  };

  return (
    <div
      ref={root}
      className={`text ${settings.vertical ? "vertical" : "horizontal"}`}
      style={style}
    >
      {lines.map((l, i) => {
        const n = i + 1;
        const mark = marks?.get(n);
        let el: React.ReactNode;
        if (l.startsWith("# ")) el = <h1 data-line={n}>{l.slice(2)}</h1>;
        else if (!l.trim()) el = <div className="gap" data-line={n} />;
        else if (/^　?◇\s*$/.test(l))
          el = (
            <div className="scene-break" data-line={n}>
              ◇
            </div>
          );
        else
          el = (
            <p
              data-line={n}
              className={`${mark?.selected ? "selected" : ""} ${onLineTap ? "tappable" : ""}`}
              onClick={onLineTap ? () => onLineTap(n) : undefined}
            >
              <Line text={l} />
              {mark?.comments ? <span className="comment-badge">{mark.comments}</span> : null}
            </p>
          );
        return (
          <Fragment key={n}>
            {el}
            {renderAfter?.(n)}
          </Fragment>
        );
      })}
    </div>
  );
}
