"use client"

import { useTheme } from "~/lib/ThemeContext"
import { Button } from "~/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { Moon, Sun, Palette, Leaf, Flame } from "lucide-react"

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          {theme === "dark" && <Moon className="h-[1.2rem] w-[1.2rem]" />}
          {theme === "light" && <Sun className="h-[1.2rem] w-[1.2rem]" />}
          {theme === "blue" && <Palette className="h-[1.2rem] w-[1.2rem]" />}
          {theme === "dark-blue" && <Palette className="h-[1.2rem] w-[1.2rem]" />}
          {theme === "green" && <Leaf className="h-[1.2rem] w-[1.2rem]" />}
          {theme === "amber" && <Flame className="h-[1.2rem] w-[1.2rem]" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("blue")}>
          <Palette className="mr-2 h-4 w-4" />
          <span>Blue</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark-blue")}>
          <Palette className="mr-2 h-4 w-4" />
          <span>Dark Blue</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("green")}>
          <Leaf className="mr-2 h-4 w-4" />
          <span>Green</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("amber")}>
          <Flame className="mr-2 h-4 w-4" />
          <span>Amber</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

