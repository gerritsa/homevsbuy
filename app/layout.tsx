import type { Metadata } from "next"
import { headers } from "next/headers"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers()
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https")
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000"

  return {
    title: "Home Decision Calculator | Buy vs. Rent",
    description:
      "Compare the monthly cost of buying and renting, explore your mortgage payment, and see home equity build year by year.",
    openGraph: {
      title: "Buy or rent? See the full picture.",
      description: "Monthly costs. Mortgage payoff. Year-by-year clarity.",
      images: [{ url: `${origin}/og.png`, width: 1664, height: 960 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Buy or rent? See the full picture.",
      description: "Monthly costs. Mortgage payoff. Year-by-year clarity.",
      images: [`${origin}/og.png`],
    },
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  )
}
