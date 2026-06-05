"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import s from "./roskilde.module.css";

// ─── types ────────────────────────────────────────────────────────────────────

type PickCategory = "interested" | "going" | "has_ticket";
type TabId = "lineup" | "tidsplan" | "gruppe";
type TimeSlot = "alle" | "formiddag" | "eftermiddag" | "aften" | "nat";

type Appearance = {
  dateLabel?: string;
  timeLabel?: string;
  stage?: string;
  date?: string;       // ISO: "2026-07-02T23:00:00"
  showTitle?: string;
};

type Act = {
  name: string;
  type?: string;
  lineupSceneLabel?: string;
  url?: string;
  countryCode?: string;
  appearances?: Appearance[];
  // top-level fallbacks
  dateLabel?: string;
  timeLabel?: string;
  date?: string;
  stage?: string;
};

type GroupPick = {
  memberId: string;
  displayName: string;
  actName: string;
  appearanceDate: string;
  category: PickCategory;
};

type GroupMember = { memberId: string; displayName: string };

type Group = {
  id: string;
  name: string;
  shareToken: string;
  members: GroupMember[];
  picks: GroupPick[];
};

type Me = {
  memberId: string;
  displayName: string;
  recallCode: string;
};

// ─── constants ────────────────────────────────────────────────────────────────

const CATEGORIES: PickCategory[] = ["interested", "going", "has_ticket"];

const CAT_META: Record<PickCategory, { label: string; emoji: string; btnCls: string }> = {
  interested: { label: "Fadøl",    emoji: "🍺",  btnCls: s.catInterested },
  going:      { label: "Ser show", emoji: "👍",  btnCls: s.catGoing },
  has_ticket: { label: "Pit",      emoji: "🕳️", btnCls: s.catHasTicket },
};

const TIME_SLOTS: { id: TimeSlot; label: string; range: string }[] = [
  { id: "alle",       label: "Alle tider",      range: "" },
  { id: "formiddag",  label: "Formiddag",        range: "06–12" },
  { id: "eftermiddag",label: "Eftermiddag",      range: "12–17" },
  { id: "aften",      label: "Aften",            range: "17–00" },
  { id: "nat",        label: "Nat",              range: "00–06" },
];

const LS_KEY = "roskilde-v2-member";

// ─── helpers ──────────────────────────────────────────────────────────────────

