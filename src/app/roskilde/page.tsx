"use client";

import { useState, useEffect, useCallback, useRef, Component, ReactNode } from "react";
import s from "./roskilde.module.css";

// ─── types ────────────────────────────────────────────────────────────────────

type PickCategory = "interested" | "going" | "has_ticket";
type TabId = "lineup" | "tidsplan" | "gruppe";
type TimeSlot = "alle" | "formiddag" | "eftermiddag" | "aften" | "nat";

type Appearance = {
  dateLabel?: string;
  timeLabel?: string;
  stage?: string;
  date?: string;
  showTitle?: string;
};

type Act = {
  name: string;
  type?: string;
  lineupSceneLabel?: string;
  url?: string;
  countryCode?: string;
  appearances?: Appearance[];
  dateLabel?: string;
  timeLabel?: string;
  date?: string;
  stage?: string;
};

type GroupPick = {
  userId: string;
  displayName: string;
  actName: string;
  appearanceDate: string;
  category: PickCategory;
};

type GroupMember = { memberId: string; userId: string; displayName: string };

type Group = {
  id: string;
  name: string;
  shareToken: string;
  memberId: string;   // MIT member_id i denne gruppe
  recallCode: string; // MIN recall-kode for denne gruppe
  members: GroupMember[];
  picks: GroupPick[];
};

type User = {
  userId: string;
  displayName: string;
};

// ─── check-in / presence types ────────────────────────────────────────────────

type Place = { id: string; name: string; emoji?: string | null; created_by?: string | null };

type PresenceMember = { name: string; checkedInAt: string; expiresAt: string };

type PresenceTarget =
  | { type: "performance"; performanceId: string; members: PresenceMember[] }
  | { type: "place"; placeId: string; members: PresenceMember[] };

type ActiveCheckin =
  | { targetType: "performance"; performanceId: string }
  | { targetType: "place"; placeId: string }
  | null;

type PresenceData = {
  version: string;
  targets: PresenceTarget[];
  me: { active: ActiveCheckin };
};

// ─── error boundary for presence features ─────────────────────────────────────

class PresenceBoundary extends Component<{ children: ReactNode }, { caught: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { caught: false };
  }
  static getDerivedStateFromError() { return { caught: true }; }
  render() { return this.state.caught ? null : this.props.children; }
}

// ─── constants ────────────────────────────────────────────────────────────────

const CATEGORIES: PickCategory[] = ["interested", "going", "has_ticket"];

const CAT_META: Record<PickCategory, { label: string; emoji: string; btnCls: string }> = {
  interested: { label: "Fadøl",    emoji: "🍺",  btnCls: s.catInterested },
  going:      { label: "Ser show", emoji: "👍",  btnCls: s.catGoing },
  has_ticket: { label: "Pit",      emoji: "🕳️", btnCls: s.catHasTicket },
};

const TIME_SLOTS: { id: TimeSlot; label: string; range: string }[] = [
  { id: "alle",        label: "Alle tider",   range: "" },
  { id: "formiddag",   label: "Formiddag",    range: "06–12" },
  { id: "eftermiddag", label: "Eftermiddag",  range: "12–17" },
  { id: "aften",       label: "Aften",        range: "17–00" },
  { id: "nat",         label: "Nat",          range: "00–06" },
];

const LS_KEY = "roskilde-v3-user";

// ─── helpers ──────────────────────────────────────────────────────────────────

function loadUserId(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
}
function saveUserId(id: string) {
  try { localStorage.setItem(LS_KEY, id); } catch { /* ignore */ }
}
function clearUserId() {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

async function api(path: string, options: RequestInit = {}, userId?: string | null) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error ?? "Noget gik galt.");
  return payload;
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function timeToSortMin(label: string): number {
  const clean = label.replace(".", ":");
  const [h, m] = clean.split(":").map(Number);
  if (isNaN(h)) return 9999;
  const min = h * 60 + (m || 0);
  return min < 360 ? min + 1440 : min;
}

function timeToMin(label: string): number {
  const clean = label.replace(".", ":");
  const [h, m] = clean.split(":").map(Number);
  if (isNaN(h)) return -1;
  return h * 60 + (m || 0);
}

function timeSlotFor(label: string): TimeSlot {
  const min = timeToMin(label);
  if (min < 0) return "alle";
  if (min < 360) return "nat";
  if (min < 750) return "formiddag";
  if (min < 1020) return "eftermiddag";
  return "aften";
}

function getAppearances(act: Act): Appearance[] {
  if (act.appearances?.length) return act.appearances;
  return [{ dateLabel: act.dateLabel, timeLabel: act.timeLabel, stage: act.lineupSceneLabel ?? act.stage, date: act.date }];
}

function perfId(actName: string, appearanceDate: string): string {
  return `${actName}::${appearanceDate}`;
}

function parsePerformanceStartMs(date: string, timeLabel: string): number | null {
  if (!date || !timeLabel) return null;
  const clean = timeLabel.replace(".", ":");
  const [h, m] = clean.split(":").map(Number);
  if (isNaN(h)) return null;
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m || 0, 0, 0);
  return d.getTime();
}

function isLiveNow(app: Appearance, nowMs: number): boolean {
  if (!app.date || !app.timeLabel) return false;
  const startMs = parsePerformanceStartMs(app.date, app.timeLabel);
  if (startMs === null) return false;
  return nowMs >= startMs - 15 * 60 * 1000 && nowMs <= startMs + 2 * 60 * 60 * 1000;
}

