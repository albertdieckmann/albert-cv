import "server-only";
import { createHmac } from "crypto";

const API_BASE = "https://api.edinburghfestivalcity.com";

export function buildSignedUrl(path: string, params: Record<string, string>): string {
  const key = process.env.FRINGE_API_KEY!;
  const secret = process.env.FRINGE_API_SECRET!;

  const allParams = { ...params, key };
  const qs = Object.entries(allParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const toSign = `${path}?${qs}`;
  const sig = createHmac("sha1", secret).update(toSign).digest("hex");
  return `${API_BASE}${toSign}&signature=${sig}`;
}
