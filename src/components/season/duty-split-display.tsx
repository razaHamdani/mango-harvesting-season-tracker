export function DutySplitDisplay({
  sprayLandlordPct,
  fertilizerLandlordPct,
}: {
  sprayLandlordPct: number
  fertilizerLandlordPct: number
}) {
  return (
    <div className="space-y-4">
      <SplitBar
        label="Spray"
        landlordPct={sprayLandlordPct}
      />
      <SplitBar
        label="Fertilizer"
        landlordPct={fertilizerLandlordPct}
      />
    </div>
  )
}

function SplitBar({
  label,
  landlordPct,
}: {
  label: string
  landlordPct: number
}) {
  const contractorPct = 100 - landlordPct

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex h-7 w-full overflow-hidden rounded-md text-xs font-medium">
        <div
          className="flex items-center justify-center bg-blue-500 text-white"
          style={{ width: `${landlordPct}%` }}
        >
          {landlordPct > 10 && `${landlordPct}%`}
        </div>
        <div
          className="flex items-center justify-center bg-amber-500 text-white"
          style={{ width: `${contractorPct}%` }}
        >
          {contractorPct > 10 && `${contractorPct}%`}
        </div>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Landlord {landlordPct}%</span>
        <span>Contractor {contractorPct}%</span>
      </div>
    </div>
  )
}
