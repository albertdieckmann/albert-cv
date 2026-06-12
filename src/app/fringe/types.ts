import s from "./fringe.module.css";
import type { Area } from "@/app/fringe/lib/area";

export type PickStatus = "interested" | "going" | "has_ticket";

export type Performance = {
  start: string;
  end: string;
  durationMinutes?: number;
  price?: number;
  priceString?: string;
};

export type Show = {
  id: string;
  title: string;
  subTitle?: string;
  artist?: string;
  genre?: string;
  descriptionTeaser?: string;
  website?: string;
  venue: { name: string; area: Area };
  performances: Performance[];
};

export type FringePick = {
  user_id: string;
  user_name: string;
  show_id: string;
  show_title: string;
  status: PickStatus;
  performance_id: string | null;
  performance_start: string | null;
  performance_end: string | null;
};

type PurchaseCover = {
  covered_user_id: string;
  covered_user_name: string;
  settled: boolean;
  settled_at: string | null;
};

export type Purchase = {
  id: number;
  buyer_user_id: string;
  buyer_user_name: string;
  show_id: string;
  show_title: string;
  performance_id: string | null;
  performance_start: string | null;
  total_cost: string | null;
  notes: string | null;
  purchased_at: string;
  covers: PurchaseCover[];
};

export type TabId  = "shows" | "plan" | "gruppe";
type Member = { id: string; name: string; role: string };
type Group  = { id: number; name: string; start_date?: string | null; end_date?: string | null };
export type ActiveGroup = {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  members: Member[];
  invites: { code: string }[];
  picks: FringePick[];
  purchases: Purchase[];
};
export type SessionData = {
  user: { id: string; name: string; email: string } | null;
  groups: Group[];
  activeGroup: ActiveGroup | null;
};

export type PurchaseForm = {
  editId?: number;
  showId: string;
  perfStart: string;
  perfId: string;
  cost: string;
  notes: string;
  covered: string[];
};

export type ConflictLevel = "hard" | "soft";
export type ConflictEntry = {
  level: ConflictLevel;
  otherShowTitle: string;
  otherPerfStart: string;
};

export const STATUS_META: Record<PickStatus, { label: string; emoji: string; cls: string; btnCls: string }> = {
  interested: { label: "Vil gerne", emoji: "🤷", cls: s.tagInterested, btnCls: s.statusBtnInterested },
  going:      { label: "Skal med",  emoji: "👍", cls: s.tagGoing,      btnCls: s.statusBtnGoing      },
  has_ticket: { label: "Har billet",emoji: "🎫", cls: s.tagTicket,     btnCls: s.statusBtnTicket     },
};

export const STATUSES: PickStatus[] = ["interested", "going", "has_ticket"];
