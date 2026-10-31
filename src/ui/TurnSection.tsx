import { useEffect, useState } from "react";
import { getTurnItems, TURN_ACTION_LABELS, type TurnItem } from "../core/turn";
import { listPulls, loadConfig } from "../sync/github";
import { syncRef } from "../sync/sync";
import { href } from "./router";

interface Props {
  /** 作品 ID → 題名(main の同期済みデータ)。無い作品は ID のまま出す */
  workTitles: ReadonlyMap<string, string>;
}

/**
 * ライブラリの先頭の「あなたの番」。open の PR を取り、依頼者がやる番の話を並べる。
 *
 * @remarks
 * どの PR が番かの判定は持たない(`src/core/turn.ts` が決める)。該当が無ければ何も描かない。
 */
export function TurnSection(props: Props) {
  const { workTitles } = props;
  const [items, setItems] = useState<TurnItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<number | null>(null);

  useEffect(() => {
    listPulls(loadConfig())
      .then((pulls) => setItems(getTurnItems(pulls)))
      .catch((e: Error) => setError(e.message));
  }, []);

  /** PR のブランチを同期してから、その話の読書画面(設計段階なら設計書)へ */
  const open = async (item: TurnItem) => {
    setOpening(item.number);
    try {
      await syncRef(loadConfig(), item.ref);
      const designTab = item.tab === "design" ? { tab: "design" as const } : {};
      window.location.assign(
        href({
          page: "reader",
          work: item.work,
          ep: item.ep,
          ref: item.ref,
          pr: item.number,
          ...designTab,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(null);
    }
  };

  const hasItems = items.length > 0;
  if (!hasItems && !error) return null;
  return (
    <section className="turn">
      <h2>あなたの番</h2>
      {error ? <p className="error">{error}</p> : null}
      <ul className="pulls">
        {items.map((item) => (
          <TurnRow
            key={item.number}
            title={workTitles.get(item.work) ?? item.work}
            ep={item.ep}
            action={TURN_ACTION_LABELS[item.kind]}
            isOpening={opening === item.number}
            isDisabled={opening !== null}
            onOpen={() => void open(item)}
          />
        ))}
      </ul>
    </section>
  );
}

interface RowProps {
  title: string;
  ep: number;
  action: string;
  isOpening: boolean;
  isDisabled: boolean;
  onOpen: () => void;
}

function TurnRow(props: RowProps) {
  const { title, ep, action, isOpening, isDisabled, onOpen } = props;
  return (
    <li>
      <button className="link" onClick={onOpen} disabled={isDisabled}>
        {title} 第{ep}話
      </button>{" "}
      <span className="tag warn">{action}</span>
      {isOpening ? <span className="muted">同期中…</span> : null}
    </li>
  );
}
