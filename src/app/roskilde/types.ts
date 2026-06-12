export type PickCategory = "interested" | "going" | "has_ticket";
export type TabId = "lineup" | "tidsplan" | "gruppe";
export type TimeSlot = "alle" | "formiddag" | "eftermiddag" | "aften" | "nat";

export type Appearance = {
  dateLabel?: string;
  timeLabel?: string;
  stage?: string;
  date?: string;
  showTitle?: string;
};

export type Act = {
  name: string;
  type?: string;
  lineupSceneLabel?: string;
  url?: string;
  countryCode?: string;
  appearances?: Appearance[];
  dateLabel?: string;
  timeLabel?: string;
  date?: string;
  stage?: string;
};

export type GroupPick = {
  userId: string;
  displayName: string;
  actName: string;
  appearanceDate: string;
  category: PickCategory;
};

export type GroupMember = { memberId: string; userId: string; displayName: string };

export type Group = {
  id: string;
  name: string;
  shareToken: string;
  memberId: string;
  recallCode: string;
  members: GroupMember[];
  picks: GroupPick[];
};

export type User = {
  userId: string;
  displayName: string;
};

export type Place = { id: string; name: string; emoji?: string | null; created_by?: string | null };

export type PresenceMember = { name: string; checkedInAt: string; expiresAt: string };

export type PresenceTarget =
  | { type: "performance"; performanceId: string; members: PresenceMember[] }
  | { type: "place"; placeId: string; members: PresenceMember[] };

export type ActiveCheckin =
  | { targetType: "performance"; performanceId: string }
  | { targetType: "place"; placeId: string }
  | null;

export type PresenceData = {
  version: string;
  targets: PresenceTarget[];
  me: { active: ActiveCheckin };
};
