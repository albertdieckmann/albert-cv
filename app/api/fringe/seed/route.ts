import { auth, currentUser } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

const SHOWS = {
  shakespeare: {
    id: "https://api.edinburghfestivalcity.com/events/027de8f055e415def99fd3d1173c64e211a71f77",
    title: "FAKE Breakfast for Shakespeare",
    start: "2026-08-05T10:00:00",
    end: "2026-08-05T10:50:00",
  },
  jazz: {
    id: "https://api.edinburghfestivalcity.com/events/0789c2d8302022323098a177c0c9c9f7e69c5502",
    title: "FAKE at Lunchtime Jazz",
    start: "2026-08-07T13:00:00",
    end: "2026-08-07T14:00:00",
  },
  martinez: {
    id: "https://api.edinburghfestivalcity.com/events/80364a78a98a148206fe5b460b4015f5fb0fc0c4",
    title: "FAKE Martinez Music My – Daniel Best The of",
    start: "2026-08-07T13:00:00",
    end: "2026-08-07T14:10:00",
  },
  monster: {
    id: "https://api.edinburghfestivalcity.com/events/563f313d109ba639198468593f4cbc530f40dc6d",
    title: "FAKE Monster Dead Are and Frankenstein's Cinderella",
    start: "2026-08-07T13:05:00",
    end: "2026-08-07T13:50:00",
  },
  cluedo: {
    id: "https://api.edinburghfestivalcity.com/events/1d42bcdf1b6cb0d91ed8b1ebeac350c6e85d5c83",
    title: "FAKE Cluedo",
    start: "2026-08-10T19:30:00",
    end: "2026-08-10T21:30:00",
  },
};

const ALICE = { id: "seed_alice_001", name: "Alice Andersen" };
const BOB   = { id: "seed_bob_001",   name: "Bob Bagger" };

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const clerk = await currentUser();
  const userName = [clerk?.firstName, clerk?.lastName].filter(Boolean).join(" ").trim() || "Du";

  // 1. Create group
  const { rows: [{ id: groupId }] } = await sql`
    INSERT INTO fringe_groups (name, created_by) VALUES ('Test-gang', ${userId}) RETURNING id
  `;

  // 2. Members: real user + two fake users
  for (const m of [
    { id: userId, name: userName, role: "owner" },
    { ...ALICE, role: "member" },
    { ...BOB,   role: "member" },
  ]) {
    await sql`
      INSERT INTO fringe_group_members (group_id, user_id, user_name, role)
      VALUES (${groupId}, ${m.id}, ${m.name}, ${m.role})
      ON CONFLICT (group_id, user_id) DO NOTHING
    `;
  }

  // 3. Picks
  const picks: { userId: string; userName: string; showKey: keyof typeof SHOWS; status: string; withPerf: boolean }[] = [
    // Aug 5 – Shakespeare: Alice has ticket, user is interested
    { userId: ALICE.id, userName: ALICE.name, showKey: "shakespeare", status: "has_ticket", withPerf: true },
    { userId,           userName,             showKey: "shakespeare", status: "interested", withPerf: false },

    // Aug 7 13:00 – Jazz: Alice going ← conflicts with Martinez (same time)
    { userId: ALICE.id, userName: ALICE.name, showKey: "jazz",      status: "going", withPerf: true },
    { userId: BOB.id,   userName: BOB.name,   showKey: "jazz",      status: "interested", withPerf: false },

    // Aug 7 13:00 – Martinez: Alice going ← overlaps with Jazz
    { userId: ALICE.id, userName: ALICE.name, showKey: "martinez", status: "going", withPerf: true },

    // Aug 7 13:05 – Monster: Bob going ← overlaps with Jazz
    { userId: BOB.id,   userName: BOB.name,   showKey: "monster",  status: "going", withPerf: true },

    // Aug 10 – Cluedo: Alice + Bob have tickets, user is interested
    { userId: ALICE.id, userName: ALICE.name, showKey: "cluedo", status: "has_ticket", withPerf: true },
    { userId: BOB.id,   userName: BOB.name,   showKey: "cluedo", status: "has_ticket", withPerf: true },
    { userId,           userName,             showKey: "cluedo", status: "interested", withPerf: false },
  ];

  for (const p of picks) {
    const show = SHOWS[p.showKey];
    const start = p.withPerf ? show.start : null;
    const end   = p.withPerf ? show.end   : null;
    await sql`
      INSERT INTO fringe_picks
        (group_id, user_id, user_name, show_id, show_title, status, performance_start, performance_end)
      VALUES
        (${groupId}, ${p.userId}, ${p.userName}, ${show.id}, ${show.title}, ${p.status}, ${start}, ${end})
      ON CONFLICT (group_id, user_id, show_id) DO UPDATE
        SET status = EXCLUDED.status,
            performance_start = EXCLUDED.performance_start,
            performance_end   = EXCLUDED.performance_end,
            updated_at        = NOW()
    `;
  }

  // 4. Purchase: Alice bought 2 Cluedo tickets (£30), covering herself and Bob
  const { rows: [{ id: p1 }] } = await sql`
    INSERT INTO fringe_purchases
      (group_id, buyer_user_id, buyer_user_name, show_id, show_title,
       performance_start, quantity, total_cost, notes)
    VALUES
      (${groupId}, ${ALICE.id}, ${ALICE.name}, ${SHOWS.cluedo.id}, ${SHOWS.cluedo.title},
       ${SHOWS.cluedo.start}, 2, 30.00, 'Online på edfringe.com')
    RETURNING id
  `;
  for (const m of [ALICE, BOB]) {
    await sql`
      INSERT INTO fringe_purchase_covers (purchase_id, covered_user_id, covered_user_name)
      VALUES (${p1}, ${m.id}, ${m.name})
      ON CONFLICT DO NOTHING
    `;
  }

  // 5. Purchase: Bob bought 1 Shakespeare ticket (£12), covering Alice
  const { rows: [{ id: p2 }] } = await sql`
    INSERT INTO fringe_purchases
      (group_id, buyer_user_id, buyer_user_name, show_id, show_title,
       performance_start, quantity, total_cost, notes)
    VALUES
      (${groupId}, ${BOB.id}, ${BOB.name}, ${SHOWS.shakespeare.id}, ${SHOWS.shakespeare.title},
       ${SHOWS.shakespeare.start}, 1, 12.00, null)
    RETURNING id
  `;
  await sql`
    INSERT INTO fringe_purchase_covers (purchase_id, covered_user_id, covered_user_name)
    VALUES (${p2}, ${ALICE.id}, ${ALICE.name})
    ON CONFLICT DO NOTHING
  `;

  return NextResponse.json({ ok: true, groupId, groupName: "Test-gang" });
}
