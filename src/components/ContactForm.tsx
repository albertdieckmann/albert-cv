"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "success" | "error";

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="contact-success">
        <p className="contact-success-icon">✓</p>
        <p className="contact-success-title">Besked sendt.</p>
        <p className="contact-success-sub">Jeg vender tilbage hurtigst muligt.</p>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="contact-field">
        <label className="contact-label" htmlFor="name">Navn</label>
        <input
          id="name"
          name="name"
          type="text"
          className="contact-input"
          placeholder="Dit navn"
          required
        />
      </div>
      <div className="contact-field">
        <label className="contact-label" htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          className="contact-input"
          placeholder="din@email.dk"
          required
        />
      </div>
      <div className="contact-field">
        <label className="contact-label" htmlFor="message">Besked</label>
        <textarea
          id="message"
          name="message"
          className="contact-input contact-textarea"
          placeholder="Hvad vil du tale om?"
          rows={4}
          required
        />
      </div>
      <button
        type="submit"
        className="contact-submit"
        disabled={status === "sending"}
      >
        {status === "sending" ? "Sender..." : "Send besked →"}
      </button>
      {status === "error" && (
        <p className="contact-error">Noget gik galt. Prøv igen eller skriv direkte til hej@albertdieckmann.dk</p>
      )}
    </form>
  );
}
