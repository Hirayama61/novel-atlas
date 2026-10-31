import { useState } from "react";
import {
  addReference,
  hasReference,
  parseNcode,
  parseReferencesCsv,
  removeReference,
  type ReferenceWork,
} from "../../core/references";
import { loadConfig } from "../../sync/github";
import { editReferencesCsv } from "../../sync/references";
import type { SyncResult } from "../useData";
import {
  getSyncFailedMessage,
  isWritePermissionError,
  REFERENCES_PERMISSION_HINT,
} from "./referencesPermission";

type OpState =
  | { kind: "idle" }
  | { kind: "busy"; label: string }
  | { kind: "done"; message: string }
  | { kind: "failed"; message: string; needsPermission: boolean };

interface OwnProps {
  /** 同期済みの `references/works.csv`。無ければ `null` */
  csvText: string | null;
  /** 書き込みのあとに手元を取り直す */
  onChanged: () => Promise<SyncResult>;
}

/**
 * 参考作品の一覧と登録。なろうの作品 URL か ncode を受け、データリポジトリの一覧に足す・外す。
 *
 * @remarks
 * 本文は扱わない(収集は別のルーティン)。一覧の表示は同期済みの中身から毎回作る。
 * 書き込みのあとの同期に失敗したら、成功とは出さず同期し直すよう促す。
 */
export function ReferencesSection(props: OwnProps) {
  const { csvText, onChanged } = props;
  const [input, setInput] = useState("");
  const [op, setOp] = useState<OpState>({ kind: "idle" });
  const works = parseReferencesCsv(csvText ?? "");
  const isBusy = op.kind === "busy";

  const run = async (
    label: string,
    done: string,
    task: () => ReturnType<typeof editReferencesCsv>,
  ) => {
    setOp({ kind: "busy", label });
    try {
      const result = await task();
      if (result.kind === "error") {
        setOp({ kind: "failed", message: result.reason, needsPermission: false });
        return;
      }
      const synced = await onChanged();
      if (synced.kind === "error") {
        setOp({
          kind: "failed",
          message: getSyncFailedMessage(done, synced.reason),
          needsPermission: false,
        });
        return;
      }
      setOp({ kind: "done", message: done });
    } catch (e) {
      setOp({
        kind: "failed",
        message: (e as Error).message,
        needsPermission: isWritePermissionError(e),
      });
    }
  };

  const register = async () => {
    const parsed = parseNcode(input);
    if (parsed.kind === "error") {
      setOp({ kind: "failed", message: parsed.reason, needsPermission: false });
      return;
    }
    const { ncode } = parsed;
    const isRegistered = hasReference(works, ncode);
    if (isRegistered) {
      setOp({ kind: "failed", message: `${ncode} は登録済みです`, needsPermission: false });
      return;
    }
    await run("登録中…", `${ncode} を登録しました`, () =>
      editReferencesCsv(loadConfig(), (t) => addReference(t, ncode), `references: ${ncode} を登録`),
    );
    setInput("");
  };

  const remove = (ncode: string) =>
    run("外しています…", `${ncode} を一覧から外しました`, () =>
      editReferencesCsv(
        loadConfig(),
        (t) => removeReference(t, ncode),
        `references: ${ncode} を外す`,
      ),
    );

  const submitLabel = isBusy ? op.label : "登録";
  const hasWorks = works.length > 0;

  return (
    <section aria-label="参考作品">
      <div className="toolbar">
        <h2>参考作品</h2>
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          void register();
        }}
      >
        <input
          aria-label="作品 URL か ncode"
          placeholder="https://ncode.syosetu.com/n1234ab/ か n1234ab"
          value={input}
          disabled={isBusy}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={isBusy}>
          {submitLabel}
        </button>
      </form>
      {op.kind === "done" ? (
        <p className="muted" role="status">
          {op.message}
        </p>
      ) : null}
      {op.kind === "failed" ? (
        <div className="error" role="alert">
          <p>{op.message}</p>
          {op.needsPermission ? <p>{REFERENCES_PERMISSION_HINT}</p> : null}
        </div>
      ) : null}
      <ul className="works">
        {works.map((w) => (
          <ReferenceItem
            key={w.ncode}
            work={w}
            disabled={isBusy}
            onRemove={() => void remove(w.ncode)}
          />
        ))}
      </ul>
      {hasWorks ? null : <p className="muted">登録した作品はまだありません。</p>}
    </section>
  );
}

interface ItemProps {
  work: ReferenceWork;
  disabled: boolean;
  onRemove: () => void;
}

function ReferenceItem(props: ItemProps) {
  const { work, disabled, onRemove } = props;
  const hasTitle = work.title !== "";
  const label = hasTitle ? `${work.title}(${work.ncode})` : work.ncode;
  return (
    <li>
      {label}{" "}
      <button onClick={onRemove} disabled={disabled} aria-label={`${work.ncode} を一覧から外す`}>
        外す
      </button>
    </li>
  );
}
