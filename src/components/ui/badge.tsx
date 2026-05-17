import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-[var(--radius-pill)] border border-transparent px-2.5 text-[12px] font-semibold leading-none whitespace-nowrap tracking-[0.005em] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mango)] [&_.dot]:inline-block [&_.dot]:size-1.5 [&_.dot]:rounded-full [&_.dot]:bg-current [&_.dot]:opacity-80 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border)] bg-transparent text-foreground",
        outline:
          "border-[var(--border)] bg-transparent text-foreground",
        secondary:
          "bg-[var(--surface-2)] text-foreground",
        destructive:
          "bg-[var(--rust-soft)] text-[oklch(0.36_0.18_35)]",
        ghost:
          "bg-transparent text-foreground hover:bg-[var(--surface-2)]",
        link: "text-[var(--mango-deep)] underline-offset-4 hover:underline",
        // Status variants
        draft:
          "bg-[var(--clay-soft)] text-[var(--soil)]",
        active:
          "bg-[var(--mango-soft)] text-[var(--mango-deep)]",
        closed:
          "bg-[var(--surface-2)] text-[var(--text-muted)]",
        paid:
          "bg-[var(--leaf-soft)] text-[oklch(0.32_0.10_145)]",
        overdue:
          "bg-[var(--rust-soft)] text-[oklch(0.36_0.18_35)]",
        pending:
          "bg-[var(--surface-2)] text-[var(--text-faint)]",
        info:
          "bg-[var(--sky-soft)] text-[oklch(0.32_0.10_240)]",
        mango:
          "bg-[var(--mango)] text-[var(--bark)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
