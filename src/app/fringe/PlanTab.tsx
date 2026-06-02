"use client";

import { fmtEdinburgh, conflictKey } from "./utils";
import { STATUS_META, STATUSES } from "./types";
import type { SessionData, Show, Performance, FringePick, ConflictEntry, PickStatus, TabId } from "./types";
import s from "./fringe.module.css";

type PlanGroup = [string, { show: Show; picks: FringePick[] }[]];

type Props = {
  session: SessionData;
  shows: Show[];
  pGroups: PlanGroup[];
  conflicts: Map<string, ConflictEntry[]>;
  tCount: number;
  dateFrom: string;
  dateTo: string;
  canPick: boolean;
  isMobile: boolean;
  activeTab: TabId;
  handleStatusClick: (show: Show, status: PickStatus) => void;
  handleQuickJoin: (show: Show, perf: Performance) => void;
};

export function PlanTab({
  session, shows, pGroups, conflicts, tCount,
  dateFrom, dateTo, canPick, isMobile, activeTab,
  handleStatusClick, handleQuickJoin,
}: Props) {
  return (
    <div
      style={isMobile ? { display: activeTab === "plan" ? "block" : "none" } : undefined}
    >
      {/* Stats */}
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

      {/* Timeline */}
      <section className={s.section}>
        <p className={s.sectionTag}>Jeres plan</p>

        {pGroups.length === 0 ? (
          <div className={s.empty}>
            {!session.activeGroup
              ? "Log ind og opret en gruppe for at bygge jeres plan."
              : (dateFrom || dateTo)
              ? "Ingen shows i det valgte datointerval — justér datofilteret for at se resten af planen."
              : "Marker shows som 'Vil gerne', 'Skal med' eller 'Har billet' — de dukker op her."}
          </div>
        ) : (
          pGroups.map(([day, items]) => (
            <div key={day} className={s.dayBlock}>
              <div className={s.dayHeader}>
                {day === "~" ? (
                  <h3 className={s.dayTitle} style={{ color: "var(--muted)", fontStyle: "italic" }}>Ikke planlagt endnu</h3>
                ) : (
                  <>
                    <span className={s.dayTag}>Dag</span>
                    <h3 className={s.dayTitle}>{day}</h3>
                  </>
                )}
              </div>
              {items.map(({ show, picks }) => {
                const myPickInCard = session.user ? picks.find((p) => p.user_id === session.user!.id) : undefined;
                const allOnlyInterested = picks.every((p) => p.status === "interested");

                const pickConflicts = picks.map((p) => ({
                  pick: p,
                  entries: p.performance_start
                    ? (conflicts.get(conflictKey(p.user_id, p.show_id, p.performance_start)) ?? [])
                    : [],
                }));
                const hasHard = pickConflicts.some((pc) => pc.entries.some((e) => e.level === "hard"));
                const hasSoft = pickConflicts.some((pc) => pc.entries.some((e) => e.level === "soft"));

                const myIsoCommitted =
                  myPickInCard?.performance_start &&
                  (myPickInCard.status === "going" || myPickInCard.status === "has_ticket")
                    ? new Date(myPickInCard.performance_start).toISOString()
                    : null;
                const joinablePerfs = new Map<string, Performance>();
                for (const p of picks) {
                  if (p.user_id === session.user?.id) continue;
                  if (!(p.status === "going" || p.status === "has_ticket") || !p.performance_start) continue;
                  const iso = new Date(p.performance_start).toISOString();
                  if (iso === myIsoCommitted) continue;
                  if (!joinablePerfs.has(iso)) joinablePerfs.set(iso, { start: p.performance_start!, end: p.performance_end ?? p.performance_start! });
                }
                const joinableList = [...joinablePerfs.values()];
                const multiPerf = joinableList.length > 1;

                return (
                  <article
                    key={show.id}
                    className={[
                      s.showCard,
                      allOnlyInterested ? s.timelineCardInterested : "",
                      hasHard ? s.hasConflictHard : hasSoft ? s.hasConflictSoft : "",
                    ].join(" ")}
                  >
                    <div className={s.showTop}>
                      <div className={s.showInfo}>
                        <h3 className={s.showTitle}>{show.title}</h3>
                        <p className={s.showMeta}>
                          {[show.genre, show.venue.name].filter(Boolean).join(" · ") || "Info mangler"}
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
                                onClick={() => handleStatusClick(show, status)}
                                title={meta.label}
                              >
                                {meta.emoji}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

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
                        {[...picks]
                          .sort((a, b) =>
                            a.user_id === session.user?.id ? -1 :
                            b.user_id === session.user?.id ?  1 : 0
                          )
                          .map((p) => (
                            <span key={p.user_id} className={`${s.tag} ${STATUS_META[p.status].cls}`}>
                              {STATUS_META[p.status].emoji} {p.user_name}: {STATUS_META[p.status].label}
                              {p.performance_start && (p.status === "going" || p.status === "has_ticket") && (
                                <span className={s.pickTime}>
                                  {fmtEdinburgh(p.performance_start, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </span>
                          ))}
                      </div>
                      {canPick && joinableList.length > 0 && (
                        <div className={s.quickJoinRow}>
                          {joinableList.map((perf) => (
                            <button
                              key={perf.start}
                              className={s.quickJoinBtn}
                              onClick={() => handleQuickJoin(show, perf)}
                              title={`Tag med til ${fmtEdinburgh(perf.start, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                            >
                              {multiPerf
                                ? `+ Tag med · ${fmtEdinburgh(perf.start, { weekday: "short", hour: "2-digit", minute: "2-digit" })}`
                                : "+ Tag med"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
