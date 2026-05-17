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
import { Home, Trash2 } from 'lucide-react'

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
      <div className="flex items-center justify-between" style={{marginBottom:24}}>
        <div>
          <h1 style={{fontSize:24,color:'var(--heading)',fontWeight:600,letterSpacing:'-0.02em'}}>Farms</h1>
          <div className="muted t-14 mt-1">{farms.length} farms · {farms.reduce((a,f) => a + f.acreage, 0).toFixed(2)} total acres</div>
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
        <div className="card overflow-hidden">
          <div className="list">
            {farms.map((farm, i) => (
              <div key={farm.id} style={{padding:'18px 24px', borderTop: i === 0 ? '0' : '1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <div style={{display:'flex', alignItems:'center', gap:14}}>
                  <div style={{width:40,height:40,borderRadius:8,background:'var(--leaf-soft)',display:'grid',placeItems:'center',color:'oklch(0.35 0.13 145)',flexShrink:0}}>
                    <Home className="h-[18px] w-[18px]" />
                  </div>
                  <div>
                    <div style={{fontWeight:500,color:'var(--heading)'}}>{farm.name}</div>
                    <div className="t-12 muted mt-1">{farm.acreage.toFixed(2)} acres</div>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <Button variant="ghost" size="sm" onClick={() => handleEditClick(farm)}>Edit</Button>
                  <button className="icon-btn" onClick={() => handleDeleteClick(farm)} aria-label="Delete farm">
                    <Trash2 className="h-[14px] w-[14px]" />
                  </button>
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
