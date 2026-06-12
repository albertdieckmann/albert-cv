"use client";

import type { PresenceMember } from "../types";
import { initials } from "../utils";
import s from "../roskilde.module.css";

export function AvatarStack({ members }: { members: PresenceMember[] }) {
  const shown = members.slice(0, 4);
  const rest = members.length - shown.length;
  if (!shown.length) return null;
  return (
    <div className={s.avatarStack}>
      {shown.map((m, i) => (
        <div key={i} className={s.avatarCircle} title={m.name}>{initials(m.name)}</div>
      ))}
      {rest > 0 && <div className={s.avatarCircle}>+{rest}</div>}
    </div>
  );
}
