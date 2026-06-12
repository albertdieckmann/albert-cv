"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { AREA_ORDER, type Area } from "@/lib/fringe-area";
import s from "./fringe.module.css";
import {
  loadUi, saveUi, api, fmtEdinburgh, PAGE_SIZE, toComparableIso,
} from "./utils";
import type {
  PickStatus, Performance, Show, FringePick, Purchase, ActiveGroup,
  SessionData, TabId, PurchaseForm, ConflictEntry,
} from "./types";
import { computeConflicts } from "./utils";
import { GruppeContent } from "./GruppeContent";
import { PlanTab } from "./PlanTab";
import { ShowsTab } from "./ShowsTab";
import { TicketDialog, JoinConfirmDialog } from "./Dialogs";

// ─── Component ────────────────────────────────────────────────────────────────

export default function FringePage() {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const openSignIn = () => router.push("/fringe/sign-in");

  const [shows,        setShows]        = useState<Show[]>([]);
  const [session,      setSession]      = useState<SessionData>({ user: null, groups: [], activeGroup: null });
  const [search,       setSearch]       = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [genreFilter,  setGenreFilter]  = useState<string[]>([]);
  const [areaFilter,   setAreaFilter]   = useState<Area[]>([]);
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [statusMsg,    setStatusMsg]    = useState("");
  const [busy,         setBusy]         = useState(false);
  const [ready,        setReady]        = useState(false);
  const [drawerOpen,   setDrawerOpen]   = useState(false);

  const [perfPicker, setPerfPicker] = useState<{ showId: string; status: "going" | "has_ticket" } | null>(null);

  const [ticketDialog, setTicketDialog] = useState<{
    show: Show;
    perf: Performance;
    coveredIds: string[];
    cost: string;
  } | null>(null);

  const [hideInterested, setHideInterested] = useState(false);

  const [joinConfirm, setJoinConfirm] = useState<{
    show: Show;
    perf: Performance;
    currentPerfStart: string | null;
  } | null>(null);

  const [expandedShows, setExpandedShows] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);


  const [activeTab, setActiveTab] = useState<TabId>("shows");
  const [isMobile,  setIsMobile]  = useState(false);
  const savedScrolls = useRef<Record<TabId, number>>({ shows: 0, plan: 0, gruppe: 0 });

  const dayStripRef      = useRef<HTMLDivElement>(null);
  const dayStripScrolled = useRef(false);

  const activeGroupIdRef = useRef<number | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function flash(msg: string) {
    setStatusMsg(msg);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatusMsg(""), 3500);
  }

  // ── Session ────────────────────────────────────────────────────────────────

  const applyActiveGroup = useCallback((activeGroup: ActiveGroup | null) => {
    setSession((prev) => ({ ...prev, activeGroup }));
    if (activeGroup) {
      activeGroupIdRef.current = activeGroup.id;
      saveUi({ activeGroupId: activeGroup.id });
    }
  }, []);

  const fetchSession = useCallback(async (groupId?: number | null, inlineActiveGroup?: ActiveGroup | null) => {
    if (inlineActiveGroup !== undefined) {
      applyActiveGroup(inlineActiveGroup);
      return;
    }
    const id = groupId !== undefined ? groupId : activeGroupIdRef.current;
    const qs = id ? `?groupId=${id}` : "";
    const pay = await api(`/api/fringe/session${qs}`);
    setSession({ user: pay.user, groups: pay.groups ?? [], activeGroup: pay.activeGroup });
    if (pay.activeGroup) {
      activeGroupIdRef.current = pay.activeGroup.id;
      saveUi({ activeGroupId: pay.activeGroup.id });
    }
  }, [applyActiveGroup]);

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    api("/api/fringe/shows")
      .then((d) => setShows(d.items ?? []))
      .catch(console.error);
  }, []);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, selectedOnly, genreFilter, areaFilter, dateFrom, dateTo]);

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

  useEffect(() => {
    const g = session.activeGroup;
    const hasGroupDates = !!(g?.startDate && g?.endDate);
    if (hasGroupDates) {
      setDateFrom(g!.startDate!.slice(0, 10));
      setDateTo(g!.endDate!.slice(0, 10));
    }
  }, [session.activeGroup?.id, session.activeGroup?.startDate, session.activeGroup?.endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupDateLocked = !!(session.activeGroup?.startDate && session.activeGroup?.endDate);

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

  useEffect(() => {
    const saved = savedScrolls.current[activeTab];
    requestAnimationFrame(() => { window.scrollTo(0, saved); });
  }, [activeTab]);

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

  async function handleCreateGroup(e: React.FormEvent, name: string, startDate: string, endDate: string, reset: () => void) {
    e.preventDefault();
    await run(async () => {
      const pay = await api("/api/fringe/groups", {
        method: "POST",
        body: JSON.stringify({ name, startDate: startDate || null, endDate: endDate || null }),
      });
      reset();
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

  async function handleJoinGroup(e: React.FormEvent, code: string, reset: () => void) {
    e.preventDefault();
    await run(async () => {
      await api("/api/fringe/invites/accept", { method: "POST", body: JSON.stringify({ code }) });
      reset();
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
    setDateFrom(""); setDateTo("");
    saveUi({ dateFrom: "", dateTo: "" });
    await run(() => fetchSession(id));
  }

  function handleDayChipClick(day: string) {
    let newFrom: string, newTo: string;
    if (!dateFrom && !dateTo) {
      newFrom = day; newTo = day;
    } else if (dateFrom === dateTo) {
      if (day === dateFrom) { newFrom = ""; newTo = ""; }
      else if (day > dateFrom) { newFrom = dateFrom; newTo = day; }
      else { newFrom = day; newTo = dateFrom; }
    } else {
      newFrom = day; newTo = day;
    }
    setDateFrom(newFrom); setDateTo(newTo);
    saveUi({ dateFrom: newFrom, dateTo: newTo });
  }

  async function handleSaveGroupSettings(e: React.FormEvent, editGroupName: string, editStartDate: string, editEndDate: string) {
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

  // ── Pick handlers ──────────────────────────────────────────────────────────

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
        const r = await api("/api/fringe/picks", {
          method: "POST",
          body: JSON.stringify({ groupId: session.activeGroup!.id, showId: show.id, showTitle: show.title, status: null }),
        });
        await fetchSession(null, r.activeGroup);
      });
      return;
    }

    if (status === "interested") {
      run(async () => {
        const r = await api("/api/fringe/picks", {
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
        await fetchSession(null, r.activeGroup);
      });
      return;
    }

    const rangePerfs = perfsInRange(show);
    if (rangePerfs.length === 1) {
      const perf = rangePerfs[0];
      if (status === "has_ticket") {
        openTicketDialog(show, perf);
      } else {
        run(async () => {
          const r = await api("/api/fringe/picks", {
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
          await fetchSession(null, r.activeGroup);
        });
      }
    } else {
      setPerfPicker({ showId: show.id, status });
    }
  }

  function openTicketDialog(show: Show, perf: Performance) {
    const members = session.activeGroup?.members ?? [];
    setTicketDialog({
      show,
      perf,
      coveredIds: session.user ? [session.user.id] : members.map((m) => m.id),
      cost: perf.priceString ? "" : perf.price != null ? String(perf.price) : "",
    });
  }

  async function handleSelectPerformance(show: Show, perf: Performance) {
    if (!perfPicker || !session.activeGroup) return;
    const { status } = perfPicker;
    setPerfPicker(null);

    if (status === "has_ticket") {
      openTicketDialog(show, perf);
      return;
    }

    await run(async () => {
      const r = await api("/api/fringe/picks", {
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
      await fetchSession(null, r.activeGroup);
    });
  }

  async function handleConfirmTickets() {
    if (!ticketDialog || !session.activeGroup) return;
    const { show, perf, coveredIds, cost } = ticketDialog;
    setTicketDialog(null);
    await run(async () => {
      const r = await api("/api/fringe/purchases", {
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
      await fetchSession(null, r.activeGroup);
      flash("Billetter registreret — picks opdateret.");
    });
  }

  function handleQuickJoin(show: Show, targetPerf: Performance) {
    if (!session.user || !session.activeGroup) return;
    const mine = myPick(show.id);
    const samePerf = mine?.performance_start &&
      toComparableIso(mine.performance_start) === toComparableIso(targetPerf.start);

    if (samePerf) {
      if (mine?.status === "interested") {
        run(async () => {
          const r = await api("/api/fringe/picks", {
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
          await fetchSession(null, r.activeGroup);
        });
      }
      return;
    }

    if (mine && mine.performance_start) {
      setJoinConfirm({ show, perf: targetPerf, currentPerfStart: mine.performance_start });
      return;
    }

    run(async () => {
      const r = await api("/api/fringe/picks", {
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
      await fetchSession(null, r.activeGroup);
    });
  }

  async function handleConfirmJoin() {
    if (!joinConfirm || !session.activeGroup) return;
    const { show, perf } = joinConfirm;
    setJoinConfirm(null);
    await run(async () => {
      const r = await api("/api/fringe/picks", {
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
      await fetchSession(null, r.activeGroup);
      flash("Moved to friend's performance.");
    });
  }

  // ── Purchase handlers ──────────────────────────────────────────────────────

  async function handleLogPurchase(e: React.FormEvent, purchaseForm: PurchaseForm, closePurchaseForm: () => void) {
    e.preventDefault();
    if (!session.activeGroup) return;
    const form = purchaseForm;
    closePurchaseForm();
    await run(async () => {
      if (form.editId) {
        const r = await api(`/api/fringe/purchases/${form.editId}`, {
          method: "PATCH",
          body: JSON.stringify({ totalCost: form.cost || null, notes: form.notes || null, coveredUserIds: form.covered }),
        });
        await fetchSession(null, r.activeGroup);
        flash("Køb opdateret.");
      } else {
        const show = shows.find((s) => s.id === form.showId);
        const r = await api("/api/fringe/purchases", {
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
        await fetchSession(null, r.activeGroup);
        flash("Køb registreret.");
      }
    });
  }

  function handleEditPurchase(purchase: Purchase): PurchaseForm {
    return {
      editId: purchase.id,
      showId: purchase.show_id,
      perfStart: purchase.performance_start ?? "",
      perfId: purchase.performance_id ?? "",
      cost: purchase.total_cost ?? "",
      notes: purchase.notes ?? "",
      covered: purchase.covers.map((c) => c.covered_user_id),
    };
  }

  async function handleDeletePurchase(id: number, title: string) {
    if (!confirm(`Slet købet af "${title}"?`)) return;
    await run(async () => {
      const r = await api(`/api/fringe/purchases/${id}`, { method: "DELETE" });
      await fetchSession(null, r.activeGroup);
      flash("Køb slettet.");
    });
  }

  async function handleSettle(purchaseId: number, coveredUserId: string, settled: boolean) {
    await run(async () => {
      const r = await api(`/api/fringe/purchases/${purchaseId}/settle`, {
        method: "POST",
        body: JSON.stringify({ coveredUserId, settled }),
      });
      await fetchSession(null, r.activeGroup);
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

  function perfPicksFor(showId: string, perfStart: string): { name: string; status: PickStatus }[] {
    return (session.activeGroup?.picks ?? [])
      .filter((p) =>
        p.show_id === showId &&
        p.performance_start &&
        toComparableIso(p.performance_start) === toComparableIso(perfStart)
      )
      .map((p) => ({ name: p.user_name, status: p.status }));
  }

  function allGenres(): string[] {
    const seen = new Set<string>();
    for (const show of shows) { if (show.genre) seen.add(show.genre); }
    return [...seen].sort();
  }

  function allAreas(): Area[] {
    const seen = new Set<Area>();
    for (const show of shows) seen.add(show.venue.area);
    return AREA_ORDER.filter((a) => seen.has(a));
  }

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
    const cur = new Date(from + "T12:00:00Z");
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

  function planGroups(): [string, { show: Show; picks: FringePick[] }[]][] {
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

  if (!isSignedIn) {
    return (
      <div className={s.page}>
        <header className={s.header}>
          <div className={s.headerCenter}>
            <span className={s.headerTitle}>Fringe Venneplanner</span>
          </div>
          <div className={s.headerActions} />
        </header>
        <div className={s.authWall}>
          <p className={s.authWallTitle}>Edinburgh Fringe Venneplanner</p>
          <p className={s.muted}>Log ind for at se programmet og planlægge med venner.</p>
          <button className={s.primaryBtn} onClick={() => openSignIn()}>
            Log ind eller opret profil
          </button>
        </div>
      </div>
    );
  }

  const canPick         = !!(session.user && session.activeGroup);
  const isGroupOwner    = session.activeGroup?.members.find((m) => m.id === session.user?.id)?.role === "owner";
  const allVisible  = visibleShows();
  const visible     = allVisible.slice(0, visibleCount);
  const hasMore     = visibleCount < allVisible.length;
  const pGroups     = planGroups();
  const conflicts   = computeConflicts(session.activeGroup?.picks ?? []);
  const tCount      = pGroups.flatMap(([, items]) => items).length;
  const genres      = allGenres();
  const areas       = allAreas();
  const days        = allDays();

  const gruppeProps = {
    session, isSignedIn: !!isSignedIn, isGroupOwner: !!isGroupOwner, shows,
    clerkUserName: clerkUser?.fullName ?? clerkUser?.firstName ?? null,
    clerkUserEmail: clerkUser?.primaryEmailAddress?.emailAddress ?? null,
    handleSaveGroupSettings, handleCreateGroup, handleJoinGroup,
    handleCreateInvite, handleCopyInvite, handleLeaveGroup, handleDeleteGroup, handleSwitchGroup,
    handleLogPurchase, handleEditPurchase, handleDeletePurchase, handleSettle,
    openSignIn, setDrawerOpen, signOut, fmtEdinburgh,
  };

  return (
    <div className={`${s.page} ${busy ? s.busy : ""}`}>

      {/* Header */}
      <header className={s.header}>
        <div className={s.headerCenter}>
          <span className={s.headerTitle}>Fringe Venneplanner</span>
          {statusMsg && <span className={s.statusMsg}>{statusMsg}</span>}
        </div>
        <div className={s.headerActions}>
          <button className={s.iconBtn} onClick={() => run(fetchSession)} aria-label="Opdatér" title="Opdatér">↻</button>
          {isSignedIn && (
            <button
              className={`${s.userChip} ${drawerOpen ? s.userChipActive : ""} ${s.desktopOnly}`}
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label="Profil og gruppe"
              title={session.user?.email ?? clerkUser?.primaryEmailAddress?.emailAddress ?? ""}
            >
              {(session.user?.name ?? clerkUser?.fullName ?? clerkUser?.firstName ?? "…").split(" ")[0]}
            </button>
          )}
          {!isSignedIn && (
            <button
              className={`${s.iconBtn} ${drawerOpen ? s.iconBtnActive : ""} ${s.desktopOnly}`}
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label="Profil og gruppe"
            >
              ○
            </button>
          )}
        </div>
      </header>

      {/* Drawer overlay (desktop only) */}
      {drawerOpen && <div className={`${s.drawerOverlay} ${s.desktopOnly}`} onClick={() => setDrawerOpen(false)} />}

      {/* Drawer (desktop only) */}
      <aside className={`${s.drawer} ${drawerOpen ? s.drawerOpen : ""} ${s.desktopOnly}`}>
        <div className={s.drawerHeader}>
          <span className={s.drawerTitle}>Profil & Gruppe</span>
          <button className={s.iconBtn} onClick={() => setDrawerOpen(false)} aria-label="Luk">✕</button>
        </div>
        <GruppeContent {...gruppeProps} />
      </aside>

      {/* Tab panel: Plan */}
      <PlanTab
        session={session}
        shows={shows}
        pGroups={pGroups}
        conflicts={conflicts}
        tCount={tCount}
        dateFrom={dateFrom}
        dateTo={dateTo}
        canPick={canPick}
        isMobile={isMobile}
        activeTab={activeTab}
        perfPicker={perfPicker}
        setPerfPicker={setPerfPicker}
        expandedShows={expandedShows}
        setExpandedShows={setExpandedShows}
        perfsInRange={perfsInRange}
        perfPicksFor={perfPicksFor}
        handleStatusClick={handleStatusClick}
        handleSelectPerformance={handleSelectPerformance}
        handleQuickJoin={handleQuickJoin}
      />

      {/* Tab panel: Shows */}
      <ShowsTab
        session={session}
        shows={shows}
        visible={visible}
        allVisible={allVisible}
        hasMore={hasMore}
        visibleCount={visibleCount}
        setVisibleCount={setVisibleCount}
        search={search} setSearch={setSearch}
        selectedOnly={selectedOnly} setSelectedOnly={setSelectedOnly}
        hideInterested={hideInterested} setHideInterested={setHideInterested}
        genreFilter={genreFilter} setGenreFilter={setGenreFilter}
        areaFilter={areaFilter} setAreaFilter={setAreaFilter}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        groupDateLocked={groupDateLocked}
        groupStart={session.activeGroup?.startDate?.slice(0, 10) ?? ""}
        groupEnd={session.activeGroup?.endDate?.slice(0, 10) ?? ""}
        genres={genres}
        areas={areas}
        allDays={days}
        dayStripRef={dayStripRef}
        myPick={myPick}
        picksFor={picksFor}
        perfPicksFor={perfPicksFor}
        perfsInRange={perfsInRange}
        canPick={canPick}
        perfPicker={perfPicker}
        setPerfPicker={setPerfPicker}
        expandedShows={expandedShows}
        setExpandedShows={setExpandedShows}
        isMobile={isMobile}
        activeTab={activeTab}
        handleStatusClick={handleStatusClick}
        handleSelectPerformance={handleSelectPerformance}
        handleQuickJoin={handleQuickJoin}
        handleDayChipClick={handleDayChipClick}
        switchTab={switchTab}
        setDrawerOpen={setDrawerOpen}
      />

      {/* Tab panel: Gruppe (mobile only) */}
      <div
        className={s.gruppePanel}
        style={isMobile ? { display: activeTab === "gruppe" ? "block" : "none" } : undefined}
      >
        <GruppeContent {...gruppeProps} />
      </div>

      {/* Mobile tab bar */}
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

      <TicketDialog
        ticketDialog={ticketDialog}
        setTicketDialog={setTicketDialog}
        session={session}
        handleConfirmTickets={handleConfirmTickets}
      />

      <JoinConfirmDialog
        joinConfirm={joinConfirm}
        setJoinConfirm={setJoinConfirm}
        handleConfirmJoin={handleConfirmJoin}
      />
    </div>
  );
}
