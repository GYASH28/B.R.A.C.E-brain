import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./workspace.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BRACE — One memory. Every AI.",
  description:
    "A local-first personal AI memory layer with provenance, project context, decisions, skills, and MCP access.",
  keywords: [
    "second brain",
    "AI memory",
    "MCP",
    "local-first",
    "B.R.A.C.E",
  ],
  authors: [{ name: "BRACE contributors" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/logo.png", type: "image/png", sizes: "1024x1024" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#dcecff",
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="light" data-theme="light" data-theme-preference="light">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var ui = JSON.parse(localStorage.getItem('brace.ui') || '{}');
                  var t = ui.theme || localStorage.getItem('second-brain-theme') || 'light';
                  var resolved = t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
                  var html = document.documentElement;
                  html.className = resolved;
                  html.dataset.theme = resolved;
                  html.dataset.themePreference = t;
                  html.style.colorScheme = resolved;
                } catch (e) {
                  document.documentElement.className = 'light';
                  document.documentElement.dataset.theme = 'light';
                  document.documentElement.dataset.themePreference = 'light';
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
