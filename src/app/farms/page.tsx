import { getFarms } from '@/lib/queries/farm-queries'
import { FarmsClient } from './farms-client'

export default async function FarmsPage() {
  const farms = await getFarms()

  return <FarmsClient farms={farms} />
}
