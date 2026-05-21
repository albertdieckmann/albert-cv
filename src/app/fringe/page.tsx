"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import s from "./fringe.module.css";

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
  venue: { name: string; address?: string; lat?: number; lon?: number };
  performances: Performance[];
  imageUrl?: string;
};

type FringePick = {
  user_id: string;
  user_name: string;
  show_id: string;
  show_title: string;
  status: PickStatus;
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
  performance_start: string | null;
  total_cost: string | null;
  notes: string | null;
  purchased_at: string;
  covers: PurchaseCover[];
};

type Member = { id: string; name: string; role: string };
type Group  = { id: number; name: string };
type ActiveGroup = {
  id: number;
  name: string;
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

const STATUS_META: Record<PickStatus, { label: string; emoji: string; cls: string; btnCls: string }> = {
  interested: { label: "Interesseret", emoji: "◎", cls: s.tagInterested, btnCls: s.statusBtnInterested },
  going:      { label: "Går",          emoji: "★", cls: s.tagGoing,      btnCls: s.statusBtnGoing      },
  has_ticket: { label: "Har billet",   emoji: "✓", cls: s.tagTicket,     btnCls: s.statusBtnTicket     },
};

const STATUSES: PickStatus[] = ["interested", "going", "has_ticket"];

const UI_KEY = "fringe-planner-ui-v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadUi() {
  if (typeof window === "undefined") {
    return { search: "", selectedOnly: false, genreFilter: null as string | null, activeGroupId: null as number | null };
  }
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY) ?? "{}");
    return {
      search:        typeof raw.search === "string" ? raw.search : "",
      selectedOnly:  Boolean(raw.selectedOnly),
      genreFilter:   typeof raw.genreFilter === "string" ? raw.genreFilter : null,
      activeGroupId: Number.isInteger(raw.activeGroupId) ? (raw.activeGroupId as number) : null,
    };
  } catch {
    return { search: "", selectedOnly: false, genreFilter: null as string | null, activeGroupId: null as number | null };
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
  const start = new Date(perf.start);
  const dateStr = start.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" });
  const timeStr = start.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  const parts: string[] = [];
  if (perf.durationMinutes) parts.push(`${perf.durationMinutes} min`);
  if (perf.priceString) parts.push(perf.priceString);
  else if (perf.price != null) parts.push(`£${perf.price}`);
  return { dateStr, timeStr, meta: parts.join(" · ") };
}

// ─── Conflict detection ───────────────────────────────────────────────────────

