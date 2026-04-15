import { describe, it, expect } from "vitest";

describe("contact API validering", () => {
  it("returnerer 400 ved manglende felter", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const req = new Request("http://localhost/api/contact", {
      method: "POST",
      body: JSON.stringify({ name: "", email: "", message: "" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Manglende felter");
  });
});
