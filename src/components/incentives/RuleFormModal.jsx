import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { serviceService } from '@/services/service.service'
import { branchService } from '@/services/branch.service'
import { RULE_TYPES, SHARE_MODES, RATE_TYPES, PERIODS, PAY_TYPES, WINDOWS, THRESHOLDS, BASES, emptyRule, validateRule, toPayload } from '@/lib/incentiveRules'

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

function LinesEditor({ lines, services, categories, onChange }) {
  const setLine = (i, patch) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const taken = (kind, id, i) => lines.some((l, j) => j !== i && l.kind === kind && l.id === id)
  const pick = (i, v) => {
    if (!v) return setLine(i, { kind: 'service', id: '' })
    const k = v.indexOf(':')
    setLine(i, { kind: v.slice(0, k), id: v.slice(k + 1) })
  }
  const known = new Set([...services.map((x) => `service:${x.id}`), ...categories.map((x) => `category:${x.id}`)])
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Rates per service or category</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="font-normal pb-1">Service or category</th>
            <th className="font-normal pb-1 w-24">Type</th>
            <th className="font-normal pb-1 w-28">Value</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="pr-2 pb-2">
                <select
                  aria-label={`Line ${i + 1} service or category`}
                  className={selectCls}
                  value={l.id ? `${l.kind}:${l.id}` : ''}
                  onChange={(e) => pick(i, e.target.value)}
                >
                  <option value="">Select...</option>
                  <optgroup label="Services">
                    {services.map((x) => <option key={x.id} value={`service:${x.id}`} disabled={taken('service', x.id, i)}>{x.name}</option>)}
                  </optgroup>
                  <optgroup label="Categories">
                    {categories.map((x) => <option key={x.id} value={`category:${x.id}`} disabled={taken('category', x.id, i)}>{x.name}</option>)}
                  </optgroup>
                  {l.id && !known.has(`${l.kind}:${l.id}`) && <option value={`${l.kind}:${l.id}`}>{l.id}</option>}
                </select>
              </td>
              <td className="pr-2 pb-2">
                <select aria-label={`Line ${i + 1} type`} className={selectCls} value={l.rate_type} onChange={(e) => setLine(i, { rate_type: e.target.value })}>
                  {RATE_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </td>
              <td className="pr-2 pb-2">
                <Input
                  aria-label={`Line ${i + 1} value`}
                  type="number"
                  min="0"
                  max={l.rate_type === 'percent' ? 100 : 99999999}
                  step="0.01"
                  value={l.value ?? ''}
                  onChange={(e) => setLine(i, { value: e.target.value })}
                />
              </td>
              <td className="pb-2">
                <Button type="button" size="sm" variant="ghost" aria-label={`Remove line ${i + 1}`} onClick={() => onChange(lines.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...lines, { kind: 'service', id: '', rate_type: 'percent', value: '' }])}>
        <Plus className="h-4 w-4 mr-1" />
        Add line
      </Button>
    </div>
  )
}

export default function RuleFormModal({ open, rule, onClose, onSave, saving }) {
  const [f, setF] = useState(emptyRule())
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setF(rule
      ? { ...emptyRule(), ...rule, service_rates: (rule.service_rates || []).map((l) => ({ ...l })), threshold_value: rule.threshold_value ?? '' }
      : emptyRule())
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
  const isSR = f.rule_type === 'service_rates'
  const changeType = (t) => setF((p) => ({
    ...p,
    rule_type: t,
    pay_types: t === 'service_rates' ? 'incentive' : (PAY_TYPES.some(([v]) => v === p.pay_types) && p.pay_types !== 'incentive' ? p.pay_types : 'both'),
  }))

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
            {isSR
              ? 'Pays incentive-based staff a percentage or a fixed amount for each service they perform. Rules are evaluated per employee in the order below.'
              : 'Pays a percentage of matching service revenue. Rules are evaluated per employee in the order below.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field id="ir-type" label="Rule type">
            <select id="ir-type" className={selectCls} value={f.rule_type} onChange={(e) => changeType(e.target.value)}>
              {RULE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>

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
              <select
                id="ir-pay"
                className={selectCls}
                value={f.pay_types}
                disabled={isSR}
                onChange={(e) => setF((p) => ({
                  ...p,
                  pay_types: e.target.value,
                  threshold_type: e.target.value !== 'monthly' && p.threshold_type === 'salary_multiple' ? 'none' : p.threshold_type,
                }))}
              >
                {PAY_TYPES.filter(([v]) => !isSR || v === 'incentive').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            {!isSR && (
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
            )}
            <Field id="ir-window" label="Service time window">
              <select id="ir-window" className={selectCls} value={f.service_window} onChange={(e) => set('service_window', e.target.value)}>
                {WINDOWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>

          {isSR && (
            <div className="space-y-3 border rounded-md p-3">
              <Field
                id="ir-share"
                label="Shared services (fixed ₹ only)"
                hint="When two or more staff share one service, a fixed ₹ amount is either divided between them or paid in full to each. Percentages always apply to each person's equal share of the price."
              >
                <select id="ir-share" className={selectCls} value={f.fixed_share_mode} onChange={(e) => set('fixed_share_mode', e.target.value)}>
                  {SHARE_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <LinesEditor lines={f.service_rates || []} services={services} categories={categories} onChange={(v) => set('service_rates', v)} />
            </div>
          )}

          {!isSR && (
            <>
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
                    {THRESHOLDS.filter(([v]) => v !== 'salary_multiple' || (f.period === 'monthly' && f.pay_types === 'monthly')).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Field>
                {f.threshold_type !== 'none' && (
                  <Field
                    id="ir-thrv"
                    label={f.threshold_type === 'fixed' ? 'Threshold (₹)' : 'Times monthly salary'}
                    hint={f.threshold_type === 'salary_multiple' ? 'e.g. 1 = revenue must reach one month of salary. Only for monthly-paid staff.' : undefined}
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
            </>
          )}
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
