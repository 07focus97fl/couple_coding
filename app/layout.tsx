/**
 * WHAT:    The root HTML shell for every page: loads the web fonts and sets the
 *          page title and description.
 * STEP:    Page shell.
 * RUNS ON: server (React server component)
 */
import type { Metadata } from "next";
import { DM_Serif_Display, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSerif = DM_Serif_Display({
  variable: "--font-serif",
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Couple Conversation Coder",
  description:
    "Code couple conversation transcripts with the LLM of your choice (Anthropic, OpenAI or Google).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSerif.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
