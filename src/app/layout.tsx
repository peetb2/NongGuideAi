import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NongGuide AI — AI Tourist Guide & Travel Specialist Chatbot",
  description: "Upload your travel docs or crawl your website, get an API key, paste one line of script. NongGuide AI turns your knowledge base into an AI tourist guide widget your visitors can talk to.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased text-charcoal selection:bg-sage-300 selection:text-charcoal">
        {children}
      </body>
    </html>
  );
}
