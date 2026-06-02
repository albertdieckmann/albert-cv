"use client";

import { formatPerf, fmtEdinburgh } from "./utils";
import type { Show, Performance, SessionData } from "./types";
import s from "./fringe.module.css";

type TicketDialogState = {
  show: Show;
  perf: Performance;
  coveredIds: string[];
  cost: string;
};

type JoinConfirmState = {
  show: Show;
  perf: Performance;
  currentPerfStart: string | null;
};

type TicketDialogProps = {
  ticketDialog: TicketDialogState | null;
  setTicketDialog: (v: TicketDialogState | null | ((prev: TicketDialogState | null) => TicketDialogState | null)) => void;
  session: SessionData;
  handleConfirmTickets: () => void;
};

export function TicketDialog({ ticketDialog, setTicketDialog, session, handleConfirmTickets }: TicketDialogProps) {
  if (!ticketDialog || !session.activeGroup) return null;
  const { dateStr, timeStr } = formatPerf(ticketDialog.perf);
  return (
    <div className={s.modalOverlay} onClick={() => setTicketDialog(null)}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHeader}>
          <h4 className={s.modalTitle}>Hvem har du billet til?</h4>
          <button className={s.iconBtn} onClick={() => setTicketDialog(null)}>✕</button>
        </div>
        <p className={s.muted} style={{ margin: "0 0 1rem" }}>
          {ticketDialog.show.title}{" · "}{dateStr} {timeStr}
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
  );
}

type JoinConfirmProps = {
  joinConfirm: JoinConfirmState | null;
  setJoinConfirm: (v: JoinConfirmState | null) => void;
  handleConfirmJoin: () => void;
};

export function JoinConfirmDialog({ joinConfirm, setJoinConfirm, handleConfirmJoin }: JoinConfirmProps) {
  if (!joinConfirm) return null;
  return (
    <div className={s.modalOverlay} onClick={() => setJoinConfirm(null)}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHeader}>
          <h4 className={s.modalTitle}>Flyt din forestilling?</h4>
          <button className={s.iconBtn} onClick={() => setJoinConfirm(null)}>✕</button>
        </div>
        <p className={s.muted} style={{ margin: "0 0 0.5rem" }}>
          Du har valgt{" "}
          {joinConfirm.currentPerfStart ? fmtEdinburgh(joinConfirm.currentPerfStart, {
            weekday: "short", day: "numeric", month: "short",
            hour: "2-digit", minute: "2-digit",
          }) : ""}
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
  );
}
