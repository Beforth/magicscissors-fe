import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { billService } from '@/services/bill.service'
import { inventoryService } from '@/services/inventory.service'
import TakeInUseModal from '@/components/modals/TakeInUseModal'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Build API payload from internal selection map.
 * selections: { [billItemId]: { [productId]: openContainerId } }
 */
export function buildContainerSelections(selections) {
  return Object.entries(selections || {})
    .map(([bill_item_id, productsMap]) => {
      const products = Object.entries(productsMap || {})
        .filter(([, open_container_id]) => open_container_id)
        .map(([product_id, open_container_id]) => ({ product_id, open_container_id }))
      if (products.length === 0) return null
      return { bill_item_id, products }
    })
    .filter(Boolean)
}

export function isConsumptionComplete(requirements, selections) {
  for (const req of requirements || []) {
    for (const line of req.lines || []) {
      const picked = selections?.[req.bill_item_id]?.[line.product_id]
      if (!picked) return false
    }
  }
  return true
}

function applyScannedContainer(requirements, selections, container) {
  const next = { ...(selections || {}) }
  for (const req of requirements) {
    for (const line of req.lines || []) {
      if (line.product_id !== container.product_id) continue
      if (next[req.bill_item_id]?.[line.product_id]) continue
      const eligible = line.active_containers?.some(
        (c) => c.open_container_id === container.open_container_id
      )
      if (!eligible) continue
      if (!next[req.bill_item_id]) next[req.bill_item_id] = {}
      next[req.bill_item_id][line.product_id] = container.open_container_id
      return { next, matched: true, req, line }
    }
  }
  return { next, matched: false }
}

export default function ServiceConsumptionPicker({
  billId,
  branchId = null,
  pendingItemIds = [],
  billItemIds = null,
  selections,
  onChange,
  enabled = true,
}) {
  const scanRef = useRef(null)
  const [scanValue, setScanValue] = useState('')
  const [scanning, setScanning] = useState(false)
  const [takeInUseTarget, setTakeInUseTarget] = useState(null)
  const queryClient = useQueryClient()

  const pendingKey = (pendingItemIds || []).join(',')
  const itemKey = (billItemIds || []).join(',')

  const { data, isLoading } = useQuery({
    queryKey: ['consumption-preview', billId, pendingKey, itemKey],
    queryFn: () =>
      billService.getConsumptionPreview(billId, {
        pending_item_ids: pendingItemIds,
        bill_item_ids: billItemIds?.length ? billItemIds : undefined,
      }),
    enabled: enabled && !!billId,
  })

  const requirements = data?.data?.requirements || data?.requirements || []

  useEffect(() => {
    if (!requirements.length) return
    const next = { ...(selections || {}) }
    let changed = false
    for (const req of requirements) {
      if (!next[req.bill_item_id]) next[req.bill_item_id] = {}
      for (const line of req.lines) {
        if (next[req.bill_item_id][line.product_id]) continue
        const first = line.active_containers?.[0]
        if (first?.open_container_id) {
          next[req.bill_item_id][line.product_id] = first.open_container_id
          changed = true
        }
      }
    }
    if (changed) onChange?.(next)
  }, [requirements, billId, pendingKey])

  const hasRequirements = requirements.length > 0

  const summary = useMemo(() => requirements.length, [requirements])

  const handleBarcodeScan = async (raw) => {
    const barcode = String(raw || '').trim()
    if (!barcode || scanning) return

    setScanning(true)
    try {
      const res = await inventoryService.getOpenContainerByBarcode(barcode, {
        branch_id: branchId || undefined,
      })
      const container = res?.data || res
      const { next, matched, req, line } = applyScannedContainer(requirements, selections, container)
      if (!matched) {
        const needed = requirements.some((r) =>
          r.lines?.some((l) => l.product_id === container.product_id)
        )
        if (!needed) {
          toast.error(`${container.product_name} is not needed for these services`)
        } else {
          toast.error('All slots for this product are already assigned, or bottle is unavailable')
        }
        return
      }
      onChange?.(next)
      toast.success(`Assigned ${container.product_name} to ${req.item_name}`)
      setScanValue('')
      scanRef.current?.focus()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Open bottle not found for this barcode')
    } finally {
      setScanning(false)
    }
  }

  if (!enabled || !billId) return null
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading product usage…
      </div>
    )
  }
  if (!hasRequirements) return null

  return (
    <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
      <div>
        <Label className="text-sm font-medium text-blue-900">Backbar products</Label>
        <p className="text-xs text-blue-700/80 mt-0.5">
          Scan an open-bottle label (OC…) or select from the list for {summary} service{summary > 1 ? 's' : ''} with recipes.
        </p>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-gray-600">Scan open bottle</Label>
        <Input
          ref={scanRef}
          value={scanValue}
          onChange={(e) => setScanValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleBarcodeScan(scanValue)
            }
          }}
          placeholder="Scan OC barcode…"
          className="h-9 bg-white font-mono text-sm"
          disabled={scanning}
          autoComplete="off"
        />
      </div>
      {requirements.map((req) => (
        <div key={req.bill_item_id} className="space-y-2 rounded-md bg-white/80 p-2.5 border border-blue-100">
          <p className="text-sm font-medium text-gray-800">{req.item_name}</p>
          {req.lines.map((line) => (
            <div key={`${req.bill_item_id}-${line.product_id}`} className="space-y-1">
              <Label className="text-xs text-gray-600">
                {line.product_name} — uses {line.amount_per_service} {line.unit} per service
              </Label>
              {line.active_containers?.length > 0 ? (
                <SearchableSelect
                  options={line.active_containers.map((c) => ({ value: c.open_container_id, label: c.label }))}
                  value={selections?.[req.bill_item_id]?.[line.product_id] || ''}
                  onChange={(value) => {
                    onChange?.({
                      ...(selections || {}),
                      [req.bill_item_id]: {
                        ...(selections?.[req.bill_item_id] || {}),
                        [line.product_id]: value,
                      },
                    })
                  }}
                  placeholder="Select open bottle"
                  triggerClassName="h-9 bg-white"
                />
              ) : (
                <p className="text-xs text-red-600">
                  No open bottle for {line.product_name}.{' '}
                  <button
                    type="button"
                    className="text-blue-700 underline underline-offset-2 hover:text-blue-900 font-medium"
                    onClick={() =>
                      setTakeInUseTarget({
                        productId: line.product_id,
                        billItemId: req.bill_item_id,
                      })
                    }
                  >
                    Open one from Inventory → Take in use
                  </button>
                </p>
              )}
            </div>
          ))}
        </div>
      ))}
      <TakeInUseModal
        open={!!takeInUseTarget}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setTakeInUseTarget(null)
        }}
        defaultBranchId={branchId || ''}
        defaultProductId={takeInUseTarget?.productId || ''}
        onTaken={(container) => {
          queryClient.invalidateQueries({ queryKey: ['consumption-preview', billId] })
          if (takeInUseTarget?.billItemId && container?.open_container_id && container?.product_id) {
            onChange?.({
              ...(selections || {}),
              [takeInUseTarget.billItemId]: {
                ...(selections?.[takeInUseTarget.billItemId] || {}),
                [container.product_id]: container.open_container_id,
              },
            })
          }
        }}
      />
    </div>
  )
}
