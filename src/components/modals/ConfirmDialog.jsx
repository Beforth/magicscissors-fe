import { useRef } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  onConfirm,
  variant = 'default',
  loading = false,
  autoFocusConfirm = false,
}) {
  const isDestructive = variant === 'destructive'
  const confirmRef = useRef(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={
          autoFocusConfirm
            ? (e) => {
                e.preventDefault()
                confirmRef.current?.focus()
              }
            : undefined
        }
      >
        <DialogHeader>
          {isDestructive && (
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          )}
          <DialogTitle className={isDestructive ? 'text-center' : ''}>{title}</DialogTitle>
          <DialogDescription className={isDestructive ? 'text-center' : ''}>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            variant={isDestructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
