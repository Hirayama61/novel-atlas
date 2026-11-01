import { getHumanIssueAction } from "../core/human-issues";
import { TURN_ACTION_LABELS } from "../core/turn";
import { useHumanIssues } from "./hooks/useHumanIssues";
import { useTurnItems } from "./hooks/useTurnItems";

interface Props {
  /** 作品 ID → 題名(main の同期済みデータ)。無い作品は ID のまま出す */
  workTitles: ReadonlyMap<string, string>;
}

const goTo = (to: string) => window.location.assign(to);

/**
 * ライブラリの先頭の「あなたの番」。依頼者がやる番の話と、人がやる Issue を並べる。
 *
 * @remarks
 * どの PR が番か、どの Issue を出すかの判定は持たない(`src/core/turn.ts`、`src/core/human-issues.ts`)。
 * 取得と開く処理は `useTurnItems`・`useHumanIssues` が持つ。該当もエラーも無ければ何も描かない。
 */
export function TurnSection(props: Props) {
  const { workTitles } = props;
  const { items, error, opening, open } = useTurnItems(goTo);
  const { issues, error: issueError } = useHumanIssues();

  const hasItems = items.length > 0 || issues.length > 0;
  const errors = [error, issueError].filter((e) => e !== null);
  const hasError = errors.length > 0;
  const isHidden = !hasItems && !hasError;
  if (isHidden) return null;
  const isAnyOpening = opening !== null;
  const rows = items.map((item) => {
    const title = workTitles.get(item.work) ?? item.work;
    const isOpening = opening === item.number;
    return (
      <TurnRow
        key={`pr-${item.number}`}
        title={title}
        ep={item.ep}
        action={TURN_ACTION_LABELS[item.kind]}
        isOpening={isOpening}
        isDisabled={isAnyOpening}
        onOpen={() => void open(item)}
      />
    );
  });
  const issueRows = issues.map((issue) => (
    <HumanIssueRow
      key={`issue-${issue.number}`}
      title={issue.title}
      url={issue.url}
      action={getHumanIssueAction(issue.tasks)}
    />
  ));
  const errorLines = errors.map((message) => (
    <p key={message} className="error">
      {message}
    </p>
  ));
  return (
    <section className="turn">
      <h2>あなたの番</h2>
      {errorLines}
      <ul className="pulls">
        {rows}
        {issueRows}
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

interface HumanIssueRowProps {
  title: string;
  url: string;
  action: string;
}

/** 人がやる Issue の 1 行。タップで GitHub の Issue を別のタブで開く */
function HumanIssueRow(props: HumanIssueRowProps) {
  const { title, url, action } = props;
  return (
    <li>
      <a href={url} target="_blank" rel="noopener noreferrer">
        {title}
      </a>{" "}
      <span className="tag warn">{action}</span>
    </li>
  );
}
