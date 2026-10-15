import { Fragment, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { incentiveService } from '@/services/incentive.service'
import { branchService } from '@/services/branch.service'
import { userService } from '@/services/user.service'
import { serviceService } from '@/services/service.service'
import { formatMoney, PAY_TYPE_LABEL } from '@/lib/payroll'
import { downloadBlob } from '@/lib/export-utils'
import {
  defaultSettings, validateSettings, newCustomRule, newScopedRule, defaultRuleName, scopedRuleName, reportCsv, WHO_OPTIONS,
  MAX_CUSTOM_RULES, MAX_MONTHLY_TIERS, MAX_RULES_PER_KIND,
} from '@/lib/incentiveSettings'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Award, CalendarDays, ChevronDown, ChevronRight, ArrowLeft, Download, Loader2, Plus, Scissors, Sparkles, Sunrise, Sunset,
  Target, Trash2, TrendingUp, UserCheck, Users, Wallet, Eye, Search, Building2, CheckCircle2, AlertCircle, RefreshCw,
} from 'lucide-react'

const errMsg = (err, fallback) => {
  const fields = err?.response?.data?.error?.details?.fields
  if (Array.isArray(fields) && fields.length > 0) return fields.map((f) => f.message).join('; ')
  return err?.response?.data?.error?.message || err?.message || fallback
}

const APPLIED_LABEL = {
  monthly: 'Monthly earnings',
  before_shift: 'Before shift',
  after_shift: 'After shift',
  all: 'All added together',
  custom: 'Custom rule',
}

const WHEN_BADGE = {
  before_shift: { label: 'Before shift', variant: 'warning' },
  after_shift: { label: 'After shift', variant: 'info' },
  normal: { label: 'Normal', variant: 'secondary' },
}

const CUSTOM_STYLES = {
  per_service: {
    title: 'Per service',
    icon: Scissors,
    tint: 'bg-success/10 text-success',
    pick: 'Pay a percent or a fixed amount for chosen services.',
  },
  target: {
    title: 'Target',
    icon: Target,
    tint: 'bg-warning/10 text-warning',
    pick: 'Pay a percent of all earnings once a monthly target is reached.',
  },
}

const money = (v) => (v == null ? '—' : formatMoney(v))

