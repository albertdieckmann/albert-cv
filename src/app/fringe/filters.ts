import type { Area } from "@/app/fringe/lib/area";
import { AREA_ORDER } from "@/app/fringe/lib/area";
import { toComparableIso } from "./utils";
import type { Show, FringePick, SessionData, PickStatus } from "./types";

export function perfsInRange(show: Show, dateFrom: string, dateTo: string) {
  const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
  const toMs   = dateTo   ? new Date(dateTo + "T23:59:59").getTime() : null;
  if (fromMs === null && toMs === null) return show.performances;
  return show.performances.filter((p) => {
    const t = new Date(p.start).getTime();
    if (fromMs !== null && t < fromMs) return false;
    if (toMs   !== null && t > toMs)   return false;
    return true;
  });
}

export function perfPicksFor(
  session: SessionData,
  showId: string,
  perfStart: string
): { name: string; status: PickStatus }[] {
  return (session.activeGroup?.picks ?? [])
    .filter((p) =>
      p.show_id === showId &&
      p.performance_start &&
      toComparableIso(p.performance_start) === toComparableIso(perfStart)
    )
    .map((p) => ({ name: p.user_name, status: p.status }));
}

export function allGenres(shows: Show[]): string[] {
  const seen = new Set<string>();
  for (const show of shows) { if (show.genre) seen.add(show.genre); }
  return [...seen].sort();
}

export function allAreas(shows: Show[]): Area[] {
  const seen = new Set<Area>();
  for (const show of shows) seen.add(show.venue.area);
  return AREA_ORDER.filter((a) => seen.has(a));
}

export function allDays(shows: Show[], session: SessionData): string[] {
  let from: string, to: string;
  if (session.activeGroup?.startDate && session.activeGroup?.endDate) {
    from = session.activeGroup.startDate.slice(0, 10);
    to   = session.activeGroup.endDate.slice(0, 10);
  } else {
    const perfDates = shows.flatMap((sh) =>
      sh.performances.map((p) =>
        new Date(p.start).toLocaleDateString("sv-SE", { timeZone: "Europe/London" })
      )
    );
    if (!perfDates.length) return [];
    from = perfDates.reduce((a, b) => (a < b ? a : b));
    to   = perfDates.reduce((a, b) => (a > b ? a : b));
  }
  const days: string[] = [];
  const cur = new Date(from + "T12:00:00Z");
  const end = new Date(to   + "T12:00:00Z");
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export function visibleShows(
  shows: Show[],
  session: SessionData,
  opts: {
    search: string;
    selectedOnly: boolean;
    hideInterested: boolean;
    genreFilter: string[];
    areaFilter: Area[];
    dateFrom: string;
    dateTo: string;
  }
): Show[] {
  const { search, selectedOnly, hideInterested, genreFilter, areaFilter, dateFrom, dateTo } = opts;
  const q = search.trim().toLowerCase();
  const picked = new Set((session.activeGroup?.picks ?? []).map((p) => p.show_id));
  const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
  const toMs   = dateTo   ? new Date(dateTo + "T23:59:59").getTime() : null;

  return shows.filter((show) => {
    if (selectedOnly && !picked.has(show.id)) return false;
    if (hideInterested && session.user) {
      const myP = session.activeGroup?.picks.find(
        (p) => p.show_id === show.id && p.user_id === session.user!.id
      );
      if (!myP || myP.status === "interested") return false;
    }
    if (genreFilter.length > 0 && (!show.genre || !genreFilter.includes(show.genre))) return false;
    if (areaFilter.length > 0 && !areaFilter.includes(show.venue.area)) return false;
    if (fromMs != null || toMs != null) {
      const hasPerf = show.performances.some((p) => {
        const t = new Date(p.start).getTime();
        if (fromMs != null && t < fromMs) return false;
        if (toMs   != null && t > toMs)   return false;
        return true;
      });
      if (!hasPerf && show.performances.length > 0) return false;
    }
    if (!q) return true;
    const hay = [show.title, show.artist ?? "", show.genre ?? "", show.venue.name, show.subTitle ?? ""]
      .join(" ").toLowerCase();
    return hay.includes(q);
  });
}

export function planGroups(
  shows: Show[],
  session: SessionData,
  opts: { hideInterested: boolean; dateFrom: string; dateTo: string }
): [string, { show: Show; picks: FringePick[] }[]][] {
  const { hideInterested, dateFrom, dateTo } = opts;
  const showMap = new Map(shows.map((s) => [s.id, s]));
  const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
  const toMs   = dateTo   ? new Date(dateTo + "T23:59:59").getTime() : null;

  const byShow = new Map<string, { show: Show; picks: FringePick[] }>();
  for (const pick of session.activeGroup?.picks ?? []) {
    if (hideInterested && pick.status === "interested") continue;
    const show: Show = showMap.get(pick.show_id) ?? {
      id: pick.show_id, title: pick.show_title,
      venue: { name: "", area: "other" as Area }, performances: [],
    };
    if (!byShow.has(pick.show_id)) byShow.set(pick.show_id, { show, picks: [] });
    byShow.get(pick.show_id)!.picks.push(pick);
  }

  const NODATE = "~";
  const byDay = new Map<string, { show: Show; picks: FringePick[] }[]>();

  for (const item of byShow.values()) {
    let committedTimes = item.picks
      .filter((p) => p.performance_start && (p.status === "going" || p.status === "has_ticket"))
      .map((p) => p.performance_start!);

    if (fromMs !== null || toMs !== null) {
      const inRange = committedTimes.filter((t) => {
        const ms = new Date(t).getTime();
        return (fromMs === null || ms >= fromMs) && (toMs === null || ms <= toMs);
      });
      const hasUntimedInterested = item.picks.some((p) => p.status === "interested" && !p.performance_start);
      if (inRange.length === 0 && !hasUntimedInterested) continue;
      committedTimes = inRange;
    }

    const earliest = [...committedTimes].sort()[0];
    const dayKey = earliest
      ? new Date(earliest.includes("+") || earliest.match(/Z$/) ? earliest : earliest.replace(" ", "T") + "Z")
          .toLocaleDateString("sv-SE", { timeZone: "UTC" })
      : NODATE;

    const list = byDay.get(dayKey) ?? [];
    list.push(item);
    byDay.set(dayKey, list);
  }

  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
}
