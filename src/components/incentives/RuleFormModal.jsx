import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { serviceService } from '@/services/service.service'
import { branchService } from '@/services/branch.service'
import { PERIODS, PAY_TYPES, WINDOWS, THRESHOLDS, BASES, emptyRule, validateRule, toPayload } from '@/lib/incentiveRules'

const selectCls = 'w-full h-10 px-3 border rounded-md bg-white text-sm'

function Field({ id, label, hint, children }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function CheckList({ title, items, selected, onChange }) {
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{title} <span className="text-xs text-gray-500">({selected.length} selected)</span></p>
      <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
        {items.length === 0 && <p className="text-xs text-gray-500">None available</p>}
        {items.map((it) => (
          <label key={it.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.includes(it.id)} onChange={() => toggle(it.id)} />
            {it.name}
          </label>
        ))}
      </div>
    </div>
  )
}

export default function RuleFormModal({ open, rule, onClose, onSave, saving }) {
  const [f, setF] = useState(emptyRule())
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setF(rule ? { ...emptyRule(), ...rule, threshold_value: rule.threshold_value ?? '' } : emptyRule())
  }, [open, rule])

  const { data: svcRes } = useQuery({
    queryKey: ['services', 'active'],
    queryFn: () => serviceService.getServices({ is_active: 'true' }),
    enabled: open,
  })
  const { data: catRes } = useQuery({
    queryKey: ['service-categories'],
    queryFn: () => serviceService.getCategories(),
    enabled: open,
  })
  const { data: brRes } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: open,
  })
  const services = (svcRes?.data || []).map((s) => ({ id: s.service_id, name: s.service_name }))
  const categories = (catRes?.data || []).map((c) => ({ id: c.category_id, name: c.name }))
  const branches = brRes?.data || []

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const filter = f.service_filter || {}
  const setFilter = (k, v) => set('service_filter', { service_ids: [], category_ids: [], ...filter, [k]: v })

  const submit = (e) => {
    e.preventDefault()
    const err = validateRule(f)
    setError(err)
    if (!err) onSave(toPayload(f))
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit incentive rule' : 'Add incentive rule'}</DialogTitle>
          <DialogDescription>
            Pays a percentage of matching service revenue. Rules are evaluated per employee in the order below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ir-name" label="Name">
              <Input id="ir-name" value={f.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field id="ir-order" label="Order" hint="Lower numbers run first.">
              <Input id="ir-order" type="number" min="0" step="1" value={f.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
            </Field>
            <Field id="ir-branch" label="Branch">
              <select id="ir-branch" className={selectCls} value={f.branch_id || ''} onChange={(e) => set('branch_id', e.target.value || null)}>
                <option value="">All branches</option>
                {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.name}</option>)}
              </select>
            </Field>
            <Field id="ir-pay" label="Applies to">
              <select id="ir-pay" className={selectCls} value={f.pay_types} onChange={(e) => set('pay_types', e.target.value)}>
                {PAY_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field id="ir-period" label="Period" hint="How revenue is totalled before the threshold is checked.">
              <select
                id="ir-period"
                className={selectCls}
                value={f.period}
                onChange={(e) => setF((p) => ({
                  ...p,
                  period: e.target.value,
                  threshold_type: e.target.value !== 'monthly' && p.threshold_type === 'salary_multiple' ? 'none' : p.threshold_type,
                }))}
              >
                {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field id="ir-window" label="Service time window">
              <select id="ir-window" className={selectCls} value={f.service_window} onChange={(e) => set('service_window', e.target.value)}>
                {WINDOWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>

          <div className="space-y-2 border rounded-md p-3">
            <p className="text-sm font-medium">Services counted: service AND category</p>
            <p className="text-xs text-gray-500">
              Leave both empty to count every service. If you pick both, a service must be one of the chosen services
              AND in one of the chosen categories.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <CheckList title="Services" items={services} selected={filter.service_ids || []} onChange={(v) => setFilter('service_ids', v)} />
              <CheckList title="Categories" items={categories} selected={filter.category_ids || []} onChange={(v) => setFilter('category_ids', v)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ir-thr" label="Threshold">
              <select
                id="ir-thr"
                className={selectCls}
                value={f.threshold_type}
                onChange={(e) => setF((p) => ({ ...p, threshold_type: e.target.value, threshold_value: e.target.value === 'none' ? '' : p.threshold_value }))}
              >
                {THRESHOLDS.filter(([v]) => v !== 'salary_multiple' || f.period === 'monthly').map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            {f.threshold_type !== 'none' && (
              <Field
                id="ir-thrv"
                label={f.threshold_type === 'fixed' ? 'Threshold (₹)' : 'Times monthly salary'}
                hint={f.threshold_type === 'salary_multiple' ? 'e.g. 1 = revenue must reach one month of salary.' : undefined}
              >
                <Input id="ir-thrv" type="number" min="0" step="0.01" value={f.threshold_value ?? ''} onChange={(e) => set('threshold_value', e.target.value)} />
              </Field>
            )}
            <Field id="ir-basis" label="Payout on">
              <select id="ir-basis" className={selectCls} value={f.payout_basis} onChange={(e) => set('payout_basis', e.target.value)}>
                {BASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field id="ir-rate" label="Rate (%)">
              <Input id="ir-rate" type="number" min="0" max="100" step="0.01" value={f.rate_percent} onChange={(e) => set('rate_percent', e.target.value)} />
            </Field>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={!!f.exclude_from_other_rules} onChange={(e) => set('exclude_from_other_rules', e.target.checked)} />
            <span>
              <span className="font-medium">Exclude these services from other rules</span>
              <span className="block text-xs text-gray-500">Services matched here are not counted again by rules that come later.</span>
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!f.enabled} onChange={(e) => set('enabled', e.target.checked)} />
            <span className="font-medium">Enabled</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {rule ? 'Save changes' : 'Add rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
