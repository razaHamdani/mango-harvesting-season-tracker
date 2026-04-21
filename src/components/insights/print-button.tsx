'use client'

import { buttonVariants } from '@/components/ui/button'

interface PrintButtonProps {
  docTitle: string
}

export function PrintButton({ docTitle }: PrintButtonProps) {
  function handlePrint() {
    const prev = document.title
    document.title = docTitle
    const restore = () => {
      document.title = prev
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      data-print="hide"
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      Save as PDF
    </button>
  )
}
