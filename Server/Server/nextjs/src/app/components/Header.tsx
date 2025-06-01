"use client"

import Link from "next/link"
      
import Image from "next/image"
import { Button } from "~/components/ui/button"
import { LogIn, LogOut, User } from "lucide-react"
import { useLogout } from "~/lib/auth";
import { useSession } from "next-auth/react";
import { ThemeSwitcher } from "./ThemeSwitcher"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

export default function Header() {
  const logout = useLogout();
  const { data: session, status } = useSession();
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          {/* 2. Add the Image component here */}
          <Image
            src="/vceljak.png" // Path to your image in the public directory
            alt="VcelJak Logo" // Important for accessibility
            width={32}        // Specify the desired width (in pixels)
            height={32}       // Specify the desired height (in pixels)
            className="mr-2"  // Optional: add margin or other classes
          />
          <span className="text-xl font-bold text-primary">VcelJak</span>
        </Link>
        
        <div className="flex items-center space-x-2">
          <ThemeSwitcher />
          {session?.user ? (
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <User className="mr-2 h-4 w-4" />
                admin
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Admin Controls</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link href="/admin/sensors" className="flex w-full">
                  Sensors & Hubs
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/admin/hubs" className="flex w-full">
                  Hub Management
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/admin/groups" className="flex w-full">
                  Group Management
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/admin/tags" className="flex w-full">
                  Tags
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/admin/rules" className="flex w-full">
                  Rules
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/admin/schedules" className="flex w-full">
                  Schedules
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/admin/sessions" className="flex w-full">
                  Sessions
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/admin/config" className="flex w-full">
                  Server Configuration
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          ) : (
            <Button effect="shineHover" variant="outline" size="sm" asChild>
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