function computeConflicts(picks: FringePick[]): Map<string, string[]> {
  const byUser = new Map<string, FringePick[]>();
  for (const p of picks) {
    if ((p.status === "going" || p.status === "has_ticket") && p.performance_start && p.performance_end) {
      const list = byUser.get(p.user_id) ?? [];
      list.push(p);
      byUser.set(p.user_id, list);
    }
  }

  const result = new Map<string, string[]>();
  for (const [, userPicks] of byUser) {
    const sorted = [...userPicks].sort((a, b) => a.performance_start!.localeCompare(b.performance_start!));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j];
        if (a.performance_start! < b.performance_end! && a.performance_end! > b.performance_start!) {
          for (const showId of [a.show_id, b.show_id]) {
            const names = result.get(showId) ?? [];
            if (!names.includes(a.user_name)) names.push(a.user_name);
            result.set(showId, names);
          }
        }
      }
    }
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FringePage() {
  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn, signOut } = useClerk();

  const [shows,       setShows]       = useState<Show[]>([]);
  const [session,     setSession]     = useState<SessionData>({ user: null, groups: [], activeGroup: null });
  const [search,      setSearch]      = useState("");
  const [selectedOnly,setSelectedOnly]= useState(false);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [groupName,   setGroupName]   = useState("");
  const [inviteCode,  setInviteCode]  = useState("");
  const [statusMsg,   setStatusMsg]   = useState("");
  const [busy,        setBusy]        = useState(false);
  const [ready,       setReady]       = useState(false);
  const [drawerOpen,  setDrawerOpen]  = useState(false);

  // Performance picker: which show + which status are we selecting a performance for
  const [perfPicker, setPerfPicker] = useState<{ showId: string; status: "going" | "has_ticket" } | null>(null);

  // Purchase form state
  const [purchaseForm, setPurchaseForm] = useState<{
    showId: string;
    perfStart: string;
    perfEnd: string;
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
    activeGroupIdRef.current = ui.activeGroupId;
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const ui = loadUi();
    fetchSession(ui.activeGroupId).finally(() => setReady(true));
  }, [isLoaded, isSignedIn, fetchSession]);

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
      const pay = await api("/api/fringe/groups", { method: "POST", body: JSON.stringify({ name: groupName }) });
      setGroupName("");
      await fetchSession(pay.groupId);
      flash("Gruppen er oprettet.");
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
      flash(`Invite-kode oprettet: ${pay.code}`);
    });
  }

  async function handleCopyInvite() {
    const code = session.activeGroup?.invites?.[0]?.code;
    if (!code) { flash("Ingen aktiv invite-kode endnu."); return; }
    try {
      await navigator.clipboard.writeText(code);
      flash(`Koden ${code} er kopieret.`);
    } catch {
      flash(`Koden er: ${code}`);
    }
  }

  async function handleJoinGroup(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      await api("/api/fringe/invites/accept", { method: "POST", body: JSON.stringify({ code: inviteCode }) });
      setInviteCode("");
      await fetchSession();
      flash("Du er tilføjet til gruppen.");
    });
  }

  async function handleLeaveGroup(id: number, name: string) {
    if (!confirm(`Forlad gruppen "${name}"?`)) return;
    await run(async () => {
      await api(`/api/fringe/groups/${id}/leave`, { method: "DELETE" });
      activeGroupIdRef.current = null;
      saveUi({ activeGroupId: null });
      await fetchSession(null);
      flash("Du har forladt gruppen.");
    });
  }

  async function handleDeleteGroup(id: number, name: string) {
    if (!confirm(`Slet gruppen "${name}"? Dette fjerner alle picks og køb i gruppen.`)) return;
    await run(async () => {
      await api(`/api/fringe/groups/${id}`, { method: "DELETE" });
      activeGroupIdRef.current = null;
      saveUi({ activeGroupId: null });
      await fetchSession(null);
      flash("Gruppen er slettet.");
    });
  }

  async function handleSwitchGroup(id: number) {
    activeGroupIdRef.current = id;
    saveUi({ activeGroupId: id });
    await run(() => fetchSession(id));
  }

  // ── Pick handlers ──────────────────────────────────────────────────────────

  function handleStatusClick(show: Show, status: PickStatus) {
    if (!session.activeGroup || !session.user) return;

    const current = myPick(show.id);

    // Toggle off if same status clicked
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

    // "interested" needs no performance selection
    if (status === "interested") {
      run(async () => {
        await api("/api/fringe/picks", {
          method: "POST",
          body: JSON.stringify({
            groupId: session.activeGroup!.id,
            showId: show.id,
            showTitle: show.title,
            status,
            performanceStart: null,
            performanceEnd: null,
          }),
        });
        await fetchSession();
      });
      return;
    }

    // going / has_ticket: if single performance, save immediately; otherwise open picker
    if (show.performances.length === 1) {
      const perf = show.performances[0];
      run(async () => {
        await api("/api/fringe/picks", {
          method: "POST",
          body: JSON.stringify({
            groupId: session.activeGroup!.id,
            showId: show.id,
            showTitle: show.title,
            status,
            performanceStart: perf.start,
            performanceEnd: perf.end,
          }),
        });
        await fetchSession();
      });
    } else {
      setPerfPicker({ showId: show.id, status });
    }
  }

  async function handleSelectPerformance(show: Show, perf: Performance) {
    if (!perfPicker || !session.activeGroup) return;
    const { status } = perfPicker;
    setPerfPicker(null);
    await run(async () => {
      await api("/api/fringe/picks", {
        method: "POST",
        body: JSON.stringify({
          groupId: session.activeGroup!.id,
          showId: show.id,
          showTitle: show.title,
          status,
          performanceStart: perf.start,
          performanceEnd: perf.end,
        }),
      });
      await fetchSession();
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

  function allGenres(): string[] {
    const seen = new Set<string>();
    for (const show of shows) {
      if (show.genre) seen.add(show.genre);
    }
    return [...seen].sort();
  }

  function visibleShows(): Show[] {
    const q = search.trim().toLowerCase();
    const picked = new Set((session.activeGroup?.picks ?? []).map((p) => p.show_id));
    return shows.filter((show) => {
      if (selectedOnly && !picked.has(show.id)) return false;
      if (genreFilter && show.genre !== genreFilter) return false;
      if (!q) return true;
      const hay = [show.title, show.artist ?? "", show.genre ?? "", show.venue.name, show.subTitle ?? ""]
        .join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  function timelineGroups(): [string, { show: Show; picks: FringePick[]; conflicts: string[] }[]][] {
    const conflicts = computeConflicts(session.activeGroup?.picks ?? []);
    const showMap = new Map(shows.map((s) => [s.id, s]));

    const picked = (session.activeGroup?.picks ?? [])
      .filter((p) => (p.status === "going" || p.status === "has_ticket") && p.performance_start)
      .map((p) => {
        const show = showMap.get(p.show_id);
        return show ? { show, pick: p } : null;
      })
      .filter(Boolean) as { show: Show; pick: FringePick }[];

    // Group by date, then by show (deduplicate same show from multiple picks)
    const seenShows = new Set<string>();
    const byDate = new Map<string, { show: Show; picks: FringePick[]; conflicts: string[] }[]>();

    const sorted = picked.sort((a, b) => a.pick.performance_start!.localeCompare(b.pick.performance_start!));

    for (const { show, pick } of sorted) {
      const date = new Date(pick.performance_start!);
      const dayKey = date.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" });
      const entryKey = `${dayKey}::${show.id}`;

      if (seenShows.has(entryKey)) {
        // Merge picks for same show on same day
        const group = byDate.get(dayKey)!;
        const entry = group.find((e) => e.show.id === show.id);
        if (entry && !entry.picks.some((p) => p.user_id === pick.user_id)) {
          entry.picks.push(pick);
        }
        continue;
      }

      seenShows.add(entryKey);
      const entry = {
        show,
        picks: [pick],
        conflicts: conflicts.get(show.id) ?? [],
      };

      const group = byDate.get(dayKey) ?? [];
      group.push(entry);
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

  const visible  = visibleShows();
  const tGroups  = timelineGroups();
  const tCount   = new Set(tGroups.flatMap(([, items]) => items.map((i) => i.show.id))).size;
  const genres   = allGenres();

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
            className={`${s.iconBtn} ${drawerOpen ? s.iconBtnActive : ""}`}
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Profil og gruppe"
          >
            {session.activeGroup ? "●" : "○"}
          </button>
        </div>
      </header>

      {/* ── Drawer overlay ── */}
      {drawerOpen && <div className={s.drawerOverlay} onClick={() => setDrawerOpen(false)} />}

      {/* ── Drawer ── */}
      <aside className={`${s.drawer} ${drawerOpen ? s.drawerOpen : ""}`}>
        <div className={s.drawerHeader}>
          <span className={s.drawerTitle}>Profil & Gruppe</span>
          <button className={s.iconBtn} onClick={() => setDrawerOpen(false)} aria-label="Luk">✕</button>
        </div>

        {/* Profil */}
        <div className={s.drawerSection}>
          <p className={s.sectionTag}>Profil</p>
          {!isSignedIn ? (
            <div className={s.authCard}>
              <p className={s.muted}>Log ind for at markere shows og dele med venner.</p>
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
                    <button type="submit" className={s.ghostBtn}>Ny invite-kode</button>
                  </form>
                  {session.activeGroup.invites[0] && (
                    <button className={s.ghostBtn} onClick={handleCopyInvite}>
                      Kopiér kode ({session.activeGroup.invites[0].code})
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
                    <span className={s.fieldLabel}>Gruppenavn</span>
                    <input className={s.fieldInput} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Fx Fringe 2025-gæng" maxLength={50} required />
                  </label>
                  <button type="submit" className={s.primaryBtn}>Opret gruppe</button>
                </form>
                <div className={s.orDivider}><span>eller</span></div>
                <form onSubmit={handleJoinGroup} className={s.stackForm}>
                  <label className={s.fieldWrap}>
                    <span className={s.fieldLabel}>Invite-kode</span>
                    <input className={s.fieldInput} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Fx A3X7K2" maxLength={10} required />
                  </label>
                  <button type="submit" className={s.ghostBtn}>Join gruppe</button>
                </form>
              </div>
            </details>
          </div>
        )}

        {/* Køb */}
        {isSignedIn && session.activeGroup && (
          <div className={s.drawerSection}>
            <p className={s.sectionTag}>Køb</p>

            {/* Existing purchases */}
            {session.activeGroup.purchases.length > 0 && (
              <div className={s.purchaseList}>
                {session.activeGroup.purchases.map((purchase) => {
                  const perfDate = purchase.performance_start
                    ? new Date(purchase.performance_start).toLocaleDateString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                    : null;
                  return (
                    <div key={purchase.id} className={s.purchaseCard}>
                      <div className={s.purchaseTop}>
                        <div>
                          <p className={s.purchaseTitle}>{purchase.show_title}</p>
                          <p className={s.purchaseMeta}>
                            Købt af {purchase.buyer_user_name}{perfDate ? ` · ${perfDate}` : ""}
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
                                <button
                                  className={s.settleBtn}
                                  onClick={() => handleSettle(purchase.id, cover.covered_user_id, false)}
                                  title="Fortryd"
                                >✓</button>
                              ) : (
                                <button
                                  className={s.settleBtn}
                                  onClick={() => handleSettle(purchase.id, cover.covered_user_id, true)}
                                  title="Marker som betalt"
                                >○</button>
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

            {/* Log new purchase */}
            {purchaseForm ? (
              <form onSubmit={handleLogPurchase} className={`${s.stackForm} ${s.purchaseFormWrap}`}>
                <label className={s.fieldWrap}>
                  <span className={s.fieldLabel}>Show</span>
                  <select
                    className={s.fieldSelect}
                    value={purchaseForm.showId}
                    onChange={(e) => {
                      const show = shows.find((sh) => sh.id === e.target.value);
                      setPurchaseForm((f) => f && ({
                        ...f,
                        showId: e.target.value,
                        perfStart: show?.performances[0]?.start ?? "",
                        perfEnd: show?.performances[0]?.end ?? "",
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
                  return show && show.performances.length > 1 ? (
                    <label className={s.fieldWrap}>
                      <span className={s.fieldLabel}>Forestilling</span>
                      <select
                        className={s.fieldSelect}
                        value={purchaseForm.perfStart}
                        onChange={(e) => {
                          const perf = show.performances.find((p) => p.start === e.target.value);
                          setPurchaseForm((f) => f && ({ ...f, perfStart: e.target.value, perfEnd: perf?.end ?? "" }));
                        }}
                        required
                      >
                        <option value="">Vælg forestilling…</option>
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
                  <span className={s.fieldLabel}>Samlet pris (£, valgfrit)</span>
                  <input type="number" step="0.01" min="0" className={s.fieldInput} value={purchaseForm.cost} onChange={(e) => setPurchaseForm((f) => f && ({ ...f, cost: e.target.value }))} placeholder="Fx 47.50" />
                </label>

                <div className={s.fieldWrap}>
                  <span className={s.fieldLabel}>Dækker</span>
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
                  <span className={s.fieldLabel}>Note (valgfrit)</span>
                  <input className={s.fieldInput} value={purchaseForm.notes} onChange={(e) => setPurchaseForm((f) => f && ({ ...f, notes: e.target.value }))} placeholder="Fx 'online booking gebyr'" maxLength={200} />
                </label>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="submit" className={s.primaryBtn}>Gem køb</button>
                  <button type="button" className={s.ghostBtn} onClick={() => setPurchaseForm(null)}>Annuller</button>
                </div>
              </form>
            ) : (
              <button
                className={s.ghostBtn}
                style={{ marginTop: session.activeGroup.purchases.length > 0 ? "0.75rem" : "0" }}
                onClick={() => setPurchaseForm({ showId: "", perfStart: "", perfEnd: "", cost: "", notes: "", covered: [session.user!.id] })}
              >
                + Log køb
              </button>
            )}
          </div>
        )}
      </aside>

      {/* ── Stats ── */}
      <div className={s.statsStrip}>
        {[
          { label: "Logget ind som", value: session.user?.name ?? "Gæst" },
          { label: "Aktiv gruppe",   value: session.activeGroup?.name ?? "—"  },
          { label: "I tidsplan",     value: tCount },
          { label: "I programme",    value: shows.length },
        ].map(({ label, value }) => (
          <div key={label} className={s.statCard}>
            <span className={s.statLabel}>{label}</span>
            <span className={s.statValue}>{String(value)}</span>
          </div>
        ))}
      </div>

      {/* ── Timeline ── */}
      <section className={s.section}>
        <p className={s.sectionTag}>Tidsplan</p>

        {tGroups.length === 0 ? (
          <div className={s.empty}>
            {session.activeGroup
              ? "Marker shows som 'Går' eller 'Har billet' og vælg forestilling — de samles her."
              : "Log ind og opret en gruppe for at bygge jeres tidsplan."}
          </div>
        ) : (
          tGroups.map(([day, items]) => (
            <div key={day} className={s.dayBlock}>
              <div className={s.dayHeader}>
                <span className={s.dayTag}>Dag</span>
                <h3 className={s.dayTitle}>{day}</h3>
              </div>
              {items.map(({ show, picks, conflicts }) => {
                const repPick = picks[0];
                const timeStr = repPick.performance_start
                  ? new Date(repPick.performance_start).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })
                  : "TBA";
                return (
                  <article key={show.id} className={`${s.timelineCard} ${conflicts.length > 0 ? s.hasConflict : ""}`}>
                    <div className={s.timeSlot}>{timeStr}</div>
                    <div className={s.timelineBody}>
                      <div className={s.timelineTop}>
                        <div>
                          <h4 className={s.actName}>{show.title}</h4>
                          <p className={s.actMeta}>{[show.genre, show.venue.name].filter(Boolean).join(" · ")}</p>
                        </div>
                      </div>
                      {conflicts.length > 0 && (
                        <div className={s.conflictBadge}>⚠ Konflikt: {conflicts.join(", ")}</div>
                      )}
                      <div className={s.pickTags}>
                        {picks.map((p) => (
                          <span key={p.user_id} className={`${s.tag} ${STATUS_META[p.status].cls}`}>
                            {p.user_name}: {STATUS_META[p.status].label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ))
        )}
      </section>

      {/* ── Shows list ── */}
      <section className={s.section}>
        <div className={s.sectionHeader}>
          <p className={s.sectionTag}>Programme · {shows.length} shows</p>
        </div>

        <div className={s.filterBar}>
          <input
            type="search"
            className={s.searchInput}
            placeholder="Søg i programme…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); saveUi({ search: e.target.value }); }}
          />
          {genres.length > 0 && (
            <div className={s.filterRow}>
              <div className={s.filterChips}>
                {genres.map((g) => (
                  <button
                    key={g}
                    className={`${s.filterChip} ${genreFilter === g ? s.active : ""}`}
                    onClick={() => { const next = genreFilter === g ? null : g; setGenreFilter(next); saveUi({ genreFilter: next }); }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className={s.toggleRow}>
            <input type="checkbox" checked={selectedOnly} onChange={(e) => { setSelectedOnly(e.target.checked); saveUi({ selectedOnly: e.target.checked }); }} />
            <span>Vis kun valgte</span>
          </label>
        </div>

        {!session.activeGroup && (
          <p className={s.hint}>
            {session.user ? "Opret eller join en gruppe for at markere shows →" : "Log ind for at markere shows →"}
            <button className={s.hintBtn} onClick={() => setDrawerOpen(true)}>Åbn profil</button>
          </p>
        )}

        {visible.length === 0 ? (
          <div className={s.empty}>Ingen shows matcher dit søgeord.</div>
        ) : (
          <div className={s.showsList}>
            {visible.map((show) => {
              const picks  = picksFor(show.id);
              const mine   = myPick(show.id);
              const canPick = !!(session.user && session.activeGroup);
              const isPickerOpen = perfPicker?.showId === show.id;
              const firstPerf = show.performances[0];
              const metaParts = [
                show.genre,
                show.venue.name,
                firstPerf
                  ? new Date(firstPerf.start).toLocaleDateString("da-DK", { day: "numeric", month: "short" }) +
                    " " + new Date(firstPerf.start).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })
                  : null,
                firstPerf?.priceString ?? (firstPerf?.price != null ? `£${firstPerf.price}` : null),
              ].filter(Boolean);

              return (
                <article key={show.id} className={s.showCard}>
                  <div className={s.showTop}>
                    <div className={s.showInfo}>
                      <h3 className={s.showTitle}>{show.title}</h3>
                      <p className={s.showMeta}>{metaParts.join(" · ") || "Info mangler"}</p>
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
                            {isActive ? "✓" : meta.emoji}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Performance picker */}
                  {isPickerOpen && (
                    <div className={s.perfPicker}>
                      <p className={s.perfPickerLabel}>Vælg forestilling</p>
                      <div className={s.perfList}>
                        {show.performances.map((perf) => {
                          const { dateStr, timeStr, meta } = formatPerf(perf);
                          return (
                            <button
                              key={perf.start}
                              className={s.perfItem}
                              onClick={() => handleSelectPerformance(show, perf)}
                            >
                              <span>
                                <span className={s.perfItemTime}>{timeStr}</span>
                                {" · "}{dateStr}
                              </span>
                              {meta && <span className={s.perfItemMeta}>{meta}</span>}
                            </button>
                          );
                        })}
                      </div>
                      <button className={`${s.ghostBtn} ${s.perfPickerCancel}`} onClick={() => setPerfPicker(null)}>
                        Annuller
                      </button>
                    </div>
                  )}

                  {/* Picks from group */}
                  {picks.length > 0 && (
                    <div className={s.showBottom}>
                      <div className={s.pickTags}>
                        {picks.map((p) => (
                          <span key={p.user_id} className={`${s.tag} ${STATUS_META[p.status].cls}`}>
                            {p.user_name}: {STATUS_META[p.status].label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className={s.footer}>
        <span>Edinburgh Fringe Venneplanner · albertdieckmann.dk</span>
        <Link href="/" className={s.footerLink}>← Tilbage</Link>
      </footer>
    </div>
  );
}
