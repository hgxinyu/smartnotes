import type { Metadata } from "next";
import Link from "next/link";
import AuthControls from "./auth-controls";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartNotes",
  description: "Capture notes quickly and auto-organize them by category."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="topbar">
            <div className="topbarInner">
              <Link href="/" className="brand">
                SmartNotes
              </Link>
              <nav className="nav">
                <Link href="/">Home</Link>
                <Link href="/notes">All Notes</Link>
                <Link href="/categories">Categories</Link>
              </nav>
              <AuthControls />
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
