"use client";

import { AREA_LABELS, type Area } from "@/lib/fringe-area";
import { fmtEdinburgh, formatPerf, saveUi, PAGE_SIZE } from "./utils";
import { STATUS_META, STATUSES } from "./types";
import type { SessionData, Show, Performance, FringePick, PickStatus, TabId } from "./types";
import s from "./fringe.module.css";

type Props = {
  session: SessionData;
  shows: Show[];
  visible: Show[];
  allVisible: Show[];
  hasMore: boolean;
  visibleCount: number;
  setVisibleCount: (fn: (c: number) => number) => void;
  // Filters
  search: string;
  setSearch: (v: string) => void;
  selectedOnly: boolean;
  setSelectedOnly: (v: boolean) => void;
  hideInterested: boolean;
  setHideInterested: (v: boolean) => void;
  genreFilter: string[];
  setGenreFilter: (v: string[]) => void;
  areaFilter: Area[];
  setAreaFilter: (v: Area[]) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  groupDateLocked: boolean;
  genres: string[];
  areas: Area[];
  allDays: string[];
  dayStripRef: React.RefObject<HTMLDivElement | null>;
  // Per-show derived
  myPick: (showId: string) => FringePick | null;
  picksFor: (showId: string) => FringePick[];
  perfPicksFor: (showId: string, perfStart: string) => { name: string; status: PickStatus }[];
  perfsInRange: (show: Show) => Performance[];
  // State
  canPick: boolean;
  perfPicker: { showId: string; status: "going" | "has_ticket" } | null;
  setPerfPicker: (v: { showId: string; status: "going" | "has_ticket" } | null) => void;
  expandedShows: Set<string>;
  setExpandedShows: (fn: (prev: Set<string>) => Set<string>) => void;
  isMobile: boolean;
  activeTab: TabId;
  // Handlers
  handleStatusClick: (show: Show, status: PickStatus) => void;
  handleSelectPerformance: (show: Show, perf: Performance) => void;
  handleQuickJoin: (show: Show, perf: Performance) => void;
  handleDayChipClick: (day: string) => void;
  switchTab: (tab: TabId) => void;
  setDrawerOpen: (v: boolean) => void;
};

