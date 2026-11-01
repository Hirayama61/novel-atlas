import { getHumanIssueItems, type HumanIssueItem } from "../../core/human-issues";
import { listHumanIssues, loadConfig } from "../../sync/github";
import { useFetchOnVisible } from "./useFetchOnVisible";

/** 取得前の一覧 */
const NO_ISSUES: HumanIssueItem[] = [];

/** 人がやる Issue を取り、「あなたの番」に出すものに絞る */
const fetchHumanIssueItems = () =>
  listHumanIssues(loadConfig()).then((list) => getHumanIssueItems(list));

/**
 * 「あなたの番」の人がやる Issue の取得。画面が表示に戻るたびに取り直す。
 *
 * @remarks
 * どの Issue を出すかは持たない(`src/core/human-issues.ts`)。見た目は持たない(`TurnSection`)。
 * PR の取得(`useTurnItems`)とはエラーを分け、片方の失敗で他方を消さない。
 */
export function useHumanIssues() {
  const { value: issues, error } = useFetchOnVisible(fetchHumanIssueItems, NO_ISSUES);
  return { issues, error };
}
