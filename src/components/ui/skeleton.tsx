import { cn } from "@/lib/utils"

const SHIMMER_STYLE = `@keyframes _sk_shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <>
      <style>{SHIMMER_STYLE}</style>
      <div
        data-slot="skeleton"
        className={cn(
          "relative overflow-hidden rounded-[8px] bg-[var(--surface-2)] before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(90deg,transparent,oklch(1_0_0_/_35%),transparent)] before:opacity-70 before:content-[''] before:animate-[_sk_shimmer_1.5s_ease-in-out_infinite]",
          className
        )}
        {...props}
      />
    </>
  )
}

export { Skeleton }