function activePresenceMembers(
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

function AvatarStack({ members }: { members: PresenceMember[] }) {
  const shown = members.slice(0, 4);
  const rest = members.length - shown.length;
  if (!shown.length) return null;
  return (
    <div className={s.avatarStack}>
      {shown.map((m, i) => (
        <div key={i} className={s.avatarCircle} title={m.name}>{initials(m.name)}</div>
      ))}
      {rest > 0 && <div className={s.avatarCircle}>+{rest}</div>}
    </div>
  );
}

function buildDayOrder(acts: Act[]): Map<string, string> {
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

// ─── component ────────────────────────────────────────────────────────────────

export default function RoskildePage() {
  const [user,   setUser]   = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [ready,  setReady]  = useState(false);

  const [lineup,   setLineup]   = useState<Act[]>([]);
  const [dayOrder, setDayOrder] = useState<Map<string, string>>(new Map());

  const [activeTab,      setActiveTab]      = useState<TabId>("lineup");
  const [search,         setSearch]         = useState("");
  const [stageF,         setStageF]         = useState("alle");
  const [typeF,          setTypeF]          = useState("alle");
  const [dayF,           setDayF]           = useState("alle");
  const [timeSlotF,      setTimeSlotF]      = useState<TimeSlot>("alle");
  const [selectedOnly,   setSelectedOnly]   = useState(false);
  const [activePlanDay,  setActivePlanDay]  = useState<string | null>(null);
  const [expandedActs,   setExpandedActs]   = useState<Set<string>>(new Set());
  const [nowTs,          setNowTs]          = useState<number | null>(null);
  const [showScrollTop,  setShowScrollTop]  = useState(false);

  // gruppe tab
  const [displayName, setDisplayName] = useState("");
  const [groupName,   setGroupName]   = useState("");
  const [shareToken,  setShareToken]  = useState("");
  const [recallGroup, setRecallGroup] = useState("");
  const [recallCode,  setRecallCode]  = useState("");

  // inline edit
  const [editingName,      setEditingName]      = useState(false);
  const [editNameVal,      setEditNameVal]      = useState("");
  const [editingGroupId,   setEditingGroupId]   = useState<string | null>(null);
  const [editGroupNameVal, setEditGroupNameVal] = useState("");

  const [status, setStatus] = useState("");
  const [busy,   setBusy]   = useState(false);

  // check-in / presence
  const [presence,      setPresence]      = useState<PresenceData | null>(null);
  const [places,        setPlaces]        = useState<Place[]>([]);
  const [newPlaceName,  setNewPlaceName]  = useState("");
  const [newPlaceEmoji, setNewPlaceEmoji] = useState("");
  const presenceVersionRef = useRef<string | null>(null);
  const pollTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savedScrolls = useRef<Record<TabId, number>>({ lineup: 0, tidsplan: 0, gruppe: 0 });
  const statusTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function flash(msg: string) {
    setStatus(msg);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(""), 5000);
  }

  // ── session ───────────────────────────────────────────────────────────────

  const fetchSession = useCallback(async (uid: string) => {
    const pay = await api(`/api/roskilde/session?userId=${uid}`);
    if (pay.user) {
      setUser(pay.user);
      setGroups(pay.groups ?? []);
    } else {
      setUser(null);
      setGroups([]);
      clearUserId();
    }
  }, []);

  // ── init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    api("/api/roskilde/lineup")
      .then((d) => {
        const items: Act[] = d.items ?? [];
        setLineup(items);
        setDayOrder(buildDayOrder(items));
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlUid = params.get("uid");
    const stored = loadUserId();
    const uid = urlUid ?? stored;
    const tabParam = params.get("tab") as TabId | null;
    if (tabParam === "lineup" || tabParam === "tidsplan" || tabParam === "gruppe") {
      setActiveTab(tabParam);
    }
    if (uid) {
      saveUserId(uid);
      fetchSession(uid).finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, [fetchSession]);

  useEffect(() => {
    function tick() { setNowTs(Date.now()); }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onScroll() { setShowScrollTop(window.scrollY > 400); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── presence polling ──────────────────────────────────────────────────────

  const fetchPresence = useCallback(async (token: string, uid: string) => {
    try {
      const since = presenceVersionRef.current;
      const url = since
        ? `/api/roskilde/g/${token}/presence?since=${encodeURIComponent(since)}`
        : `/api/roskilde/g/${token}/presence`;
      const res = await fetch(url, { headers: { "x-user-id": uid } });
      if (res.status === 304) return;
      if (!res.ok) return;
      const data: PresenceData = await res.json();
      presenceVersionRef.current = data.version;
      setPresence(data);
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => {
    // Brug groups + activeGroupId (state) i stedet for den afledte activeGroup
    const group = groups.find(g => g.id === activeGroupId) ?? groups[0] ?? null;
    const token = group?.shareToken;
    const uid   = user?.userId;
    if (!token || !uid) { setPresence(null); return; }

    presenceVersionRef.current = null;

    function clearPoll() {
      if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    }
    const t = token;
    const u = uid;
    function schedulePoll() {
      clearPoll();
      if (document.hidden) return;
      pollTimerRef.current = setTimeout(async () => {
        await fetchPresence(t, u);
        schedulePoll();
      }, 60_000);
    }
    function onVisibility() {
      if (!document.hidden) { fetchPresence(t, u); schedulePoll(); }
      else clearPoll();
    }

    fetchPresence(t, u);
    schedulePoll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearPoll();
    };
  }, [groups, activeGroupId, user?.userId, fetchPresence]);

  // ── places fetch ──────────────────────────────────────────────────────────

  const fetchPlaces = useCallback(async (token: string, uid: string) => {
    try {
      const res = await fetch(`/api/roskilde/g/${token}/places`, { headers: { "x-user-id": uid } });
      if (!res.ok) return;
      const data = await res.json();
      setPlaces(data.places ?? []);
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => {
    const group = groups.find(g => g.id === activeGroupId) ?? groups[0] ?? null;
    const token = group?.shareToken;
    const uid   = user?.userId;
    if (!token || !uid) { setPlaces([]); return; }
    fetchPlaces(token, uid);
  }, [groups, activeGroupId, user?.userId, fetchPlaces]);

  useEffect(() => {
    const saved = savedScrolls.current[activeTab];
    requestAnimationFrame(() => window.scrollTo(0, saved));
  }, [activeTab]);

  // ── busy wrapper ──────────────────────────────────────────────────────────

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try { await task(); }
    catch (err) { flash(err instanceof Error ? err.message : "Noget gik galt."); }
    finally { setBusy(false); }
  }

  // ── tab switch ────────────────────────────────────────────────────────────

  function switchTab(tab: TabId) {
    savedScrolls.current[activeTab] = window.scrollY;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
    setActiveTab(tab);
  }

  // ── handlers ──────────────────────────────────────────────────────────────

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const pay = await api("/api/roskilde/groups", {
        method: "POST",
        body: JSON.stringify({ groupName, userId: user?.userId, displayName: user ? undefined : displayName }),
      });
      saveUserId(pay.userId);
      await fetchSession(pay.userId);
      setGroupName("");
      setDisplayName("");
      setActiveGroupId(pay.groupId);
      flash(`Gruppe "${groupName}" oprettet! Token: ${pay.shareToken}`);
      switchTab("tidsplan");
    });
  }

  async function handleJoinGroup(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const pay = await api("/api/roskilde/join", {
        method: "POST",
        body: JSON.stringify({ shareToken, userId: user?.userId, displayName: user ? undefined : displayName }),
      });
      saveUserId(pay.userId);
      await fetchSession(pay.userId);
      setShareToken("");
      setDisplayName("");
      setActiveGroupId(pay.groupId);
      flash(`Velkommen til "${pay.groupName}"!`);
      switchTab("tidsplan");
    });
  }

  async function handleResume(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const pay = await api(`/api/roskilde/resume?groupId=${recallGroup}&code=${recallCode}`);
      saveUserId(pay.userId);
      await fetchSession(pay.userId);
      setRecallGroup("");
      setRecallCode("");
      flash(`Velkommen tilbage, ${pay.displayName}!`);
    });
  }

  async function handleLeaveGroup(groupId: string, groupName: string) {
    if (!user) return;
    if (!confirm(`Forlad gruppen "${groupName}"?`)) return;
    await run(async () => {
      await api(`/api/roskilde/groups/${groupId}/leave`, { method: "DELETE" }, user.userId);
      await fetchSession(user.userId);
      if (activeGroupId === groupId) setActiveGroupId(null);
      flash("Du har forladt gruppen.");
    });
  }

  async function handleDeleteGroup(groupId: string, groupName: string) {
    if (!user) return;
    if (!confirm(`Slet gruppen "${groupName}"? Kan ikke fortrydes.`)) return;
    await run(async () => {
      await api(`/api/roskilde/groups/${groupId}`, { method: "DELETE" }, user.userId);
      await fetchSession(user.userId);
      if (activeGroupId === groupId) setActiveGroupId(null);
      flash("Gruppen er slettet.");
    });
  }

  async function handleLogout() {
    if (!confirm("Log ud? Du kan genvinde adgang med genkald-koden.")) return;
    clearUserId();
    setUser(null);
    setGroups([]);
    setActiveGroupId(null);
  }

  async function handlePick(actName: string, appearanceDate: string, category: PickCategory) {
    if (!user) return;
    const current = myPickFor(actName, appearanceDate);
    await run(async () => {
      await api("/api/roskilde/picks", {
        method: "POST",
        body: JSON.stringify({ actName, appearanceDate, category: current === category ? null : category }),
      }, user.userId);
      await fetchSession(user.userId);
    });
  }

  async function handleRenameUser(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    await run(async () => {
      await api(`/api/roskilde/users/${user.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ displayName: editNameVal }),
      }, user.userId);
      await fetchSession(user.userId);
      setEditingName(false);
      flash("Navn opdateret.");
    });
  }

  async function handleRenameGroup(e: React.FormEvent, groupId: string) {
    e.preventDefault();
    if (!user) return;
    await run(async () => {
      await api(`/api/roskilde/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editGroupNameVal }),
      }, user.userId);
      await fetchSession(user.userId);
      setEditingGroupId(null);
      flash("Gruppenavn opdateret.");
    });
  }

  // ── check-in handlers ─────────────────────────────────────────────────────

  async function handleCheckin(targetType: "performance" | "place", targetId: string) {
    if (!activeGroup || !user) return;
    const body =
      targetType === "performance"
        ? { targetType, performanceId: targetId }
        : { targetType, placeId: targetId };

    // Optimistisk: markér mig lokalt med det samme
    const now = new Date().toISOString();
    // eslint-disable-next-line react-hooks/purity
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    setPresence((prev) => {
      const myName = user.displayName;
      const newActive: ActiveCheckin =
        targetType === "performance"
          ? { targetType: "performance", performanceId: targetId }
          : { targetType: "place", placeId: targetId };

      // Fjern mig fra alle targets
      const targets: PresenceTarget[] = (prev?.targets ?? []).map((t) => ({
        ...t,
        members: t.members.filter((m) => m.name !== myName),
      })).filter((t) => t.members.length > 0);

      // Tilføj mig til det nye target
      const key = targetType === "performance" ? `perf::${targetId}` : `place::${targetId}`;
      const existing = targets.find((t) =>
        t.type === targetType &&
        (t.type === "performance" ? t.performanceId === targetId : t.placeId === targetId)
      );
      if (existing) {
        existing.members.push({ name: myName, checkedInAt: now, expiresAt });
      } else {
        const newTarget: PresenceTarget =
          targetType === "performance"
            ? { type: "performance", performanceId: targetId, members: [{ name: myName, checkedInAt: now, expiresAt }] }
            : { type: "place", placeId: targetId, members: [{ name: myName, checkedInAt: now, expiresAt }] };
        targets.push(newTarget);
      }
      void key;
      return { version: now, targets, me: { active: newActive } };
    });

    // Send til server — ved fejl: revert ved næste poll
    try {
      const res = await fetch(`/api/roskilde/g/${activeGroup.shareToken}/checkins`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-user-id": user.userId },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data: PresenceData = await res.json();
        presenceVersionRef.current = data.version;
        setPresence(data);
      }
    } catch { /* poll vil rette op */ }
  }

  async function handleCheckout() {
    if (!activeGroup || !user) return;
    // Optimistisk
    setPresence((prev) => {
      if (!prev) return prev;
      const myName = user.displayName;
      return {
        ...prev,
        targets: prev.targets
          .map((t) => ({ ...t, members: t.members.filter((m) => m.name !== myName) }))
          .filter((t) => t.members.length > 0),
        me: { active: null },
      };
    });
    try {
      await fetch(`/api/roskilde/g/${activeGroup.shareToken}/checkins/current`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "x-user-id": user.userId },
      });
    } catch { /* poll retter op */ }
    // Refresh
    if (activeGroup?.shareToken && user?.userId) {
      fetchPresence(activeGroup.shareToken, user.userId);
    }
  }

  async function handleAddPlace(e: React.FormEvent) {
    e.preventDefault();
    if (!activeGroup || !user || !newPlaceName.trim()) return;
    await run(async () => {
      const res = await fetch(`/api/roskilde/g/${activeGroup.shareToken}/places`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-user-id": user.userId },
        body: JSON.stringify({ name: newPlaceName.trim(), emoji: newPlaceEmoji.trim() || undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Fejl"); }
      const data = await res.json();
      setPlaces((prev) => [...prev, data.place]);
      setNewPlaceName("");
      setNewPlaceEmoji("");
    });
  }

  async function handleDeletePlace(placeId: string) {
    if (!activeGroup || !user) return;
    await run(async () => {
      const res = await fetch(`/api/roskilde/g/${activeGroup.shareToken}/places/${placeId}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "x-user-id": user.userId },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Fejl"); }
      setPlaces((prev) => prev.filter((p) => p.id !== placeId));
      // Fjern presence for slettet sted
      setPresence((prev) =>
        prev
          ? { ...prev, targets: prev.targets.filter((t) => !(t.type === "place" && t.placeId === placeId)) }
          : prev
      );
    });
  }

  async function copyResumeLink() {
    if (!user) return;
    const url = `${window.location.origin}/roskilde?uid=${user.userId}`;
    try { await navigator.clipboard.writeText(url); flash("Genoptag-link kopieret!"); }
    catch { flash(`Link: ${url}`); }
  }

  async function copyShareToken(token: string) {
    try { await navigator.clipboard.writeText(token); flash(`Token ${token} kopieret!`); }
    catch { flash(`Token: ${token}`); }
  }

  function toggleExpand(actName: string) {
    setExpandedActs((prev) => {
      const next = new Set(prev);
      next.has(actName) ? next.delete(actName) : next.add(actName);
      return next;
    });
  }

  function resetFilters() {
    setSearch("");
    setStageF("alle");
    setTypeF("alle");
    setDayF("alle");
    setTimeSlotF("alle");
    setSelectedOnly(false);
  }

  const filtersActive = search !== "" || stageF !== "alle" || typeF !== "alle" || dayF !== "alle" || timeSlotF !== "alle" || selectedOnly;

  // ── derived ───────────────────────────────────────────────────────────────

  // Aktiv gruppe — brug den valgte, ellers første i listen
  const activeGroup: Group | null = groups.find(g => g.id === activeGroupId) ?? groups[0] ?? null;

  // Mine picks (user-level, dedupliceret på tværs af grupper)
  const myPicks: GroupPick[] = user
    ? [...new Map(
        groups.flatMap(g => g.picks.filter(p => p.userId === user.userId))
          .map(p => [`${p.actName}|${p.appearanceDate}`, p])
      ).values()]
    : [];

  function myPickFor(actName: string, appearanceDate: string): PickCategory | null {
    return myPicks.find(p => p.actName === actName && p.appearanceDate === appearanceDate)?.category ?? null;
  }

  function groupPicksFor(actName: string, appearanceDate: string): GroupPick[] {
    return (activeGroup?.picks ?? []).filter(
      (p) => p.actName === actName && p.appearanceDate === appearanceDate
    );
  }

  const allStages  = [...new Set(lineup.map((a) => a.lineupSceneLabel ?? a.stage).filter(Boolean))].sort() as string[];
  const allTypes   = [...new Set(lineup.map((a) => a.type).filter(Boolean))].sort() as string[];
  const sortedDays = [...dayOrder.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([label]) => label);

  function visibleActs(): Act[] {
    const q      = search.trim().toLowerCase();
    const picked = new Set(myPicks.map((p) => p.actName));
    return lineup.filter((act) => {
      if (selectedOnly && !picked.has(act.name)) return false;
      if (stageF !== "alle" && (act.lineupSceneLabel ?? act.stage) !== stageF) return false;
      if (typeF  !== "alle" && act.type !== typeF) return false;

      const apps = getAppearances(act);
      if (dayF !== "alle" && !apps.some((a) => a.dateLabel === dayF)) return false;
      if (timeSlotF !== "alle" && !apps.some((a) => timeSlotFor(a.timeLabel ?? "") === timeSlotF)) return false;

      if (!q) return true;
      const hay = [act.name, act.type ?? "", act.lineupSceneLabel ?? act.stage ?? ""]
        .join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  function timelineByDay(): Map<string, { act: Act; app: Appearance; picks: GroupPick[]; sortMin: number }[]> {
    if (!activeGroup) return new Map();
    const byDay = new Map<string, { act: Act; app: Appearance; picks: GroupPick[]; sortMin: number }[]>();

    for (const act of lineup) {
      const apps = getAppearances(act);
      for (const app of apps) {
        const appDate = app.date ?? "";
        const picks = activeGroup.picks.filter(
          (p) => p.actName === act.name && p.appearanceDate === appDate
        );
        if (!picks.length) continue;
        const day = app.dateLabel ?? "Dato ikke offentliggjort";
        const sortMin = timeToSortMin(app.timeLabel ?? "");
        const list = byDay.get(day) ?? [];
        list.push({ act, app, picks, sortMin });
        byDay.set(day, list);
      }
    }

    for (const [day, items] of byDay) {
      byDay.set(day, items.sort((a, b) => a.sortMin - b.sortMin));
    }

    return new Map(
      [...byDay.entries()].sort((a, b) => {
        const da = dayOrder.get(a[0]) ?? "9999";
        const db = dayOrder.get(b[0]) ?? "9999";
        return da.localeCompare(db);
      })
    );
  }

  type TlEntry = { act: Act; app: Appearance; picks: GroupPick[]; sortMin: number };

  function buildBands(items: TlEntry[]): TlEntry[][] {
    const used = new Set<number>();
    const bands: TlEntry[][] = [];

    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue;
      const band: TlEntry[] = [items[i]];
      used.add(i);
      const aUsers = new Set(items[i].picks.map((p) => p.userId));

      for (let j = i + 1; j < items.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(items[j].sortMin - items[i].sortMin) >= 60) break;
        if (items[j].picks.some((p) => aUsers.has(p.userId))) {
          band.push(items[j]);
          used.add(j);
        }
      }
      bands.push(band);
    }
    return bands;
  }

  // ── loading ───────────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <div className={s.page}>
        <div className={s.loading}><span className={s.loadingDot} />Loader…</div>
      </div>
    );
  }

  const acts        = visibleActs();
  const tlByDay     = timelineByDay();
  const tlDays      = [...tlByDay.keys()];
  const tlTotal     = [...tlByDay.values()].reduce((n, v) => n + v.length, 0);
  const activeDayKey = activePlanDay && tlDays.includes(activePlanDay) ? activePlanDay : (tlDays[0] ?? null);

  // ── gruppe-tab ────────────────────────────────────────────────────────────

  // ── derived: check-in helpers ─────────────────────────────────────────────

  const myActiveCheckin: ActiveCheckin = presence?.me?.active ?? null;

  // Live-akter med min willingness som endnu ikke er tjekket ind
  const livePromptActs: { actName: string; app: Appearance; pid: string }[] = [];
  if (nowTs !== null && activeGroup && user) {
    const myPickSet = new Set(myPicks.map((p) => perfId(p.actName, p.appearanceDate)));
    for (const act of lineup) {
      for (const app of getAppearances(act)) {
        const pid = perfId(act.name, app.date ?? "");
        if (!myPickSet.has(pid)) continue;
        if (!isLiveNow(app, nowTs)) continue;
        if (myActiveCheckin?.targetType === "performance" && (myActiveCheckin as { targetType: "performance"; performanceId: string }).performanceId === pid) continue;
        livePromptActs.push({ actName: act.name, app, pid });
      }
    }
  }

  const gruppeTab = (
    <div className={s.gruppePanel}>
      {user ? (
        <>
          {/* Aktiv check-in */}
          {myActiveCheckin && (
            <div className={s.activeCheckinBar}>
              <span className={s.activeCheckinLabel}>
                {myActiveCheckin.targetType === "performance"
                  ? `📍 ${myActiveCheckin.performanceId.split("::")[0]}`
                  : `📍 ${places.find((p) => p.id === (myActiveCheckin as { targetType: "place"; placeId: string }).placeId)?.name ?? "Sted"}`}
              </span>
              <button className={s.checkoutBtn} onClick={handleCheckout}>Tjek ud</button>
            </div>
          )}

          {/* Steder */}
          {(places.length > 0 || activeGroup) && (
            <PresenceBoundary>
              <div className={s.placesSection}>
                <p className={s.placesSectionTag}>Hvor er folk?</p>
                <div className={s.placeChips}>
                  {places.map((place) => {
                    const members = activePresenceMembers(presence, { type: "place", placeId: place.id });
                    const isHere = myActiveCheckin?.targetType === "place" &&
                      (myActiveCheckin as { targetType: "place"; placeId: string }).placeId === place.id;
                    return (
                      <div key={place.id} className={s.placeChip}>
                        {place.emoji && <span>{place.emoji}</span>}
                        <span className={s.placeChipName}>{place.name}</span>
                        {members.length > 0 && <AvatarStack members={members} />}
                        {isHere ? (
                          <button className={s.checkoutBtn} onClick={handleCheckout}>Tjek ud</button>
                        ) : (
                          <button className={s.checkinBtn} onClick={() => handleCheckin("place", place.id)} disabled={busy}>Her</button>
                        )}
                        {place.created_by === activeGroup?.memberId && (
                          <button className={s.deleteSmBtn} onClick={() => handleDeletePlace(place.id)} title="Slet sted">×</button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={handleAddPlace} className={s.addPlaceForm}>
                  <input
                    className={s.emojiInput}
                    value={newPlaceEmoji}
                    onChange={(e) => setNewPlaceEmoji(e.target.value)}
                    placeholder="🏕️"
                    maxLength={4}
                  />
                  <input
                    className={s.addPlaceInput}
                    value={newPlaceName}
                    onChange={(e) => setNewPlaceName(e.target.value)}
                    placeholder="Tilføj sted…"
                    maxLength={80}
                  />
                  <button type="submit" className={s.ghostBtnSm} disabled={busy || !newPlaceName.trim()}>Tilføj</button>
                </form>
              </div>
            </PresenceBoundary>
          )}

          {/* Profil */}
          <div className={s.drawerSection}>
            <p className={s.sectionTag}>Din profil</p>
            <div className={s.identityCard}>
              <div className={s.identityAvatar}>{initials(user.displayName)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className={s.identityName}>{user.displayName}</p>
                <p className={s.identityEmail}>{groups.length} gruppe{groups.length !== 1 ? "r" : ""}</p>
              </div>
              <button className={s.ghostBtnSm} onClick={() => { setEditNameVal(user.displayName); setEditingName(true); }}>Ret</button>
            </div>
            {editingName && (
              <form onSubmit={handleRenameUser} className={s.inlineEditForm}>
                <input
                  className={s.fieldInput}
                  value={editNameVal}
                  onChange={(e) => setEditNameVal(e.target.value)}
                  maxLength={50}
                  autoFocus
                  required
                />
                <button type="submit" className={s.ghostBtnSm} disabled={busy}>Gem</button>
                <button type="button" className={s.ghostBtnSm} onClick={() => setEditingName(false)}>Annullér</button>
              </form>
            )}
            <div className={s.resumeBox}>
              <p className={s.resumeLabel}>Genoptag-link</p>
              <button className={s.ghostBtn} onClick={copyResumeLink}>Kopiér link</button>
            </div>
            <button className={s.deleteBtn} style={{ marginTop: "0.5rem" }} onClick={handleLogout}>Log ud</button>
          </div>

          {/* Grupper */}
          {groups.map((g) => {
            const isOwner = g.members[0]?.userId === user.userId;
            const isActive = g.id === (activeGroup?.id ?? groups[0]?.id);
            return (
              <div
                key={g.id}
                className={`${s.drawerSection} ${isActive ? s.drawerSectionActive : ""}`}
                onClick={() => setActiveGroupId(g.id)}
                style={{ cursor: "pointer" }}
              >
                <div className={s.groupSectionHeader}>
                  <p className={s.sectionTag}>
                    {isActive && <span className={s.activeGroupDot} />}
                    {g.name}
                  </p>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    {isOwner && (
                      <button className={s.ghostBtnSm} onClick={(e) => { e.stopPropagation(); setEditGroupNameVal(g.name); setEditingGroupId(g.id); }}>Ret</button>
                    )}
                    {groups.length > 1 && !isActive && (
                      <button className={s.ghostBtnSm} onClick={(e) => { e.stopPropagation(); setActiveGroupId(g.id); }}>Vælg</button>
                    )}
                  </div>
                </div>
                {editingGroupId === g.id && (
                  <form onSubmit={(e) => handleRenameGroup(e, g.id)} className={s.inlineEditForm} onClick={(e) => e.stopPropagation()}>
                    <input
                      className={s.fieldInput}
                      value={editGroupNameVal}
                      onChange={(e) => setEditGroupNameVal(e.target.value)}
                      maxLength={80}
                      autoFocus
                      required
                    />
                    <button type="submit" className={s.ghostBtnSm} disabled={busy}>Gem</button>
                    <button type="button" className={s.ghostBtnSm} onClick={() => setEditingGroupId(null)}>Annullér</button>
                  </form>
                )}
                <div className={s.shareTokenRow}>
                  <span className={s.shareTokenBadge}>{g.shareToken}</span>
                  <button className={s.ghostBtn} onClick={(e) => { e.stopPropagation(); copyShareToken(g.shareToken); }}>Kopiér token</button>
                </div>
                <div className={s.memberList}>
                  {g.members.map((m, i) => (
                    <div key={m.memberId} className={`${s.friendChip} ${m.userId === user.userId ? s.active : ""}`}>
                      <div className={s.memberAvatar} style={{ "--avatar-idx": i } as React.CSSProperties}>{initials(m.displayName)}</div>
                      <span>{m.displayName}</span>
                      {i === 0 && <small>Oprettede gruppen</small>}
                    </div>
                  ))}
                </div>
                <div className={s.recallRow}>
                  <span className={s.resumeLabel}>Genkald-kode</span>
                  <span className={s.recallBadge}>{g.recallCode}</span>
                  <span className={s.mutedSmall}>Group-ID: <code className={s.code}>{g.id.slice(0, 8)}…</code></span>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  {isOwner
                    ? <button className={s.deleteBtn} onClick={() => handleDeleteGroup(g.id, g.name)}>Slet gruppe</button>
                    : <button className={s.deleteBtn} onClick={() => handleLeaveGroup(g.id, g.name)}>Forlad gruppe</button>
                  }
                </div>
              </div>
            );
          })}

          {/* Opret ny gruppe */}
          <div className={s.orDivider}><span>ny gruppe</span></div>
          <div className={s.drawerSection}>
            <p className={s.sectionTag}>Opret ny gruppe</p>
            <form onSubmit={handleCreateGroup} className={s.stackForm}>
              <label className={s.fieldWrap}>
                <span className={s.fieldLabel}>Gruppenavn</span>
                <input className={s.fieldInput} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Fx Festivalgæng 2026" maxLength={80} required />
              </label>
              <button type="submit" className={s.primaryBtn} disabled={busy}>Opret gruppe</button>
            </form>
          </div>

          {/* Join eksisterende gruppe */}
          <div className={s.orDivider}><span>eller join</span></div>
          <div className={s.drawerSection}>
            <p className={s.sectionTag}>Join med token</p>
            <form onSubmit={handleJoinGroup} className={s.stackForm}>
              <label className={s.fieldWrap}>
                <span className={s.fieldLabel}>Gruppe-token</span>
                <input className={s.fieldInput} value={shareToken} onChange={(e) => setShareToken(e.target.value.toUpperCase())} placeholder="Fx AB3XK7PQ" maxLength={20} required />
              </label>
              <button type="submit" className={s.ghostBtn} disabled={busy}>Join gruppe</button>
            </form>
          </div>
        </>
      ) : (
        <>
          <div className={s.drawerSection}>
            <p className={s.sectionTag}>Opret gruppe</p>
            <form onSubmit={handleCreateGroup} className={s.stackForm}>
              <label className={s.fieldWrap}>
                <span className={s.fieldLabel}>Dit navn</span>
                <input className={s.fieldInput} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Fx Maria" maxLength={50} required />
              </label>
              <label className={s.fieldWrap}>
                <span className={s.fieldLabel}>Gruppenavn</span>
                <input className={s.fieldInput} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Fx Festivalgæng 2026" maxLength={80} required />
              </label>
              <button type="submit" className={s.primaryBtn} disabled={busy}>Opret gruppe</button>
            </form>
          </div>
          <div className={s.orDivider}><span>eller</span></div>
          <div className={s.drawerSection}>
            <p className={s.sectionTag}>Join med token</p>
            <form onSubmit={handleJoinGroup} className={s.stackForm}>
              <label className={s.fieldWrap}>
                <span className={s.fieldLabel}>Dit navn</span>
                <input className={s.fieldInput} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Fx Lars" maxLength={50} required />
              </label>
              <label className={s.fieldWrap}>
                <span className={s.fieldLabel}>Gruppe-token</span>
                <input className={s.fieldInput} value={shareToken} onChange={(e) => setShareToken(e.target.value.toUpperCase())} placeholder="Fx AB3XK7PQ" maxLength={20} required />
              </label>
              <button type="submit" className={s.ghostBtn} disabled={busy}>Join gruppe</button>
            </form>
          </div>
          <div className={s.orDivider}><span>genoptag</span></div>
          <div className={s.drawerSection}>
            <p className={s.sectionTag}>Genoptag med kode</p>
            <form onSubmit={handleResume} className={s.stackForm}>
              <label className={s.fieldWrap}>
                <span className={s.fieldLabel}>Group-ID</span>
                <input className={s.fieldInput} value={recallGroup} onChange={(e) => setRecallGroup(e.target.value.trim())} placeholder="UUID fra gruppe-siden" maxLength={36} required />
              </label>
              <label className={s.fieldWrap}>
                <span className={s.fieldLabel}>Genkald-kode</span>
                <input className={s.fieldInput} value={recallCode} onChange={(e) => setRecallCode(e.target.value.trim())} placeholder="4-cifret kode" maxLength={6} required inputMode="numeric" />
              </label>
              <button type="submit" className={s.ghostBtn} disabled={busy}>Genoptag</button>
            </form>
          </div>
        </>
      )}
    </div>
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className={`${s.page} ${busy ? s.busy : ""}`}>

      <header className={s.header}>
        <div className={s.headerCenter}>
          <span className={s.headerTitle}>Roskilde Venneplanner</span>
          {status && <span className={s.statusMsg}>{status}</span>}
        </div>
        <div className={s.headerActions}>
          {user && (
            <button className={s.iconBtn} onClick={() => run(() => fetchSession(user.userId))} aria-label="Opdatér">↻</button>
          )}
        </div>
      </header>

      <div className={s.statsStrip}>
        {[
          { label: "Bruger",       value: user?.displayName ?? "Ingen bruger" },
          { label: "Aktiv gruppe", value: activeGroup?.name ?? "—" },
          { label: "Valgte shows", value: myPicks.length },
          { label: "I line-up",    value: lineup.length },
        ].map(({ label, value }) => (
          <div key={label} className={s.statCard}>
            <span className={s.statLabel}>{label}</span>
            <span className={s.statValue}>{String(value)}</span>
          </div>
        ))}
      </div>

      {/* ══ TAB: LINEUP ══ */}
      <div style={{ display: activeTab === "lineup" ? "block" : "none" }}>
        <section className={s.section}>
          <p className={s.sectionTag}>Line-up · {lineup.length} acts</p>

          <div className={s.filterBar}>
            <input
              type="search"
              className={s.searchInput}
              placeholder="Søg i line-up…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className={s.filterRow}>
              <select className={s.filterSelect} value={stageF} onChange={(e) => setStageF(e.target.value)}>
                <option value="alle">Alle scener</option>
                {allStages.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
              <select className={s.filterSelect} value={typeF} onChange={(e) => setTypeF(e.target.value)}>
                <option value="alle">Alle typer</option>
                {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className={s.filterRow}>
              <select className={s.filterSelect} value={dayF} onChange={(e) => setDayF(e.target.value)}>
                <option value="alle">Alle dage</option>
                {sortedDays.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className={s.filterSelect} value={timeSlotF} onChange={(e) => setTimeSlotF(e.target.value as TimeSlot)}>
                {TIME_SLOTS.map((ts) => (
                  <option key={ts.id} value={ts.id}>{ts.label}{ts.range ? ` (${ts.range})` : ""}</option>
                ))}
              </select>
            </div>
            <div className={s.filterBottomRow}>
              <label className={s.toggleRow}>
                <input type="checkbox" checked={selectedOnly} onChange={(e) => setSelectedOnly(e.target.checked)} />
                <span>Vis kun valgte</span>
              </label>
              {filtersActive && (
                <button className={s.resetBtn} onClick={resetFilters}>Nulstil filtre</button>
              )}
            </div>
          </div>

          {!user && (
            <p className={s.hint}>
              Opret eller join en gruppe for at markere shows →{" "}
              <button className={s.hintBtn} onClick={() => switchTab("gruppe")}>Åbn gruppe</button>
            </p>
          )}

          {acts.length === 0 ? (
            <div className={s.empty}>Ingen acts matcher dit filter.</div>
          ) : (
            <div className={s.actsList}>
              {[...acts].sort((a, b) => a.name.localeCompare(b.name, "da")).map((act) => {
                const apps     = getAppearances(act);
                const canPick  = !!user;
                const isMulti  = apps.length > 1;
                const expanded = expandedActs.has(act.name);
                const anyPickedOnAct = apps.some((app) => {
                  const appDate = app.date ?? "";
                  return myPickFor(act.name, appDate) !== null || groupPicksFor(act.name, appDate).length > 0;
                });

                if (!isMulti) {
                  const app     = apps[0];
                  const appDate = app.date ?? "";
                  const mine    = myPickFor(act.name, appDate);
                  const gPicks  = groupPicksFor(act.name, appDate);
                  const schedStr = [app.timeLabel, app.dateLabel, app.stage ?? act.lineupSceneLabel].filter(Boolean).join(" · ") || "Dato TBA";

                  return (
                    <article key={act.name} className={`${s.actCard} ${(mine || gPicks.length) ? s.actCardPicked : ""}`}>
                      <div className={s.actTop}>
                        <div className={s.actInfo}><h3 className={s.actName}>{act.name}</h3></div>
                        <div className={s.catGrid}>
                          {CATEGORIES.map((key) => (
                            <button
                              key={key}
                              className={`${s.catBtn} ${CAT_META[key].btnCls} ${mine === key ? s.catBtnActive : ""}`}
                              onClick={() => handlePick(act.name, appDate, key)}
                              disabled={!canPick}
                              title={CAT_META[key].label}
                            >{CAT_META[key].emoji}</button>
                          ))}
                        </div>
                      </div>
                      <p className={s.actMeta}>{schedStr}</p>
                      {gPicks.length > 0 && (
                        <div className={s.pickTags}>
                          {gPicks.map((p) => (
                            <span key={`${p.userId}-${appDate}`} className={`${s.tag} ${CAT_META[p.category].btnCls}`}>
                              {CAT_META[p.category].emoji} {initials(p.displayName)}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                }

                return (
                  <article key={act.name} className={`${s.actCard} ${anyPickedOnAct ? s.actCardPicked : ""}`}>
                    <button className={s.actHeader} onClick={() => toggleExpand(act.name)} aria-expanded={expanded}>
                      <div className={s.actInfo}>
                        <h3 className={s.actName}>{act.name}</h3>
                        <p className={s.actMeta}>
                          {act.type ? `${act.type} · ` : ""}{apps.length} optrædener
                          {anyPickedOnAct ? " · ✓" : ""}
                        </p>
                      </div>
                      <span className={s.expandArrow}>{expanded ? "▴" : "▾"}</span>
                    </button>

                    {expanded && (
                      <div className={s.appList}>
                        {apps.map((app) => {
                          const appDate  = app.date ?? "";
                          const mine     = myPickFor(act.name, appDate);
                          const gPicks   = groupPicksFor(act.name, appDate);
                          const schedStr = [app.timeLabel, app.dateLabel, app.stage ?? act.lineupSceneLabel].filter(Boolean).join(" · ") || "Dato TBA";
                          return (
                            <div key={appDate || schedStr} className={s.appRow}>
                              <div className={s.appRowTop}>
                                <p className={s.appMeta2}>{schedStr}</p>
                                <div className={s.catGrid}>
                                  {CATEGORIES.map((key) => (
                                    <button
                                      key={key}
                                      className={`${s.catBtn} ${CAT_META[key].btnCls} ${mine === key ? s.catBtnActive : ""}`}
                                      onClick={() => handlePick(act.name, appDate, key)}
                                      disabled={!canPick}
                                      title={CAT_META[key].label}
                                    >{CAT_META[key].emoji}</button>
                                  ))}
                                </div>
                              </div>
                              {gPicks.length > 0 && (
                                <div className={s.pickTags}>
                                  {gPicks.map((p) => (
                                    <span key={`${p.userId}-${appDate}`} className={`${s.tag} ${CAT_META[p.category].btnCls}`}>
                                      {CAT_META[p.category].emoji} {initials(p.displayName)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ══ TAB: TIDSPLAN ══ */}
      <div style={{ display: activeTab === "tidsplan" ? "block" : "none" }}>
        {/* Live-prompt: akter der spiller nu med min willingness */}
        <PresenceBoundary>
          {livePromptActs.map(({ actName, pid }) => (
            <div key={pid} className={s.livePromptBanner}>
              <p className={s.livePromptText}><strong>{actName}</strong> spiller nu — er du der?</p>
              <button className={s.checkinBtn} onClick={() => handleCheckin("performance", pid)} disabled={busy}>Jeg er her!</button>
            </div>
          ))}
        </PresenceBoundary>
        {tlDays.length === 0 ? (
          <div className={s.section}>
            <div className={s.empty}>
              {activeGroup
                ? "Marker shows i line-up — de samles her som en kronologisk tidsplan."
                : "Opret eller join en gruppe for at se jeres fælles tidsplan."}
            </div>
          </div>
        ) : (
          <>
            {/* Gruppe-skifter hvis man er i flere grupper */}
            {groups.length > 1 && (
              <div className={s.groupSwitcher}>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    className={`${s.groupSwitchBtn} ${g.id === activeGroup?.id ? s.groupSwitchActive : ""}`}
                    onClick={() => setActiveGroupId(g.id)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            <div className={s.dayTabs}>
              {tlDays.map((day) => (
                <button
                  key={day}
                  className={`${s.dayTabBtn} ${day === activeDayKey ? s.dayTabActive : ""}`}
                  onClick={() => setActivePlanDay(day)}
                >
                  {day.replace(/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY) /, "").replace(/ \d{4}$/, "")}
                </button>
              ))}
            </div>

            {activeDayKey && (() => {
              const items = tlByDay.get(activeDayKey) ?? [];
              const bands = buildBands(items);
              return (
                <div className={s.timelineColumn}>
                  {bands.map((band, bandIdx) => {
                    const isConflict = band.length > 1;

                    return (
                      <div key={`band-${bandIdx}`}>
                        <div className={isConflict ? s.conflictBand : undefined}>
                          {band.map((entry) => (
                            <article
                              key={`${entry.act.name}-${entry.app.date ?? bandIdx}`}
                              className={`${s.timelineCard} ${isConflict ? s.timelineCardConflict : ""} ${nowTs !== null && entry.app.date ? new Date(entry.app.date).getTime() < nowTs ? s.timelineCardPast : "" : ""}`}
                            >
                              <div className={s.timeSlot}>{entry.app.timeLabel ?? "TBA"}</div>
                              <div className={s.timelineBody}>
                                <div className={s.timelineTop}>
                                  <div className={s.actInfo}>
                                    <h4 className={s.actName}>{entry.act.name}</h4>
                                    <p className={s.actMeta}>
                                      {[entry.act.type, entry.app.stage ?? entry.act.lineupSceneLabel].filter(Boolean).join(" · ")}
                                    </p>
                                  </div>
                                  {user && (
                                    <div className={s.catGrid}>
                                      {CATEGORIES.map((key) => {
                                        const mine = myPickFor(entry.act.name, entry.app.date ?? "");
                                        return (
                                          <button
                                            key={key}
                                            className={`${s.catBtn} ${CAT_META[key].btnCls} ${mine === key ? s.catBtnActive : ""}`}
                                            // eslint-disable-next-line react-hooks/refs
                                            onClick={() => handlePick(entry.act.name, entry.app.date ?? "", key)}
                                            title={CAT_META[key].label}
                                          >{CAT_META[key].emoji}</button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                {entry.picks.filter((p) => p.userId !== user?.userId).length > 0 && (
                                  <div className={s.pickTags}>
                                    {entry.picks.filter((p) => p.userId !== user?.userId).map((p) => (
                                      <span key={p.userId} className={`${s.tag} ${CAT_META[p.category].btnCls}`}>
                                        {initials(p.displayName)} {CAT_META[p.category].emoji}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              <PresenceBoundary>
                                {(() => {
                                  const pid = perfId(entry.act.name, entry.app.date ?? "");
                                  const presMembers = activePresenceMembers(presence, { type: "performance", performanceId: pid });
                                  const live = nowTs !== null && isLiveNow(entry.app, nowTs);
                                  const imHere = myActiveCheckin?.targetType === "performance" &&
                                    (myActiveCheckin as { targetType: "performance"; performanceId: string }).performanceId === pid;
                                  if (!live && presMembers.length === 0) return null;
                                  return (
                                    <div className={s.timelineCheckinRow}>
                                      {presMembers.length > 0 && <AvatarStack members={presMembers} />}
                                      {live && (
                                        imHere
                                          ? <button className={s.checkoutBtn} onClick={handleCheckout}>Tjek ud</button>
                                          // eslint-disable-next-line react-hooks/refs
                                          : <button className={s.checkinBtn} onClick={() => handleCheckin("performance", pid)} disabled={busy}>Jeg er her</button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </PresenceBoundary>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* ══ TAB: GRUPPE ══ */}
      <div style={{ display: activeTab === "gruppe" ? "block" : "none" }}>
        {gruppeTab}
      </div>

      {/* Mobil tab bar */}
      <nav className={s.tabBar} aria-label="Navigation">
        <button className={`${s.tabBarBtn} ${activeTab === "lineup" ? s.tabBarBtnActive : ""}`} onClick={() => switchTab("lineup")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor" stroke="none"/>
            <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1" fill="currentColor" stroke="none"/>
          </svg>
          <span className={s.tabBarLabel}>Line-up</span>
        </button>
        <button className={`${s.tabBarBtn} ${activeTab === "tidsplan" ? s.tabBarBtnActive : ""}`} onClick={() => switchTab("tidsplan")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className={s.tabBarLabel}>Tidsplan</span>
          {tlTotal > 0 && <span className={s.tabBadge}>{tlTotal}</span>}
        </button>
        <button className={`${s.tabBarBtn} ${activeTab === "gruppe" ? s.tabBarBtnActive : ""}`} onClick={() => switchTab("gruppe")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span className={s.tabBarLabel}>Gruppe</span>
          {!user && <span className={s.tabBadgeDot} />}
        </button>
      </nav>

      <footer className={s.footer}>
        <span>Roskilde Venneplanner · albertdieckmann.dk</span>
      </footer>

      {showScrollTop && (
        <button
          className={s.scrollTopBtn}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll til top"
        >
          ↑
        </button>
      )}
    </div>
  );
}
