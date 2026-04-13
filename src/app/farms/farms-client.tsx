'use client'

import { useState, useTransition } from 'react'
import type { Farm } from '@/types/database'
import { deleteFarm } from '@/lib/actions/farm-actions'
import { FarmForm } from '@/components/farm/farm-form'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface FarmsClientProps {
  farms: Farm[]
}

export function FarmsClient({ farms }: FarmsClientProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingFarm, setEditingFarm] = useState<Farm | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Farm | undefined>()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()

  function handleAddClick() {
    setEditingFarm(undefined)
    setFormOpen(true)
  }

  function handleEditClick(farm: Farm) {
    setEditingFarm(farm)
    setFormOpen(true)
  }

  function handleFormSuccess() {
    setFormOpen(false)
    setEditingFarm(undefined)
  }

  function handleDeleteClick(farm: Farm) {
    setDeleteTarget(farm)
    setDeleteOpen(true)
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return

    startDeleteTransition(async () => {
      await deleteFarm(deleteTarget.id)
      setDeleteOpen(false)
      setDeleteTarget(undefined)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Farms</h1>
          <p className="text-sm text-muted-foreground">
            Manage your mango farms
          </p>
        </div>
        <Dialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open)
            if (!open) setEditingFarm(undefined)
          }}
        >
          <DialogTrigger render={<Button />} onClick={handleAddClick}>
            Add Farm
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingFarm ? 'Edit Farm' : 'Add Farm'}
              </DialogTitle>
              <DialogDescription>
                {editingFarm
                  ? 'Update farm details below.'
                  : 'Enter details for your new farm.'}
              </DialogDescription>
            </DialogHeader>
            <FarmForm farm={editingFarm} onSuccess={handleFormSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      {farms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-muted-foreground">
            No farms yet. Add your first farm to get started.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Acreage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {farms.map((farm) => (
              <TableRow key={farm.id}>
                <TableCell className="font-medium">{farm.name}</TableCell>
                <TableCell>{farm.acreage.toFixed(2)} acres</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditClick(farm)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(farm)}
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
            <DialogTitle>Delete Farm</DialogTitle>
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
