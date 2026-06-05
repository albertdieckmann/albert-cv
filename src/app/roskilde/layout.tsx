import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roskilde Venneplanner — albertdieckmann.dk",
  description:
    "Byg jeres fælles Roskilde-tidsplan. Opret en gruppe, invitér venner med et token og marker favoritter.",
};

export default function RoskildeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
