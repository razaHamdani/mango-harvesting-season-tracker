export type ExpenseCategory = 'spray' | 'fertilizer' | 'electricity' | 'labor' | 'misc'

export function calculateLandlordCost(
  totalCost: number,
  category: ExpenseCategory,
  season: { spray_landlord_pct: number; fertilizer_landlord_pct: number }
): number {
  switch (category) {
    case 'spray':
      return Math.round(totalCost * season.spray_landlord_pct / 100 * 100) / 100
    case 'fertilizer':
      return Math.round(totalCost * season.fertilizer_landlord_pct / 100 * 100) / 100
    case 'electricity':
    case 'labor':
    case 'misc':
      return totalCost
  }
}
