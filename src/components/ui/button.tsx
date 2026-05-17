import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-input)] border border-transparent bg-clip-padding text-[13.5px] font-medium whitespace-nowrap transition-[background,border-color,color,transform,box-shadow] duration-[120ms] outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mango)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_-1px_0_oklch(0_0_0_/_8%)] hover:bg-[var(--mango-deep)]",
        outline:
          "bg-transparent text-foreground border-[var(--border-strong)] hover:bg-[var(--hover)] hover:border-[var(--border-strong)] aria-expanded:bg-[var(--hover)]",
        secondary:
          "bg-[var(--surface-2)] text-foreground hover:bg-[var(--hover)] aria-expanded:bg-[var(--hover)]",
        ghost:
          "bg-transparent text-foreground hover:bg-[var(--surface-2)] aria-expanded:bg-[var(--surface-2)]",
        destructive:
          "bg-[var(--rust)] text-white hover:bg-[var(--rust)]/90 focus-visible:outline-[var(--rust)]",
        link: "text-[var(--mango-deep)] underline-offset-4 hover:underline bg-transparent",
      },
      size: {
        default: "h-10 px-4 text-[13.5px]",
        sm: "h-8 px-3 text-[12.5px] rounded-[8px]",
        xs: "h-[26px] px-2.5 text-xs rounded-[6px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-5 text-sm",
        icon: "size-10 p-0",
        "icon-xs": "size-[26px] p-0 rounded-[6px] [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 p-0 rounded-[8px]",
        "icon-lg": "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
