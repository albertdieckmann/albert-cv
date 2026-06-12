import "server-only";
import { sql } from "@vercel/postgres";

// pg returns TIMESTAMP WITHOUT TIMEZONE columns as "YYYY-MM-DDTHH:MM:SS.000Z" (JS Date serialized as UTC).
// Our times are Edinburgh local time stored without an offset marker, so the Z suffix causes fmtEdinburgh
// to apply Europe/London (BST +1), shifting every time 1 hour forward and rolling late-night shows to
// the next day. Strip the Z+millis to restore the original "YYYY-MM-DD HH:MM:SS" format.
function normalizeTs(val: unknown): string | null {
  if (val == null) return null;
  // pg may return TIMESTAMP columns as Date objects or ISO strings — normalise both
  // to "YYYY-MM-DD HH:MM:SS" so fmtEdinburgh treats them as Edinburgh local time.
  const s = val instanceof Date ? val.toISOString() : String(val);
  return s.replace("T", " ").replace(/\.\d+Z$/, "").replace(/Z$/, "");
}

export async function buildGroupSession(_userId: string, groupId: number) {
  const [membersResult, invitesResult, picksResult, purchasesResult, coversResult, groupResult] =
    await Promise.all([
      sql`SELECT user_id as id, user_name as name, role FROM fringe_group_members WHERE group_id = ${groupId} ORDER BY joined_at ASC`,
      sql`SELECT code FROM fringe_invites WHERE group_id = ${groupId} AND used_by IS NULL ORDER BY created_at DESC LIMIT 5`,
      sql`SELECT user_id, user_name, show_id, show_title, status, performance_id, performance_start, performance_end FROM fringe_picks WHERE group_id = ${groupId} ORDER BY updated_at DESC`,
      sql`SELECT id, buyer_user_id, buyer_user_name, show_id, show_title, performance_id, performance_start, quantity, total_cost, notes, purchased_at FROM fringe_purchases WHERE group_id = ${groupId} ORDER BY purchased_at DESC`,
      sql`SELECT pc.purchase_id, pc.covered_user_id, pc.covered_user_name, pc.settled, pc.settled_at FROM fringe_purchase_covers pc JOIN fringe_purchases p ON p.id = pc.purchase_id WHERE p.group_id = ${groupId}`,
      sql`SELECT id, name, start_date, end_date FROM fringe_groups WHERE id = ${groupId}`,
    ]);

  const coversByPurchase = new Map<number, typeof coversResult.rows>();
  for (const cover of coversResult.rows) {
    const list = coversByPurchase.get(cover.purchase_id) ?? [];
    list.push(cover);
    coversByPurchase.set(cover.purchase_id, list);
  }

  const g = groupResult.rows[0];
  if (!g) return null;

  return {
    id: groupId,
    name: g.name,
    startDate: g.start_date ?? null,
    endDate: g.end_date ?? null,
    members: membersResult.rows,
    invites: invitesResult.rows,
    picks: picksResult.rows.map((p) => ({
      ...p,
      performance_start: normalizeTs(p.performance_start),
      performance_end:   normalizeTs(p.performance_end),
    })),
    purchases: purchasesResult.rows.map((p) => ({
      ...p,
      performance_start: normalizeTs(p.performance_start),
      covers: coversByPurchase.get(p.id) ?? [],
    })),
  };
}

export async function buildGroupList(userId: string) {
  const result = await sql`
    SELECT g.id, g.name, g.start_date, g.end_date
    FROM fringe_groups g
    JOIN fringe_group_members m ON g.id = m.group_id
    WHERE m.user_id = ${userId}
    ORDER BY g.id ASC
  `;
  return result.rows;
}
