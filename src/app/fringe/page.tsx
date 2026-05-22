"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import s from "./fringe.module.css";
import { AREA_LABELS, AREA_ORDER, type Area } from "@/lib/fringe-area";

// ─── Types ────────────────────────────────────────────────────────────────────

type PickStatus = "interested" | "going" | "has_ticket";

type Performance = {
  start: string;
  end: string;
  durationMinutes?: number;
  price?: number;
  concession?: number;
  priceString?: string;
  title?: string;
  type?: string;
};

type Show = {
  id: string;
  code?: string;
  title: string;
  subTitle?: string;
  artist?: string;
  artistType?: string;
  genre?: string;
  genreTags?: string[];
  descriptionTeaser?: string;
  website?: string;
  status?: string;
  venue: { name: string; address?: string; lat?: number; lon?: number; area: Area };
  performances: Performance[];
  imageUrl?: string;
};

type FringePick = {
  user_id: string;
  user_name: string;
  show_id: string;
  show_title: string;
  status: PickStatus;
  performance_id: string | null;
  performance_start: string | null;
  performance_end: string | null;
};

type PurchaseCover = {
  covered_user_id: string;
  covered_user_name: string;
  settled: boolean;
  settled_at: string | null;
};

type Purchase = {
  id: number;
  buyer_user_id: string;
  buyer_user_name: string;
  show_id: string;
  show_title: string;
  performance_id: string | null;
  performance_start: string | null;
  total_cost: string | null;
  notes: string | null;
  purchased_at: string;
  covers: PurchaseCover[];
};

type TabId  = "shows" | "plan" | "gruppe";
type Member = { id: string; name: string; role: string };
type Group  = { id: number; name: string; start_date?: string | null; end_date?: string | null };
type ActiveGroup = {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  members: Member[];
  invites: { code: string }[];
  picks: FringePick[];
  purchases: Purchase[];
};
type SessionData = {
  user: { id: string; name: string; email: string } | null;
  groups: Group[];
  activeGroup: ActiveGroup | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

// Feature 1: distinct, readable emoji icons for each status
const STATUS_META: Record<PickStatus, { label: string; emoji: string; cls: string; btnCls: string }> = {
  interested: { label: "Vil gerne", emoji: "🤷", cls: s.tagInterested, btnCls: s.statusBtnInterested },
  going:      { label: "Skal med",  emoji: "👍", cls: s.tagGoing,      btnCls: s.statusBtnGoing      },
  has_ticket: { label: "Har billet",emoji: "🎫", cls: s.tagTicket,     btnCls: s.statusBtnTicket     },
};

const STATUSES: PickStatus[] = ["interested", "going", "has_ticket"];

const UI_KEY = "fringe-planner-ui-v2";

// Edinburgh is always Europe/London (BST in summer, GMT in winter)
const EDINBURGH_TZ = "Europe/London";
const fmtEdinburgh = (iso: string, opts: Intl.DateTimeFormatOptions): string =>
  new Date(iso).toLocaleString("da-DK", { ...opts, timeZone: EDINBURGH_TZ });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadUi() {
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

function saveUi(patch: Partial<ReturnType<typeof loadUi>>) {
  localStorage.setItem(UI_KEY, JSON.stringify({ ...loadUi(), ...patch }));
}

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error ?? "Noget gik galt.");
  return payload;
}

function formatPerf(perf: Performance): { dateStr: string; timeStr: string; meta: string } {
  const dateStr = fmtEdinburgh(perf.start, { weekday: "short", day: "numeric", month: "short" });
  const timeStr = fmtEdinburgh(perf.start, { hour: "2-digit", minute: "2-digit" });
  const parts: string[] = [];
  if (perf.durationMinutes) parts.push(`${perf.durationMinutes} min`);
  if (perf.priceString) parts.push(perf.priceString);
  else if (perf.price != null) parts.push(`£${perf.price}`);
  return { dateStr, timeStr, meta: parts.join(" · ") };
}

// ─── Conflict detection ───────────────────────────────────────────────────────
// Feature 3: per-person, per-level conflicts
// Key: `${userId}::${showId}::${perfStart}` → ConflictEntry[]

type ConflictLevel = "hard" | "soft";
type ConflictEntry = {
  level: ConflictLevel;
  otherShowTitle: string;
  otherPerfStart: string;
};

function conflictKey(userId: string, showId: string, perfStart: string) {
  return `${userId}::${showId}::${perfStart}`;
}

