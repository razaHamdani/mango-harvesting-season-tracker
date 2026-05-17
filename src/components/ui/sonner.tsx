"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--text)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--leaf-soft)",
          "--success-text": "oklch(0.30 0.10 145)",
          "--success-border": "oklch(0.55 0.13 145 / 30%)",
          "--error-bg": "var(--rust-soft)",
          "--error-text": "oklch(0.32 0.18 35)",
          "--error-border": "oklch(0.55 0.20 35 / 30%)",
          "--info-bg": "var(--sky-soft)",
          "--info-text": "oklch(0.32 0.10 240)",
          "--info-border": "oklch(0.55 0.10 240 / 30%)",
          "--border-radius": "12px",
          "--toast-shadow": "var(--shadow-lift)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !rounded-[12px] !shadow-[var(--shadow-lift)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
