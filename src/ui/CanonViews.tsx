import { useState } from "react";
import type { WorkData } from "../core/data/work";
import type { Character, Source } from "../core/schema";
import { lineOf } from "../core/check/text";
import { href } from "./router";

interface Props {
  w: WorkData;
  tab: "characters" | "timeline" | "threads" | "knowledge";
  refName: string;
}

export function CanonViews({ w, tab, refName }: Props) {
  if (tab === "characters") return <Characters w={w} refName={refName} />;
  if (tab === "timeline") return <TimelineView w={w} refName={refName} />;
  if (tab === "threads") return <ThreadsView w={w} refName={refName} />;
  return <KnowledgeTable w={w} />;
}

const Status = ({ s }: { s: string }) => (
  <span className={`status ${s === "確定" ? "fixed" : "tentative"}`}>{s}</span>
);

/** 出典の引用。タップで本文のその行へ飛ぶ(読了位置として保存して開く) */
function Sources({ w, sources, refName }: { w: WorkData; sources?: Source[]; refName: string }) {
  if (!sources?.length) return null;
  return (
    <span className="sources">
      {sources.map((s, i) => {
        const text = w.episodes.get(s.ep)?.text;
        const line = text ? lineOf(text, s.quote) : null;
        return (
          <a
            key={i}
            className="source"
            href={href({
              page: "reader",
              work: w.id,
              ep: s.ep,
              ref: refName,
              pr: null,
              ...(line ? { line } : {}),
            })}
            title={line ? `第${s.ep}話 ${line}行目` : "本文に見つからない"}
          >
            第{s.ep}話「{s.quote}」
          </a>
        );
      })}
    </span>
  );
}

