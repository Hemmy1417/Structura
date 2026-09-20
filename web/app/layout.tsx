import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import { Shell } from "@/components/Shell";
import { WalletProvider } from "@/lib/wallet";

// One family, two roles: 600 for every headline (nothing heavier), 400 for
// everything a person reads.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: { default: "STRUCTURA", template: "%s | STRUCTURA" },
  description:
    "Construction milestone escrow, judged from the evidence. Validators on GenLayer read the photographs and documents a milestone's parties file, judge every contractual criterion, and only a finalized acceptance releases the payment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <WalletProvider>
          <Shell>{children}</Shell>
        </WalletProvider>
      </body>
    </html>
  );
}
