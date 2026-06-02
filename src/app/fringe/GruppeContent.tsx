"use client";

import { useState, useEffect } from "react";
import { formatPerf } from "./utils";
import type { SessionData, Show, Purchase, PurchaseForm } from "./types";
import s from "./fringe.module.css";

type Props = {
  session: SessionData;
  isSignedIn: boolean;
  isGroupOwner: boolean;
  shows: Show[];
  clerkUserName: string | null;
  clerkUserEmail: string | null;
  // Handlers
  handleSaveGroupSettings: (e: React.FormEvent, editGroupName: string, editStartDate: string, editEndDate: string) => void;
  handleCreateGroup: (e: React.FormEvent, name: string, startDate: string, endDate: string, reset: () => void) => void;
  handleJoinGroup: (e: React.FormEvent, code: string, reset: () => void) => void;
  handleCreateInvite: (e: React.FormEvent) => void;
  handleCopyInvite: () => void;
  handleLeaveGroup: (id: number, name: string) => void;
  handleDeleteGroup: (id: number, name: string) => void;
  handleSwitchGroup: (id: number) => void;
  handleLogPurchase: (e: React.FormEvent, form: PurchaseForm, close: () => void) => void;
  handleEditPurchase: (purchase: Purchase) => PurchaseForm;
  handleDeletePurchase: (id: number, title: string) => void;
  handleSettle: (purchaseId: number, coveredUserId: string, settled: boolean) => void;
  openSignIn: () => void;
  setDrawerOpen: (v: boolean) => void;
  signOut: (opts: { redirectUrl: string }) => void;
  fmtEdinburgh: (iso: string, opts: Intl.DateTimeFormatOptions) => string;
};

