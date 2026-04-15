import { sql } from "@vercel/postgres";
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { name, email, message } = await req.json();

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Manglende felter" }, { status: 400 });
  }

  // Gem henvendelse i databasen
  await sql`
    INSERT INTO contact_messages (name, email, message, created_at)
    VALUES (${name}, ${email}, ${message}, NOW())
  `;

  // Send bekræftelsesmail med Resend
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "hej@albertdieckmann.dk",
    to: "ad.albertdieckmann@gmail.com",
    subject: `Ny henvendelse fra ${name}`,
    text: `Fra: ${name} <${email}>\n\n${message}`,
  });

  return NextResponse.json({ ok: true, resend: result });
}
