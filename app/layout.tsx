import GlobalVoiceAssistant from "@/components/global-voice-assistant";
import type { Metadata, Viewport } from "next";
import { Newsreader, Instrument_Sans } from "next/font/google";
import "./globals.css";

const display = Newsreader({ subsets: ["latin"], variable: "--font-display" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Visionmate AI",
  description: "A second pair of eyes for every medicine you take.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
  {children}

  <GlobalVoiceAssistant />
</body>
    </html>
  );
}
