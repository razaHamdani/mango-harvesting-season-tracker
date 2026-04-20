'use client'

import { buttonVariants } from '@/components/ui/button'

interface PrintButtonProps {
  docTitle: string
}

export function PrintButton({ docTitle }: PrintButtonProps) {
  function handlePrint() {
    const prev = document.title
    document.title = docTitle
    window.print()
    document.title = prev
  }

  return (
    <button
      onClick={handlePrint}
      data-print="hide"
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      Save as PDF
    </button>
  )
}
