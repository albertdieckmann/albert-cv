import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fringe Venneplanner",
  description: "Planlæg Edinburgh Fringe med dine venner",
};

export default function FringeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
