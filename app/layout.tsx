import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

type LayoutProps = Readonly<{ children: React.ReactNode }>;

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Digital Heroes", template: "%s | Digital Heroes" },
  description: "Golf performance, monthly rewards, and charity impact in one community.",
};

export default function RootLayout({ children }: LayoutProps) {
  return <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}><body className="min-h-full flex flex-col">{children}</body></html>;
}
