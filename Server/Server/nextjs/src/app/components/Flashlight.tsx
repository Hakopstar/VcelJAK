"use client"

import { useEffect, useState, useCallback } from "react"

interface FlashlightProps {
  size?: number
  intensity?: number
}

export default function Flashlight({ size = 600, intensity = 0.6 }: FlashlightProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const updatePosition = useCallback((clientX: number, clientY: number) => {
    setPosition({ x: clientX, y: clientY })
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      updatePosition(e.clientX, e.clientY)
    }

    window.addEventListener("mousemove", handleMouseMove)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [updatePosition])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 mix-blend-soft-light flashlight-color"
      style={{
        background: `
          radial-gradient(${size}px at ${position.x}px ${position.y}px, 
            rgba(var(--flashlight-color), ${intensity}), 
            transparent 70%
          ),
          radial-gradient(${size * 1.5}px at ${position.x}px ${position.y}px, 
            rgba(var(--flashlight-color), ${intensity / 2}), 
            transparent 100%
          )
        `,
      }}
    />
  )
}

