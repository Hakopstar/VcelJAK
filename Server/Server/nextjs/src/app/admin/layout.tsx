"use client";
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "../globals.css"
import { useSession, signIn } from "next-auth/react";
import { useEffect } from "react";
import AdminSidebar from "./components/AdminSidebar"
import type React from "react"


export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

