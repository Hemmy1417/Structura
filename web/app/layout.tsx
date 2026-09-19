import type { Metadata } from "next";
import { Azeret_Mono, Instrument_Sans } from "next/font/google";

import "./globals.css";
import { Shell } from "@/components/Shell";
import { WalletProvider } from "@/lib/wallet";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument",
});
const azeret = Azeret_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-azeret",
});

export const metadata: Metadata = {
  title: { default: "STRUCTURA", template: "%s | STRUCTURA" },
  description:
    "Construction milestone escrow, judged from the evidence. Validators on GenLayer read the photographs and documents a milestone's parties file, judge every contractual criterion, and only a finalized acceptance releases the payment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrument.variable} ${azeret.variable}`}>
      <body>
        <WalletProvider>
          <Shell>{children}</Shell>
        </WalletProvider>
      </body>
    </html>
  );
}
