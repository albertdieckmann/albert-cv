"use client";

import { fmtEdinburgh, formatPerf, conflictKey, toComparableIso } from "./utils";
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
  perfPicker: { showId: string; status: "going" | "has_ticket" } | null;
  setPerfPicker: (v: { showId: string; status: "going" | "has_ticket" } | null) => void;
  expandedShows: Set<string>;
  setExpandedShows: (fn: (prev: Set<string>) => Set<string>) => void;
  perfsInRange: (show: Show) => Performance[];
  perfPicksFor: (showId: string, perfStart: string) => { name: string; status: PickStatus }[];
  handleStatusClick: (show: Show, status: PickStatus) => void;
  handleSelectPerformance: (show: Show, perf: Performance) => void;
  handleQuickJoin: (show: Show, perf: Performance) => void;
};

function formatDayKey(day: string): string {
  const d = new Date(day + "T12:00:00Z");
  return d.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export function PlanTab({
  session, shows, pGroups, conflicts, tCount,
  dateFrom, dateTo, canPick, isMobile, activeTab,
  perfPicker, setPerfPicker, expandedShows, setExpandedShows,
  perfsInRange, perfPicksFor,
  handleStatusClick, handleSelectPerformance, handleQuickJoin,
}: Props) {
  return (
    <div
      style={isMobile ? { display: activeTab === "plan" ? "block" : "none" } : undefined}
    >
      {/* Stats */}
      <div className={s.statsStrip}>
        {[
          { label: "Du",        value: session.user?.name.split(" ")[0] ?? "Gæst" },
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
                    <h3 className={s.dayTitle}>{formatDayKey(day)}</h3>
                  </>
                )}
              </div>
              {items.map(({ show, picks }) => {
                const myPickInCard = session.user ? picks.find((p) => p.user_id === session.user!.id) : undefined;
                const allOnlyInterested = picks.every((p) => p.status === "interested");
                const isPickerOpen = perfPicker?.showId === show.id;
                const rangePerfs = perfsInRange(show);

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
                    ? toComparableIso(myPickInCard.performance_start)
                    : null;
                const joinablePerfs = new Map<string, Performance>();
                for (const p of picks) {
                  if (p.user_id === session.user?.id) continue;
                  if (!(p.status === "going" || p.status === "has_ticket") || !p.performance_start) continue;
                  const iso = toComparableIso(p.performance_start);
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
                        <p className={s.showMeta}>
                          {[show.genre, show.venue.name].filter(Boolean).join(" · ") || "Info mangler"}
                        </p>
                        {show.website && (
                          <a href={show.website} target="_blank" rel="noopener noreferrer" className={s.ticketLink}>
                            Billetter ↗
                          </a>
                        )}
                      </div>
                      <div className={s.statusGrid}>
                        {STATUSES.map((status) => {
                          const meta = STATUS_META[status];
                          const isActive = myPickInCard?.status === status;
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

                    {show.descriptionTeaser && expandedShows.has(show.id) && (
                      <p className={s.showDescription}>{show.descriptionTeaser}</p>
                    )}

                    {/* Performance picker */}
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
