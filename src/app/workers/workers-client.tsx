'use client'

import { useState, useTransition } from 'react'
import type { Worker } from '@/types/database'
import { deleteWorker, toggleWorkerActive } from '@/lib/actions/worker-actions'
import { WorkerForm } from '@/components/worker/worker-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Trash2 } from 'lucide-react'
import { formatPKR } from '@/lib/utils/format'

interface WorkersClientProps {
  workers: Worker[]
}

export function WorkersClient({ workers }: WorkersClientProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Worker | undefined>()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isToggling, startToggleTransition] = useTransition()

  function handleAddClick() {
    setEditingWorker(undefined)
    setFormOpen(true)
  }

  function handleEditClick(worker: Worker) {
    setEditingWorker(worker)
    setFormOpen(true)
  }

  function handleFormSuccess() {
    setFormOpen(false)
    setEditingWorker(undefined)
  }

  function handleDeleteClick(worker: Worker) {
    setDeleteTarget(worker)
    setDeleteOpen(true)
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return

    startDeleteTransition(async () => {
      await deleteWorker(deleteTarget.id)
      setDeleteOpen(false)
      setDeleteTarget(undefined)
    })
  }

  function handleToggleActive(worker: Worker) {
    startToggleTransition(async () => {
      await toggleWorkerActive(worker.id)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between" style={{marginBottom:24}}>
        <div>
          <h1 style={{fontSize:24,color:'var(--heading)',fontWeight:600,letterSpacing:'-0.02em'}}>Workers</h1>
          <div className="muted t-14 mt-1">{workers.filter(w => w.is_active).length} active · {workers.filter(w => !w.is_active).length} inactive</div>
        </div>
        <Dialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open)
            if (!open) setEditingWorker(undefined)
          }}
        >
          <DialogTrigger render={<Button />} onClick={handleAddClick}>
            Add Worker
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingWorker ? 'Edit Worker' : 'Add Worker'}
              </DialogTitle>
              <DialogDescription>
                {editingWorker
                  ? 'Update worker details below.'
                  : 'Enter details for your new worker.'}
              </DialogDescription>
            </DialogHeader>
            <WorkerForm worker={editingWorker} onSuccess={handleFormSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      {workers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-muted-foreground">
            No workers yet. Add your first worker to get started.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="list">
            {workers.map((worker, i) => (
              <div key={worker.id} style={{padding:'18px 24px', borderTop: i === 0 ? '0' : '1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', opacity: worker.is_active ? 1 : 0.65}}>
                <div style={{display:'flex', alignItems:'center', gap:14}}>
                  <div style={{width:40,height:40,borderRadius:999,background:'var(--clay-soft)',display:'grid',placeItems:'center',color:'var(--bark)',fontWeight:600,fontSize:13,flexShrink:0}}>
                    {worker.name.split(' ').map(s => s[0]).slice(0,2).join('')}
                  </div>
                  <div>
                    <div style={{fontWeight:500,color:'var(--heading)'}}>{worker.name}</div>
                    <div className="t-12 muted mt-1">{worker.phone ?? '—'}</div>
                  </div>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:24}}>
                  {worker.monthly_salary != null && (
                    <div style={{textAlign:'right'}}>
                      <div className="mono" style={{fontWeight:600,color:'var(--heading)'}}>{formatPKR(worker.monthly_salary)}</div>
                      <div className="t-12 muted">per month</div>
                    </div>
                  )}
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span className="t-12 muted">{worker.is_active ? 'Active' : 'Inactive'}</span>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleActive(worker)} disabled={isToggling}>
                      {worker.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <Button variant="ghost" size="sm" onClick={() => handleEditClick(worker)}>Edit</Button>
                    <button className="icon-btn" onClick={() => handleDeleteClick(worker)} aria-label="Delete worker">
                      <Trash2 className="h-[14px] w-[14px]" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setDeleteTarget(undefined)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Worker</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