const getInitials = (name) => {
  if (!name) return 'ST'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const SELECT_CLASS = 'w-full h-10 px-3 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring'

const RULES = {
  monthly: {
    title: 'Monthly earnings',
    icon: CalendarDays,
    tint: 'bg-primary/10 text-primary',
    pick: 'Extra percent when an employee earns a set amount in a month.',
    help: 'Set a row for each salary. When an employee has that salary and their earnings for the month reach the earned amount, they get the percent of all their earnings.',
  },
  before_shift: {
    title: 'Before shift',
    icon: Sunrise,
    tint: 'bg-warning/10 text-warning',
    pick: 'Extra pay for services that start before the shift starts.',
    help: "Services that start before the employee's shift starts earn extra. For monthly and daily staff.",
  },
  after_shift: {
    title: 'After shift',
    icon: Sunset,
    tint: 'bg-info/10 text-info',
    pick: 'Extra pay for services that start after the shift ends.',
    help: "Services that start after the employee's shift ends earn extra. For monthly and daily staff.",
  },
}
const RULE_KEYS = Object.keys(RULES)

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

// Server settings -> editable form state (numbers as strings so inputs can be blank while typing)
const scopeForm = (r) => ({ id: r.id, name: r.name ?? '', branch_id: r.branch_id ?? null, employee_ids: [...(r.employee_ids || [])] })
const toForm = (s) => ({
  monthly_rules: (s.monthly_rules || []).map((r) => ({
    ...scopeForm(r),
    pick_highest: !!r.pick_highest,
    tiers: (r.tiers || []).map((t) => ({
      salary: String(t.salary ?? ''), earned_amount: String(t.earned_amount), percent: String(t.percent),
    })),
  })),
  before_shift_rules: (s.before_shift_rules || []).map((r) => ({ ...scopeForm(r), percent: String(r.percent ?? 0) })),
  after_shift_rules: (s.after_shift_rules || []).map((r) => ({ ...scopeForm(r), percent: String(r.percent ?? 0) })),
  custom_rules: (s.custom_rules || []).map((r) => (r.kind === 'target'
    ? { ...r, earned_amount: String(r.earned_amount), percent: String(r.percent) }
    : { ...r, service_ids: [...(r.service_ids || [])], category_ids: [...(r.category_ids || [])], value: String(r.value) })),
})

const num = (v) => (v === '' ? NaN : Number(v))

const scopePayload = (r) => ({ id: r.id, name: r.name.trim(), branch_id: r.branch_id || null, employee_ids: r.employee_ids })
const toPayload = (f) => ({
  monthly_rules: f.monthly_rules.map((r, i) => ({
    ...scopePayload(r), name: scopedRuleName('monthly', r.name, i),
    pick_highest: r.pick_highest,
    tiers: r.tiers.map((t) => ({ salary: num(t.salary), earned_amount: num(t.earned_amount), percent: num(t.percent) })),
  })),
  before_shift_rules: f.before_shift_rules.map((r, i) => ({
    ...scopePayload(r), name: scopedRuleName('before_shift', r.name, i), percent: num(r.percent),
  })),
  after_shift_rules: f.after_shift_rules.map((r, i) => ({
    ...scopePayload(r), name: scopedRuleName('after_shift', r.name, i), percent: num(r.percent),
  })),
  custom_rules: f.custom_rules.map((r) => (r.kind === 'target'
    ? { id: r.id, kind: 'target', name: r.name.trim(), who: r.who, earned_amount: num(r.earned_amount), percent: num(r.percent) }
    : {
      id: r.id, kind: 'per_service', name: r.name.trim(), who: r.who, service_ids: r.service_ids,
      category_ids: r.category_ids, pay_as: r.pay_as, value: num(r.value),
    })),
})

function RuleCard({ kind, rule: custom, badge, summary, defaultOpen = true, onRemove, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const rule = custom || RULES[kind]
  const Icon = rule.icon
  return (
    <Card className="transition-all duration-200 border-muted/80 shadow-xs">
      <CardHeader
        className={cn('cursor-pointer select-none py-3.5 px-4 sm:px-6 hover:bg-muted/30 transition-colors rounded-t-xl', open && 'border-b border-muted/50')}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg shadow-xs', rule.tint)}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-semibold text-foreground">{rule.title}</CardTitle>
                {badge && <Badge variant="secondary" className="text-[11px] font-normal">{badge}</Badge>}
              </div>
              <CardDescription className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{rule.help}</CardDescription>
              {!open && summary && (
                <div className="mt-1 text-xs font-medium text-primary flex items-center gap-1.5">
                  <span>{summary}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
              aria-label={`Remove ${custom?.removeLabel || rule.title}`}
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md"
              aria-label={open ? 'Collapse details' : 'Expand details'}
              onClick={() => setOpen((o) => !o)}
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      {open && <CardContent className="pt-4 px-4 sm:px-6 pb-5">{children}</CardContent>}
    </Card>
  )
}

function ShiftFields({ id, rule, onChange }) {
  return (
    <div className="space-y-2 max-w-sm">
      <Label htmlFor={`${id}-value`} className="text-xs font-medium text-foreground">Percent (%) of each service</Label>
      <div className="relative w-44">
        <Input
          id={`${id}-value`}
          type="number" min="0" max="100" step="any"
          className="pr-7 text-sm"
          placeholder="0"
          value={rule.percent}
          onChange={(e) => onChange({ percent: e.target.value })}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">%</span>
      </div>
      <p className="text-xs text-muted-foreground">0 = pays nothing. Not paid to incentive-based staff.</p>
    </div>
  )
}

// A note when a rule saved earlier is limited to some staff / a branch)
function ScopeFields({ rule, onChange }) {
  const limited = !!rule.branch_id || rule.employee_ids.length > 0
  if (!limited) return null
  return (
    <div className="space-y-3">
      {limited && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">This rule is limited to specific staff/branch (set earlier)</p>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({ branch_id: null, employee_ids: [] })}>
            Make it apply to everyone
          </Button>
        </div>
      )}
    </div>
  )
}

function CheckList({ id, label, emptyText, items, selected, onChange }) {
  const toggle = (value) => onChange(selected.includes(value) ? selected.filter((x) => x !== value) : [...selected, value])
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-foreground">{label}</Label>
        <span className="text-xs text-muted-foreground">{selected.length === 0 ? emptyText : `${selected.length} picked`}</span>
      </div>
      <div id={id} className="max-h-40 overflow-y-auto rounded-md border bg-background p-1">
        {items.length === 0 && <p className="p-2 text-xs text-muted-foreground">Nothing to pick.</p>}
        {items.map((it) => (
          <label key={it.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={selected.includes(it.value)}
              onChange={() => toggle(it.value)}
            />
            <span className="truncate">{it.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function CustomRuleCard({ rule, index, services, categories, onChange, onRemove }) {
  const style = CUSTOM_STYLES[rule.kind]
  const isPercent = rule.kind === 'target' || rule.pay_as === 'percent'
  const cardRule = {
    title: rule.name.trim() || `Custom rule ${index + 1}`,
    icon: style.icon,
    tint: style.tint,
    removeLabel: `custom rule ${index + 1}`,
    help: rule.kind === 'target'
      ? 'If employee sales reach the monthly target, pays this % of total sales.'
      : 'Pays for specific matching services performed by staff.',
  }
  const badge = rule.kind === 'target'
    ? (rule.earned_amount ? `Target: ₹${rule.earned_amount} → ${rule.percent}%` : 'Target Rule')
    : (rule.pay_as === 'percent' ? `${rule.value || 0}% per service` : `₹${rule.value || 0} per service`)
  const summary = `Applies to: ${WHO_OPTIONS.find((o) => o.value === rule.who)?.label || rule.who}`
  const pre = `custom-${rule.id}`
  return (
    <RuleCard rule={cardRule} badge={badge} summary={summary} defaultOpen={true} onRemove={onRemove}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 w-full sm:w-64">
            <Label htmlFor={`${pre}-name`} className="text-xs font-medium text-foreground">Rule name</Label>
            <Input
              id={`${pre}-name`} maxLength={60} placeholder="e.g. Colour bonus"
              value={rule.name} onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 w-full sm:w-56">
            <Label htmlFor={`${pre}-who`} className="text-xs font-medium text-foreground">Who gets it</Label>
            <select id={`${pre}-who`} className={SELECT_CLASS} value={rule.who} onChange={(e) => onChange({ who: e.target.value })}>
              {WHO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {rule.kind === 'per_service' ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <CheckList
                id={`${pre}-services`} label="Services" emptyText="All services"
                items={services} selected={rule.service_ids} onChange={(v) => onChange({ service_ids: v })}
              />
              <CheckList
                id={`${pre}-categories`} label="Categories" emptyText="All categories"
                items={categories} selected={rule.category_ids} onChange={(v) => onChange({ category_ids: v })}
              />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5 w-full sm:w-56">
                <Label htmlFor={`${pre}-pay`} className="text-xs font-medium text-foreground">Pay as</Label>
                <select id={`${pre}-pay`} className={SELECT_CLASS} value={rule.pay_as} onChange={(e) => onChange({ pay_as: e.target.value })}>
                  <option value="percent">% of the employee&apos;s share</option>
                  <option value="fixed">₹ per service</option>
                </select>
              </div>
              <div className="space-y-1.5 w-full sm:w-40">
                <Label htmlFor={`${pre}-value`} className="text-xs font-medium text-foreground">
                  {isPercent ? 'Percent (%)' : 'Amount (₹)'}
                </Label>
                <Input
                  id={`${pre}-value`} type="number" min="0" step="any"
                  value={rule.value} onChange={(e) => onChange({ value: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {isPercent
                ? "Percent is taken from the employee's share of the service price."
                : 'A fixed amount is split equally between the employees on the same service.'}
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 w-full sm:w-48">
              <Label htmlFor={`${pre}-earned`} className="text-xs font-medium text-foreground">Earned amount (₹)</Label>
              <Input
                id={`${pre}-earned`} type="number" min="0" step="any"
                value={rule.earned_amount} onChange={(e) => onChange({ earned_amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-40">
              <Label htmlFor={`${pre}-percent`} className="text-xs font-medium text-foreground">Percent (%)</Label>
              <Input
                id={`${pre}-percent`} type="number" min="0" max="100" step="any"
                value={rule.percent} onChange={(e) => onChange({ percent: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    </RuleCard>
  )
}

function RuleOption({ icon: Icon, tint, title, text, disabled, badge, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring',
      )}
    >
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', tint)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
      {badge && <Badge variant="secondary">{badge}</Badge>}
    </button>
  )
}

function AddRuleDialog({ open, onOpenChange, counts, customCount, onPick, onPickCustom }) {
  const [step, setStep] = useState('kind')
  const full = customCount >= MAX_CUSTOM_RULES
  const handleOpenChange = (o) => {
    if (!o) setStep('kind')
    onOpenChange(o)
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        {step === 'kind' ? (
          <>
            <DialogHeader>
              <DialogTitle>What kind of rule?</DialogTitle>
              <DialogDescription>Pick one. You can add the same kind of rule again with different numbers.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {RULE_KEYS.map((k) => (
                <RuleOption
                  key={k} icon={RULES[k].icon} tint={RULES[k].tint} title={RULES[k].title} text={RULES[k].pick}
                  disabled={counts[k] >= MAX_RULES_PER_KIND} badge={counts[k] >= MAX_RULES_PER_KIND ? `Limit of ${MAX_RULES_PER_KIND} reached` : null}
                  onClick={() => onPick(k)}
                />
              ))}
              <RuleOption
                icon={Sparkles} tint="bg-primary/10 text-primary" title="Create your own rule"
                text="Build a rule for chosen services or a monthly target."
                disabled={full} badge={full ? `Limit of ${MAX_CUSTOM_RULES} reached` : null}
                onClick={() => setStep('style')}
              />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Which style?</DialogTitle>
              <DialogDescription>Choose how your rule pays.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {Object.entries(CUSTOM_STYLES).map(([k, st]) => (
                <RuleOption
                  key={k} icon={st.icon} tint={st.tint} title={st.title} text={st.pick}
                  onClick={() => { setStep('kind'); onPickCustom(k) }}
                />
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setStep('kind')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

const FORM_KEY = { monthly: 'monthly_rules', before_shift: 'before_shift_rules', after_shift: 'after_shift_rules' }

function ScopedRuleCard({ kind, rule, index, onChange, onRemove }) {
  const base = RULES[kind]
  const title = scopedRuleName(kind, rule.name, index)
  const cardRule = { ...base, title, removeLabel: title }
  const pre = `${kind}-${rule.id}`
  const setTier = (i, patch) => onChange({ tiers: rule.tiers.map((t, k) => (k === i ? { ...t, ...patch } : t)) })

  let badge = null
  let summary = null
  if (kind === 'monthly') {
    badge = `${rule.tiers.length} ${rule.tiers.length === 1 ? 'tier' : 'tiers'}`
    summary = `Click arrow to expand and view ${rule.tiers.length} salary target row(s)`
  } else {
    badge = `${rule.percent || 0}% rate`
    summary = `${rule.percent || 0}% extra pay ${kind === 'before_shift' ? 'before shift' : 'after shift'}`
  }

  return (
    <RuleCard kind={kind} rule={cardRule} badge={badge} summary={summary} defaultOpen={true} onRemove={onRemove}>
      <div className="space-y-4">
        <ScopeFields rule={rule} onChange={onChange} />
        {kind === 'monthly' ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Salary targets & rates</span>
              <span className="text-xs text-muted-foreground">{rule.tiers.length} of {MAX_MONTHLY_TIERS} rows used</span>
            </div>
            {rule.tiers.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-[11px] font-medium text-muted-foreground">Salary (₹)</TableHead>
                      <TableHead className="text-[11px] font-medium text-muted-foreground">Sales target (₹)</TableHead>
                      <TableHead className="text-[11px] font-medium text-muted-foreground">Payout rate (%)</TableHead>
                      <TableHead className="w-10 text-center text-[11px] font-medium text-muted-foreground" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rule.tiers.map((t, i) => (
                      <TableRow key={i} className="hover:bg-muted/20">
                        <TableCell className="py-2">
                          <Input
                            aria-label={`Salary, row ${i + 1}`}
                            type="number" min="0" step="any" className="h-8 w-36 text-sm" list="inc-salary-list"
                            placeholder="e.g. 20000"
                            value={t.salary}
                            onChange={(e) => setTier(i, { salary: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            aria-label={`Earned amount, row ${i + 1}`}
                            type="number" min="0" step="any" className="h-8 w-40 text-sm"
                            placeholder="e.g. 50000"
                            value={t.earned_amount}
                            onChange={(e) => setTier(i, { earned_amount: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="relative w-28">
                            <Input
                              aria-label={`Percent, row ${i + 1}`}
                              type="number" min="0" max="100" step="any" className="h-8 pr-6 text-sm"
                              placeholder="5"
                              value={t.percent}
                              onChange={(e) => setTier(i, { percent: e.target.value })}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          <Button
                            type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove row ${i + 1}`}
                            onClick={() => onChange({ tiers: rule.tiers.filter((_, k) => k !== i) })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button" size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                disabled={rule.tiers.length >= MAX_MONTHLY_TIERS}
                onClick={() => onChange({ tiers: [...rule.tiers, { salary: '', earned_amount: '', percent: '' }] })}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Salary Tier
              </Button>
              <span className="text-xs text-muted-foreground">Pick a staff salary from dropdown or type any custom amount.</span>
            </div>
            <label className="flex items-start gap-3 cursor-pointer border-t pt-3 mt-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary rounded"
                checked={rule.pick_highest}
                onChange={(e) => onChange({ pick_highest: e.target.checked })}
              />
              <span className="text-xs text-muted-foreground">
                <strong className="text-foreground">Pay highest tier only</strong> (if unchecked, all matching tiers will add up together).
              </span>
            </label>
          </div>
        ) : (
          <div className="pt-2">
            <ShiftFields id={pre} rule={rule} onChange={onChange} />
          </div>
        )}
      </div>
    </RuleCard>
  )
}

function SettingsSection({ addOpen, setAddOpen }) {
  const queryClient = useQueryClient()
  const { data: res, isLoading, isError, error } = useQuery({
    queryKey: ['incentive-settings'],
    queryFn: incentiveService.getSettings,
  })
  const [form, setForm] = useState(() => toForm(defaultSettings()))
  const [saved, setSaved] = useState(null) // JSON of the last loaded/saved form

  const { data: usersRes } = useQuery({
    queryKey: ['incentive-employees'],
    queryFn: () => userService.getUsers({ role: 'employee,manager,cashier', limit: 500 }),
  })
  const salaries = useMemo(() => {
    const found = new Set()
    for (const u of usersRes?.data || []) {
      const d = u.employee_details
      const n = Number(d?.base_salary)
      if (d?.pay_type === 'monthly' && Number.isFinite(n) && n > 0) found.add(n)
    }
    return [...found].sort((a, b) => a - b)
  }, [usersRes])
  const { data: servicesRes } = useQuery({
    queryKey: ['incentive-services'],
    queryFn: () => serviceService.getServices({ limit: 500 }),
  })
  const { data: categoriesRes } = useQuery({
    queryKey: ['service-categories'],
    queryFn: () => serviceService.getCategories(),
  })
  const serviceItems = useMemo(
    () => (servicesRes?.data || []).map((x) => ({ value: x.service_id, label: x.service_name })),
    [servicesRes],
  )
  const categoryItems = useMemo(
    () => (categoriesRes?.data || []).map((c) => ({ value: c.category_id, label: c.name })),
    [categoriesRes],
  )

  useEffect(() => {
    if (res?.data) {
      const f = toForm(res.data)
      setForm(f)
      setSaved(JSON.stringify(f))
    }
  }, [res])

  const save = useMutation({
    mutationFn: (payload) => incentiveService.saveSettings(payload),
    onSuccess: () => {
      toast.success('Incentive settings saved')
      setSaved(JSON.stringify(form))
      queryClient.invalidateQueries({ queryKey: ['incentive-settings'] })
      queryClient.invalidateQueries({ queryKey: ['incentive-report'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-report'] })
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save settings')),
  })

  const dirty = saved !== null && JSON.stringify(form) !== saved
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const counts = {
    monthly: form.monthly_rules.length,
    before_shift: form.before_shift_rules.length,
    after_shift: form.after_shift_rules.length,
  }

  // Every press adds a NEW card (the same rule kind can be added many times).
  const addRule = (k) => {
    const key = FORM_KEY[k]
    if (form[key].length >= MAX_RULES_PER_KIND) return
    set({ [key]: [...form[key], newScopedRule(k, crypto.randomUUID(), defaultRuleName(k, form[key].length))] })
    setAddOpen(false)
  }
  const setRule = (k, id, patch) => set({ [FORM_KEY[k]]: form[FORM_KEY[k]].map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  const removeRule = (k, id) => set({ [FORM_KEY[k]]: form[FORM_KEY[k]].filter((r) => r.id !== id) })
  const addCustom = (kind) => {
    if (form.custom_rules.length >= MAX_CUSTOM_RULES) return
    set({ custom_rules: [...form.custom_rules, newCustomRule(kind, crypto.randomUUID())] })
    setAddOpen(false)
  }
  const setCustom = (id, patch) => set({ custom_rules: form.custom_rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  const handleSave = () => {
    const payload = toPayload(form)
    const problem = validateSettings(payload)
    if (problem) {
      toast.error(problem)
      return
    }
    save.mutate(payload)
  }

  if (isLoading) return <Spinner />
  if (isError) return <p className="text-center text-destructive py-8">{errMsg(error, 'Failed to load settings')}</p>

  const noRules = counts.monthly + counts.before_shift + counts.after_shift + form.custom_rules.length === 0

  return (
    <div className="space-y-4">
      {noRules && (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-foreground">No incentive rules yet</p>
            <p className="text-sm">Click Add rule to create one.</p>
            <Button className="mt-4" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add rule
            </Button>
          </CardContent>
        </Card>
      )}

      <datalist id="inc-salary-list">
        {salaries.map((n) => <option key={n} value={n} />)}
      </datalist>

      {RULE_KEYS.flatMap((k) => form[FORM_KEY[k]].map((r, i) => (
        <ScopedRuleCard
          key={r.id} kind={k} rule={r} index={i}
          onChange={(patch) => setRule(k, r.id, patch)} onRemove={() => removeRule(k, r.id)}
        />
      )))}

      {form.custom_rules.map((r, i) => (
        <CustomRuleCard
          key={r.id} rule={r} index={i} services={serviceItems} categories={categoryItems}
          onChange={(patch) => setCustom(r.id, patch)}
          onRemove={() => set({ custom_rules: form.custom_rules.filter((x) => x.id !== r.id) })}
        />
      ))}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!dirty || save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
        {dirty && <span className="text-xs text-muted-foreground">You have unsaved changes.</span>}
      </div>

      <AddRuleDialog
        open={addOpen} onOpenChange={setAddOpen} counts={counts}
        customCount={form.custom_rules.length} onPick={addRule} onPickCustom={addCustom}
      />
    </div>
  )
}

function SummaryTile({ icon: Icon, tint, label, value, sub }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', tint)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span className="block truncate text-base font-bold tabular-nums leading-tight text-foreground sm:text-xl">{value}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  )
}

const fmtDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d || '—')

function Amount({ label, value }) {
  return (
    <div className="rounded-md border bg-background px-3 py-1.5">
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <span className="block text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  )
}

const appliedText = (e) => e.applied_label || (e.applied ? APPLIED_LABEL[e.applied] || e.applied : null)

function EmployeeDetailModal({ employee: e, open, onClose, branchName, allBranches, month }) {
  const [search, setSearch] = useState('')
  const [filterWhen, setFilterWhen] = useState('all')

  useEffect(() => {
    setSearch('')
    setFilterWhen('all')
  }, [e?.employee_id])

  if (!e) return null

  const services = e.services || []
  const showBranchCol = services.some((sv) => sv.branch_name)
  const branchRows = Array.isArray(e.earnings_by_branch) ? e.earnings_by_branch : []
  const applied = appliedText(e)
  const salary = e.salary_used ?? e.base_salary

  const filteredServices = services.filter((sv) => {
    if (filterWhen !== 'all' && sv.when !== filterWhen) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (sv.service_name || '').toLowerCase().includes(q) ||
      (sv.bill_number || '').toLowerCase().includes(q) ||
      (sv.date || '').toLowerCase().includes(q)
    )
  })

  const totalFilteredAmount = filteredServices.reduce((sum, s) => sum + Number(s.amount || 0), 0)
  const yieldPct = e.earnings > 0 ? ((Number(e.paid_incentive || 0) / Number(e.earnings)) * 100).toFixed(1) : '0'

  const whenCounts = {
    all: services.length,
    normal: services.filter((s) => s.when === 'normal' || !s.when).length,
    before_shift: services.filter((s) => s.when === 'before_shift').length,
    after_shift: services.filter((s) => s.when === 'after_shift').length,
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl sm:max-w-4xl max-h-[88vh] overflow-y-auto p-4 sm:p-6 gap-5">
        <DialogHeader className="space-y-1">
          <div className="flex items-start gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary font-bold text-lg shadow-xs">
              {getInitials(e.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-xl font-bold text-foreground">{e.full_name}</DialogTitle>
                <Badge variant={e.pay_type === 'incentive' ? 'secondary' : 'default'} className="text-xs">
                  {e.pay_type ? PAY_TYPE_LABEL[e.pay_type] || e.pay_type : 'Employee'}
                </Badge>
                {e.pay_type === 'incentive' ? (
                  <Badge variant="outline" className="text-xs font-normal">
                    Commission Rate: {salary != null && salary !== '' ? `${salary}%` : '0%'}
                  </Badge>
                ) : salary ? (
                  <Badge variant="outline" className="text-xs font-normal">
                    Base Salary: {money(salary)}
                  </Badge>
                ) : null}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 font-medium text-foreground/80">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {allBranches ? 'All branches' : branchName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {monthLabel(month)}
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Hero Card: Total Incentive & Snapshot Metrics */}
        <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-card to-background p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground">Total incentive earned</span>
              <div className="text-3xl font-extrabold tabular-nums text-primary mt-0.5">
                {money(e.paid_incentive)}
              </div>
              {applied ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Rule applied: {applied}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">No incentive rules applied or targets reached.</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center sm:text-right">
              <div className="rounded-lg bg-background/80 border p-2.5">
                <span className="block text-[11px] font-medium text-muted-foreground">Sales billed</span>
                <span className="text-sm sm:text-base font-bold tabular-nums text-foreground">{money(e.earnings)}</span>
              </div>
              <div className="rounded-lg bg-background/80 border p-2.5">
                <span className="block text-[11px] font-medium text-muted-foreground">Services</span>
                <span className="text-sm sm:text-base font-bold tabular-nums text-foreground">{e.services_count ?? 0}</span>
              </div>
              <div className="rounded-lg bg-background/80 border p-2.5">
                <span className="block text-[11px] font-medium text-muted-foreground">Yield</span>
                <span className="text-sm sm:text-base font-bold tabular-nums text-foreground">{yieldPct}%</span>
              </div>
            </div>
          </div>

          {/* Rule Breakdown Mini-Tiles */}
          <div className="border-t border-border/60 pt-3">
            <span className="text-xs font-medium text-muted-foreground block mb-2">
              Rule contributions
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {e.pay_type === 'incentive' ? (
                <>
                  <div className="rounded-lg border bg-background/60 p-2">
                    <span className="text-[11px] text-muted-foreground block truncate">Service Commission</span>
                    <span className="text-sm font-semibold text-primary tabular-nums">
                      {money(e.paid_incentive)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {salary != null && salary !== '' ? `${salary}% rate` : '0% rate'}
                    </span>
                  </div>
                  <div className="rounded-lg border bg-background/60 p-2 opacity-60">
                    <span className="text-[11px] text-muted-foreground block truncate">Monthly Target</span>
                    <span className="text-sm font-semibold text-muted-foreground tabular-nums">N/A</span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Salary staff only</span>
                  </div>
                  <div className="rounded-lg border bg-background/60 p-2 opacity-60">
                    <span className="text-[11px] text-muted-foreground block truncate">Shift Targets</span>
                    <span className="text-sm font-semibold text-muted-foreground tabular-nums">N/A</span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Salary staff only</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg border bg-background/60 p-2">
                    <span className="text-[11px] text-muted-foreground block truncate">Monthly Target</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {money(e.monthly_incentive)}
                    </span>
                  </div>
                  <div className="rounded-lg border bg-background/60 p-2">
                    <span className="text-[11px] text-muted-foreground block truncate">Before Shift</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {money(e.before_shift_incentive)}
                    </span>
                  </div>
                  <div className="rounded-lg border bg-background/60 p-2">
                    <span className="text-[11px] text-muted-foreground block truncate">After Shift</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {money(e.after_shift_incentive)}
                    </span>
                  </div>
                </>
              )}
              {(e.custom_incentives || []).map((c) => (
                <div key={c.id} className="rounded-lg border bg-background/60 p-2">
                  <span className="text-[11px] text-muted-foreground block truncate">{c.name}</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">{money(c.amount)}</span>
                </div>
              ))}
              {(!e.custom_incentives || e.custom_incentives.length === 0) && e.pay_type !== 'incentive' && (
                <div className="rounded-lg border bg-background/60 p-2">
                  <span className="text-[11px] text-muted-foreground block truncate">Custom Rules</span>
                  <span className="text-sm font-semibold text-muted-foreground tabular-nums">₹0</span>
                </div>
              )}
            </div>
          </div>

          {/* Warnings */}
          {e.warnings && e.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
              {e.warnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {branchRows.length > 1 && (
          <div className="rounded-lg border bg-background p-3">
            <span className="text-xs font-medium text-muted-foreground block mb-1.5">By branch</span>
            <ul className="space-y-0.5 text-xs">
              {branchRows.map((b, i) => (
                <li key={b.branch_id || i} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-foreground">{b.branch_name || 'Branch'}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {b.services_count ?? 0} {Number(b.services_count) === 1 ? 'service' : 'services'} — <strong className="text-foreground">{money(b.earnings)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Completed Services Table Section */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Scissors className="h-4 w-4 text-primary" />
                Completed Services Breakdown
                <Badge variant="secondary" className="text-xs">
                  {services.length}
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground">
                Only completed services from completed bills count toward incentives.
              </p>
            </div>

            {/* Filter Pills */}
            {services.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={filterWhen === 'all' ? 'secondary' : 'ghost'}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setFilterWhen('all')}
                >
                  All ({whenCounts.all})
                </Button>
                {whenCounts.before_shift > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant={filterWhen === 'before_shift' ? 'secondary' : 'ghost'}
                    className="h-7 text-xs px-2.5"
                    onClick={() => setFilterWhen('before_shift')}
                  >
                    Before Shift ({whenCounts.before_shift})
                  </Button>
                )}
                {whenCounts.after_shift > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant={filterWhen === 'after_shift' ? 'secondary' : 'ghost'}
                    className="h-7 text-xs px-2.5"
                    onClick={() => setFilterWhen('after_shift')}
                  >
                    After Shift ({whenCounts.after_shift})
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Search bar if many services */}
          {services.length > 2 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by service name, bill number, or date..."
                className="pl-9 h-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          {services.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <Scissors className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm font-medium">No completed services</p>
              <p className="text-xs">This employee has no completed services recorded for {monthLabel(month)}{allBranches ? '' : ` at ${branchName}`}.</p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              <p className="text-sm">No services match your search or filter.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden max-h-72 overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[11px] font-medium text-muted-foreground">Date</TableHead>
                    <TableHead className="text-[11px] font-medium text-muted-foreground">Time</TableHead>
                    {showBranchCol && <TableHead className="text-[11px] font-medium text-muted-foreground">Branch</TableHead>}
                    <TableHead className="text-[11px] font-medium text-muted-foreground">Bill no.</TableHead>
                    <TableHead className="text-[11px] font-medium text-muted-foreground">Service</TableHead>
                    <TableHead className="text-[11px] font-medium text-muted-foreground">Timing</TableHead>
                    <TableHead className="text-[11px] font-medium text-muted-foreground text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map((sv, i) => {
                    const when = WHEN_BADGE[sv.when] || WHEN_BADGE.normal
                    return (
                      <TableRow key={i} className="hover:bg-muted/20">
                        <TableCell className="text-xs py-2">{fmtDate(sv.date)}</TableCell>
                        <TableCell className="text-xs py-2 text-muted-foreground">{sv.time || '—'}</TableCell>
                        {showBranchCol && <TableCell className="text-xs py-2">{sv.branch_name || '—'}</TableCell>}
                        <TableCell className="text-xs py-2 font-mono font-medium">{sv.bill_number || '—'}</TableCell>
                        <TableCell className="text-xs py-2 font-medium">{sv.service_name || '—'}</TableCell>
                        <TableCell className="text-xs py-2">
                          <Badge variant={when.variant} className="text-[10px] px-1.5 py-0.5">
                            {when.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right font-semibold tabular-nums">
                          {money(sv.amount)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredServices.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pt-1">
              <span>Showing {filteredServices.length} of {services.length} service(s)</span>
              <span>Total filtered sales: <strong className="text-foreground">{money(totalFilteredAmount)}</strong></span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const monthLabel = (m) => {
  const match = /^(\d{4})-(\d{2})$/.exec(m || '')
  if (!match) return 'the month selected'
  const name = new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleString('en-US', { month: 'long' })
  return `${name} ${match[1]}`
}

function ResultsCard() {
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const { data: branchesData } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
  })
  const branches = branchesData?.data || []
  const branchId = selectedBranchId // '' = all branches (default)
  const allBranches = !branchId
  const branchName = branches.find((b) => b.branch_id === branchId)?.name || 'branch'

  const { data: res, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['incentive-report', branchId, month],
    queryFn: () => incentiveService.getReport(branchId, month),
    enabled: !!month,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  })
  const employees = useMemo(() => res?.data?.employees || [], [res])
  const grand = employees.reduce((t, e) => t + Number(e.paid_incentive || 0), 0)
  const paidCount = employees.filter((e) => Number(e.paid_incentive || 0) > 0).length
  const top = employees.reduce((best, e) => (Number(e.paid_incentive || 0) > Number(best?.paid_incentive || 0) ? e : best), null)
  const hasTop = !!top && Number(top.paid_incentive) > 0

  const activeEmployee = selectedEmployee
    ? employees.find((x) => x.employee_id === selectedEmployee.employee_id) || selectedEmployee
    : null

  const exportCsv = () => {
    const rules = []
    const seen = new Set()
    for (const e of employees) {
      for (const c of e.custom_incentives || []) {
        if (!seen.has(c.id)) { seen.add(c.id); rules.push({ id: c.id, name: c.name }) }
      }
    }
    const blob = new Blob([reportCsv(employees, rules)], { type: 'text/csv;charset=utf-8;' })
    const safeBranch = allBranches ? 'all-branches' : String(branchName).trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'branch'
    downloadBlob(blob, `incentives_${safeBranch}_${month}.csv`)
  }

  return (
    <div className="space-y-4">
      {/* Branch & Month Toolbar Card */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-3 sm:gap-4 flex-1">
              <div className="space-y-1.5 w-full sm:w-64">
                <Label htmlFor="inc-branch" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Branch
                </Label>
                <select
                  id="inc-branch"
                  className={SELECT_CLASS}
                  value={branchId}
                  onChange={(e) => { setSelectedBranchId(e.target.value); setSelectedEmployee(null) }}
                >
                  <option value="">All branches</option>
                  {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 w-full sm:w-48">
                <Label htmlFor="inc-month" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Month
                </Label>
                <Input
                  id="inc-month"
                  type="month"
                  value={month}
                  onChange={(e) => { setMonth(e.target.value); setSelectedEmployee(null) }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {dataUpdatedAt > 0 && (
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(dataUpdatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 text-xs gap-1.5"
                disabled={isFetching}
                onClick={() => refetch()}
              >
                <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
                Refresh
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 text-xs gap-1.5"
                disabled={employees.length === 0}
                onClick={exportCsv}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Tiles */}
      {employees.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile icon={Wallet} tint="bg-primary/10 text-primary" label="Total paid this month" value={formatMoney(grand)} />
          <SummaryTile icon={UserCheck} tint="bg-success/10 text-success" label="Employees paid" value={`${paidCount} of ${employees.length}`} />
          <SummaryTile
            icon={TrendingUp}
            tint="bg-info/10 text-info"
            label="Highest earner"
            value={hasTop ? top.full_name : '—'}
            sub={hasTop ? formatMoney(top.paid_incentive) : undefined}
          />
        </div>
      )}

      {/* Results Table Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5 text-primary" />
                Staff Incentive Results
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Counts completed services on completed bills (the same rule as Staff Performance), billed at{' '}
                <strong className="text-foreground">{allBranches ? 'all branches' : branchName}</strong>, for{' '}
                <strong className="text-foreground">{monthLabel(month)}</strong>. Click any staff row to see their full breakdown and completed services.
              </CardDescription>
              <CardDescription className="mt-1 text-xs">
                Incentives are worked out on each person&apos;s earnings across all branches and paid in their own branch&apos;s payroll.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!month ? (
            <p className="text-center text-muted-foreground py-8">Select a month.</p>
          ) : isLoading ? (
            <Spinner />
          ) : isError ? (
            <p className="text-center text-destructive py-8">{errMsg(error, 'Failed to load incentives')}</p>
          ) : employees.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>{allBranches ? 'No employees to report.' : 'No employees to report for this branch.'}</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-[11px] font-medium text-muted-foreground">Staff</TableHead>
                      <TableHead className="text-[11px] font-medium text-muted-foreground">Pay type</TableHead>
                      <TableHead className="text-[11px] font-medium text-muted-foreground text-center">Salary / %</TableHead>
                      <TableHead className="text-[11px] font-medium text-muted-foreground text-right">Sales</TableHead>
                      <TableHead className="text-[11px] font-medium text-muted-foreground text-center">Services</TableHead>
                      <TableHead className="text-[11px] font-medium text-muted-foreground text-center">Monthly</TableHead>
                      <TableHead className="text-[11px] font-medium text-muted-foreground text-center">Before shift</TableHead>
                      <TableHead className="text-[11px] font-medium text-muted-foreground text-center">After shift</TableHead>
                      <TableHead className="text-[11px] font-medium text-muted-foreground text-right">Incentive</TableHead>
                      <TableHead className="text-[11px] font-medium text-muted-foreground text-center w-20">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((e) => {
                      const salary = e.salary_used ?? e.base_salary
                      const applied = appliedText(e)
                      return (
                        <TableRow
                          key={e.employee_id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors group"
                          onClick={() => setSelectedEmployee(e)}
                        >
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary font-semibold text-xs shadow-xs">
                                {getInitials(e.full_name)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                                  <span className="truncate">{e.full_name}</span>
                                  <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0" />
                                </div>
                                {(e.warnings || []).map((w, wi) => (
                                  <div key={`${wi}-${w}`} className="text-[11px] text-amber-600 dark:text-amber-400 font-normal truncate max-w-xs">{w}</div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className="text-xs font-normal">
                              {e.pay_type ? PAY_TYPE_LABEL[e.pay_type] || e.pay_type : '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-center tabular-nums">
                            {e.pay_type === 'incentive' ? (
                              <Badge variant="secondary" className="text-xs font-semibold">
                                {salary != null && salary !== '' ? `${salary}%` : '0%'}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">{money(salary)}</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right tabular-nums font-semibold text-foreground">{money(e.earnings)}</TableCell>
                          <TableCell className="py-3 text-center tabular-nums">{e.services_count ?? '—'}</TableCell>
                          <TableCell className="py-3 text-center tabular-nums">
                            {e.pay_type === 'incentive' ? <span className="text-muted-foreground/60">—</span> : money(e.monthly_incentive)}
                          </TableCell>
                          <TableCell className="py-3 text-center tabular-nums">
                            {e.pay_type === 'incentive' ? <span className="text-muted-foreground/60">—</span> : money(e.before_shift_incentive)}
                          </TableCell>
                          <TableCell className="py-3 text-center tabular-nums">
                            {e.pay_type === 'incentive' ? <span className="text-muted-foreground/60">—</span> : money(e.after_shift_incentive)}
                          </TableCell>
                          <TableCell className="py-3 text-right tabular-nums">
                            <div className="font-bold text-foreground text-sm">{money(e.paid_incentive)}</div>
                            {applied && <div className="text-[10px] text-muted-foreground font-medium">{applied}</div>}
                          </TableCell>
                          <TableCell className="py-3 text-center" onClick={(ev) => ev.stopPropagation()}>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1.5"
                              onClick={() => setSelectedEmployee(e)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Details</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow className="font-semibold bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={8} className="py-2.5 text-xs font-medium text-muted-foreground">Total</TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-primary font-bold">{formatMoney(grand)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Total Incentive = Monthly earnings + Before shift + After shift + any custom rules. Added directly to net pay in Payroll.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modern Employee Detail Modal */}
      <EmployeeDetailModal
        employee={activeEmployee}
        open={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        branchName={branchName}
        allBranches={allBranches}
        month={month}
      />
    </div>
  )
}

export default function IncentivesPage() {
  const { user } = useSelector((s) => s.auth)
  const [addOpen, setAddOpen] = useState(false)
  if (user?.role !== 'owner') return <Navigate to="/" replace />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Incentives</h1>
          <p className="text-muted-foreground">Extra pay for staff, based on the services they complete. Rules apply to everyone who qualifies, in all branches.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add rule
        </Button>
      </div>

      <SettingsSection addOpen={addOpen} setAddOpen={setAddOpen} />
      <ResultsCard />
    </div>
  )
}
