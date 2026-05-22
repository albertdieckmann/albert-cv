"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import s from "./roskilde.module.css";

// ─── types ────────────────────────────────────────────────────────────────────

type PickStatus = "interested" | "going" | "has_ticket";
type TabId = "lineup" | "tidsplan" | "gruppe";

type Act = {
  name: string;
  type?: string;
  stage?: string;
  showTitle?: string;
  timeLabel?: string;
  dateLabel?: string;
  date?: string;
  appearances?: { stage?: string; timeLabel?: string; dateLabel?: string }[];
};

type Pick = {
  user_id: string;
  user_name: string;
  act_name: string;
  category: PickStatus;
};

type Member = { id: string; name: string; role: string };
type Group = { id: number; name: string };
type ActiveGroup = {
  id: number;
  name: string;
  members: Member[];
  invites: { code: string }[];
  picks: Pick[];
};
type SessionData = {
  user: { id: string; name: string; email: string } | null;
  groups: Group[];
  activeGroup: ActiveGroup | null;
};

// ─── constants ────────────────────────────────────────────────────────────────

const PICK_STATUSES: PickStatus[] = ["interested", "going", "has_ticket"];

const STATUS_META: Record<string, { label: string; emoji: string; btnCls: string }> = {
  interested: { label: "Interesseret",  emoji: "🍺", btnCls: s.catInterested },
  going:      { label: "Går",           emoji: "👍", btnCls: s.catGoing },
  has_ticket: { label: "Skal i pitten", emoji: "🕳️", btnCls: s.catHasTicket },
  must:       { label: "Interesseret",  emoji: "🍺", btnCls: s.catInterested },
  should:     { label: "Interesseret",  emoji: "🍺", btnCls: s.catInterested },
  beer:       { label: "Interesseret",  emoji: "🍺", btnCls: s.catInterested },
};

const UI_KEY = "roskilde-friends-planner-ui-v1";

// ─── helpers ──────────────────────────────────────────────────────────────────

function loadUi() {
  if (typeof window === "undefined") return { search: "", selectedOnly: false, activeGroupId: null as number | null };
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY) ?? "{}");
    return {
      search:        typeof raw.search === "string" ? raw.search : "",
      selectedOnly:  Boolean(raw.selectedOnly),
      activeGroupId: Number.isInteger(raw.activeGroupId) ? (raw.activeGroupId as number) : null,
    };
  } catch {
    return { search: "", selectedOnly: false, activeGroupId: null as number | null };
  }
}