function Characters({ w, refName }: { w: WorkData; refName: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const chars = [...w.characters].sort((a, b) => (a.since ?? 999) - (b.since ?? 999));
  return (
    <div className="characters">
      {chars.map((c) => (
        <details
          key={c.id}
          open={open === c.id}
          onToggle={(e) => (e.currentTarget.open ? setOpen(c.id) : null)}
        >
          <summary>
            {c.name} <span className="muted">{c.role ?? ""}</span> <Status s={c.status} />
            {c.since ? <span className="muted"> 第{c.since}話〜</span> : null}
          </summary>
          <CharacterDetail w={w} c={c} refName={refName} />
        </details>
      ))}
    </div>
  );
}

function CharacterDetail({ w, c, refName }: { w: WorkData; c: Character; refName: string }) {
  const lines = speakerLines(w, c.id);
  return (
    <div className="character">
      {c.aliases?.length ? <p className="muted">呼び名: {c.aliases.join("、")}</p> : null}
      {c.profile ? (
        <dl>
          {Object.entries(c.profile).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className="pre">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {c.attributes?.length ? (
        <>
          <h4>属性</h4>
          <ul>
            {c.attributes.map((a) => (
              <li key={a.id}>
                {a.key}: {String(a.value)} <Status s={a.status} />{" "}
                <Sources w={w} sources={a.sources} refName={refName} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {c.voice ? (
        <>
          <h4>声</h4>
          <p>
            一人称 {c.voice.first_person ?? "—"} / 二人称 {c.voice.second_person?.default ?? "—"}
            {c.voice.second_person?.others?.length
              ? `(${c.voice.second_person.others.join("・")})`
              : ""}
          </p>
          {c.voice.endings?.length ? <p>語尾: {c.voice.endings.join("、")}</p> : null}
          {c.voice.established?.endings?.length ? (
            <p>実績: {c.voice.established.endings.join("、")}</p>
          ) : null}
          {c.voice.avoid?.length ? (
            <p>
              使わない: {c.voice.avoid.map((a) => ("text" in a ? a.text : a.pattern)).join("、")}
            </p>
          ) : null}
          {c.voice.notes?.length ? (
            <ul>
              {c.voice.notes.map((n, i) => (
                <li key={i}>{n.text}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {c.relations?.length ? (
        <>
          <h4>関係</h4>
          <ul>
            {c.relations.map((r, i) => (
              <li key={i}>
                {w.characters.find((x) => x.id === r.to)?.name ?? r.to}: {r.kind} {r.state ?? ""}{" "}
                <Status s={r.status} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {c.core?.length ? (
        <>
          <h4>根幹</h4>
          <ul>
            {c.core.map((k) => (
              <li key={k.id} className="pre">
                {k.text} <Status s={k.status} />
                {k.reveal?.not_before ? (
                  <span className="muted"> 第{k.reveal.not_before}話まで伏せる</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {lines.length ? (
        <details>
          <summary>全台詞({lines.length})</summary>
          <ul className="lines">
            {lines.map((l, i) => (
              <li key={i}>
                <span className="muted">第{l.ep}話</span> {l.text}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <Feedbacks w={w} id={c.id} />
    </div>
  );
}

/** claims の話者から、そのキャラの台詞を集める */
function speakerLines(w: WorkData, id: string) {
  const out: { ep: number; text: string }[] = [];
  for (const ep of [...w.episodes.values()].sort((a, b) => a.no - b.no)) {
    const lines = ep.text?.split(/\r?\n/) ?? [];
    for (const s of ep.claims?.speakers ?? [])
      if (s.who === id && lines[s.line - 1]) out.push({ ep: ep.no, text: lines[s.line - 1]! });
  }
  return out;
}

function Feedbacks({ w, id }: { w: WorkData; id: string }) {
  const items = [...w.feedback.values()].flatMap((f) =>
    f.items.filter((it) => it.tags.includes(`voice:${id}`)).map((it) => ({ ep: f.episode, ...it })),
  );
  if (!items.length) return null;
  return (
    <details>
      <summary>指摘の履歴({items.length})</summary>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <span className="muted">第{it.ep}話</span> {it.body}{" "}
            <span className="tag">{it.decision}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function TimelineView({ w, refName }: { w: WorkData; refName: string }) {
  const tl = w.timeline;
  if (!tl) return <p className="muted">timeline.yaml がありません。</p>;
  const whenText = (when: unknown): string => {
    if (!when || typeof when !== "object") return "";
    const o = when as Record<string, unknown>;
    if (o.calendar) {
      const cal = tl.calendars.find((c) => c.id === o.calendar);
      return `${cal?.label ?? o.calendar} ${o.day}日目${o.part ? ` ${o.part}` : ""}`;
    }
    const parts: string[] = [];
    if (o.after) parts.push(`${o.after} の後`);
    if (o.before) parts.push(`${o.before} の前`);
    const gap = o.gap as { days?: number; approx?: string } | undefined;
    if (gap) parts.push(gap.approx ?? `${gap.days}日`);
    if (o.approx) parts.push(String(o.approx));
    return parts.join(" ");
  };
  const events = [...tl.events].sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0));
  return (
    <div>
      <h3>背骨</h3>
      <ul>
        {tl.anchors.map((a) => (
          <li key={a.id}>
            {whenText(a.when)} — {a.label} <Status s={a.status} />
          </li>
        ))}
      </ul>
      <h3>出来事</h3>
      <table className="timeline">
        <thead>
          <tr>
            <th>話</th>
            <th>いつ</th>
            <th>出来事</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{e.episode ?? "—"}</td>
              <td>
                {whenText(e.when)}
                {e.flashback ? " (回想)" : ""}
              </td>
              <td>
                {e.title} <Status s={e.status} />{" "}
                <Sources w={w} sources={e.sources} refName={refName} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ThreadsView({ w, refName }: { w: WorkData; refName: string }) {
  const max = Math.max(1, ...[...w.episodes.keys()]);
  const cols = Array.from({ length: max }, (_, i) => i + 1);
  const mark = { plant: "●", advance: "→", payoff: "◎", echo: "·" } as const;
  return (
    <div className="scroll-x">
      <table className="threads">
        <thead>
          <tr>
            <th>伏線</th>
            {cols.map((n) => (
              <th key={n}>{n}</th>
            ))}
            <th>明かす</th>
          </tr>
        </thead>
        <tbody>
          {w.threads.map((t) => {
            const at = new Map<number, string>();
            if (t.planted) at.set(t.planted.ep, mark.plant);
            for (const e of t.events ?? []) at.set(e.ep, (at.get(e.ep) ?? "") + mark[e.kind]);
            return (
              <tr key={t.id}>
                <td>
                  <details>
                    <summary>
                      {t.id} {t.title} <Status s={t.status} />
                    </summary>
                    <p className="muted">{t.kind}</p>
                    {t.detail ? <p className="pre">{t.detail}</p> : null}
                    {t.options?.length ? (
                      <ul>
                        {t.options.map((o, i) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                    ) : null}
                    <Sources w={w} sources={t.planted?.sources} refName={refName} />
                  </details>
                </td>
                {cols.map((n) => (
                  <td key={n} className="cell">
                    {at.get(n) ?? ""}
                  </td>
                ))}
                <td>{t.reveal?.not_before ? `${t.reveal.not_before}〜` : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted">● 撒く → 進める ◎ 回収 · 触れる</p>
    </div>
  );
}

function KnowledgeTable({ w }: { w: WorkData }) {
  const max = Math.max(1, ...[...w.episodes.keys()]);
  const cols = Array.from({ length: max }, (_, i) => i + 1);
  const chars = w.characters.filter((c) => c.knowledge?.length);
  if (!chars.length) return <p className="muted">知識状態はまだ登録されていません。</p>;
  return (
    <div className="scroll-x">
      <table className="knowledge">
        <thead>
          <tr>
            <th>人物</th>
            {cols.map((n) => (
              <th key={n}>{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chars.map((c) => (
            <tr key={c.id}>
              <td>
                <details>
                  <summary>{c.name}</summary>
                  <ul>
                    {c.knowledge!.map((k, i) => (
                      <li key={i} className={k.belief ? "belief" : ""}>
                        {k.fact}: {k.from === null ? "知らない" : `第${k.from}話から`}
                        {k.belief ? `(誤信: ${k.belief})` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              </td>
              {cols.map((n) => {
                const known = c.knowledge!.filter(
                  (k) => k.from !== null && k.from <= n && (!k.until || n < k.until),
                );
                return (
                  <td key={n} className="cell">
                    {known.length || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
