import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-[var(--radius-input)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1 text-[13.5px] text-foreground transition-[border-color,box-shadow,outline] duration-[120ms] outline-none placeholder:text-muted-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground hover:border-[var(--border-strong)] focus-visible:border-[var(--mango)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mango)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:outline-destructive md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
