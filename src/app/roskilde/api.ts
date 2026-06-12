export async function api(path: string, options: RequestInit = {}, userId?: string | null) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error ?? "Noget gik galt.");
  return payload;
}