function saveUi(patch: Partial<{ search: string; selectedOnly: boolean; activeGroupId: number | null }>) {
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

// ─── component ────────────────────────────────────────────────────────────────

export default function RoskildePage() {
  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn, signOut } = useClerk();

  const [lineup,       setLineup]       = useState<Act[]>([]);
  const [session,      setSession]      = useState<SessionData>({ user: null, groups: [], activeGroup: null });
  const [search,       setSearch]       = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [groupName,    setGroupName]    = useState("");
  const [inviteCode,   setInviteCode]   = useState("");
  const [status,       setStatus]       = useState("");
  const [busy,         setBusy]         = useState(false);
  const [ready,        setReady]        = useState(false);
  const [drawerOpen,   setDrawerOpen]   = useState(false);

  // Mobile tab navigation
  const [activeTab, setActiveTab] = useState<TabId>("lineup");
  const [isMobile,  setIsMobile]  = useState(false);
  const savedScrolls = useRef<Record<TabId, number>>({ lineup: 0, tidsplan: 0, gruppe: 0 });

  const activeGroupIdRef = useRef<number | null>(null);
  const statusTimer      = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function flash(msg: string) {
    setStatus(msg);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(""), 3500);
  }

  // ── session ────────────────────────────────────────────────────────────────

  const fetchSession = useCallback(async (groupId?: number | null) => {
    const id  = groupId !== undefined ? groupId : activeGroupIdRef.current;
    const qs  = id ? `?groupId=${id}` : "";
    const pay = await api(`/api/roskilde/session${qs}`);
    setSession({ user: pay.user, groups: pay.groups ?? [], activeGroup: pay.activeGroup });
    if (pay.activeGroup) {
      activeGroupIdRef.current = pay.activeGroup.id;
      saveUi({ activeGroupId: pay.activeGroup.id });
    }
  }, []);

  // ── init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    api("/api/roskilde/lineup")
      .then((d) => setLineup(d.items ?? []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const ui = loadUi();
    setSearch(ui.search);
    setSelectedOnly(ui.selectedOnly);
    activeGroupIdRef.current = ui.activeGroupId;
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const ui = loadUi();
    fetchSession(ui.activeGroupId).finally(() => setReady(true));
  }, [isLoaded, isSignedIn, fetchSession]);

  // ── mobile breakpoint + URL-param ─────────────────────────────────────────

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    const p = new URLSearchParams(window.location.search).get("tab") as TabId | null;
    if (p === "lineup" || p === "tidsplan" || p === "gruppe") setActiveTab(p);
    return () => mq.removeEventListener("change", update);
  }, []);

  // ── scroll-restore efter tab-skift ────────────────────────────────────────

  useEffect(() => {
    const saved = savedScrolls.current[activeTab];
    requestAnimationFrame(() => {
      window.scrollTo(0, saved);
    });
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── busy wrapper ───────────────────────────────────────────────────────────

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Noget gik galt.");
    } finally {
      setBusy(false);
    }
  }

  // ── tab navigation ─────────────────────────────────────────────────────────

  function switchTab(tab: TabId) {
    savedScrolls.current[activeTab] = window.scrollY;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
    setActiveTab(tab);
  }

  // ── handlers ───────────────────────────────────────────────────────────────

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const pay = await api("/api/roskilde/groups", { method: "POST", body: JSON.stringify({ name: groupName }) });
      setGroupName("");
      await fetchSession(pay.groupId);
      flash("Gruppen er oprettet.");
    });
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!session.activeGroup) return;
    await run(async () => {
      const pay = await api("/api/roskilde/invites", {
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
      await api("/api/roskilde/invites/accept", {
        method: "POST",
        body: JSON.stringify({ code: inviteCode }),
      });
      setInviteCode("");
      await fetchSession();
      flash("Du er tilføjet til gruppen.");
    });
  }

  async function handleLeaveGroup(id: number, name: string) {
    if (!confirm(`Forlad gruppen "${name}"? Dine valg i gruppen slettes.`)) return;
    await run(async () => {
      await api(`/api/roskilde/groups/${id}/leave`, { method: "DELETE" });
      activeGroupIdRef.current = null;
      saveUi({ activeGroupId: null });
      await fetchSession(null);
      flash("Du har forladt gruppen.");
    });
  }

  async function handleDeleteGroup(id: number, name: string) {
    if (!confirm(`Slet gruppen "${name}"? Dette fjerner alle valg og invite-koder i gruppen.`)) return;
    await run(async () => {
      await api(`/api/roskilde/groups/${id}`, { method: "DELETE" });
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

  async function handlePick(actName: string, status: PickStatus) {
    if (!session.activeGroup || !session.user) return;
    const current = session.activeGroup.picks.find(
      (p) => p.act_name === actName && p.user_id === session.user!.id
    )?.category ?? null;
    await run(async () => {
      await api("/api/roskilde/picks", {
        method: "POST",
        body: JSON.stringify({
          groupId: session.activeGroup!.id,
          actName,
          category: current === status ? null : status,
        }),
      });
      await fetchSession();
    });
  }

  // ── derived ────────────────────────────────────────────────────────────────

  function myPick(actName: string): PickStatus | null {
    if (!session.user || !session.activeGroup) return null;
    return session.activeGroup.picks.find(
      (p) => p.act_name === actName && p.user_id === session.user!.id
    )?.category ?? null;
  }

  function picksFor(actName: string): Pick[] {
    return (session.activeGroup?.picks ?? []).filter((p) => p.act_name === actName);
  }

  function visibleActs(): Act[] {
    const q = search.trim().toLowerCase();
    const picked = new Set((session.activeGroup?.picks ?? []).map((p) => p.act_name));
    return lineup.filter((act) => {
      const hay = [act.name, act.type ?? "", act.stage ?? "", act.timeLabel ?? "", act.dateLabel ?? ""]
        .join(" ")
        .toLowerCase();
      return (!q || hay.includes(q)) && (!selectedOnly || picked.has(act.name));
    });
  }

  function timelineGroups(): [string, (Act & { picks: Pick[] })[]][] {
    const picksMap = new Map<string, Pick[]>();
    for (const p of session.activeGroup?.picks ?? []) {
      picksMap.set(p.act_name, [...(picksMap.get(p.act_name) ?? []), p]);
    }
    const selected = lineup
      .filter((a) => picksMap.has(a.name))
      .map((a) => ({ ...a, picks: picksMap.get(a.name)! }))
      .sort((a, b) => {
        const da = a.date ?? "9999", db = b.date ?? "9999";
        if (da !== db) return da.localeCompare(db);
        const ta = a.timeLabel ?? "99:99", tb = b.timeLabel ?? "99:99";
        if (ta !== tb) return ta.localeCompare(tb);
        return a.name.localeCompare(b.name);
      });

    const groups = new Map<string, typeof selected>();
    for (const act of selected) {
      const key = act.dateLabel ?? "Dato ikke offentliggjort";
      groups.set(key, [...(groups.get(key) ?? []), act]);
    }
    return [...groups.entries()];
  }

  function schedule(act: Act) {
    return [act.dateLabel, act.timeLabel, act.stage].filter(Boolean).join(" · ") || "Programinfo mangler";
  }

  // ── early states ───────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <div className={s.page}>
        <div className={s.loading}>
          <span className={s.loadingDot} />
          Loader line-up…
        </div>
      </div>
    );
  }

  const acts    = visibleActs();
  const tGroups = timelineGroups();
  const tCount  = tGroups.reduce((n, [, items]) => n + items.length, 0);

  // ── shared drawer / gruppe-tab content ─────────────────────────────────────

  const gruppeContent = (
    <>
      {/* Profil */}
      <div className={s.drawerSection}>
        <p className={s.sectionTag}>Profil</p>
        {!isSignedIn ? (
          <div className={s.authCard}>
            <p className={s.muted}>Log ind for at markere favoritter og dele med venner.</p>
            <button className={s.primaryBtn} onClick={() => { setDrawerOpen(false); openSignIn({ fallbackRedirectUrl: "/roskilde" }); }}>
              Log ind eller opret profil
            </button>
          </div>
        ) : (
          <div className={s.identityCard}>
            <div>
              <p className={s.identityName}>{session.user?.name}</p>
              <p className={s.identityEmail}>{session.user?.email}</p>
            </div>
            <button className={s.ghostBtn} onClick={() => signOut({ redirectUrl: "/roskilde" })}>Log ud</button>
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
                  <input className={s.fieldInput} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Fx Roskilde-gæng 2026" maxLength={50} required />
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
    </>
  );

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`${s.page} ${busy ? s.busy : ""}`}>

      {/* ── header ── */}
      <header className={s.header}>
        <Link href="/" className={s.backLink}>←</Link>
        <div className={s.headerCenter}>
          <span className={s.headerTitle}>Venneplanner</span>
          {status && <span className={s.statusMsg}>{status}</span>}
        </div>
        <div className={s.headerActions}>
          <button className={s.iconBtn} onClick={() => run(fetchSession)} aria-label="Opdatér" title="Opdatér">↻</button>
          <button
            className={`${s.iconBtn} ${drawerOpen ? s.iconBtnActive : ""} ${s.desktopOnly}`}
            onClick={() => setDrawerOpen(v => !v)}
            aria-label="Profil og gruppe"
            title="Profil og gruppe"
          >
            {session.activeGroup ? "●" : "○"}
          </button>
        </div>
      </header>

      {/* ── drawer overlay (desktop only) ── */}
      {drawerOpen && (
        <div className={`${s.drawerOverlay} ${s.desktopOnly}`} onClick={() => setDrawerOpen(false)} />
      )}

      {/* ── drawer panel (desktop only) ── */}
      <aside className={`${s.drawer} ${drawerOpen ? s.drawerOpen : ""} ${s.desktopOnly}`}>
        <div className={s.drawerHeader}>
          <span className={s.drawerTitle}>Profil & Gruppe</span>
          <button className={s.iconBtn} onClick={() => setDrawerOpen(false)} aria-label="Luk">✕</button>
        </div>
        {gruppeContent}
      </aside>

      {/* ══════════════════ TAB PANEL: TIDSPLAN ══════════════════ */}
      <div style={isMobile ? { display: activeTab === "tidsplan" ? "block" : "none" } : undefined}>

        {/* ── stats ── */}
        <div className={s.statsStrip}>
          {[
            { label: "Logget ind som", value: session.user?.name ?? "Gæst" },
            { label: "Aktiv gruppe",   value: session.activeGroup?.name ?? "—" },
            { label: "Valgte acts",    value: tCount },
            { label: "I line-up",      value: lineup.length },
          ].map(({ label, value }) => (
            <div key={label} className={s.statCard}>
              <span className={s.statLabel}>{label}</span>
              <span className={s.statValue}>{String(value)}</span>
            </div>
          ))}
        </div>

        {/* ── tidsplan ── */}
        <section className={s.section}>
          <p className={s.sectionTag}>Tidsplan</p>
          {tGroups.length === 0 ? (
            <div className={s.empty}>
              {session.activeGroup
                ? "Marker acts i line-up herunder — de samles her som en kronologisk tidsplan."
                : "Log ind og opret en gruppe for at bygge jeres tidsplan."}
            </div>
          ) : (
            tGroups.map(([day, items]) => (
              <div key={day} className={s.dayBlock}>
                <div className={s.dayHeader}>
                  <span className={s.dayTag}>Dag</span>
                  <h3 className={s.dayTitle}>{day}</h3>
                </div>
                {items.map((item) => (
                  <article key={item.name} className={s.timelineCard}>
                    <div className={s.timeSlot}>{item.timeLabel ?? "TBA"}</div>
                    <div className={s.timelineBody}>
                      <div className={s.timelineTop}>
                        <div>
                          <h4 className={s.actName}>{item.name}</h4>
                          <p className={s.actMeta}>{item.type ?? "Act"}</p>
                          <p className={s.actMeta}>{[item.stage, item.showTitle].filter(Boolean).join(" · ") || "Scene ikke offentliggjort endnu"}</p>
                        </div>
                      </div>
                      <div className={s.pickTags}>
                        {item.picks.map((p) => (
                          <span key={p.user_id} className={`${s.tag} ${STATUS_META[p.category].btnCls}`}>
                            {STATUS_META[p.category].emoji} {p.user_name}: {STATUS_META[p.category].label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ))
          )}
        </section>
      </div>{/* end tidsplan tab panel */}

      {/* ══════════════════ TAB PANEL: LINEUP ══════════════════ */}
      <div style={isMobile ? { display: activeTab === "lineup" ? "block" : "none" } : undefined}>
        <section className={s.section}>
          <p className={s.sectionTag}>Line-up · {lineup.length} acts</p>

          <div className={s.filterBar}>
            <input
              type="search"
              className={s.searchInput}
              placeholder="Søg i line-up…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); saveUi({ search: e.target.value }); }}
            />
            <label className={s.toggleRow}>
              <input type="checkbox" checked={selectedOnly} onChange={(e) => { setSelectedOnly(e.target.checked); saveUi({ selectedOnly: e.target.checked }); }} />
              <span>Vis kun valgte</span>
            </label>
          </div>

          {!session.activeGroup && (
            <p className={s.hint}>
              {session.user ? "Opret eller join en gruppe for at markere favoritter →" : "Log ind for at markere favoritter →"}
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

          {acts.length === 0 ? (
            <div className={s.empty}>Ingen acts matcher dit søgeord.</div>
          ) : (
            <div className={s.actsList}>
              {acts.map((act) => {
                const picks   = picksFor(act.name);
                const mine    = myPick(act.name);
                const canPick = !!(session.user && session.activeGroup);

                return (
                  <article key={act.name} className={s.actCard}>
                    <div className={s.actTop}>
                      <div className={s.actInfo}>
                        <h3 className={s.actName}>{act.name}</h3>
                        <p className={s.actMeta}>{act.type ?? "Act"} · {schedule(act)}</p>
                      </div>
                      <div className={s.catGrid}>
                        {PICK_STATUSES.map((key) => {
                          const meta = STATUS_META[key];
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
                          <span key={p.user_id} className={`${s.tag} ${STATUS_META[p.category].btnCls}`}>
                            {STATUS_META[p.category].emoji} {p.user_name}: {STATUS_META[p.category].label}
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
      </div>{/* end lineup tab panel */}

      {/* ══════════════════ TAB PANEL: GRUPPE (mobil) ══════════════════ */}
      <div
        className={s.gruppePanel}
        style={isMobile ? { display: activeTab === "gruppe" ? "block" : "none" } : undefined}
      >
        {gruppeContent}
      </div>

      {/* ══════════════════ MOBIL TAB BAR ══════════════════ */}
      <div className={s.tabBar} role="navigation" aria-label="Navigation">
        <button
          className={`${s.tabBarBtn} ${activeTab === "lineup" ? s.tabBarBtnActive : ""}`}
          onClick={() => switchTab("lineup")}
          aria-label="Line-up"
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
          aria-label="Tidsplan"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className={s.tabBarLabel}>Tidsplan</span>
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
        <span>Roskilde Venneplanner · albertdieckmann.dk</span>
        <Link href="/" className={s.footerLink}>← Tilbage</Link>
      </footer>
    </div>
  );
}
