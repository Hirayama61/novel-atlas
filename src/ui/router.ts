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
  | { page: "pulls" }
  | { page: "settings" };

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
      const isDesignTab = q.get("tab") === "design";
      return {
        page: "reader",
        work: parts[1],
        ep: Number(parts[3]),
        ref,
        pr: pr ? Number(pr) : null,
        ...(line ? { line: Number(line) } : {}),
        ...(isDesignTab ? { tab: "design" as const } : {}),
      };
    }
    const tab = (TABS as readonly string[]).includes(parts[2] ?? "")
      ? (parts[2] as (typeof TABS)[number])
      : "episodes";
    return { page: "work", work: parts[1], tab, ref };
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
        ...(r.tab ? { tab: r.tab } : {}),
      })}`;
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
