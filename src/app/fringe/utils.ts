import type { Area } from "@/lib/fringe-area";
import type { FringePick, ConflictEntry, ConflictLevel } from "./types";

export const UI_KEY = "fringe-planner-ui-v2";
export const EDINBURGH_TZ = "Europe/London";
export const PAGE_SIZE = 50;

export const fmtEdinburgh = (iso: string, opts: Intl.DateTimeFormatOptions): string =>
  new Date(iso).toLocaleString("da-DK", { ...opts, timeZone: EDINBURGH_TZ });

export function loadUi() {
  if (typeof window === "undefined") {
    return {
      search: "", selectedOnly: false,
      genreFilter: [] as string[], areaFilter: [] as Area[],
      dateFrom: "", dateTo: "",
      activeGroupId: null as number | null,
    };
  }
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY) ?? "{}");
    return {
      search:        typeof raw.search === "string" ? raw.search : "",
      selectedOnly:  Boolean(raw.selectedOnly),
      genreFilter:   Array.isArray(raw.genreFilter) ? raw.genreFilter : [],
      areaFilter:    Array.isArray(raw.areaFilter) ? raw.areaFilter : [],
      dateFrom:      typeof raw.dateFrom === "string" ? raw.dateFrom : "",
      dateTo:        typeof raw.dateTo === "string" ? raw.dateTo : "",
      activeGroupId: Number.isInteger(raw.activeGroupId) ? (raw.activeGroupId as number) : null,
    };
  } catch {
    return { search: "", selectedOnly: false, genreFilter: [] as string[], areaFilter: [] as Area[], dateFrom: "", dateTo: "", activeGroupId: null as number | null };
  }
}

export function saveUi(patch: Partial<ReturnType<typeof loadUi>>) {
  localStorage.setItem(UI_KEY, JSON.stringify({ ...loadUi(), ...patch }));
}

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error ?? "Noget gik galt.");
  return payload;
}

export function formatPerf(perf: { start: string; end: string; durationMinutes?: number; price?: number; priceString?: string }): { dateStr: string; timeStr: string; meta: string } {
  const dateStr = fmtEdinburgh(perf.start, { weekday: "short", day: "numeric", month: "short" });
  const timeStr = fmtEdinburgh(perf.start, { hour: "2-digit", minute: "2-digit" });
  const parts: string[] = [];
  if (perf.durationMinutes) parts.push(`${perf.durationMinutes} min`);
  if (perf.priceString) parts.push(perf.priceString);
  else if (perf.price != null) parts.push(`£${perf.price}`);
  return { dateStr, timeStr, meta: parts.join(" · ") };
}

export function conflictKey(userId: string, showId: string, perfStart: string) {
  return `${userId}::${showId}::${perfStart}`;
}

export function computeConflicts(picks: FringePick[]): Map<string, ConflictEntry[]> {
  const byUser = new Map<string, FringePick[]>();
  for (const p of picks) {
    if (p.performance_start && p.performance_end) {
      const list = byUser.get(p.user_id) ?? [];
      list.push(p);
      byUser.set(p.user_id, list);
    }
  }

  const result = new Map<string, ConflictEntry[]>();

  function addConflict(pick: FringePick, other: FringePick, level: ConflictLevel) {
    const key = conflictKey(pick.user_id, pick.show_id, pick.performance_start!);
    const list = result.get(key) ?? [];
    list.push({ level, otherShowTitle: other.show_title, otherPerfStart: other.performance_start! });
    result.set(key, list);
  }

  for (const [, userPicks] of byUser) {
    const sorted = [...userPicks].sort((a, b) => a.performance_start!.localeCompare(b.performance_start!));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j];
        const overlaps = a.performance_start! < b.performance_end! && a.performance_end! > b.performance_start!;
        if (!overlaps) continue;

        const aCommitted = a.status === "going" || a.status === "has_ticket";
        const bCommitted = b.status === "going" || b.status === "has_ticket";

        if (aCommitted && bCommitted) {
          addConflict(a, b, "hard");
          addConflict(b, a, "hard");
        } else if (aCommitted || bCommitted) {
          addConflict(a, b, "soft");
          addConflict(b, a, "soft");
        }
      }
    }
  }
  return result;
}
