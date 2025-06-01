"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "~/lib/utils"
import {
  Home,
  Settings,
  Database,
  Server,
  Clock,
  LogOut,
  Radio,
  Tag,
  AlertTriangle,
  Calendar,
  HelpCircle,
  Bell,
  LayoutDashboard,
} from "lucide-react"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { useLogout } from "~/lib/auth";

const sidebarItems = [
  { name: "Sensors & Hubs", href: "/admin/sensors", icon: Radio },
  { name: "Hub Management", href: "/admin/hubs", icon: Server },
  { name: "Group Management", href: "/admin/groups", icon: Database },
  { name: "Tags", href: "/admin/tags", icon: Tag },
  { name: "Rules", href: "/admin/rules", icon: AlertTriangle },
  { name: "Schedule", href: "/admin/schedules", icon: Calendar },
  { name: "Sessions", href: "/admin/sessions", icon: Clock },
  { name: "Server Configuration", href: "/admin/config", icon: Settings },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const logout = useLogout();

  return (
    <aside className="w-64 bg-card/50 backdrop-blur-sm border-r border-border h-screen sticky top-0">
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold text-primary">Admin Panel</h1>
      </div>
      <nav className="p-4 space-y-1">
        <Link
          href="/"
          className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            "text-muted-foreground hover:bg-primary/5 hover:text-primary",
          )}
        >
          <Home className="h-5 w-5" />
          <span>Home</span>
        </Link>

        {sidebarItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-primary/5 hover:text-primary",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
              {item.badge && (
                <Badge className="ml-auto" variant="destructive">
                  {item.badge}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>
      <div className="absolute bottom-4 left-4 right-4">
        <Button variant="destructive" className="w-full" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  )
}