function loadMemberId(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
}
function saveMemberId(id: string) {
  try { localStorage.setItem(LS_KEY, id); } catch { /* ignore */ }
}
function clearMemberId() {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

async function api(path: string, options: RequestInit = {}, memberId?: string | null) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(memberId ? { "x-member-id": memberId } : {}),
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

// Returnerer minutter siden midnat — natshows 00-05 returneres som 1440+min (dvs. "næste dag")
function timeToSortMin(label: string): number {
  const clean = label.replace(".", ":");
  const [h, m] = clean.split(":").map(Number);
  if (isNaN(h)) return 9999;
  const min = h * 60 + (m || 0);
  // Nat 00:00-05:59 → sortér som 24:00+ (efter aftenens shows)
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
  if (min < 360) return "nat";          // 00-05:59
  if (min < 750) return "formiddag";   // 06-12:29
  if (min < 1020) return "eftermiddag"; // 12:30-16:59
  return "aften";                        // 17:00-23:59
}

// Normalisér appearances — acts uden appearances bruger top-level felter
function getAppearances(act: Act): Appearance[] {
  if (act.appearances?.length) return act.appearances;
  return [{ dateLabel: act.dateLabel, timeLabel: act.timeLabel, stage: act.lineupSceneLabel ?? act.stage, date: act.date }];
}

// Sortér dateLabels kronologisk ud fra den tidligste ISO-dato i appearances
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
  const [me,    setMe]    = useState<Me | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [ready, setReady] = useState(false);

  const [lineup,  setLineup]  = useState<Act[]>([]);
  const [dayOrder, setDayOrder] = useState<Map<string, string>>(new Map());

  const [activeTab,    setActiveTab]    = useState<TabId>("lineup");
  const [search,       setSearch]       = useState("");
  const [stageF,       setStageF]       = useState("alle");
  const [typeF,        setTypeF]        = useState("alle");
  const [dayF,         setDayF]         = useState("alle");
  const [timeSlotF,    setTimeSlotF]    = useState<TimeSlot>("alle");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [activePlanDay,  setActivePlanDay]  = useState<string | null>(null);
  const [expandedActs,   setExpandedActs]   = useState<Set<string>>(new Set());
  const [nowMin,         setNowMin]         = useState<number | null>(null);
  const [showScrollTop,  setShowScrollTop]  = useState(false);

  // gruppe tab
  const [displayName, setDisplayName] = useState("");
  const [groupName,   setGroupName]   = useState("");
  const [shareToken,  setShareToken]  = useState("");
  const [recallGroup, setRecallGroup] = useState("");
  const [recallCode,  setRecallCode]  = useState("");

  const [status, setStatus] = useState("");
  const [busy,   setBusy]   = useState(false);

  const savedScrolls = useRef<Record<TabId, number>>({ lineup: 0, tidsplan: 0, gruppe: 0 });
  const statusTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function flash(msg: string) {
    setStatus(msg);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(""), 4000);
  }

  // ── session ───────────────────────────────────────────────────────────────

  const fetchSession = useCallback(async (mid: string) => {
    const pay = await api(`/api/roskilde/session?memberId=${mid}`);
    if (pay.member) {
      setMe(pay.member);
      setGroup(pay.group);
    } else {
      setMe(null);
      setGroup(null);
      clearMemberId();
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
    const urlMid = params.get("mid");
    const stored = loadMemberId();
    const mid = urlMid ?? stored;
    const tabParam = params.get("tab") as TabId | null;
    if (tabParam === "lineup" || tabParam === "tidsplan" || tabParam === "gruppe") {
      setActiveTab(tabParam);
    }
    if (mid) {
      saveMemberId(mid);
      fetchSession(mid).finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, [fetchSession]);

  // Nu-markør
  useEffect(() => {
    function tick() {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Scroll-to-top knap
  useEffect(() => {
    function onScroll() { setShowScrollTop(window.scrollY > 400); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll restore
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
        body: JSON.stringify({ groupName, displayName }),
      });
      saveMemberId(pay.memberId);
      await fetchSession(pay.memberId);
      setGroupName("");
      setDisplayName("");
      flash(`Gruppe oprettet! Token: ${pay.shareToken} · Genkald: ${pay.recallCode}`);
      switchTab("tidsplan");
    });
  }

  async function handleJoinGroup(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const pay = await api("/api/roskilde/join", {
        method: "POST",
        body: JSON.stringify({ shareToken, displayName }),
      });
      saveMemberId(pay.memberId);
      await fetchSession(pay.memberId);
      setShareToken("");
      setDisplayName("");
      flash(`Velkommen til "${pay.groupName}"! Genkald: ${pay.recallCode}`);
      switchTab("tidsplan");
    });
  }

  async function handleResume(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const pay = await api(`/api/roskilde/resume?groupId=${recallGroup}&code=${recallCode}`);
      saveMemberId(pay.memberId);
      await fetchSession(pay.memberId);
      setRecallGroup("");
      setRecallCode("");
      flash(`Velkommen tilbage, ${pay.displayName}!`);
    });
  }

  async function handleLeaveGroup() {
    if (!me || !group) return;
    if (!confirm(`Forlad gruppen "${group.name}"? Dine picks slettes.`)) return;
    await run(async () => {
      await api(`/api/roskilde/groups/${group.id}/leave`, { method: "DELETE" }, me.memberId);
      clearMemberId();
      setMe(null);
      setGroup(null);
      flash("Du har forladt gruppen.");
    });
  }

  async function handleDeleteGroup() {
    if (!me || !group) return;
    if (!confirm(`Slet gruppen "${group.name}"? Kan ikke fortrydes.`)) return;
    await run(async () => {
      await api(`/api/roskilde/groups/${group.id}`, { method: "DELETE" }, me.memberId);
      clearMemberId();
      setMe(null);
      setGroup(null);
      flash("Gruppen er slettet.");
    });
  }

  async function handlePick(actName: string, appearanceDate: string, category: PickCategory) {
    if (!me || !group) return;
    const current = group.picks.find(
      (p) => p.actName === actName && p.appearanceDate === appearanceDate && p.memberId === me.memberId
    )?.category ?? null;
    await run(async () => {
      await api("/api/roskilde/picks", {
        method: "POST",
        body: JSON.stringify({ actName, appearanceDate, category: current === category ? null : category }),
      }, me.memberId);
      await fetchSession(me.memberId);
    });
  }

  async function copyResumeLink() {
    if (!me) return;
    const url = `${window.location.origin}/roskilde?mid=${me.memberId}`;
    try { await navigator.clipboard.writeText(url); flash("Genoptag-link kopieret!"); }
    catch { flash(`Link: ${url}`); }
  }

  async function copyShareToken() {
    if (!group) return;
    try { await navigator.clipboard.writeText(group.shareToken); flash(`Token ${group.shareToken} kopieret!`); }
    catch { flash(`Token: ${group.shareToken}`); }
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

  function myPickFor(actName: string, appearanceDate: string): PickCategory | null {
    if (!me || !group) return null;
    return group.picks.find(
      (p) => p.actName === actName && p.appearanceDate === appearanceDate && p.memberId === me.memberId
    )?.category ?? null;
  }

  function groupPicksFor(actName: string, appearanceDate: string): GroupPick[] {
    return (group?.picks ?? []).filter(
      (p) => p.actName === actName && p.appearanceDate === appearanceDate
    );
  }

  const allStages  = [...new Set(lineup.map((a) => a.lineupSceneLabel ?? a.stage).filter(Boolean))].sort() as string[];
  const allTypes   = [...new Set(lineup.map((a) => a.type).filter(Boolean))].sort() as string[];
  const sortedDays = [...dayOrder.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([label]) => label);

  function visibleActs(): Act[] {
    const q     = search.trim().toLowerCase();
    const picked = new Set((group?.picks ?? []).map((p) => p.actName));
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

  // Timeline: gruppér alle gruppemedlemmers picks pr. dag, sortér natshows sidst
  function timelineByDay(): Map<string, { act: Act; app: Appearance; picks: GroupPick[]; sortMin: number }[]> {
    if (!group) return new Map();
    const byDay = new Map<string, { act: Act; app: Appearance; picks: GroupPick[]; sortMin: number }[]>();

    for (const act of lineup) {
      const apps = getAppearances(act);
      for (const app of apps) {
        const appDate = app.date ?? "";
        const picks = group.picks.filter(
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

    // Sortér hvert dag kronologisk (nat sidst)
    for (const [day, items] of byDay) {
      byDay.set(day, items.sort((a, b) => a.sortMin - b.sortMin));
    }

    // Sortér dagene kronologisk
    return new Map(
      [...byDay.entries()].sort((a, b) => {
        const da = dayOrder.get(a[0]) ?? "9999";
        const db = dayOrder.get(b[0]) ?? "9999";
        return da.localeCompare(db);
      })
    );
  }

  type TlEntry = { act: Act; app: Appearance; picks: GroupPick[]; sortMin: number };

  // Gruppér timeline-entries i bånd: overlappende shows side om side
  function buildBands(items: TlEntry[]): TlEntry[][] {
    const used = new Set<number>();
    const bands: TlEntry[][] = [];

    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue;
      const band: TlEntry[] = [items[i]];
      used.add(i);
      const aMembers = new Set(items[i].picks.map((p) => p.memberId));

      for (let j = i + 1; j < items.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(items[j].sortMin - items[i].sortMin) >= 60) break; // sorted, so no later match
        if (items[j].picks.some((p) => aMembers.has(p.memberId))) {
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

  const acts     = visibleActs();
  const tlByDay  = timelineByDay();
  const tlDays   = [...tlByDay.keys()];
  const tlTotal  = [...tlByDay.values()].reduce((n, v) => n + v.length, 0);
  const isOwner  = group && me ? group.members[0]?.memberId === me.memberId : false;
  const activeDayKey = activePlanDay && tlDays.includes(activePlanDay) ? activePlanDay : (tlDays[0] ?? null);

  // ── gruppe-tab ────────────────────────────────────────────────────────────

  const gruppeTab = (
    <div className={s.gruppePanel}>
      {me && group ? (
        <>
          <div className={s.drawerSection}>
            <p className={s.sectionTag}>Du er</p>
            <div className={s.identityCard}>
              <div className={s.identityAvatar}>{initials(me.displayName)}</div>
              <div>
                <p className={s.identityName}>{me.displayName}</p>
                <p className={s.identityEmail}>Gruppe: {group.name}</p>
              </div>
            </div>
            <div className={s.resumeBox}>
              <p className={s.resumeLabel}>Genoptag-link</p>
              <button className={s.ghostBtn} onClick={copyResumeLink}>Kopiér link</button>
              <p className={s.resumeLabel}>Backup genkald-kode</p>
              <div className={s.recallBadge}>{me.recallCode}</div>
              <p className={s.mutedSmall}>Group-ID: <code className={s.code}>{group.id}</code></p>
            </div>
          </div>
          <div className={s.drawerSection}>
            <p className={s.sectionTag}>Gruppe · {group.name}</p>
            <div className={s.shareTokenRow}>
              <span className={s.shareTokenBadge}>{group.shareToken}</span>
              <button className={s.ghostBtn} onClick={copyShareToken}>Kopiér token</button>
            </div>
            <p className={s.mutedSmall}>Del token med venner så de kan joine.</p>
            <div className={s.memberList}>
              {group.members.map((m, i) => (
                <div key={m.memberId} className={`${s.friendChip} ${m.memberId === me.memberId ? s.active : ""}`}>
                  <div className={s.memberAvatar} style={{ "--avatar-idx": i } as React.CSSProperties}>{initials(m.displayName)}</div>
                  <span>{m.displayName}</span>
                  {i === 0 && <small>Oprettede gruppen</small>}
                </div>
              ))}
            </div>
            {isOwner
              ? <button className={s.deleteBtn} onClick={handleDeleteGroup}>Slet gruppe</button>
              : <button className={s.deleteBtn} onClick={handleLeaveGroup}>Forlad gruppe</button>
            }
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
          {me && (
            <button className={s.iconBtn} onClick={() => run(() => fetchSession(me.memberId))} aria-label="Opdatér">↻</button>
          )}
        </div>
      </header>

      <div className={s.statsStrip}>
        {[
          { label: "Bruger",      value: me?.displayName ?? "Ingen gruppe" },
          { label: "Gruppe",      value: group?.name ?? "—" },
          { label: "Valgte shows",value: tlTotal },
          { label: "I line-up",   value: lineup.length },
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

          {!group && (
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
                const canPick  = !!(me && group);
                const isMulti  = apps.length > 1;
                const expanded = expandedActs.has(act.name);
                const anyPickedOnAct = apps.some((app) => {
                  const appDate = app.date ?? "";
                  return myPickFor(act.name, appDate) !== null || groupPicksFor(act.name, appDate).length > 0;
                });

                if (!isMulti) {
                  // Enkelt appearance — fladt kort
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
                            <span key={`${p.memberId}-${appDate}`} className={`${s.tag} ${CAT_META[p.category].btnCls}`}>
                              {CAT_META[p.category].emoji} {initials(p.displayName)}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                }

                // Multi-appearance — fold-ud
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
                                    <span key={`${p.memberId}-${appDate}`} className={`${s.tag} ${CAT_META[p.category].btnCls}`}>
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
        {tlDays.length === 0 ? (
          <div className={s.section}>
            <div className={s.empty}>
              {group
                ? "Marker shows i line-up — de samles her som en kronologisk tidsplan."
                : "Opret eller join en gruppe for at se jeres fælles tidsplan."}
            </div>
          </div>
        ) : (
          <>
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
              let nowInserted = false;

              return (
                <div className={s.timelineColumn}>
                  {bands.map((band, bandIdx) => {
                    const firstMin = band[0].sortMin < 1440 ? band[0].sortMin : band[0].sortMin - 1440;
                    const nextBandFirstMin = bands[bandIdx + 1]
                      ? (bands[bandIdx + 1][0].sortMin < 1440 ? bands[bandIdx + 1][0].sortMin : bands[bandIdx + 1][0].sortMin - 1440)
                      : null;
                    const showNow = nowMin !== null && !nowInserted && (
                      nowMin >= firstMin && (nextBandFirstMin === null || nowMin < nextBandFirstMin)
                    );
                    if (showNow) nowInserted = true;
                    const isConflict = band.length > 1;

                    return (
                      <div key={`band-${bandIdx}`}>
                        <div className={isConflict ? s.conflictBand : undefined}>
                          {band.map((entry) => (
                            <article
                              key={`${entry.act.name}-${entry.app.date ?? bandIdx}`}
                              className={`${s.timelineCard} ${isConflict ? s.timelineCardConflict : ""}`}
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
                                  {me && group && (
                                    <div className={s.catGrid}>
                                      {CATEGORIES.map((key) => {
                                        const mine = myPickFor(entry.act.name, entry.app.date ?? "");
                                        return (
                                          <button
                                            key={key}
                                            className={`${s.catBtn} ${CAT_META[key].btnCls} ${mine === key ? s.catBtnActive : ""}`}
                                            onClick={() => handlePick(entry.act.name, entry.app.date ?? "", key)}
                                            title={CAT_META[key].label}
                                          >{CAT_META[key].emoji}</button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                {entry.picks.filter((p) => p.memberId !== me?.memberId).length > 0 && (
                                  <div className={s.pickTags}>
                                    {entry.picks.filter((p) => p.memberId !== me?.memberId).map((p) => (
                                      <span key={p.memberId} className={`${s.tag} ${CAT_META[p.category].btnCls}`}>
                                        {initials(p.displayName)} {CAT_META[p.category].emoji}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                        {showNow && (
                          <div className={s.nowMarker}>
                            <span className={s.nowDot} />
                            <span className={s.nowLabel}>nu</span>
                            <span className={s.nowLine} />
                          </div>
                        )}
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
          {!me && <span className={s.tabBadgeDot} />}
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
