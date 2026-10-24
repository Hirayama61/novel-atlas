import { useEffect, useState } from "react";
import { isBotComment } from "../core/comment";
import { db } from "../db/db";
import {
  listPullFiles,
  listPulls,
  listReviewComments,
  loadConfig,
  type PullRequest,
} from "../sync/github";
import { syncRef } from "../sync/sync";
import { href } from "./router";

interface Row {
  pr: PullRequest;
  /** その PR で開く話(text.md か design.yaml が変わっている話) */
  target: { work: string; ep: number } | null;
  /** 依頼者のコメントで、ルーティンのリアクション(🚀/👀)がまだ無いもの */
  pending: number;
}

export function PullsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<number | null>(null);

  useEffect(() => {
    const c = loadConfig();
    if (!c.token) return;
    (async () => {
      const pulls = await listPulls(c);
      const out: Row[] = [];
      for (const pr of pulls) {
        const [files, comments] = await Promise.all([
          listPullFiles(c, pr.number),
          listReviewComments(c, pr.number),
        ]);
        const m = files
          .map((f) =>
            /^works\/([^/]+)\/episodes\/(\d{3})\/(text\.md|design\.yaml)$/.exec(f.filename),
          )
          .find(Boolean);
        out.push({
          pr,
          target: m ? { work: m[1]!, ep: Number(m[2]) } : null,
          pending: comments.filter(
            (x) =>
              !isBotComment(x.body) &&
              x.user.type !== "Bot" &&
              !x.reactions?.rocket &&
              !x.reactions?.eyes,
          ).length,
        });
      }
      setRows(out);
    })().catch((e: Error) => setError(e.message));
  }, []);

  /** PR のブランチを同期してから読書画面へ */
  const open = async (r: Row) => {
    if (!r.target) return;
    setOpening(r.pr.number);
    try {
      await syncRef(loadConfig(), r.pr.head.ref);
      window.location.assign(
        href({
          page: "reader",
          work: r.target.work,
          ep: r.target.ep,
          ref: r.pr.head.ref,
          pr: r.pr.number,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(null);
    }
  };

  const drafts = (n: number) => db.drafts.where("pr").equals(n).count();

  if (!loadConfig().token) return <p className="error">設定でトークンを入れてください</p>;
  return (
    <div>
      <h2>PR</h2>
      {error ? <p className="error">{error}</p> : null}
      {!rows && !error ? <p className="muted">読み込み中…</p> : null}
      {rows?.length === 0 ? <p className="muted">開いている PR はありません。</p> : null}
      <ul className="pulls">
        {rows?.map((r) => (
          <li key={r.pr.number}>
            <button
              className="link"
              onClick={() => void open(r)}
              disabled={!r.target || opening !== null}
            >
              #{r.pr.number} {r.pr.title}
            </button>
            <div className="muted">
              {r.pr.labels.map((l) => (
                <span key={l.name} className="tag">
                  {l.name}
                </span>
              ))}
              {r.pending ? <span className="tag warn">未処理のコメント {r.pending}</span> : null}
              <DraftCount n={r.pr.number} count={drafts} />
              {opening === r.pr.number ? " 同期中…" : ""}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DraftCount({ n, count }: { n: number; count: (n: number) => Promise<number> }) {
  const [c, setC] = useState(0);
  useEffect(() => {
    void count(n).then(setC);
  }, [n, count]);
  return c ? <span className="tag">下書き {c}</span> : null;
}