export function GruppeContent({
  session, isSignedIn, isGroupOwner, shows,
  clerkUserName, clerkUserEmail,
  handleSaveGroupSettings, handleCreateGroup, handleJoinGroup,
  handleCreateInvite, handleCopyInvite, handleLeaveGroup, handleDeleteGroup, handleSwitchGroup,
  handleLogPurchase, handleEditPurchase, handleDeletePurchase, handleSettle,
  openSignIn, setDrawerOpen, signOut, fmtEdinburgh,
}: Props) {
  // ── Local form state (isolated here so keystrokes don't re-render the show list) ──
  const [groupName,      setGroupName]      = useState("");
  const [groupStartDate, setGroupStartDate] = useState("");
  const [groupEndDate,   setGroupEndDate]   = useState("");
  const [inviteCode,     setInviteCode]     = useState("");

  // Group settings — initialise from session, sync when group changes
  const [editGroupName, setEditGroupName] = useState(session.activeGroup?.name ?? "");
  const [editStartDate, setEditStartDate] = useState(session.activeGroup?.startDate?.slice(0, 10) ?? "");
  const [editEndDate,   setEditEndDate]   = useState(session.activeGroup?.endDate?.slice(0, 10)   ?? "");

  useEffect(() => {
    setEditGroupName(session.activeGroup?.name ?? "");
    setEditStartDate(session.activeGroup?.startDate?.slice(0, 10) ?? "");
    setEditEndDate(session.activeGroup?.endDate?.slice(0, 10)     ?? "");
  }, [session.activeGroup?.id]);

  const groupSettingsChanged = session.activeGroup != null && (
    editGroupName !== session.activeGroup.name ||
    (editStartDate || "") !== (session.activeGroup.startDate?.slice(0, 10) ?? "") ||
    (editEndDate   || "") !== (session.activeGroup.endDate?.slice(0, 10)   ?? "")
  );

  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm | null>(null);
  const [detailsOpen,  setDetailsOpen]  = useState(false);
  const [drawerMsg,    setDrawerMsg]    = useState("");

  return (
    <>
      {/* Profil */}
      <div className={s.drawerSection}>
        <p className={s.sectionTag}>Profil</p>
        {!isSignedIn ? (
          <div className={s.authCard}>
            <p className={s.muted}>Log ind for at markere shows og planlægge med venner.</p>
            <button className={s.primaryBtn} onClick={() => { setDrawerOpen(false); openSignIn(); }}>
              Log ind eller opret profil
            </button>
          </div>
        ) : (
          <div className={s.identityCard}>
            <div>
              <p className={s.identityName}>{session.user?.name ?? clerkUserName ?? "…"}</p>
              <p className={s.identityEmail}>{session.user?.email ?? clerkUserEmail ?? ""}</p>
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
              <form onSubmit={(e) => handleSaveGroupSettings(e, editGroupName, editStartDate, editEndDate)} className={s.groupSettingsForm}>
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
                    <input type="date" className={s.fieldInput} value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                  </label>
                  <label className={s.fieldWrap}>
                    <span className={s.fieldLabel}>Til</span>
                    <input type="date" className={s.fieldInput} value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
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

          {drawerMsg && <p className={s.drawerMsg}>{drawerMsg}</p>}

          <details className={s.details} open={detailsOpen} onToggle={(e) => setDetailsOpen((e.target as HTMLDetailsElement).open)}>
            <summary className={s.detailsSummary}>
              {session.groups.length === 0 ? "Opret gruppe eller join med invite-kode" : "Ny gruppe / join med kode"}
            </summary>
            <div className={s.detailsBody}>
              <form
                onSubmit={(e) => handleCreateGroup(e, groupName, groupStartDate, groupEndDate, () => {
                  setGroupName(""); setGroupStartDate(""); setGroupEndDate("");
                  setDetailsOpen(false);
                  setDrawerMsg("Gruppe oprettet ✓");
                  setTimeout(() => setDrawerMsg(""), 3000);
                })}
                className={s.stackForm}
              >
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
              <form
                onSubmit={(e) => handleJoinGroup(e, inviteCode, () => {
                  setInviteCode("");
                  setDetailsOpen(false);
                  setDrawerMsg("Du er med i gruppen ✓");
                  setTimeout(() => setDrawerMsg(""), 3000);
                })}
                className={s.stackForm}
              >
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
                      <div className={s.purchaseTopRight}>
                        {purchase.total_cost && (
                          <span className={s.purchaseCost}>£{parseFloat(purchase.total_cost).toFixed(2)}</span>
                        )}
                        {purchase.buyer_user_id === session.user?.id && (
                          <div className={s.purchaseActions}>
                            <button className={s.purchaseActionBtn} onClick={() => setPurchaseForm(handleEditPurchase(purchase))} title="Rediger">✎</button>
                            <button className={s.purchaseActionBtn} onClick={() => handleDeletePurchase(purchase.id, purchase.show_title)} title="Slet">✕</button>
                          </div>
                        )}
                      </div>
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
            <form onSubmit={(e) => handleLogPurchase(e, purchaseForm, () => setPurchaseForm(null))} className={`${s.stackForm} ${s.purchaseFormWrap}`}>
              {purchaseForm.editId && (
                <p className={s.fieldLabel} style={{ marginBottom: "0.5rem" }}>
                  Rediger: {shows.find((sh) => sh.id === purchaseForm.showId)?.title ?? purchaseForm.showId}
                </p>
              )}
              {!purchaseForm.editId && (
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
              )}

              {!purchaseForm.editId && purchaseForm.showId && (() => {
                const show = shows.find((sh) => sh.id === purchaseForm.showId);
                return show && show.performances.length > 0 ? (
                  <label className={s.fieldWrap}>
                    <span className={s.fieldLabel}>Forestilling</span>
                    <select
                      className={s.fieldSelect}
                      value={purchaseForm.perfStart}
                      onChange={(e) => setPurchaseForm((f) => f && ({ ...f, perfStart: e.target.value, perfId: e.target.value }))}
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
}
