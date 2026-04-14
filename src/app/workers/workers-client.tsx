'use client'

import { useState, useTransition } from 'react'
import type { Worker } from '@/types/database'
import { deleteWorker, toggleWorkerActive } from '@/lib/actions/worker-actions'
import { WorkerForm } from '@/components/worker/worker-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your farm workers
          </p>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Monthly Salary</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.map((worker) => (
              <TableRow key={worker.id}>
                <TableCell className="font-medium">{worker.name}</TableCell>
                <TableCell>{worker.phone || '-'}</TableCell>
                <TableCell>
                  {worker.monthly_salary
                    ? formatPKR(worker.monthly_salary)
                    : '-'}
                </TableCell>
                <TableCell>
                  {worker.is_active ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditClick(worker)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(worker)}
                      disabled={isToggling}
                    >
                      {worker.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(worker)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