function computeConflicts(picks: FringePick[]): Map<string, ConflictEntry[]> {
  // Include ALL picks with a time window (interested too, for soft-conflict detection)
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
          // Hard conflict — both are committed
          addConflict(a, b, "hard");
          addConflict(b, a, "hard");
        } else if (aCommitted || bCommitted) {
          // Soft conflict — one committed, one interested
          addConflict(a, b, "soft");
          addConflict(b, a, "soft");
        }
        // interested vs interested: no conflict
      }
    }
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FringePage() {
  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn, signOut } = useClerk();

  const [shows,        setShows]        = useState<Show[]>([]);
  const [session,      setSession]      = useState<SessionData>({ user: null, groups: [], activeGroup: null });
  const [search,       setSearch]       = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [genreFilter,  setGenreFilter]  = useState<string[]>([]);
  const [areaFilter,   setAreaFilter]   = useState<Area[]>([]);
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [groupName,    setGroupName]    = useState("");
  const [groupStartDate, setGroupStartDate] = useState("");
  const [groupEndDate,   setGroupEndDate]   = useState("");
  const [inviteCode,   setInviteCode]   = useState("");
  const [statusMsg,    setStatusMsg]    = useState("");
  const [busy,         setBusy]         = useState(false);
  const [ready,        setReady]        = useState(false);
  const [drawerOpen,   setDrawerOpen]   = useState(false);

  // Performance picker
  const [perfPicker, setPerfPicker] = useState<{ showId: string; status: "going" | "has_ticket" } | null>(null);

  // Feature 2: ticket buyer dialog (opened when clicking "Har billet")
  const [ticketDialog, setTicketDialog] = useState<{
    show: Show;
    perf: Performance;
    coveredIds: string[];
    cost: string;
  } | null>(null);

  // Feature 4: hide "Vil gerne" in timeline toggle
  const [hideInterested, setHideInterested] = useState(false);

  // Feature 5: quick-join confirmation when user has a conflicting pick on another perf
  const [joinConfirm, setJoinConfirm] = useState<{
    show: Show;
    perf: Performance;
    currentPerfStart: string | null;
  } | null>(null);

  // Expanded show descriptions (shows tab only)
  const [expandedShows, setExpandedShows] = useState<Set<string>>(new Set());

  // Group settings (drawer edit form)
  const [editGroupName,  setEditGroupName]  = useState("");
  const [editStartDate,  setEditStartDate]  = useState("");
  const [editEndDate,    setEditEndDate]    = useState("");

  // Mobile tab navigation
  const [activeTab, setActiveTab] = useState<TabId>("shows");
  const [isMobile,  setIsMobile]  = useState(false);
  const tabRefShows  = useRef<HTMLDivElement>(null);
  const tabRefPlan   = useRef<HTMLDivElement>(null);
  const tabRefGruppe = useRef<HTMLDivElement>(null);
  const savedScrolls = useRef<Record<TabId, number>>({ shows: 0, plan: 0, gruppe: 0 });

  // Day strip
  const dayStripRef     = useRef<HTMLDivElement>(null);
  const dayStripScrolled = useRef(false);

  // Purchase form
  const [purchaseForm, setPurchaseForm] = useState<{
    showId: string;
    perfStart: string;
    perfId: string;
    cost: string;
    notes: string;
    covered: string[];
  } | null>(null);

  const activeGroupIdRef = useRef<number | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function flash(msg: string) {
    setStatusMsg(msg);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatusMsg(""), 3500);
  }

  // ── Session ────────────────────────────────────────────────────────────────

  const fetchSession = useCallback(async (groupId?: number | null) => {
    const id = groupId !== undefined ? groupId : activeGroupIdRef.current;
    const qs = id ? `?groupId=${id}` : "";
    const pay = await api(`/api/fringe/session${qs}`);
    setSession({ user: pay.user, groups: pay.groups ?? [], activeGroup: pay.activeGroup });
    if (pay.activeGroup) {
      activeGroupIdRef.current = pay.activeGroup.id;
      saveUi({ activeGroupId: pay.activeGroup.id });
    }
  }, []);

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    api("/api/fringe/shows")
      .then((d) => setShows(d.items ?? []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const ui = loadUi();
    setSearch(ui.search);
    setSelectedOnly(ui.selectedOnly);
    setGenreFilter(ui.genreFilter);
    setAreaFilter(ui.areaFilter);
    setDateFrom(ui.dateFrom);
    setDateTo(ui.dateTo);
    activeGroupIdRef.current = ui.activeGroupId;
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const ui = loadUi();
    fetchSession(ui.activeGroupId).finally(() => setReady(true));
  }, [isLoaded, isSignedIn, fetchSession]);

  // Sync group edit fields when active group changes
  useEffect(() => {
    setEditGroupName(session.activeGroup?.name ?? "");
    setEditStartDate(session.activeGroup?.startDate?.slice(0, 10) ?? "");
    setEditEndDate(session.activeGroup?.endDate?.slice(0, 10) ?? "");
  }, [session.activeGroup?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default date range to group travel dates when they change
  useEffect(() => {
    const g = session.activeGroup;
    if (!g) return;
    setDateFrom((prev) => {
      if (prev) return prev;
      return g.startDate ? g.startDate.slice(0, 10) : "";
    });
    setDateTo((prev) => {
      if (prev) return prev;
      return g.endDate ? g.endDate.slice(0, 10) : "";
    });
  }, [session.activeGroup?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect mobile breakpoint + read initial tab from URL
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    const p = new URLSearchParams(window.location.search).get("tab") as TabId | null;
    if (p === "shows" || p === "plan" || p === "gruppe") setActiveTab(p);
    return () => mq.removeEventListener("change", update);
  }, []);

  // ── Tab navigation ─────────────────────────────────────────────────────────

  function switchTab(tab: TabId) {
    savedScrolls.current[activeTab] = window.scrollY;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
    setActiveTab(tab);
  }

  // Restore window scroll position after tab switch
  useEffect(() => {
    const saved = savedScrolls.current[activeTab];
    requestAnimationFrame(() => {
      window.scrollTo(0, saved);
    });
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll day strip to first selected day (or today) when shows populate
  useEffect(() => {
    if (dayStripScrolled.current) return;
    const strip = dayStripRef.current;
    if (!strip) return;
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/London" });
    const target = dateFrom || today;
    const btn = strip.querySelector<HTMLElement>(`[data-day="${target}"]`);
    if (btn) {
      btn.scrollIntoView({ inline: "center", behavior: "instant", block: "nearest" });
      dayStripScrolled.current = true;
    }
  }, [shows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Busy wrapper ───────────────────────────────────────────────────────────

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try { await task(); }
    catch (err) { flash(err instanceof Error ? err.message : "Noget gik galt."); }
    finally { setBusy(false); }
  }

  // ── Group handlers ─────────────────────────────────────────────────────────

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const pay = await api("/api/fringe/groups", {
        method: "POST",
        body: JSON.stringify({ name: groupName, startDate: groupStartDate || null, endDate: groupEndDate || null }),
      });
      setGroupName("");
      setGroupStartDate("");
      setGroupEndDate("");
      await fetchSession(pay.groupId);
      flash("Gruppe oprettet.");
    });
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!session.activeGroup) return;
    await run(async () => {
      const pay = await api("/api/fringe/invites", {
        method: "POST",
        body: JSON.stringify({ groupId: session.activeGroup!.id }),
      });
      await fetchSession();
      flash(`Invite-kode: ${pay.code}`);
    });
  }

  async function handleCopyInvite() {
    const code = session.activeGroup?.invites?.[0]?.code;
    if (!code) { flash("Opret en invite-kode først."); return; }
    try {
      await navigator.clipboard.writeText(code);
      flash(`${code} kopieret.`);
    } catch {
      flash(`Kode: ${code}`);
    }
  }

  async function handleJoinGroup(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      await api("/api/fringe/invites/accept", { method: "POST", body: JSON.stringify({ code: inviteCode }) });
      setInviteCode("");
      await fetchSession();
      flash("Du er med i gruppen.");
    });
  }

  async function handleLeaveGroup(id: number, name: string) {
    if (!confirm(`Forlad "${name}"?`)) return;
    await run(async () => {
      await api(`/api/fringe/groups/${id}/leave`, { method: "DELETE" });
      activeGroupIdRef.current = null;
      saveUi({ activeGroupId: null });
      await fetchSession(null);
      flash("Du har forladt gruppen.");
    });
  }

  async function handleDeleteGroup(id: number, name: string) {
    if (!confirm(`Slet gruppen "${name}"? Alle picks og køb slettes.`)) return;
    await run(async () => {
      await api(`/api/fringe/groups/${id}`, { method: "DELETE" });
      activeGroupIdRef.current = null;
      saveUi({ activeGroupId: null });
      await fetchSession(null);
      flash("Gruppe slettet.");
    });
  }

  async function handleSwitchGroup(id: number) {
    activeGroupIdRef.current = id;
    saveUi({ activeGroupId: id });
    // Reset date filters so they pick up the new group's travel dates
    setDateFrom("");
    setDateTo("");
    saveUi({ dateFrom: "", dateTo: "" });
    await run(() => fetchSession(id));
  }

  function handleDayChipClick(day: string) {
    let newFrom: string, newTo: string;
    if (!dateFrom && !dateTo) {
      newFrom = day; newTo = day;
    } else if (dateFrom === dateTo) {
      if (day === dateFrom) { newFrom = ""; newTo = ""; }            // toggle off
      else if (day > dateFrom) { newFrom = dateFrom; newTo = day; }  // extend right
      else { newFrom = day; newTo = dateFrom; }                       // extend left
    } else {
      // Range already active → reset to single day
      newFrom = day; newTo = day;
    }
    setDateFrom(newFrom);
    setDateTo(newTo);
    saveUi({ dateFrom: newFrom, dateTo: newTo });
  }

  async function handleSaveGroupSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!session.activeGroup) return;
    const isOwner = session.activeGroup.members.find((m) => m.id === session.user?.id)?.role === "owner";
    await run(async () => {
      await api(`/api/fringe/groups/${session.activeGroup!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(isOwner && editGroupName ? { name: editGroupName } : {}),
          startDate: editStartDate || null,
          endDate:   editEndDate   || null,
        }),
      });
      await fetchSession();
      flash("Gruppeindstillinger gemt.");
    });
  }

  async function handleSeed() {
    await run(async () => {
      const pay = await api("/api/fringe/seed", { method: "POST" });
      await fetchSession(pay.groupId);
      flash(`"${pay.groupName}" oprettet med demodata.`);
    });
  }

  // ── Pick handlers ──────────────────────────────────────────────────────────

  // Returns only performances within the active date range (or all if no range set)
  function perfsInRange(show: Show): Performance[] {
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

  function handleStatusClick(show: Show, status: PickStatus) {
    if (!session.activeGroup || !session.user) return;

    const current = myPick(show.id);

    if (current?.status === status) {
      run(async () => {
        await api("/api/fringe/picks", {
          method: "POST",
          body: JSON.stringify({ groupId: session.activeGroup!.id, showId: show.id, showTitle: show.title, status: null }),
        });
        await fetchSession();
      });
      return;
    }

    if (status === "interested") {
      run(async () => {
        await api("/api/fringe/picks", {
          method: "POST",
          body: JSON.stringify({
            groupId: session.activeGroup!.id,
            showId: show.id,
            showTitle: show.title,
            status,
            performanceId: null,
            performanceStart: null,
            performanceEnd: null,
          }),
        });
        await fetchSession();
      });
      return;
    }

    // going / has_ticket → only offer performances within the active date range
    const rangePerfs = perfsInRange(show);
    if (rangePerfs.length === 1) {
      const perf = rangePerfs[0];
      if (status === "has_ticket") {
        openTicketDialog(show, perf);
      } else {
        run(async () => {
          await api("/api/fringe/picks", {
            method: "POST",
            body: JSON.stringify({
              groupId: session.activeGroup!.id,
              showId: show.id,
              showTitle: show.title,
              status,
              performanceId: perf.start,
              performanceStart: perf.start,
              performanceEnd: perf.end,
            }),
          });
          await fetchSession();
        });
      }
    } else {
      setPerfPicker({ showId: show.id, status });
    }
  }

  // Like handleStatusClick but with a specific performance already chosen — used from timeline cards
  function handleStatusClickForPerf(show: Show, perf: Performance, status: PickStatus) {
    if (!session.activeGroup || !session.user) return;
    const current = myPick(show.id);

    // Toggle off if the user is already on this status for this exact perf
    const isActiveHere =
      current?.status === status &&
      (status === "interested" ||
        (current?.performance_start &&
          new Date(current.performance_start).toISOString() ===
            new Date(perf.start).toISOString()));

    if (isActiveHere) {
      run(async () => {
        await api("/api/fringe/picks", {
          method: "POST",
          body: JSON.stringify({
            groupId: session.activeGroup!.id,
            showId: show.id,
            showTitle: show.title,
            status: null,
          }),
        });
        await fetchSession();
      });
      return;
    }

    if (status === "interested") {
      // Downgrade to interested — clears the specific performance
      run(async () => {
        await api("/api/fringe/picks", {
          method: "POST",
          body: JSON.stringify({
            groupId: session.activeGroup!.id,
            showId: show.id,
            showTitle: show.title,
            status,
            performanceId: null,
            performanceStart: null,
            performanceEnd: null,
          }),
        });
        await fetchSession();
      });
      return;
    }

    if (status === "has_ticket") {
      openTicketDialog(show, perf);
      return;
    }

    // going: commit directly to this performance
    run(async () => {
      await api("/api/fringe/picks", {
        method: "POST",
        body: JSON.stringify({
          groupId: session.activeGroup!.id,
          showId: show.id,
          showTitle: show.title,
          status,
          performanceId: perf.start,
          performanceStart: perf.start,
          performanceEnd: perf.end,
        }),
      });
      await fetchSession();
    });
  }

  function openTicketDialog(show: Show, perf: Performance) {
    const members = session.activeGroup?.members ?? [];
    setTicketDialog({
      show,
      perf,
      coveredIds: session.user ? [session.user.id] : members.map((m) => m.id),
      cost: perf.priceString
        ? ""
        : perf.price != null
        ? String(perf.price)
        : "",
    });
  }

  async function handleSelectPerformance(show: Show, perf: Performance) {
    if (!perfPicker || !session.activeGroup) return;
    const { status } = perfPicker;
    setPerfPicker(null);

    if (status === "has_ticket") {
      // Feature 2: open ticket buyer dialog instead of saving pick directly
      openTicketDialog(show, perf);
      return;
    }

    await run(async () => {
      await api("/api/fringe/picks", {
        method: "POST",
        body: JSON.stringify({
          groupId: session.activeGroup!.id,
          showId: show.id,
          showTitle: show.title,
          status,
          performanceId: perf.start,
          performanceStart: perf.start,
          performanceEnd: perf.end,
        }),
      });
      await fetchSession();
    });
  }

  // Feature 2: confirm ticket purchase + auto-set picks for covered users
  async function handleConfirmTickets() {
    if (!ticketDialog || !session.activeGroup) return;
    const { show, perf, coveredIds, cost } = ticketDialog;
    setTicketDialog(null);
    await run(async () => {
      await api("/api/fringe/purchases", {
        method: "POST",
        body: JSON.stringify({
          groupId: session.activeGroup!.id,
          showId: show.id,
          showTitle: show.title,
          performanceId: perf.start,
          performanceStart: perf.start,
          performanceEnd: perf.end,
          totalCost: cost || null,
          quantity: coveredIds.length,
          coveredUserIds: coveredIds,
        }),
      });
      await fetchSession();
      flash("Billetter registreret — picks opdateret.");
    });
  }

  // Feature 5: quick-join a friend's performance
  function handleQuickJoin(show: Show, targetPerf: Performance) {
    if (!session.user || !session.activeGroup) return;
    const mine = myPick(show.id);
    const samePerf = mine?.performance_start &&
      new Date(mine.performance_start).toISOString() === new Date(targetPerf.start).toISOString();

    if (samePerf) {
      // Already on this perf — just promote to going if currently interested
      if (mine?.status === "interested") {
        run(async () => {
          await api("/api/fringe/picks", {
            method: "POST",
            body: JSON.stringify({
              groupId: session.activeGroup!.id,
              showId: show.id,
              showTitle: show.title,
              status: "going",
              performanceId: targetPerf.start,
              performanceStart: targetPerf.start,
              performanceEnd: targetPerf.end,
            }),
          });
          await fetchSession();
        });
      }
      return;
    }

    if (mine && mine.performance_start) {
      // I have a pick on a different performance — need confirmation
      setJoinConfirm({ show, perf: targetPerf, currentPerfStart: mine.performance_start });
      return;
    }

    // No existing pick → set directly
    run(async () => {
      await api("/api/fringe/picks", {
        method: "POST",
        body: JSON.stringify({
          groupId: session.activeGroup!.id,
          showId: show.id,
          showTitle: show.title,
          status: "going",
          performanceId: targetPerf.start,
          performanceStart: targetPerf.start,
          performanceEnd: targetPerf.end,
        }),
      });
      await fetchSession();
    });
  }

  async function handleConfirmJoin() {
    if (!joinConfirm || !session.activeGroup) return;
    const { show, perf } = joinConfirm;
    setJoinConfirm(null);
    await run(async () => {
      await api("/api/fringe/picks", {
        method: "POST",
        body: JSON.stringify({
          groupId: session.activeGroup!.id,
          showId: show.id,
          showTitle: show.title,
          status: "going",
          performanceId: perf.start,
          performanceStart: perf.start,
          performanceEnd: perf.end,
        }),
      });
      await fetchSession();
      flash("Moved to friend's performance.");
    });
  }

  // ── Purchase handlers ──────────────────────────────────────────────────────

  async function handleLogPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!purchaseForm || !session.activeGroup) return;
    const form = purchaseForm;
    setPurchaseForm(null);
    await run(async () => {
      const show = shows.find((s) => s.id === form.showId);
      await api("/api/fringe/purchases", {
        method: "POST",
        body: JSON.stringify({
          groupId: session.activeGroup!.id,
          showId: form.showId,
          showTitle: show?.title ?? form.showId,
          performanceId: form.perfId || null,
          performanceStart: form.perfStart || null,
          totalCost: form.cost || null,
          notes: form.notes || null,
          coveredUserIds: form.covered,
        }),
      });
      await fetchSession();
      flash("Køb registreret.");
    });
  }

  async function handleSettle(purchaseId: number, coveredUserId: string, settled: boolean) {
    await run(async () => {
      await api(`/api/fringe/purchases/${purchaseId}/settle`, {
        method: "POST",
        body: JSON.stringify({ coveredUserId, settled }),
      });
      await fetchSession();
    });
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  function myPick(showId: string): FringePick | null {
    if (!session.user || !session.activeGroup) return null;
    return session.activeGroup.picks.find(
      (p) => p.show_id === showId && p.user_id === session.user!.id
    ) ?? null;
  }

  function picksFor(showId: string): FringePick[] {
    return (session.activeGroup?.picks ?? []).filter((p) => p.show_id === showId);
  }

  // Who in the group has picked a specific performance (by start timestamp)
  function perfPicksFor(showId: string, perfStart: string): { name: string; status: PickStatus }[] {
    return (session.activeGroup?.picks ?? [])
      .filter((p) =>
        p.show_id === showId &&
        (p.status === "going" || p.status === "has_ticket") &&
        p.performance_start &&
        new Date(p.performance_start).toISOString() === new Date(perfStart).toISOString()
      )
      .map((p) => ({ name: p.user_name, status: p.status }));
  }

  function allGenres(): string[] {
    const seen = new Set<string>();
    for (const show of shows) {
      if (show.genre) seen.add(show.genre);
    }
    return [...seen].sort();
  }

  function allAreas(): Area[] {
    const seen = new Set<Area>();
    for (const show of shows) seen.add(show.venue.area);
    return AREA_ORDER.filter((a) => seen.has(a));
  }

  // Day strip: derive all calendar days in the relevant range
  function allDays(): string[] {
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
    const cur = new Date(from + "T12:00:00Z"); // noon UTC avoids DST edge
    const end = new Date(to   + "T12:00:00Z");
    while (cur <= end) {
      days.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return days;
  }

  function visibleShows(): Show[] {
    const q = search.trim().toLowerCase();
    const picked = new Set((session.activeGroup?.picks ?? []).map((p) => p.show_id));
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs   = dateTo   ? new Date(dateTo + "T23:59:59").getTime() : null;

    return shows.filter((show) => {
      if (selectedOnly && !picked.has(show.id)) return false;
      // "Vis kun besluttet": only shows where I have going or has_ticket
      if (hideInterested && session.user) {
        const myP = session.activeGroup?.picks.find(
          (p) => p.show_id === show.id && p.user_id === session.user!.id
        );
        if (!myP || myP.status === "interested") return false;
      }
      if (genreFilter.length > 0 && (!show.genre || !genreFilter.includes(show.genre))) return false;
      if (areaFilter.length > 0 && !areaFilter.includes(show.venue.area)) return false;

      // Date filter: show is included if any performance falls within the range
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

  // Feature 4: include interested picks (with performance_start) in timeline
  function timelineGroups(): [string, { show: Show; picks: FringePick[] }[]][] {
    const showMap = new Map(shows.map((s) => [s.id, s]));

    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs   = dateTo   ? new Date(dateTo + "T23:59:59").getTime() : null;

    const allPicks = (session.activeGroup?.picks ?? [])
      .filter((p) => {
        if (!p.performance_start) return false;
        if (!(p.status === "going" || p.status === "has_ticket" || (p.status === "interested" && !hideInterested))) return false;
        // Apply the same date range filter as the show list
        if (fromMs !== null || toMs !== null) {
          const t = new Date(p.performance_start).getTime();
          if (fromMs !== null && t < fromMs) return false;
          if (toMs   !== null && t > toMs)   return false;
        }
        return true;
      })
      .map((p) => {
        // Fallback: if the show isn't in the API results, build a minimal Show from pick data
        const show: Show = showMap.get(p.show_id) ?? {
          id: p.show_id,
          title: p.show_title,
          venue: { name: "", area: "other" as Area },
          performances: [],
        };
        return { show, pick: p };
      });

    // Group by show+day, collecting all users' picks per show
    const byDate = new Map<string, { show: Show; picks: FringePick[] }[]>();
    const seenKey = new Set<string>();

    const sorted = allPicks.sort((a, b) => a.pick.performance_start!.localeCompare(b.pick.performance_start!));

    for (const { show, pick } of sorted) {
      const dayKey = fmtEdinburgh(pick.performance_start!, { weekday: "long", day: "numeric", month: "long" });
      // Group same show on same day together (use show+day+perf as unique entry key)
      const entryKey = `${dayKey}::${show.id}::${pick.performance_start}`;

      if (seenKey.has(entryKey)) {
        const group = byDate.get(dayKey)!;
        const entry = group.find(
          (e) => e.show.id === show.id &&
                 e.picks[0]?.performance_start === pick.performance_start
        );
        if (entry && !entry.picks.some((p) => p.user_id === pick.user_id)) {
          entry.picks.push(pick);
        }
        continue;
      }

      seenKey.add(entryKey);
      const group = byDate.get(dayKey) ?? [];
      group.push({ show, picks: [pick] });
      byDate.set(dayKey, group);
    }

    return [...byDate.entries()];
  }

  // ── Early states ───────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <div className={s.page}>
        <div className={s.loading}>
          <span className={s.loadingDot} />
          Loader programme…
        </div>
      </div>
    );
  }

  const canPick         = !!(session.user && session.activeGroup);
  const isGroupOwner    = session.activeGroup?.members.find((m) => m.id === session.user?.id)?.role === "owner";
  const groupSettingsChanged = session.activeGroup != null && (
    editGroupName !== session.activeGroup.name ||
    (editStartDate || "") !== (session.activeGroup.startDate?.slice(0, 10) ?? "") ||
    (editEndDate   || "") !== (session.activeGroup.endDate?.slice(0, 10)   ?? "")
  );
  const visible     = visibleShows();
  const tGroups     = timelineGroups();
  const conflicts   = computeConflicts(session.activeGroup?.picks ?? []);
  const tCount      = new Set(tGroups.flatMap(([, items]) => items.map((i) => i.show.id))).size;
  const genres      = allGenres();
  const areas       = allAreas();

  // ── Shared drawer / Gruppe-tab content ────────────────────────────────────

  const gruppeContent = (
    <>
      {/* Profil */}
      <div className={s.drawerSection}>
        <p className={s.sectionTag}>Profil</p>
        {!isSignedIn ? (
          <div className={s.authCard}>
            <p className={s.muted}>Log ind for at markere shows og planlægge med venner.</p>
            <button className={s.primaryBtn} onClick={() => { setDrawerOpen(false); openSignIn({ fallbackRedirectUrl: "/fringe" }); }}>
              Log ind eller opret profil
            </button>
          </div>
        ) : (
          <div className={s.identityCard}>
            <div>
              <p className={s.identityName}>{session.user?.name}</p>
              <p className={s.identityEmail}>{session.user?.email}</p>
            </div>
            <button className={s.ghostBtn} onClick={() => signOut({ redirectUrl: "/fringe" })}>Log ud</button>
          </div>
        )}
      </div>

      {/* Gruppe */}
      {isSignedIn && (
        <div className={s.drawerSection}>
          <p className={s.sectionTag}>Gruppe</p>

          {session.groups.length > 0 && (
            <div className={s.groupSwitcher}>
              {session.groups.map((g) => (
                <button
                  key={g.id}
                  className={`${s.groupChip} ${g.id === session.activeGroup?.id ? s.active : ""}`}
                  onClick={() => handleSwitchGroup(g.id)}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}

          {session.activeGroup && (
            <>
              {/* ── Group settings form ── */}
              <form onSubmit={handleSaveGroupSettings} className={s.groupSettingsForm}>
                {isGroupOwner && (
                  <label className={s.fieldWrap}>
                    <span className={s.fieldLabel}>Gruppenavn</span>
                    <input
                      className={s.fieldInput}
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      maxLength={50}
                      required
                    />
                  </label>
                )}
                <div className={s.dateRow}>
                  <label className={s.fieldWrap}>
                    <span className={s.fieldLabel}>Rejse fra</span>
                    <input
                      type="date"
                      className={s.fieldInput}
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                    />
                  </label>
                  <label className={s.fieldWrap}>
                    <span className={s.fieldLabel}>Til</span>
                    <input
                      type="date"
                      className={s.fieldInput}
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                    />
                  </label>
                </div>
                {groupSettingsChanged && (
                  <button type="submit" className={s.primaryBtn}>Gem ændringer</button>
                )}
              </form>

              <div className={s.memberList}>
                {session.activeGroup.members.map((m) => (
                  <div key={m.id} className={`${s.friendChip} ${m.id === session.user?.id ? s.active : ""}`}>
                    <span>{m.name}</span>
                    <small>{m.role === "owner" ? "Oprettede gruppen" : "Medlem"}</small>
                  </div>
                ))}
              </div>
              <div className={s.inviteBar}>
                <form onSubmit={handleCreateInvite} style={{ display: "contents" }}>
                  <button type="submit" className={s.ghostBtn}>Ny invite</button>
                </form>
                {session.activeGroup.invites[0] && (
                  <button className={s.ghostBtn} onClick={handleCopyInvite}>
                    Kopiér ({session.activeGroup.invites[0].code})
                  </button>
                )}
              </div>
              {session.activeGroup.members.find((m) => m.id === session.user?.id)?.role === "owner" ? (
                <button className={s.deleteBtn} onClick={() => handleDeleteGroup(session.activeGroup!.id, session.activeGroup!.name)}>
                  Slet gruppe
                </button>
              ) : (
                <button className={s.deleteBtn} onClick={() => handleLeaveGroup(session.activeGroup!.id, session.activeGroup!.name)}>
                  Forlad gruppe
                </button>
              )}
            </>
          )}

          <details className={s.details}>
            <summary className={s.detailsSummary}>
              {session.groups.length === 0 ? "Opret gruppe eller join med invite-kode" : "Ny gruppe / join med kode"}
            </summary>
            <div className={s.detailsBody}>
              <form onSubmit={handleCreateGroup} className={s.stackForm}>
                <label className={s.fieldWrap}>
                  <span className={s.fieldLabel}>Navn</span>
                  <input className={s.fieldInput} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Fx Edinburgh-gæng" maxLength={50} required />
                </label>
                <div className={s.dateRow}>
                  <label className={s.fieldWrap}>
                    <span className={s.fieldLabel}>Rejse fra</span>
                    <input type="date" className={s.fieldInput} value={groupStartDate} onChange={(e) => setGroupStartDate(e.target.value)} />
                  </label>
                  <label className={s.fieldWrap}>
                    <span className={s.fieldLabel}>Til</span>
                    <input type="date" className={s.fieldInput} value={groupEndDate} onChange={(e) => setGroupEndDate(e.target.value)} />
                  </label>
                </div>
                <button type="submit" className={s.primaryBtn}>Opret</button>
              </form>

              <div className={s.orDivider}><span>eller</span></div>

              <form onSubmit={handleJoinGroup} className={s.stackForm}>
                <label className={s.fieldWrap}>
                  <span className={s.fieldLabel}>Invite-kode</span>
                  <input className={s.fieldInput} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Fx A3X7K2" maxLength={10} required />
                </label>
                <button type="submit" className={s.ghostBtn}>Join gruppe</button>
              </form>

              <div className={s.orDivider}><span>eller</span></div>

              <div>
                <p className={s.muted} style={{ marginBottom: "0.5rem" }}>Test alle funktioner med færdiglavet demodata — to fiktive gruppemedlemmer, picks og konflikter.</p>
                <button type="button" className={s.ghostBtn} onClick={handleSeed}>Opret testgruppe med demodata</button>
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Køb */}
      {isSignedIn && session.activeGroup && (
        <div className={s.drawerSection}>
          <p className={s.sectionTag}>Køb</p>

          {session.activeGroup.purchases.length > 0 && (
            <div className={s.purchaseList}>
              {session.activeGroup.purchases.map((purchase) => {
                const perfDate = purchase.performance_start
                  ? fmtEdinburgh(purchase.performance_start, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                  : null;
                return (
                  <div key={purchase.id} className={s.purchaseCard}>
                    <div className={s.purchaseTop}>
                      <div>
                        <p className={s.purchaseTitle}>{purchase.show_title}</p>
                        <p className={s.purchaseMeta}>
                          {purchase.buyer_user_name}{perfDate ? ` · ${perfDate}` : ""}
                        </p>
                        {purchase.notes && <p className={s.purchaseMeta}>{purchase.notes}</p>}
                      </div>
                      {purchase.total_cost && (
                        <span className={s.purchaseCost}>£{parseFloat(purchase.total_cost).toFixed(2)}</span>
                      )}
                    </div>
                    {purchase.covers.length > 0 && (
                      <div className={s.coverList}>
                        {purchase.covers.map((cover) => (
                          <span
                            key={cover.covered_user_id}
                            className={`${s.coverChip} ${cover.settled ? s.coverChipSettled : ""}`}
                          >
                            <span className={cover.covered_user_id === session.user?.id ? s.coverIsSelf : ""}>
                              {cover.covered_user_name}
                            </span>
                            {cover.settled ? (
                              <button className={s.settleBtn} onClick={() => handleSettle(purchase.id, cover.covered_user_id, false)} title="Fortryd">✓</button>
                            ) : (
                              <button className={s.settleBtn} onClick={() => handleSettle(purchase.id, cover.covered_user_id, true)} title="Marker som betalt">○</button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {purchaseForm ? (
            <form onSubmit={handleLogPurchase} className={`${s.stackForm} ${s.purchaseFormWrap}`}>
              <label className={s.fieldWrap}>
                <span className={s.fieldLabel}>Show</span>
                <select
                  className={s.fieldSelect}
                  value={purchaseForm.showId}
                  onChange={(e) => {
                    const show = shows.find((sh) => sh.id === e.target.value);
                    const firstPerf = show?.performances[0];
                    setPurchaseForm((f) => f && ({
                      ...f,
                      showId: e.target.value,
                      perfStart: firstPerf?.start ?? "",
                      perfId: firstPerf?.start ?? "",
                    }));
                  }}
                  required
                >
                  <option value="">Vælg show…</option>
                  {shows
                    .filter((sh) => session.activeGroup!.picks.some((p) => p.show_id === sh.id))
                    .map((sh) => (
                      <option key={sh.id} value={sh.id}>{sh.title}</option>
                    ))}
                </select>
              </label>

              {purchaseForm.showId && (() => {
                const show = shows.find((sh) => sh.id === purchaseForm.showId);
                return show && show.performances.length > 0 ? (
                  <label className={s.fieldWrap}>
                    <span className={s.fieldLabel}>Forestilling</span>
                    <select
                      className={s.fieldSelect}
                      value={purchaseForm.perfStart}
                      onChange={(e) => {
                        setPurchaseForm((f) => f && ({ ...f, perfStart: e.target.value, perfId: e.target.value }));
                      }}
                      required
                    >
                      <option value="">Vælg…</option>
                      {show.performances.map((p) => {
                        const { dateStr, timeStr, meta } = formatPerf(p);
                        return (
                          <option key={p.start} value={p.start}>
                            {dateStr} {timeStr}{meta ? ` · ${meta}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                ) : null;
              })()}

              <label className={s.fieldWrap}>
                <span className={s.fieldLabel}>Pris (£)</span>
                <input type="number" step="0.01" min="0" className={s.fieldInput} value={purchaseForm.cost} onChange={(e) => setPurchaseForm((f) => f && ({ ...f, cost: e.target.value }))} placeholder="Fx 47.50" />
              </label>

              <div className={s.fieldWrap}>
                <span className={s.fieldLabel}>Betalte for</span>
                <div className={s.checkList}>
                  {session.activeGroup.members.map((m) => (
                    <label key={m.id} className={s.checkRow}>
                      <input
                        type="checkbox"
                        checked={purchaseForm.covered.includes(m.id)}
                        onChange={(e) => setPurchaseForm((f) => f && ({
                          ...f,
                          covered: e.target.checked
                            ? [...f.covered, m.id]
                            : f.covered.filter((id) => id !== m.id),
                        }))}
                      />
                      {m.name}{m.id === session.user?.id ? " (dig)" : ""}
                    </label>
                  ))}
                </div>
              </div>

              <label className={s.fieldWrap}>
                <span className={s.fieldLabel}>Note</span>
                <input className={s.fieldInput} value={purchaseForm.notes} onChange={(e) => setPurchaseForm((f) => f && ({ ...f, notes: e.target.value }))} placeholder="Fx booking-gebyr" maxLength={200} />
              </label>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="submit" className={s.primaryBtn}>Gem</button>
                <button type="button" className={s.ghostBtn} onClick={() => setPurchaseForm(null)}>Annuller</button>
              </div>
            </form>
          ) : (
            <button
              className={s.ghostBtn}
              style={{ marginTop: session.activeGroup.purchases.length > 0 ? "0.75rem" : "0" }}
              onClick={() => setPurchaseForm({ showId: "", perfStart: "", perfId: "", cost: "", notes: "", covered: [session.user!.id] })}
            >
              + Registrér køb
            </button>
          )}
        </div>
      )}
    </>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`${s.page} ${busy ? s.busy : ""}`}>

      {/* ── Header ── */}
      <header className={s.header}>
        <Link href="/" className={s.backLink}>←</Link>
        <div className={s.headerCenter}>
          <span className={s.headerTitle}>Fringe Venneplanner</span>
          {statusMsg && <span className={s.statusMsg}>{statusMsg}</span>}
        </div>
        <div className={s.headerActions}>
          <button className={s.iconBtn} onClick={() => run(fetchSession)} aria-label="Opdatér" title="Opdatér">↻</button>
          <button
            className={`${s.iconBtn} ${drawerOpen ? s.iconBtnActive : ""} ${s.desktopOnly}`}
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Profil og gruppe"
          >
            {session.activeGroup ? "●" : "○"}
          </button>
        </div>
      </header>

      {/* ── Drawer overlay (desktop only) ── */}
      {drawerOpen && <div className={`${s.drawerOverlay} ${s.desktopOnly}`} onClick={() => setDrawerOpen(false)} />}

      {/* ── Drawer (desktop only) ── */}
      <aside className={`${s.drawer} ${drawerOpen ? s.drawerOpen : ""} ${s.desktopOnly}`}>
        <div className={s.drawerHeader}>
          <span className={s.drawerTitle}>Profil & Gruppe</span>
          <button className={s.iconBtn} onClick={() => setDrawerOpen(false)} aria-label="Luk">✕</button>
        </div>
        {gruppeContent}
      </aside>

      {/* ══════════════════ TAB PANEL: PLAN ══════════════════ */}
      <div
        ref={tabRefPlan}
        style={isMobile ? { display: activeTab === "plan" ? "block" : "none" } : undefined}
      >
        {/* ── Stats ── */}
        <div className={s.statsStrip}>
          {[
            { label: "Du",        value: session.user?.name ?? "Gæst" },
            { label: "Gruppe",    value: session.activeGroup?.name ?? "—" },
            { label: "I planen",  value: tCount },
            { label: "Programme", value: shows.length },
          ].map(({ label, value }) => (
            <div key={label} className={s.statCard}>
              <span className={s.statLabel}>{label}</span>
              <span className={s.statValue}>{String(value)}</span>
            </div>
          ))}
        </div>

      {/* ── Timeline ── */}
      <section className={s.section}>
        <p className={s.sectionTag}>Jeres plan</p>

        {tGroups.length === 0 ? (
          <div className={s.empty}>
            {!session.activeGroup
              ? "Log ind og opret en gruppe for at bygge jeres plan."
              : (dateFrom || dateTo)
              ? "Ingen forestillinger i det valgte datointerval — justér datofilteret for at se resten af planen."
              : "Marker shows som 'Skal med' eller 'Har billet' og vælg en forestilling — de dukker op her."}
          </div>
        ) : (
          tGroups.map(([day, items]) => (
            <div key={day} className={s.dayBlock}>
              <div className={s.dayHeader}>
                <span className={s.dayTag}>Dag</span>
                <h3 className={s.dayTitle}>{day}</h3>
              </div>
              {items.map(({ show, picks }) => {
                const repPick = picks[0];
                const isInterested = repPick.status === "interested";
                const timeStr = repPick.performance_start
                  ? fmtEdinburgh(repPick.performance_start, { hour: "2-digit", minute: "2-digit" })
                  : "TBA";

                // Feature 3: collect per-pick conflicts; determine card-level severity
                const pickConflicts = picks.map((p) => ({
                  pick: p,
                  entries: p.performance_start
                    ? (conflicts.get(conflictKey(p.user_id, p.show_id, p.performance_start)) ?? [])
                    : [],
                }));
                const hasHard = pickConflicts.some((pc) => pc.entries.some((e) => e.level === "hard"));
                const hasSoft = pickConflicts.some((pc) => pc.entries.some((e) => e.level === "soft"));

                // Timeline actions: build a Performance from pick data + find my pick in this card
                const cardPerf: Performance = {
                  start: repPick.performance_start!,
                  end: repPick.performance_end ?? repPick.performance_start!,
                };
                const myPickInCard = session.user
                  ? picks.find((p) => p.user_id === session.user!.id)
                  : undefined;
                return (
                  <article
                    key={`${show.id}::${repPick.performance_start}`}
                    className={[
                      s.showCard,
                      isInterested ? s.timelineCardInterested : "",
                      hasHard ? s.hasConflictHard : hasSoft ? s.hasConflictSoft : "",
                    ].join(" ")}
                  >
                    {/* Top row: identical to show cards — info left, status buttons right */}
                    <div className={s.showTop}>
                      <div className={s.showInfo}>
                        <h3 className={s.showTitle}>{show.title}</h3>
                        <p className={s.showMeta}>
                          {[timeStr, show.genre, show.venue.name].filter(Boolean).join(" · ")}
                        </p>
                        {show.website && (
                          <a href={show.website} target="_blank" rel="noopener noreferrer" className={s.ticketLink}>
                            Billetter ↗
                          </a>
                        )}
                      </div>
                      {canPick && (
                        <div className={s.statusGrid}>
                          {STATUSES.map((status) => {
                            const meta = STATUS_META[status];
                            const isActive = myPickInCard?.status === status;
                            return (
                              <button
                                key={status}
                                className={`${s.statusBtn} ${meta.btnCls} ${isActive ? s.statusBtnActive : ""}`}
                                onClick={() => handleStatusClickForPerf(show, cardPerf, status)}
                                title={meta.label}
                              >
                                {meta.emoji}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Bottom: conflict badges + pick tags + single Tag med */}
                    <div className={s.showBottom}>
                      {pickConflicts.map(({ pick, entries }) =>
                        entries.length > 0 ? (
                          <div
                            key={pick.user_id}
                            className={`${s.conflictBadge} ${entries[0].level === "hard" ? s.conflictHard : s.conflictSoft}`}
                            title={entries.map((e) => {
                              const t = fmtEdinburgh(e.otherPerfStart, { hour: "2-digit", minute: "2-digit" });
                              return `${e.otherShowTitle} (${t})`;
                            }).join(", ")}
                          >
                            {entries[0].level === "hard" ? "⚠" : "⚡"}{" "}
                            {pick.user_name}:{" "}
                            {entries.length === 1
                              ? `overlapper med "${entries[0].otherShowTitle}"`
                              : `${entries.length} overlap`}
                          </div>
                        ) : null
                      )}
                      <div className={s.pickTags}>
                        {/* Own pick first, then friends */}
                        {[...picks]
                          .sort((a, b) =>
                            a.user_id === session.user?.id ? -1 :
                            b.user_id === session.user?.id ?  1 : 0
                          )
                          .map((p) => (
                            <span key={p.user_id} className={`${s.tag} ${STATUS_META[p.status].cls}`}>
                              {STATUS_META[p.status].emoji} {p.user_name}: {STATUS_META[p.status].label}
                            </span>
                          ))}
                      </div>
                      {/* Single Tag med per card — all picks share the same performance */}
                      {canPick &&
                        picks.some((p) =>
                          p.user_id !== session.user?.id &&
                          (p.status === "going" || p.status === "has_ticket")
                        ) &&
                        myPickInCard?.status !== "going" &&
                        myPickInCard?.status !== "has_ticket" && (
                          <button
                            className={s.quickJoinBtn}
                            style={{ marginTop: "0.35rem" }}
                            onClick={() => handleQuickJoin(show, cardPerf)}
                            title={`Tag med til ${fmtEdinburgh(cardPerf.start, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                          >
                            + Tag med
                          </button>
                        )}
                    </div>
                  </article>
                );
              })}
            </div>
          ))
        )}
      </section>
      </div>{/* end Plan tab panel */}

      {/* ══════════════════ TAB PANEL: SHOWS ══════════════════ */}
      <div
        ref={tabRefShows}
        style={isMobile ? { display: activeTab === "shows" ? "block" : "none" } : undefined}
      >
      {/* ── Shows list ── */}
      <section className={s.section}>
        <div className={s.sectionHeader}>
          <p className={s.sectionTag}>Programme · {shows.length} shows</p>
        </div>

        <div className={s.filterBar}>
          {/* Search */}
          <input
            type="search"
            className={s.searchInput}
            placeholder="Søg…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); saveUi({ search: e.target.value }); }}
          />

          {/* Genre chips row */}
          {genres.length > 0 && (
            <div className={s.filterDimension}>
              <span className={s.filterDimLabel}>Genre</span>
              <div className={s.filterChipScroll}>
                {genres.map((g) => (
                  <button
                    key={g}
                    className={`${s.filterChip} ${genreFilter.includes(g) ? s.active : ""}`}
                    onClick={() => {
                      const next = genreFilter.includes(g)
                        ? genreFilter.filter((x) => x !== g)
                        : [...genreFilter, g];
                      setGenreFilter(next);
                      saveUi({ genreFilter: next });
                    }}
                  >
                    {g}
                  </button>
                ))}
                {genreFilter.length > 0 && (
                  <button
                    className={s.filterChipClear}
                    onClick={() => { setGenreFilter([]); saveUi({ genreFilter: [] }); }}
                  >
                    Ryd
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Area chips row */}
          {areas.length > 1 && (
            <div className={s.filterDimension}>
              <span className={s.filterDimLabel}>Område</span>
              <div className={s.filterChipScroll}>
                {areas.map((area) => (
                  <button
                    key={area}
                    className={`${s.filterChip} ${areaFilter.includes(area) ? s.active : ""}`}
                    onClick={() => {
                      const next = areaFilter.includes(area)
                        ? areaFilter.filter((a) => a !== area)
                        : [...areaFilter, area];
                      setAreaFilter(next);
                      saveUi({ areaFilter: next });
                    }}
                  >
                    {AREA_LABELS[area]}
                  </button>
                ))}
                {areaFilter.length > 0 && (
                  <button
                    className={s.filterChipClear}
                    onClick={() => { setAreaFilter([]); saveUi({ areaFilter: [] }); }}
                  >
                    Ryd
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Date day strip */}
          {(() => {
            const days = allDays();
            if (!days.length) return null;
            return (
              <div className={s.filterDimension}>
                <span className={s.filterDimLabel}>Dato</span>
                <div className={s.filterChipScroll} ref={dayStripRef}>
                  {days.map((day, i) => {
                    const isEndpoint = day === dateFrom || day === dateTo;
                    const isInRange  = !!(dateFrom && dateTo && dateFrom !== dateTo && day > dateFrom && day < dateTo);
                    const date    = new Date(day + "T12:00:00Z");
                    const prevDate = i > 0 ? new Date(days[i - 1] + "T12:00:00Z") : null;
                    const monthChanged = prevDate != null && date.getUTCMonth() !== prevDate.getUTCMonth();
                    const weekday  = date.toLocaleDateString("da-DK", { weekday: "short", timeZone: "UTC" });
                    const dayNum   = date.toLocaleDateString("da-DK", { day: "numeric",   timeZone: "UTC" });
                    const monthLbl = date.toLocaleDateString("da-DK", { month: "short",    timeZone: "UTC" });
                    const ariaLbl  = date.toLocaleDateString("da-DK", {
                      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
                    });
                    return (
                      <span key={day} style={{ display: "contents" }}>
                        {monthChanged && (
                          <span className={s.dayMonthSep} aria-hidden="true">
                            {monthLbl.toUpperCase()}
                          </span>
                        )}
                        <button
                          className={`${s.dayChip} ${isEndpoint ? s.dayChipSelected : isInRange ? s.dayChipInRange : ""}`}
                          onClick={() => handleDayChipClick(day)}
                          aria-pressed={isEndpoint || isInRange}
                          aria-label={ariaLbl}
                          data-day={day}
                        >
                          <span className={s.dayChipDay}>{weekday}</span>
                          <span className={s.dayChipNum}>{dayNum}</span>
                        </button>
                      </span>
                    );
                  })}
                  {(dateFrom || dateTo) && (
                    <button
                      className={s.filterChipClear}
                      onClick={() => { setDateFrom(""); setDateTo(""); saveUi({ dateFrom: "", dateTo: "" }); }}
                    >
                      Ryd
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          <label className={s.toggleRow}>
            <input type="checkbox" checked={selectedOnly} onChange={(e) => { setSelectedOnly(e.target.checked); saveUi({ selectedOnly: e.target.checked }); }} />
            <span>Kun mine</span>
          </label>
          <label className={s.toggleRow}>
            <input type="checkbox" checked={hideInterested} onChange={(e) => setHideInterested(e.target.checked)} />
            <span>Kun besluttet</span>
          </label>
        </div>

        {!session.activeGroup && (
          <p className={s.hint}>
            {session.user ? "Opret eller join en gruppe for at markere shows →" : "Log ind for at markere shows →"}
            <button
              className={s.hintBtn}
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth < 768) {
                  switchTab("gruppe");
                } else {
                  setDrawerOpen(true);
                }
              }}
            >Åbn profil</button>
          </p>
        )}

        {visible.length === 0 ? (
          <div className={s.empty}>Ingen shows matcher filteret.</div>
        ) : (
          <div className={s.showsList}>
            {visible.map((show) => {
              const picks         = picksFor(show.id);
              const mine          = myPick(show.id);
              const isPickerOpen  = perfPicker?.showId === show.id;
              const rangePerfs    = perfsInRange(show);
              const firstPerf     = rangePerfs[0] ?? show.performances[0];
              const metaParts  = [
                show.genre,
                AREA_LABELS[show.venue.area] !== "Andet" ? AREA_LABELS[show.venue.area] : null,
                show.venue.name,
                firstPerf
                  ? fmtEdinburgh(firstPerf.start, { day: "numeric", month: "short" }) +
                    " " + fmtEdinburgh(firstPerf.start, { hour: "2-digit", minute: "2-digit" })
                  : null,
                firstPerf?.priceString ?? (firstPerf?.price != null ? `£${firstPerf.price}` : null),
              ].filter(Boolean);

              return (
                <article key={show.id} className={s.showCard}>
                  <div className={s.showTop}>
                    <div className={s.showInfo}>
                      {show.descriptionTeaser ? (
                        <button
                          className={s.showTitleBtn}
                          onClick={() =>
                            setExpandedShows((prev) => {
                              const next = new Set(prev);
                              next.has(show.id) ? next.delete(show.id) : next.add(show.id);
                              return next;
                            })
                          }
                          aria-expanded={expandedShows.has(show.id)}
                        >
                          <span>{show.title}</span>
                          <span className={s.expandArrow} aria-hidden="true">
                            {expandedShows.has(show.id) ? "▴" : "▾"}
                          </span>
                        </button>
                      ) : (
                        <h3 className={s.showTitle}>{show.title}</h3>
                      )}
                      <p className={s.showMeta}>{metaParts.join(" · ") || "Info mangler"}</p>
                      {show.website && (
                        <a href={show.website} target="_blank" rel="noopener noreferrer" className={s.ticketLink}>
                          Billetter ↗
                        </a>
                      )}
                      {show.descriptionTeaser && expandedShows.has(show.id) && (
                        <p className={s.showDescription}>{show.descriptionTeaser}</p>
                      )}
                    </div>
                    <div className={s.statusGrid}>
                      {STATUSES.map((status) => {
                        const meta = STATUS_META[status];
                        const isActive = mine?.status === status;
                        return (
                          <button
                            key={status}
                            className={`${s.statusBtn} ${meta.btnCls} ${isActive ? s.statusBtnActive : ""}`}
                            onClick={() => handleStatusClick(show, status)}
                            disabled={!canPick}
                            title={meta.label}
                          >
                            {meta.emoji}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Performance picker — only in-range performances */}
                  {isPickerOpen && (
                    <div className={s.perfPicker}>
                      <p className={s.perfPickerLabel}>Hvilken dag?</p>
                      <div className={s.perfList}>
                        {rangePerfs.map((perf) => {
                          const { dateStr, timeStr, meta } = formatPerf(perf);
                          const friends = perfPicksFor(show.id, perf.start);
                          return (
                            <button
                              key={perf.start}
                              className={s.perfItem}
                              onClick={() => handleSelectPerformance(show, perf)}
                            >
                              <div className={s.perfItemMain}>
                                <span>
                                  <span className={s.perfItemTime}>{timeStr}</span>
                                  {" · "}{dateStr}
                                </span>
                                {meta && <span className={s.perfItemMeta}>{meta}</span>}
                              </div>
                              {friends.length > 0 && (
                                <div className={s.perfFriends}>
                                  {friends.map((f) => (
                                    <span key={f.name} className={`${s.perfFriendTag} ${STATUS_META[f.status].cls}`}>
                                      {f.name} {STATUS_META[f.status].label.toLowerCase()}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <button className={`${s.ghostBtn} ${s.perfPickerCancel}`} onClick={() => setPerfPicker(null)}>
                        Annuller
                      </button>
                    </div>
                  )}

                  {/* Picks from group — badge list + one "Tag med" per unique performance */}
                  {picks.length > 0 && (() => {
                    const myCurrentPick = myPick(show.id);
                    const myIsoCommitted =
                      myCurrentPick?.performance_start &&
                      (myCurrentPick.status === "going" || myCurrentPick.status === "has_ticket")
                        ? new Date(myCurrentPick.performance_start).toISOString()
                        : null;

                    // Collect unique committed friend performances I haven't joined yet
                    const joinablePerfs = new Map<string, Performance>();
                    for (const p of picks) {
                      if (
                        p.user_id === session.user?.id ||
                        !(p.status === "going" || p.status === "has_ticket") ||
                        !p.performance_start
                      ) continue;
                      const iso = new Date(p.performance_start).toISOString();
                      if (iso === myIsoCommitted) continue;     // already on this perf
                      if (!joinablePerfs.has(iso)) {
                        joinablePerfs.set(iso, {
                          start: p.performance_start!,
                          end: p.performance_end ?? p.performance_start!,
                        });
                      }
                    }
                    const joinableList = [...joinablePerfs.values()];
                    const multiPerf = joinableList.length > 1;

                    return (
                      <div className={s.showBottom}>
                        <div className={s.pickTags}>
                          {picks.map((p) => (
                            <span key={p.user_id} className={`${s.tag} ${STATUS_META[p.status].cls}`}>
                              {STATUS_META[p.status].emoji} {p.user_name}: {STATUS_META[p.status].label}
                            </span>
                          ))}
                        </div>
                        {canPick && joinableList.length > 0 && (
                          <div className={s.quickJoinRow}>
                            {joinableList.map((perf) => {
                              const label = multiPerf
                                ? `+ Tag med · ${fmtEdinburgh(perf.start, { weekday: "short", hour: "2-digit", minute: "2-digit" })}`
                                : "+ Tag med";
                              return (
                                <button
                                  key={perf.start}
                                  className={s.quickJoinBtn}
                                  onClick={() => handleQuickJoin(show, perf)}
                                  title={`Tag med til ${fmtEdinburgh(perf.start, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </article>
              );
            })}
          </div>
        )}
      </section>
      </div>{/* end Shows tab panel */}

      {/* ══════════════════ TAB PANEL: GRUPPE (mobile only, overrides .gruppePanel) ══════════════════ */}
      <div
        ref={tabRefGruppe}
        className={s.gruppePanel}
        style={isMobile ? { display: activeTab === "gruppe" ? "block" : "none" } : undefined}
      >
        {gruppeContent}
      </div>

      {/* ══════════════════ MOBILE TAB BAR ══════════════════ */}
      <div className={s.tabBar} role="navigation" aria-label="Navigation">
        <button
          className={`${s.tabBarBtn} ${activeTab === "shows" ? s.tabBarBtnActive : ""}`}
          onClick={() => switchTab("shows")}
          aria-label="Shows"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor" stroke="none"/>
            <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1" fill="currentColor" stroke="none"/>
          </svg>
          <span className={s.tabBarLabel}>Shows</span>
        </button>
        <button
          className={`${s.tabBarBtn} ${activeTab === "plan" ? s.tabBarBtnActive : ""}`}
          onClick={() => switchTab("plan")}
          aria-label="Plan"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className={s.tabBarLabel}>Plan</span>
        </button>
        <button
          className={`${s.tabBarBtn} ${activeTab === "gruppe" ? s.tabBarBtnActive : ""}`}
          onClick={() => switchTab("gruppe")}
          aria-label="Gruppe"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span className={s.tabBarLabel}>Gruppe</span>
        </button>
      </div>

      <footer className={`${s.footer} ${s.desktopOnly}`}>
        <span>Edinburgh Fringe Venneplanner · albertdieckmann.dk</span>
        <Link href="/" className={s.footerLink}>← Tilbage</Link>
      </footer>

      {/* ── Feature 2: Ticket buyer dialog ── */}
      {ticketDialog && session.activeGroup && (
        <div className={s.modalOverlay} onClick={() => setTicketDialog(null)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h4 className={s.modalTitle}>Hvem har du billet til?</h4>
              <button className={s.iconBtn} onClick={() => setTicketDialog(null)}>✕</button>
            </div>
            <p className={s.muted} style={{ margin: "0 0 1rem" }}>
              {ticketDialog.show.title}
              {" · "}
              {(() => { const { dateStr, timeStr } = formatPerf(ticketDialog.perf); return `${dateStr} ${timeStr}`; })()}
            </p>
            <div className={s.checkList} style={{ marginBottom: "1rem" }}>
              {session.activeGroup.members.map((m) => (
                <label key={m.id} className={s.checkRow}>
                  <input
                    type="checkbox"
                    checked={ticketDialog.coveredIds.includes(m.id)}
                    onChange={(e) => setTicketDialog((d) => d && ({
                      ...d,
                      coveredIds: e.target.checked
                        ? [...d.coveredIds, m.id]
                        : d.coveredIds.filter((id) => id !== m.id),
                    }))}
                  />
                  {m.name}{m.id === session.user?.id ? " (dig)" : ""}
                </label>
              ))}
            </div>
            <label className={s.fieldWrap} style={{ marginBottom: "1rem" }}>
              <span className={s.fieldLabel}>Pris (£) — valgfri</span>
              <input
                type="number" step="0.01" min="0"
                className={s.fieldInput}
                value={ticketDialog.cost}
                onChange={(e) => setTicketDialog((d) => d && ({ ...d, cost: e.target.value }))}
                placeholder={ticketDialog.perf.price != null ? `${ticketDialog.perf.price}` : "Fx 22.50"}
              />
            </label>
            <div className={s.modalActions}>
              <button
                className={s.primaryBtn}
                disabled={ticketDialog.coveredIds.length === 0}
                onClick={handleConfirmTickets}
              >
                Bekræft {ticketDialog.coveredIds.length > 0 ? `(${ticketDialog.coveredIds.length})` : ""}
              </button>
              <button className={s.ghostBtn} onClick={() => setTicketDialog(null)}>Annuller</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feature 5: Quick-join confirmation dialog ── */}
      {joinConfirm && (
        <div className={s.modalOverlay} onClick={() => setJoinConfirm(null)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h4 className={s.modalTitle}>Flyt din forestilling?</h4>
              <button className={s.iconBtn} onClick={() => setJoinConfirm(null)}>✕</button>
            </div>
            <p className={s.muted} style={{ margin: "0 0 0.5rem" }}>
              Du har valgt{" "}
              {fmtEdinburgh(joinConfirm.currentPerfStart!, {
                weekday: "short", day: "numeric", month: "short",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
            <p className={s.muted} style={{ margin: "0 0 1.25rem" }}>
              Vil du flytte til{" "}
              {fmtEdinburgh(joinConfirm.perf.start, {
                weekday: "short", day: "numeric", month: "short",
                hour: "2-digit", minute: "2-digit",
              })}?
            </p>
            <div className={s.modalActions}>
              <button className={s.primaryBtn} onClick={handleConfirmJoin}>Ja, flyt</button>
              <button className={s.ghostBtn} onClick={() => setJoinConfirm(null)}>Behold min nuværende</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
