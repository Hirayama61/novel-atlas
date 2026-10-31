import { useState } from "react";
import { createAppIssue, loadConfig, type CreatedIssue } from "../../sync/github";
import {
  canSubmitIssue,
  clearIssueDraft,
  ISSUE_PERMISSION_HINT,
  isPermissionError,
  loadIssueDraft,
  saveIssueDraft,
  type IssueDraft,
} from "./issueDraft";

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; issue: CreatedIssue }
  | { kind: "failed"; message: string; needsPermission: boolean };

interface OwnProps {
  onClose: () => void;
}

/**
 * 改善 Issue のシート。題と本文を書き、本体リポジトリに `ready` 付きの Issue を作る。
 *
 * @remarks
 * 送り先は持たない(`APP_REPO`)。下書きは入力のたびに端末に残し、送れたときだけ消す。
 */
export function IssueSheet(props: OwnProps) {
  const { onClose } = props;
  const [draft, setDraft] = useState<IssueDraft>(loadIssueDraft);
  const [send, setSend] = useState<SendState>({ kind: "idle" });

  const updateDraft = (next: IssueDraft) => {
    setDraft(next);
    saveIssueDraft(next);
  };

  const submit = async () => {
    setSend({ kind: "sending" });
    try {
      const issue = await createAppIssue(loadConfig(), draft.title.trim(), draft.body);
      clearIssueDraft();
      setDraft(loadIssueDraft());
      setSend({ kind: "sent", issue });
    } catch (e) {
      setSend({
        kind: "failed",
        message: (e as Error).message,
        needsPermission: isPermissionError(e),
      });
    }
  };

  const isSending = send.kind === "sending";
  const isSubmitDisabled = !canSubmitIssue(draft) || isSending;
  const submitLabel = isSending ? "送信中…" : "Issue を作る";

  return (
    <section className="issue-sheet" aria-label="改善 Issue">
      <h3>改善 Issue を作る</h3>
      <p className="notice">公開リポジトリなので、未公開の設定を書かない。</p>
      <label>
        題
        <input
          value={draft.title}
          onChange={(e) => updateDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <label>
        本文
        <textarea
          rows={6}
          value={draft.body}
          onChange={(e) => updateDraft({ ...draft, body: e.target.value })}
        />
      </label>
      <div className="row">
        <button onClick={submit} disabled={isSubmitDisabled}>
          {submitLabel}
        </button>
        <button onClick={onClose}>閉じる</button>
      </div>
      {send.kind === "sent" ? (
        <p className="muted">
          <a href={send.issue.html_url} target="_blank" rel="noreferrer">
            #{send.issue.number}
          </a>{" "}
          を作りました
        </p>
      ) : null}
      {send.kind === "failed" ? (
        <div className="error" role="alert">
          <p>送れませんでした(下書きは残ります): {send.message}</p>
          {send.needsPermission ? <p>{ISSUE_PERMISSION_HINT}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
