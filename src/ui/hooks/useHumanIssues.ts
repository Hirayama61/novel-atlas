import { useEffect, useState } from "react";
import { getHumanIssueItems, type HumanIssueItem } from "../../core/human-issues";
import { listHumanIssues, loadConfig } from "../../sync/github";

/**
 * 「あなたの番」の人がやる Issue の取得。
 *
 * @remarks
 * どの Issue を出すかは持たない(`src/core/human-issues.ts`)。見た目は持たない(`TurnSection`)。
 * PR の取得(`useTurnItems`)とはエラーを分け、片方の失敗で他方を消さない。
 */
export function useHumanIssues() {
  const [issues, setIssues] = useState<HumanIssueItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listHumanIssues(loadConfig())
      .then((list) => setIssues(getHumanIssueItems(list)))
      .catch((e: Error) => setError(e.message));
  }, []);

  return { issues, error };
}
