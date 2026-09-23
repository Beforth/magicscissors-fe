import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { Plus, Printer, Ban, Loader2, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { tokenService } from '@/services/token.service'
import { branchService } from '@/services/branch.service'
import { printTokenSlip } from '@/components/TokenSlip'
import TokenQrCode from '@/components/TokenQrCode'
import ConfirmDialog from '@/components/modals/ConfirmDialog'
import CreateTokenModal from '@/components/modals/CreateTokenModal'

const STATUS_FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'consumed', label: 'Consumed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
]

function StatusBadge({ status }) {
  const map = {
    open:      'bg-green-100 text-green-800',
    consumed:  'bg-blue-100 text-blue-800',
    expired:   'bg-gray-100 text-gray-600',
    cancelled: 'bg-rose-100 text-rose-800',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default function TokensPage() {
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const userBranchId = user?.branchId || null

  const [statusFilter, setStatusFilter] = useState('open')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState(userBranchId)
  const [qrToken, setQrToken] = useState(null)
  const [cancelToken, setCancelToken] = useState(null)

  // Owners/developers may not have a fixed branch — let them pick one.
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: !userBranchId,
  })
  const branches = branchesData?.data || []

  // If owner picked nothing yet, default to first branch
  useEffect(() => {
    if (!userBranchId && !selectedBranch && branches.length > 0) {
      setSelectedBranch(branches[0].branch_id)
    }
  }, [userBranchId, selectedBranch, branches])

  const { data, isLoading } = useQuery({
    queryKey: ['tokens', { branchId: selectedBranch, status: statusFilter }],
    queryFn: () => tokenService.getOpenTokens({ status: statusFilter, branch_id: selectedBranch }),
    enabled: !!selectedBranch,
  })
  const tokens = data?.data || []

  const cancelMutation = useMutation({
    mutationFn: (id) => tokenService.cancelToken(id),
    onSuccess: () => {
      toast.success('Token cancelled')
      queryClient.invalidateQueries({ queryKey: ['tokens'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to cancel'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tokens</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Issue a token to a waiting customer. The token can be scanned at billing to pull up the customer and their requested services.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!selectedBranch}>
          <Plus className="h-4 w-4 mr-2" />
          New Token
        </Button>
      </div>

      {/* Branch picker (owners/developers without a fixed branch) */}
      {!userBranchId && branches.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Branch:</span>
          <select
            className="h-8 px-2 border rounded-md text-sm"
            value={selectedBranch || ''}
            onChange={(e) => setSelectedBranch(e.target.value || null)}
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={
              statusFilter === f.value
                ? 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary text-primary-foreground'
                : 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:border-primary hover:text-primary transition-colors'
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tokens grid */}
      <Card>
        <CardContent className="py-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : tokens.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No {statusFilter} tokens for today.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tokens.map((t) => (
                <div key={t.id} className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl font-bold tracking-wide text-primary">{t.token_number}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {t.customer_name_snap}
                  </div>
                  {t.customer_phone_snap && (
                    <div className="text-xs text-gray-500">{t.customer_phone_snap}</div>
                  )}
                  {(t.services_requested?.length ?? 0) > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      {t.services_requested
                        .map((it) => (it.kind === 'package' ? `📦 ${it.name || it.service_name}` : (it.name || it.service_name)))
                        .join(', ')}
                    </div>
                  )}
                  {t.notes && (
                    <div className="mt-2 text-xs text-gray-500 italic truncate">"{t.notes}"</div>
                  )}
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQrToken(t)}
                      title="Show QR code"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => printTokenSlip(t)}
                      title="Print slip"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    {t.status === 'open' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-rose-600"
                        onClick={() => setCancelToken(t)}
                        disabled={cancelMutation.isPending}
                        title="Cancel"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                    {t.consumed_bill && (
                      <span className="text-xs text-gray-500 ml-auto">
                        → {t.consumed_bill.bill_number}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTokenModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        branchId={selectedBranch}
      />

      <ConfirmDialog
        open={!!cancelToken}
        onOpenChange={(open) => { if (!open) setCancelToken(null) }}
        title="Cancel Token"
        description={`Cancel token ${cancelToken?.token_number}? This action cannot be undone.`}
        confirmLabel="Cancel Token"
        onConfirm={() => { cancelMutation.mutate(cancelToken.id); setCancelToken(null) }}
      />

      <Dialog open={!!qrToken} onOpenChange={(open) => { if (!open) setQrToken(null) }}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Token QR — {qrToken?.token_number}</DialogTitle>
          </DialogHeader>
          {qrToken && (
            <div className="flex flex-col items-center gap-3 py-2">
              <TokenQrCode token={qrToken} size={200} />
              <p className="text-sm font-medium">{qrToken.customer_name_snap}</p>
              <p className="text-xs text-gray-500 text-center">
                Scan at billing to load this token.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => printTokenSlip(qrToken)}>
                <Printer className="h-4 w-4 mr-2" />
                Print slip
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
