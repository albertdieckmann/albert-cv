import type { Metadata } from "next";
import { DM_Serif_Display, DM_Mono, Instrument_Sans } from "next/font/google";
import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import "./globals.css";

const dmSerif = DM_Serif_Display({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-dm-serif",
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
});

const instrumentSans = Instrument_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-instrument-sans",
});

export const metadata: Metadata = {
  title: "Albert Dieckmann",
  description: "Delivery manager, product owner og GenAI-teamleder hos DR.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="da"
        className={`${dmSerif.variable} ${dmMono.variable} ${instrumentSans.variable}`}
      >
        <body>
          <div id="clerk-auth" style={{ position: "fixed", top: "1.25rem", right: "3rem", zIndex: 200, display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton />
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
