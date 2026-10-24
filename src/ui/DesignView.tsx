import type { Design } from "../core/schema";
import type { WorkData } from "../core/data/work";

const nameOf = (w: WorkData, id: string) => w.characters.find((c) => c.id === id)?.name ?? id;
const threadTitle = (w: WorkData, id: string) => w.threads.find((t) => t.id === id)?.title ?? "";

/** 話設計書を欄ごとに整形して描く */
export function DesignView({ design: d, work: w }: { design: Design; work: WorkData }) {
  return (
    <div className="design">
      <h2>
        第{d.episode}話 {d.title.final ?? d.title.working}
      </h2>
      <p className="muted">
        第{d.position.chapter}章 {d.position.arc ?? ""} / {d.position.role} / 型: {d.type.label}
      </p>
      <section>
        <h3>感情目的</h3>
        <p className="pre">{d.emotion_goal}</p>
        <h3>芯</h3>
        <p className="pre">{d.core}</p>
      </section>
      <section>
        <h3>あらすじ</h3>
        {d.synopsis.map((p) => (
          <div key={p.part} className="part">
            <h4>
              {p.part}(約 {p.target_chars.toLocaleString()} 字)
            </h4>
            <p className="pre">{p.summary}</p>
            {p.scenes.map((s) => (
              <div key={s.id} className="scene">
                <span className="tag">{s.id}</span>{" "}
                {s.characters.map((c) => nameOf(w, c)).join("・")}
                <ul>
                  {s.beats.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </section>
      <section>
        <h3>引き</h3>
        <p className="pre">
          {d.hook.text}
          <br />
          <span className="muted">{d.hook.why}</span>
        </p>
        <h3>見せ場</h3>
        <ul>
          {d.showpieces.map((s, i) => (
            <li key={i}>
              <span className="tag">{s.scene}</span> {s.picture}
            </li>
          ))}
        </ul>
        <h3>世界観テクスチャ</h3>
        <ul>
          {d.texture.map((t, i) => (
            <li key={i}>
              <span className="tag">{t.kind}</span> {t.element}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>キャスト</h3>
        <table>
          <thead>
            <tr>
              <th>人物</th>
              <th>欲</th>
              <th>行動</th>
              <th>新しい面</th>
            </tr>
          </thead>
          <tbody>
            {d.cast.map((c) => (
              <tr key={c.who}>
                <td>{nameOf(w, c.who)}</td>
                <td>{c.desire}</td>
                <td>{c.action}</td>
                <td>{c.new_facet}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h3>伏線</h3>
        <ul>
          {(["plant", "advance", "payoff"] as const).flatMap((k) =>
            d.threads[k].map((r) => (
              <li key={`${k}-${r.id}`}>
                <span className="tag">
                  {{ plant: "撒く", advance: "進める", payoff: "回収" }[k]}
                </span>{" "}
                {r.id} {threadTitle(w, r.id)} {r.note ? `— ${r.note}` : ""}
              </li>
            )),
          )}
          {d.threads.keep.length ? (
            <li className="muted">温存: {d.threads.keep.join("、")}</li>
          ) : null}
        </ul>
        {d.ability_checks.length ? (
          <>
            <h3>異能の発動</h3>
            <ul>
              {d.ability_checks.map((a, i) => (
                <li key={i}>
                  「{a.utterance}」{a.kind} →{" "}
                  {a.expect_fire ? `発動(ズレ: ${a.drift ?? "?"})` : "不発"}
                  {a.lands_on ? ` / ${a.lands_on}` : ""}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <h3>字数</h3>
        <p>
          {d.budget.total.toLocaleString()} 字(感情の核{" "}
          {d.budget.emotional_core.chars.toLocaleString()} 字:{" "}
          {d.budget.emotional_core.scenes.join("・")})
        </p>
      </section>
      {d.rejected.length ? (
        <section>
          <h3>却下した案</h3>
          <ul>
            {d.rejected.map((r, i) => (
              <li key={i}>
                {r.what} <span className="muted">— {r.why}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
