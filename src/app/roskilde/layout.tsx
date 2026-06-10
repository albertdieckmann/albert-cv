import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roskilde Venneplanner — albertdieckmann.dk",
  description:
    "Byg jeres fælles Roskilde-tidsplan. Opret en gruppe, invitér venner med et token og marker favoritter.",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🙌</text></svg>" },
};

export default function RoskildeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
