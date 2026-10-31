import { useCallback, useEffect, useMemo, useState } from "react";
import { buildCommentBody, commentText, isBotComment } from "../core/comment";
import { episodeDir } from "../core/data/files";
import { postingStats, toPostingText } from "../core/posting";
import { stripRuby } from "../core/ruby";
import { db, type DraftRecord } from "../db/db";
import {
  addLabel,
  getPull,
  listReviewComments,
  loadConfig,
  submitReview,
  type PullRequest,
  type ReviewComment,
} from "../sync/github";
import { DesignView } from "./DesignView";
import { useReadingPosition } from "./hooks/useReadingPosition";
import { ReaderSettingsControls } from "./ReaderSettingsControls";
import { href } from "./router";
import { TextView, type LineMark } from "./TextView";
import { useReaderSettings } from "./readerSettings";
import { useData } from "./useData";

interface Props {
  work: string;
  ep: number;
  branch: string;
  pr: number | null;
  /** 指定があればこの行を開く(出典リンクから来たとき)。無ければ読了位置 */
  line?: number;
  /** 最初に開くタブ(「あなたの番」から設計の話を開いたとき)。無ければ本文 */
  initialTab?: "design";
}

export function ReaderPage({ work, ep, branch: ref, pr, line, initialTab }: Props) {
  const { data, loading, error, sync, progress } = useData(ref);
  const [settings, update] = useReaderSettings();
  const [chosenTab, setTab] = useState<"text" | "design" | undefined>(undefined);
  const tab = chosenTab ?? initialTab ?? "text";
  const path = `works/${work}/episodes/${episodeDir(ep)}/text.md`;
  const w = data?.works.get(work);
  const episode = w?.episodes.get(ep);
  const text = episode?.text ?? null;
  const posKey = `${ref}:${path}`;

  // 読了位置
  const { savedLine, onTopLine } = useReadingPosition(posKey);
  const initialLine = line ?? savedLine;

  // PR
  const [pull, setPull] = useState<PullRequest | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reloadPr = useCallback(async () => {
    if (!pr) return;
    const c = loadConfig();
    const [p, cs] = await Promise.all([getPull(c, pr), listReviewComments(c, pr)]);
    setPull(p);
    setComments(cs.filter((x) => x.path === path || x.path.endsWith("/design.yaml")));
    setDrafts(await db.drafts.where("pr").equals(pr).toArray());
  }, [pr, path]);
  useEffect(() => {
    // reloadPr は最初に await するので、effect の中で同期的に setState しない
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reloadPr().catch((e: Error) => setNotice(e.message));
  }, [reloadPr]);

  const lines = useMemo(() => (text ?? "").split(/\r?\n/), [text]);

  const marks = useMemo(() => {
    const m = new Map<number, LineMark>();
    if (sel) for (let i = sel[0]; i <= sel[1]; i++) m.set(i, { selected: true });
    const bump = (n: number) => m.set(n, { ...m.get(n), comments: (m.get(n)?.comments ?? 0) + 1 });
    for (const c of comments) if (c.path === path && !c.in_reply_to_id && c.line) bump(c.line);
    for (const d of drafts) if (d.path === path) bump(d.line);
    return m;
  }, [sel, comments, drafts, path]);

  const onLineTap = pr
    ? (n: number) => {
        if (!sel) setSel([n, n]);
        else if (sel[0] === n && sel[1] === n) setSel(null);
        else setSel([Math.min(sel[0], n), Math.max(sel[1], n)]);
      }
    : undefined;

  const selectParagraph = () => {
    if (!sel) return;
    let a = sel[0];
    let b = sel[1];
    while (a > 1 && lines[a - 2]?.trim()) a--;
    while (b < lines.length && lines[b]?.trim()) b++;
    setSel([a, b]);
  };

  const saveDraft = async () => {
    if (!pr || !sel || !draftBody.trim()) return;
    const quote = lines
      .slice(sel[0] - 1, sel[1])
      .map((l) => stripRuby(l.replace(/^　/, "")))
      .join("\n");
    const tree = await db.trees.get(ref);
    await db.drafts.add({
      pr,
      path,
      startLine: sel[0],
      line: sel[1],
      quote,
      body: draftBody,
      // push 後に元の稿を引けるように、読んでいた稿の blob SHA を付ける
      blob: tree?.files[path] ?? "",
      ep,
      createdAt: new Date().toISOString(),
    });
    setDraftBody("");
    setSel(null);
    setDrafts(await db.drafts.where("pr").equals(pr).toArray());
  };

  const sendAll = async () => {
    if (!pr || !pull || !drafts.length) return;
    const tree = await db.trees.get(ref);
    if (!tree || tree.commit !== pull.head.sha) {
      setNotice("PR が更新されています。同期してから送ってください(下書きは残ります)");
      return;
    }
    setBusy("送信中…");
    try {
      await submitReview(
        loadConfig(),
        pr,
        pull.head.sha,
        drafts.map((d) => ({
          path: d.path,
          line: d.line,
          start_line: d.startLine,
          body: buildCommentBody(d.body, d.quote, {
            ep: d.ep,
            lines: [d.startLine, d.line],
            blob: d.blob,
          }),
        })),
      );
      await db.drafts.where("pr").equals(pr).delete();
      setNotice(`${drafts.length} 件を送りました`);
      await reloadPr();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const approve = async () => {
    if (!pr) return;
    setBusy("承認中…");
    try {
      await addLabel(loadConfig(), pr, "design-approved");
      setNotice("design-approved を付けました");
      await reloadPr();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const copyForPosting = async () => {
    if (!text) return;
    const s = postingStats(text);
    try {
      await navigator.clipboard.writeText(toPostingText(text));
      setNotice(
        `投稿用にコピーしました(${s.chars.toLocaleString()} 字)。先頭「${s.first.slice(0, 12)}」末尾「${s.last.slice(-12)}」`,
      );
    } catch {
      setNotice("クリップボードに書けませんでした");
    }
  };

  const threadAfter = (n: number) => {
    const roots = comments.filter((c) => c.path === path && !c.in_reply_to_id && c.line === n);
    const ds = drafts.filter((d) => d.path === path && d.line === n);
    if (!roots.length && !ds.length) return null;
    return (
      <div className="threads">
        {roots.map((c) => (
          <div key={c.id} className="thread">
            <Comment c={c} />
            {comments
              .filter((r) => r.in_reply_to_id === c.id)
              .map((r) => (
                <Comment key={r.id} c={r} />
              ))}
          </div>
        ))}
        {ds.map((d) => (
          <div key={d.id} className="thread draft">
            <div className="comment-body">下書き: {d.body}</div>
            <button
              className="link"
              onClick={async () => {
                await db.drafts.delete(d.id!);
                setDrafts(await db.drafts.where("pr").equals(pr!).toArray());
              }}
            >
              削除
            </button>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return <p className="muted">読み込み中…</p>;
  const labels = pull?.labels.map((l) => l.name) ?? [];

  return (
    <div className="reader">
      <div className="toolbar">
        <a href={href({ page: "work", work, tab: "episodes", ref })}>← 一覧</a>
        <ReaderSettingsControls settings={settings} onChange={update} />
        {text && !pr ? <button onClick={copyForPosting}>投稿用にコピー</button> : null}
        <button onClick={() => void sync()} disabled={!!progress}>
          {progress ?? "同期"}
        </button>
      </div>

      {pr ? (
        <div className="pr-bar">
          <span>
            PR #{pr}{" "}
            {labels.filter((l) => l.startsWith("stage:") || l === "design-approved").join(" ")}
          </span>
          {episode?.design ? (
            <span className="tabs">
              <button className={tab === "text" ? "on" : ""} onClick={() => setTab("text")}>
                本文
              </button>
              <button className={tab === "design" ? "on" : ""} onClick={() => setTab("design")}>
                設計書
              </button>
            </span>
          ) : null}
          {labels.includes("stage:design") && !labels.includes("design-approved") ? (
            <button onClick={approve} disabled={!!busy}>
              設計を承認
            </button>
          ) : null}
          <button onClick={sendAll} disabled={!drafts.length || !!busy}>
            {busy ?? `まとめて送る(${drafts.length})`}
          </button>
          {pull ? (
            <a href={pull.html_url} target="_blank" rel="noreferrer">
              GitHub で開く
            </a>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {notice ? (
        <p className="notice" onClick={() => setNotice(null)}>
          {notice}
        </p>
      ) : null}

      {tab === "design" && episode?.design && w ? (
        <DesignView design={episode.design} work={w} />
      ) : text !== null ? (
        <TextView
          text={text}
          settings={settings}
          marks={marks}
          onLineTap={onLineTap}
          onTopLine={onTopLine}
          initialLine={initialLine}
          renderAfter={pr ? threadAfter : undefined}
        />
      ) : episode?.design && w ? (
        <DesignView design={episode.design} work={w} />
      ) : (
        <p className="muted">この話の本文はまだありません。</p>
      )}

      {pr && sel ? (
        <div className="composer">
          <div className="muted">
            {sel[0] === sel[1] ? `${sel[0]} 行目` : `${sel[0]}〜${sel[1]} 行目`}
            <button className="link" onClick={selectParagraph}>
              段落ごと選ぶ
            </button>
            <button className="link" onClick={() => setSel(null)}>
              選択を外す
            </button>
          </div>
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            placeholder="コメント"
            rows={3}
          />
          <button onClick={saveDraft} disabled={!draftBody.trim()}>
            下書きに足す
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Comment({ c }: { c: ReviewComment }) {
  const bot = isBotComment(c.body);
  const r = c.reactions;
  return (
    <div className={`comment ${bot ? "bot" : ""}`}>
      <div className="comment-meta">
        {bot ? "ルーティン" : c.user.type === "Bot" ? c.user.login : "自分"}
        {r?.rocket ? " 🚀" : ""}
        {r?.eyes ? " 👀" : ""}
        {c.line === null ? " (古い行)" : ""}
      </div>
      <div className="comment-body">{commentText(c.body)}</div>
    </div>
  );
}
