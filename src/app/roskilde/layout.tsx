import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roskilde Venneplanner — albertdieckmann.dk",
  description:
    "Byg jeres fælles Roskilde-tidsplan. Log ind, opret en gruppe og invitér venner med en kode.",
};

export default function RoskildeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
