import { TURN_ACTION_LABELS } from "../core/turn";
import { useTurnItems } from "./hooks/useTurnItems";

interface Props {
  /** 作品 ID → 題名(main の同期済みデータ)。無い作品は ID のまま出す */
  workTitles: ReadonlyMap<string, string>;
}

const goTo = (to: string) => window.location.assign(to);

/**
 * ライブラリの先頭の「あなたの番」。依頼者がやる番の話を並べる。
 *
 * @remarks
 * どの PR が番かの判定は持たない(`src/core/turn.ts`)。取得と開く処理は `useTurnItems` が持つ。
 * 該当が無ければ何も描かない。
 */
export function TurnSection(props: Props) {
  const { workTitles } = props;
  const { items, error, opening, open } = useTurnItems(goTo);

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
