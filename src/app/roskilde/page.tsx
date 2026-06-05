"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import s from "./roskilde.module.css";

// ─── types ────────────────────────────────────────────────────────────────────

type PickCategory = "interested" | "going" | "has_ticket";
type TabId = "lineup" | "tidsplan" | "gruppe";

type Act = {
  name: string;
  type?: string;
  lineupSceneLabel?: string;
  stage?: string;
  timeLabel?: string;
  dateLabel?: string;
  date?: string;
  appearances?: Appearance[];
};

type Appearance = {
  dateLabel?: string;
  timeLabel?: string;
  stage?: string;
  date?: string;
};

type GroupPick = {
  memberId: string;
  displayName: string;
  actName: string;
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
  interested: { label: "Interesseret",  emoji: "🍺",  btnCls: s.catInterested },
  going:      { label: "Går",           emoji: "👍",  btnCls: s.catGoing },
  has_ticket: { label: "Skal i pitten", emoji: "🕳️", btnCls: s.catHasTicket },
};

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

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function RoskildePage() {
  // identity
  const [me,       setMe]       = useState<Me | null>(null);
  const [group,    setGroup]    = useState<Group | null>(null);
  const [ready,    setReady]    = useState(false);
  const memberId = me?.memberId ?? null;

  // lineup
  const [lineup,   setLineup]   = useState<Act[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<TabId>("lineup");
  const [search,    setSearch]    = useState("");
  const [stageF,    setStageF]    = useState("alle");
  const [typeF,     setTypeF]     = useState("alle");
  const [dayF,      setDayF]      = useState("alle");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [activePlanDay, setActivePlanDay] = useState<string | null>(null);
  const [nowMin, setNowMin] = useState<number | null>(null); // minutter siden midnat

  // gruppe tab
  const [displayName,  setDisplayName]  = useState("");
  const [groupName,    setGroupName]    = useState("");
  const [shareToken,   setShareToken]   = useState("");
  const [recallGroup,  setRecallGroup]  = useState("");
  const [recallCode,   setRecallCode]   = useState("");
  const [renameVal,    setRenameVal]    = useState("");

  const [status,  setStatus]  = useState("");
  const [busy,    setBusy]    = useState(false);

  const savedScrolls = useRef<Record<TabId, number>>({ lineup: 0, tidsplan: 0, gruppe: 0 });
  const statusTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function flash(msg: string) {
    setStatus(msg);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(""), 4000);
  }

  // ── session fetch ─────────────────────────────────────────────────────────

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
      .then((d) => setLineup(d.items ?? []))
      .catch(console.error);
  }, []);

  // Nu-markør: opdatér hvert minut
  useEffect(() => {
    function tick() {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // URL-param ?mid=... override (genoptag-link)
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

  // ── scroll restore ────────────────────────────────────────────────────────

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
      flash(`Gruppe oprettet! Token: ${pay.shareToken} · Genkald-kode: ${pay.recallCode}`);
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
      flash(`Velkommen til "${pay.groupName}"! Genkald-kode: ${pay.recallCode}`);
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
    if (!confirm(`Forlad gruppen "${group.name}"? Dine valg slettes.`)) return;
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
    if (!confirm(`Slet gruppen "${group.name}"? Dette sletter alle picks og kan ikke fortrydes.`)) return;
    await run(async () => {
      await api(`/api/roskilde/groups/${group.id}`, { method: "DELETE" }, me.memberId);
      clearMemberId();
      setMe(null);
      setGroup(null);
      flash("Gruppen er slettet.");
    });
  }

  async function handlePick(actName: string, category: PickCategory) {
    if (!me || !group) return;
    const current = group.picks.find(
      (p) => p.actName === actName && p.memberId === me.memberId
    )?.category ?? null;
    await run(async () => {
      await api("/api/roskilde/picks", {
        method: "POST",
        body: JSON.stringify({ actName, category: current === category ? null : category }),
      }, me.memberId);
      await fetchSession(me.memberId);
    });
  }

  async function copyResumeLink() {
    if (!me) return;
    const url = `${window.location.origin}/roskilde?mid=${me.memberId}`;
    try {
      await navigator.clipboard.writeText(url);
      flash("Genoptag-link kopieret!");
    } catch {
      flash(`Genoptag-link: ${url}`);
    }
  }

  async function copyShareToken() {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.shareToken);
      flash(`Token ${group.shareToken} kopieret!`);
    } catch {
      flash(`Token: ${group.shareToken}`);
    }
  }

  // ── derived ───────────────────────────────────────────────────────────────

  function myPick(actName: string): PickCategory | null {
    if (!me || !group) return null;
    return group.picks.find((p) => p.actName === actName && p.memberId === me.memberId)?.category ?? null;
  }

  function picksFor(actName: string): GroupPick[] {
    return (group?.picks ?? []).filter((p) => p.actName === actName);
  }

  // Flatten appearances — hvert act kan have flere optrædener
  function flatActs(): (Act & { _app: Appearance })[] {
    const out: (Act & { _app: Appearance })[] = [];
    for (const act of lineup) {
      const apps = act.appearances ?? [{ dateLabel: act.dateLabel, timeLabel: act.timeLabel, stage: act.lineupSceneLabel ?? act.stage, date: act.date }];
      for (const app of apps) {
        out.push({ ...act, _app: app });
      }
    }
    return out;
  }

  // Unikke scener og typer
  const allStages = [...new Set(lineup.map((a) => a.lineupSceneLabel ?? a.stage).filter(Boolean))].sort() as string[];
  const allTypes  = [...new Set(lineup.map((a) => a.type).filter(Boolean))].sort() as string[];
  const allDays   = [...new Set(
    lineup.flatMap((a) =>
      (a.appearances ?? [{ dateLabel: a.dateLabel }]).map((ap) => ap.dateLabel).filter(Boolean)
    )
  )].sort() as string[];

  function visibleActs() {
    const q = search.trim().toLowerCase();
    const picked = new Set((group?.picks ?? []).map((p) => p.actName));
    return lineup.filter((act) => {
      if (selectedOnly && !picked.has(act.name)) return false;
      if (stageF !== "alle" && (act.lineupSceneLabel ?? act.stage) !== stageF) return false;
      if (typeF  !== "alle" && act.type !== typeF) return false;
      if (dayF   !== "alle") {
        const days = (act.appearances ?? [{ dateLabel: act.dateLabel }]).map((ap) => ap.dateLabel);
        if (!days.includes(dayF)) return false;
      }
      if (!q) return true;
      const hay = [act.name, act.type ?? "", act.lineupSceneLabel ?? act.stage ?? "", act.timeLabel ?? "", act.dateLabel ?? ""]
        .join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  // Timeline: alle gruppemedlemmers picks grupperet pr. dag, sorteret på tid
  function timelineByDay(): Map<string, (Act & { _picks: GroupPick[]; _app: Appearance })[]> {
    if (!group) return new Map();
    const pickedNames = new Set(group.picks.map((p) => p.actName));
    const byDay = new Map<string, (Act & { _picks: GroupPick[]; _app: Appearance })[]>();

    for (const act of lineup) {
      if (!pickedNames.has(act.name)) continue;
      const picks = group.picks.filter((p) => p.actName === act.name);
      const apps = act.appearances?.length
        ? act.appearances
        : [{ dateLabel: act.dateLabel, timeLabel: act.timeLabel, stage: act.lineupSceneLabel ?? act.stage, date: act.date }];

      for (const app of apps) {
        const day = app.dateLabel ?? "Dato ikke offentliggjort";
        const entry = { ...act, _picks: picks, _app: app };
        const list = byDay.get(day) ?? [];
        list.push(entry);
        byDay.set(day, list);
      }
    }

    // Sortér hvert dags-array efter starttid
    for (const [day, items] of byDay) {
      byDay.set(day, items.sort((a, b) => (a._app.timeLabel ?? "99:99").localeCompare(b._app.timeLabel ?? "99:99")));
    }

    // Sortér dagene
    const sorted = new Map([...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)));
    return sorted;
  }

  // Sammenstøds-detektion: to picks fra SAMME person på SAMME dag overlapper tidsmæssigt
  function hasConflict(items: (Act & { _picks: GroupPick[]; _app: Appearance })[], idx: number): boolean {
    const item = items[idx];
    const tA = item._app.timeLabel;
    if (!tA) return false;
    for (let j = 0; j < items.length; j++) {
      if (j === idx) continue;
      const other = items[j];
      const tB = other._app.timeLabel;
      if (!tB) continue;
      // Tjek om nogen af de SAMME members er picked til begge
      const aMembers = new Set(item._picks.map((p) => p.memberId));
      const overlapMembers = other._picks.filter((p) => aMembers.has(p.memberId));
      if (!overlapMembers.length) continue;
      // Grovt overlap: antag 90 min varighed
      const aStart = toMin(tA), bStart = toMin(tB);
      if (Math.abs(aStart - bStart) < 90) return true;
    }
    return false;
  }

  // ── loading ───────────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <div className={s.page}>
        <div className={s.loading}>
          <span className={s.loadingDot} />
          Loader…
        </div>
      </div>
    );
  }

  const acts      = visibleActs();
  const tlByDay   = timelineByDay();
  const tlDays    = [...tlByDay.keys()];
  const tlTotal   = [...tlByDay.values()].reduce((n, v) => n + v.length, 0);
  const isOwner   = group && me ? group.members[0]?.memberId === me.memberId : false;

  // Default til første dag i tidsplanen
  const activeDayKey = activePlanDay && tlDays.includes(activePlanDay) ? activePlanDay : (tlDays[0] ?? null);

  // ── gruppe-tab indhold ────────────────────────────────────────────────────

  const gruppeTab = (
    <div className={s.gruppePanel}>
      {me && group ? (
        <>
          {/* Identitet & genoptag */}
          <div className={s.drawerSection}>
            <p className={s.sectionTag}>Du er logget ind som</p>
            <div className={s.identityCard}>
              <div className={s.identityAvatar}>{initials(me.displayName)}</div>
              <div>
                <p className={s.identityName}>{me.displayName}</p>
                <p className={s.identityEmail}>Gruppe: {group.name}</p>
              </div>
            </div>
            <div className={s.resumeBox}>
              <p className={s.resumeLabel}>Genoptag-link (virker på alle enheder)</p>
              <button className={s.ghostBtn} onClick={copyResumeLink}>Kopiér genoptag-link</button>
              <p className={s.resumeLabel}>Backup genkald-kode</p>
              <div className={s.recallBadge}>{me.recallCode}</div>
              <p className={s.mutedSmall}>Group-ID til genkald: <code className={s.code}>{group.id}</code></p>
            </div>
          </div>

          {/* Gruppe */}
          <div className={s.drawerSection}>
            <p className={s.sectionTag}>Gruppe · {group.name}</p>
            <div className={s.shareTokenRow}>
              <span className={s.shareTokenBadge}>{group.shareToken}</span>
              <button className={s.ghostBtn} onClick={copyShareToken}>Kopiér token</button>
            </div>
            <p className={s.mutedSmall}>Del token med venner — de bruger det til at joine gruppen.</p>
            <div className={s.memberList}>
              {group.members.map((m, i) => (
                <div key={m.memberId} className={`${s.friendChip} ${m.memberId === me.memberId ? s.active : ""}`}>
                  <div className={s.memberAvatar} style={{ "--avatar-idx": i } as React.CSSProperties}>{initials(m.displayName)}</div>
                  <span>{m.displayName}</span>
                  {i === 0 && <small>Oprettet gruppen</small>}
                </div>
              ))}
            </div>
            {isOwner ? (
              <button className={s.deleteBtn} onClick={handleDeleteGroup}>Slet gruppe</button>
            ) : (
              <button className={s.deleteBtn} onClick={handleLeaveGroup}>Forlad gruppe</button>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Opret gruppe */}
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

          {/* Join gruppe */}
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

          {/* Genoptag med kode */}
          <div className={s.drawerSection}>
            <p className={s.sectionTag}>Genoptag med kode</p>
            <form onSubmit={handleResume} className={s.stackForm}>
              <label className={s.fieldWrap}>
                <span className={s.fieldLabel}>Group-ID</span>
                <input className={s.fieldInput} value={recallGroup} onChange={(e) => setRecallGroup(e.target.value.trim())} placeholder="UUID fra gruppe-siden" maxLength={36} required />
              </label>
              <label className={s.fieldWrap}>
                <span className={s.fieldLabel}>4-cifret genkald-kode</span>
                <input className={s.fieldInput} value={recallCode} onChange={(e) => setRecallCode(e.target.value.trim())} placeholder="Fx 4827" maxLength={6} required inputMode="numeric" />
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

      {/* header */}
      <header className={s.header}>
        <Link href="/" className={s.backLink}>←</Link>
        <div className={s.headerCenter}>
          <span className={s.headerTitle}>Roskilde Venneplanner</span>
          {status && <span className={s.statusMsg}>{status}</span>}
        </div>
        <div className={s.headerActions}>
          {me && (
            <button className={s.iconBtn} onClick={() => me && run(() => fetchSession(me.memberId))} aria-label="Opdatér">↻</button>
          )}
        </div>
      </header>

      {/* stats strip */}
      <div className={s.statsStrip}>
        {[
          { label: "Bruger",      value: me?.displayName ?? "Ikke tilknyttet gruppe" },
          { label: "Gruppe",      value: group?.name ?? "—" },
          { label: "Valgte acts", value: tlTotal },
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

          {/* Filterbar */}
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
              <select className={s.filterSelect} value={dayF} onChange={(e) => setDayF(e.target.value)}>
                <option value="alle">Alle dage</option>
                {allDays.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <label className={s.toggleRow}>
              <input type="checkbox" checked={selectedOnly} onChange={(e) => setSelectedOnly(e.target.checked)} />
              <span>Vis kun valgte</span>
            </label>
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
              {acts.map((act) => {
                const picks   = picksFor(act.name);
                const mine    = myPick(act.name);
                const canPick = !!(me && group);
                const stage   = act.lineupSceneLabel ?? act.stage ?? "";
                const apps    = act.appearances?.length
                  ? act.appearances
                  : [{ dateLabel: act.dateLabel, timeLabel: act.timeLabel }];
                const schedStr = apps.map((ap) => [ap.dateLabel, ap.timeLabel].filter(Boolean).join(" ")).join(", ") || "Programinfo mangler";

                return (
                  <article key={act.name} className={s.actCard}>
                    <div className={s.actTop}>
                      <div className={s.actInfo}>
                        <h3 className={s.actName}>{act.name}</h3>
                        <p className={s.actMeta}>{act.type ?? "Act"}{stage ? ` · ${stage}` : ""}</p>
                        <p className={s.actMeta}>{schedStr}</p>
                      </div>
                      <div className={s.catGrid}>
                        {CATEGORIES.map((key) => {
                          const meta = CAT_META[key];
                          return (
                            <button
                              key={key}
                              className={`${s.catBtn} ${meta.btnCls} ${mine === key ? s.catBtnActive : ""}`}
                              onClick={() => handlePick(act.name, key)}
                              disabled={!canPick}
                              title={meta.label}
                            >
                              {meta.emoji}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {picks.length > 0 && (
                      <div className={s.pickTags}>
                        {picks.map((p) => (
                          <span key={p.memberId} className={`${s.tag} ${CAT_META[p.category].btnCls}`}>
                            {CAT_META[p.category].emoji} {initials(p.displayName)}: {CAT_META[p.category].label}
                          </span>
                        ))}
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
                ? "Marker acts i line-up — de samles her som en kronologisk tidsplan."
                : "Opret eller join en gruppe for at se jeres fælles tidsplan."}
            </div>
          </div>
        ) : (
          <>
            {/* Sticky dagfaner */}
            <div className={s.dayTabs}>
              {tlDays.map((day) => (
                <button
                  key={day}
                  className={`${s.dayTabBtn} ${day === activeDayKey ? s.dayTabActive : ""}`}
                  onClick={() => setActivePlanDay(day)}
                >
                  {day.replace(/^\w+ /, "").replace(/\d{4}$/, "").trim()}
                </button>
              ))}
            </div>

            {/* Tidslinje for aktiv dag */}
            {activeDayKey && (() => {
              const items = tlByDay.get(activeDayKey) ?? [];
              let nowInserted = false;
              return (
                <div className={s.timelineColumn}>
                  {items.map((item, idx) => {
                    const conflict   = hasConflict(items, idx);
                    const itemMin    = item._app.timeLabel ? toMin(item._app.timeLabel) : null;
                    const nextItem   = items[idx + 1];
                    const nextMin    = nextItem?._app.timeLabel ? toMin(nextItem._app.timeLabel) : null;

                    // Indsæt nu-markør lige EFTER det sidst passerede show
                    const showNow = nowMin !== null && !nowInserted && itemMin !== null && (
                      nowMin >= itemMin && (nextMin === null || nowMin < nextMin)
                    );
                    if (showNow) nowInserted = true;

                    return (
                      <div key={`${item.name}-${item._app.timeLabel}-${idx}`}>
                        <article
                          className={`${s.timelineCard} ${conflict ? s.hasConflictSoft : ""}`}
                        >
                          <div className={s.timeSlot}>{item._app.timeLabel ?? "TBA"}</div>
                          <div className={s.timelineBody}>
                            <div className={s.timelineTop}>
                              <div>
                                <h4 className={s.actName}>{item.name}</h4>
                                <p className={s.actMeta}>{item.type ?? "Act"} · {item._app.stage ?? item.lineupSceneLabel ?? "Scene TBA"}</p>
                              </div>
                            </div>
                            <div className={s.pickTags}>
                              {item._picks.map((p) => (
                                <span key={p.memberId} className={`${s.tag} ${CAT_META[p.category].btnCls}`}>
                                  {initials(p.displayName)} {CAT_META[p.category].emoji}
                                </span>
                              ))}
                            </div>
                          </div>
                        </article>
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
        <button
          className={`${s.tabBarBtn} ${activeTab === "lineup" ? s.tabBarBtnActive : ""}`}
          onClick={() => switchTab("lineup")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor" stroke="none"/>
            <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1" fill="currentColor" stroke="none"/>
          </svg>
          <span className={s.tabBarLabel}>Line-up</span>
        </button>
        <button
          className={`${s.tabBarBtn} ${activeTab === "tidsplan" ? s.tabBarBtnActive : ""}`}
          onClick={() => switchTab("tidsplan")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className={s.tabBarLabel}>Tidsplan</span>
          {tlTotal > 0 && <span className={s.tabBadge}>{tlTotal}</span>}
        </button>
        <button
          className={`${s.tabBarBtn} ${activeTab === "gruppe" ? s.tabBarBtnActive : ""}`}
          onClick={() => switchTab("gruppe")}
        >
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
        <Link href="/" className={s.footerLink}>← Tilbage</Link>
      </footer>
    </div>
  );
}
