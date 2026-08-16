import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "StoryBoard — Creator Submissions", template: "%s · StoryBoard" },
  description: "A thoughtful home for original stories, scripts, films and pitches.",
  applicationName: "StoryBoard",
  category: "entertainment",
  robots: { index: true, follow: true },
  openGraph: { title: "StoryBoard — Creator Submissions", description: "A thoughtful home for original stories, scripts, films and pitches.", type: "website", siteName: "StoryBoard" },
  twitter: { card: "summary", title: "StoryBoard — Creator Submissions", description: "A thoughtful home for original stories, scripts, films and pitches." },
  icons: { icon: "/icon.svg" }
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f8f6ef" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><div className="site-frame">{children}</div></body></html>; }
