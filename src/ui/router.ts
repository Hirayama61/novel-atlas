import { useEffect, useState } from "react";

export type Route =
  | { page: "library" }
  | {
      page: "work";
      work: string;
      tab: "episodes" | "characters" | "timeline" | "threads" | "knowledge";
      ref: string;
    }
  | {
      page: "reader";
      work: string;
      ep: number;
      ref: string;
      pr: number | null;
      line?: number;
      /** 最初に開くタブ。無ければ本文 */
      tab?: "design";
    }
  | { page: "reference"; ncode: string }
  | { page: "referenceReader"; ncode: string; ep: number }
  | { page: "pulls" }
  | { page: "settings" };

/** 読書画面で設計書タブを開くときの `tab` の値 */
const DESIGN_TAB = "design";

/** 読書画面の `tab` のクエリ。指定が無ければ何も足さない(本文を開く) */
function toTabQuery(tab: "design" | undefined): Record<string, string> {
  const hasTab = tab !== undefined;
  if (!hasTab) return {};
  return { tab };
}

const TABS = ["episodes", "characters", "timeline", "threads", "knowledge"] as const;

export function parseHash(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?");
  const q = new URLSearchParams(query);
  const ref = q.get("ref") ?? "main";
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "w" && parts[1]) {
    if (parts[2] === "e" && parts[3]) {
      const pr = q.get("pr");
      const line = q.get("line");
      const reader: Route = {
        page: "reader",
        work: parts[1],
        ep: Number(parts[3]),
        ref,
        pr: pr ? Number(pr) : null,
        ...(line ? { line: Number(line) } : {}),
      };
      const isDesignTab = q.get("tab") === DESIGN_TAB;
      if (!isDesignTab) return reader;
      return { ...reader, tab: DESIGN_TAB };
    }
    const tab = (TABS as readonly string[]).includes(parts[2] ?? "")
      ? (parts[2] as (typeof TABS)[number])
      : "episodes";
    return { page: "work", work: parts[1], tab, ref };
  }
  if (parts[0] === "r" && parts[1]) {
    const isEpisode = parts[2] === "e" && parts[3] !== undefined;
    if (!isEpisode) return { page: "reference", ncode: parts[1] };
    return { page: "referenceReader", ncode: parts[1], ep: Number(parts[3]) };
  }
  if (parts[0] === "pulls") return { page: "pulls" };
  if (parts[0] === "settings") return { page: "settings" };
  return { page: "library" };
}

export function href(r: Route): string {
  const q = (ref: string, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ ...(ref !== "main" ? { ref } : {}), ...extra }).toString();
    return p ? `?${p}` : "";
  };
  switch (r.page) {
    case "library":
      return "#/";
    case "work":
      return `#/w/${encodeURIComponent(r.work)}${r.tab === "episodes" ? "" : `/${r.tab}`}${q(r.ref)}`;
    case "reader":
      return `#/w/${encodeURIComponent(r.work)}/e/${r.ep}${q(r.ref, {
        ...(r.pr ? { pr: String(r.pr) } : {}),
        ...(r.line ? { line: String(r.line) } : {}),
        ...toTabQuery(r.tab),
      })}`;
    case "reference":
      return `#/r/${encodeURIComponent(r.ncode)}`;
    case "referenceReader":
      return `#/r/${encodeURIComponent(r.ncode)}/e/${r.ep}`;
    case "pulls":
      return "#/pulls";
    case "settings":
      return "#/settings";
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return route;
}
