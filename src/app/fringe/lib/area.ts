export type Area =
  | "new_town"
  | "old_town"
  | "cowgate_grassmarket"
  | "pleasance"
  | "george_square"
  | "southside"
  | "other";

export const AREA_LABELS: Record<Area, string> = {
  old_town:            "Old Town",
  new_town:            "New Town",
  cowgate_grassmarket: "Cowgate / Grassmarket",
  pleasance:           "Pleasance",
  george_square:       "George Square",
  southside:           "Southside",
  other:               "Andet",
};

export const AREA_ORDER: Area[] = [
  "old_town",
  "new_town",
  "cowgate_grassmarket",
  "pleasance",
  "george_square",
  "southside",
  "other",
];

function byPostcode(postcode?: string | null): Area {
  if (!postcode) return "other";
  const pc = postcode.trim().toUpperCase().replace(/\s/g, "");
  if (pc.startsWith("EH11J") || pc.startsWith("EH11H")) return "cowgate_grassmarket";
  if (pc.startsWith("EH1")) return "old_town";
  if (pc.startsWith("EH2") || pc.startsWith("EH3")) return "new_town";
  if (pc.startsWith("EH89") || pc.startsWith("EH88")) return "pleasance";
  if (pc.startsWith("EH8")) return "george_square";
  if (pc.startsWith("EH9")) return "southside";
  return "other";
}

export function assignArea(
  lat?: number | null,
  lon?: number | null,
  postcode?: string | null,
): Area {
  if (lat == null || lon == null) return byPostcode(postcode);

  if (lat >= 55.953) return "new_town";

  if (lat >= 55.942 && lat <= 55.947 && lon >= -3.192 && lon <= -3.184)
    return "george_square";

  if (lat >= 55.946 && lat <= 55.951 && lon > -3.184) return "pleasance";

  if (lat >= 55.946 && lat <= 55.949 && lon >= -3.2 && lon <= -3.184)
    return "cowgate_grassmarket";

  if (lat > 55.949 && lat < 55.953 && lon >= -3.2 && lon <= -3.175)
    return "old_town";

  if (lat >= 55.93 && lat < 55.942 && lon >= -3.2 && lon <= -3.17)
    return "southside";

  return "other";
}