export function ShowsTab({
  session, shows, visible, allVisible, hasMore, visibleCount, setVisibleCount,
  search, setSearch, selectedOnly, setSelectedOnly, hideInterested, setHideInterested,
  genreFilter, setGenreFilter, areaFilter, setAreaFilter,
  dateFrom, setDateFrom, dateTo, setDateTo,
  groupDateLocked, genres, areas, allDays, dayStripRef,
  myPick, picksFor, perfPicksFor, perfsInRange,
  canPick, perfPicker, setPerfPicker, expandedShows, setExpandedShows,
  isMobile, activeTab,
  handleStatusClick, handleSelectPerformance, handleQuickJoin, handleDayChipClick,
  switchTab, setDrawerOpen,
}: Props) {
  return (
    <div
      style={isMobile ? { display: activeTab === "shows" ? "block" : "none" } : undefined}
    >
      <section className={s.section}>
        <div className={s.sectionHeader}>
          <p className={s.sectionTag}>
            Programme ·{" "}
            {allVisible.length < shows.length
              ? `${allVisible.length} af ${shows.length} shows`
              : `${shows.length} shows`}
          </p>
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

          {/* Genre chips */}
          {genres.length > 0 && (
            <div className={s.filterDimension}>
              <span className={s.filterDimLabel}>Genre</span>
              <div className={s.filterChipScroll}>
                {genres.map((g) => (
                  <button
                    key={g}
                    className={`${s.filterChip} ${genreFilter.includes(g) ? s.active : ""}`}
                    onClick={() => {
                      const next = genreFilter.includes(g) ? genreFilter.filter((x) => x !== g) : [...genreFilter, g];
                      setGenreFilter(next);
                      saveUi({ genreFilter: next });
                    }}
                  >
                    {g}
                  </button>
                ))}
                {genreFilter.length > 0 && (
                  <button className={s.filterChipClear} onClick={() => { setGenreFilter([]); saveUi({ genreFilter: [] }); }}>Ryd</button>
                )}
              </div>
            </div>
          )}

          {/* Area chips */}
          {areas.length > 1 && (
            <div className={s.filterDimension}>
              <span className={s.filterDimLabel}>Område</span>
              <div className={s.filterChipScroll}>
                {areas.map((area) => (
                  <button
                    key={area}
                    className={`${s.filterChip} ${areaFilter.includes(area) ? s.active : ""}`}
                    onClick={() => {
                      const next = areaFilter.includes(area) ? areaFilter.filter((a) => a !== area) : [...areaFilter, area];
                      setAreaFilter(next);
                      saveUi({ areaFilter: next });
                    }}
                  >
                    {AREA_LABELS[area]}
                  </button>
                ))}
                {areaFilter.length > 0 && (
                  <button className={s.filterChipClear} onClick={() => { setAreaFilter([]); saveUi({ areaFilter: [] }); }}>Ryd</button>
                )}
              </div>
            </div>
          )}

          {/* Date day strip */}
          {allDays.length > 0 && (
            <div className={s.filterDimension}>
              <span className={s.filterDimLabel}>Dato</span>
              <div className={s.filterChipScroll} ref={dayStripRef}>
                {allDays.map((day, i) => {
                  const isEndpoint = day === dateFrom || day === dateTo;
                  const isInRange  = !!(dateFrom && dateTo && dateFrom !== dateTo && day > dateFrom && day < dateTo);
                  const date     = new Date(day + "T12:00:00Z");
                  const prevDate = i > 0 ? new Date(allDays[i - 1] + "T12:00:00Z") : null;
                  const monthChanged = prevDate != null && date.getUTCMonth() !== prevDate.getUTCMonth();
                  const weekday  = date.toLocaleDateString("da-DK", { weekday: "short", timeZone: "UTC" });
                  const dayNum   = date.toLocaleDateString("da-DK", { day: "numeric",   timeZone: "UTC" });
                  const monthLbl = date.toLocaleDateString("da-DK", { month: "short",    timeZone: "UTC" });
                  const ariaLbl  = date.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
                  return (
                    <span key={day} style={{ display: "contents" }}>
                      {monthChanged && (
                        <span className={s.dayMonthSep} aria-hidden="true">{monthLbl.toUpperCase()}</span>
                      )}
                      <button
                        className={`${s.dayChip} ${isEndpoint ? s.dayChipSelected : isInRange ? s.dayChipInRange : ""}`}
                        onClick={() => handleDayChipClick(day)}
                        aria-pressed={isEndpoint || isInRange}
                        aria-label={ariaLbl}
                        data-day={day}
                        disabled={groupDateLocked}
                      >
                        <span className={s.dayChipDay}>{weekday}</span>
                        <span className={s.dayChipNum}>{dayNum}</span>
                      </button>
                    </span>
                  );
                })}
                {(dateFrom || dateTo) && !groupDateLocked && (
                  <button
                    className={s.filterChipClear}
                    onClick={() => { setDateFrom(""); setDateTo(""); saveUi({ dateFrom: "", dateTo: "" }); }}
                  >
                    Ryd
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Vis chips */}
          <div className={s.filterDimension}>
            <span className={s.filterDimLabel}>Vis</span>
            <div className={s.filterChipScroll}>
              <button
                className={`${s.filterChip} ${selectedOnly ? s.active : ""}`}
                onClick={() => { setSelectedOnly(!selectedOnly); saveUi({ selectedOnly: !selectedOnly }); }}
              >
                Kun mine
              </button>
              <button
                className={`${s.filterChip} ${hideInterested ? s.active : ""}`}
                onClick={() => setHideInterested(!hideInterested)}
              >
                Kun besluttet
              </button>
            </div>
          </div>
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
              const picks        = picksFor(show.id);
              const mine         = myPick(show.id);
              const isPickerOpen = perfPicker?.showId === show.id;
              const rangePerfs   = perfsInRange(show);
              const venueNames   = [...new Set(show.performances.map((p) => (p as Performance & { venueName?: string }).venueName).filter(Boolean))];
              const venueLabel   = venueNames.length > 1 ? "Multiple venues" : show.venue.name;
              const perfCount    = (dateFrom || dateTo) ? rangePerfs.length : null;
              const metaParts    = [
                show.genre,
                venueLabel,
                perfCount !== null ? `${perfCount} forestilling${perfCount !== 1 ? "er" : ""}` : null,
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

                  {/* Group picks + quick-join */}
                  {picks.length > 0 && (() => {
                    const myCurrentPick = myPick(show.id);
                    const myIsoCommitted =
                      myCurrentPick?.performance_start &&
                      (myCurrentPick.status === "going" || myCurrentPick.status === "has_ticket")
                        ? new Date(myCurrentPick.performance_start).toISOString()
                        : null;

                    const joinablePerfs = new Map<string, Performance>();
                    for (const p of picks) {
                      if (
                        p.user_id === session.user?.id ||
                        !(p.status === "going" || p.status === "has_ticket") ||
                        !p.performance_start
                      ) continue;
                      const iso = new Date(p.performance_start).toISOString();
                      if (iso === myIsoCommitted) continue;
                      if (!joinablePerfs.has(iso)) {
                        joinablePerfs.set(iso, { start: p.performance_start!, end: p.performance_end ?? p.performance_start! });
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
        <div className={s.showsFooter}>
          {hasMore && (
            <button
              className={s.ghostBtn}
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              Vis flere · {allVisible.length - visibleCount} tilbage
            </button>
          )}
          {allVisible.length > 10 && (
            <button
              className={s.scrollTopBtn}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Scroll til toppen"
            >
              ↑ Top
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
