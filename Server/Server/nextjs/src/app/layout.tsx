"use client"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Header from "./components/Header"
import Footer from "./components/Footer"
import Flashlight from "./components/Flashlight"
import QueryProvider from "./components/QueryProvider"
import { SSEProvider } from "./components/SSEProvider";
import type React from "react"
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "~/lib/ThemeContext"

const inter = Inter({ subsets: ["latin"] })



export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">

      <body className={inter.className}>
      <ThemeProvider>
        <SessionProvider>
            <QueryProvider>
              <SSEProvider>
                <div className="flex flex-col min-h-screen relative">
                  <Flashlight size={600} intensity={0.6}/>
                  <Header />
                  <main className="flex-grow container mx-auto px-4 py-8 relative z-10 mt-16">{children}</main>
                  
                </div>
              </SSEProvider>
            </QueryProvider>
        </SessionProvider>
      </ThemeProvider>
      </body>

    </html>
  )
}

