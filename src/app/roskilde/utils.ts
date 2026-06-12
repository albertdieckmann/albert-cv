import type { Act, Appearance, PresenceData, PresenceMember, TimeSlot } from "./types";

export const LS_KEY = "roskilde-v3-user";

export function loadUserId(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
}
export function saveUserId(id: string) {
  try { localStorage.setItem(LS_KEY, id); } catch { /* ignore */ }
}
export function clearUserId() {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

export function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function timeToSortMin(label: string): number {
  const clean = label.replace(".", ":");
  const [h, m] = clean.split(":").map(Number);
  if (isNaN(h)) return 9999;
  const min = h * 60 + (m || 0);
  return min < 360 ? min + 1440 : min;
}

export function timeToMin(label: string): number {
  const clean = label.replace(".", ":");
  const [h, m] = clean.split(":").map(Number);
  if (isNaN(h)) return -1;
  return h * 60 + (m || 0);
}

export function timeSlotFor(label: string): TimeSlot {
  const min = timeToMin(label);
  if (min < 0) return "alle";
  if (min < 360) return "nat";
  if (min < 750) return "formiddag";
  if (min < 1020) return "eftermiddag";
  return "aften";
}

export function getAppearances(act: Act): Appearance[] {
  if (act.appearances?.length) return act.appearances;
  return [{ dateLabel: act.dateLabel, timeLabel: act.timeLabel, stage: act.lineupSceneLabel ?? act.stage, date: act.date }];
}

export function perfId(actName: string, appearanceDate: string): string {
  return `${actName}::${appearanceDate}`;
}

export function parsePerformanceStartMs(date: string, timeLabel: string): number | null {
  if (!date || !timeLabel) return null;
  const clean = timeLabel.replace(".", ":");
  const [h, m] = clean.split(":").map(Number);
  if (isNaN(h)) return null;
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m || 0, 0, 0);
  return d.getTime();
}

export function isLiveNow(app: Appearance, nowMs: number): boolean {
  if (!app.date || !app.timeLabel) return false;
  const startMs = parsePerformanceStartMs(app.date, app.timeLabel);
  if (startMs === null) return false;
  return nowMs >= startMs - 15 * 60 * 1000 && nowMs <= startMs + 2 * 60 * 60 * 1000;
}

export function activePresenceMembers(
  presence: PresenceData | null,
  key: { type: "performance"; performanceId: string } | { type: "place"; placeId: string }
): PresenceMember[] {
  if (!presence) return [];
  const now = Date.now();
  const target = presence.targets.find((t) => {
    if (t.type !== key.type) return false;
    if (t.type === "performance" && key.type === "performance")
      return t.performanceId === key.performanceId;
    if (t.type === "place" && key.type === "place")
      return t.placeId === key.placeId;
    return false;
  });
  if (!target) return [];
  return target.members.filter((m) => new Date(m.expiresAt).getTime() > now);
}

export function buildDayOrder(acts: Act[]): Map<string, string> {
  const firstDate = new Map<string, string>();
  for (const act of acts) {
    for (const app of getAppearances(act)) {
      if (app.dateLabel && app.date) {
        const cur = firstDate.get(app.dateLabel);
        if (!cur || app.date < cur) firstDate.set(app.dateLabel, app.date);
      }
    }
  }
  return firstDate;
}
