import { getWorkers } from '@/lib/queries/worker-queries'
import { WorkersClient } from './workers-client'

export default async function WorkersPage() {
  const workers = await getWorkers()

  return <WorkersClient workers={workers} />
}
