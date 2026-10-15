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
  defaultSettings, validateSettings, newCustomRule, newScopedRule, defaultRuleName, scopedRuleName, topPerformers, reportCsv, WHO_OPTIONS,
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
  Target, Trash2, Trophy, TrendingUp, UserCheck, Users, Wallet,
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

// Rank badge colours: gold, silver, bronze (semantic tokens only)
const RANK_STYLE = {
  1: 'bg-warning/15 text-warning border-warning/30',
  2: 'bg-muted text-muted-foreground border-border',
  3: 'bg-primary/10 text-primary border-primary/30',
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
const SCOPE_HINT = 'If two rules apply to the same person, both are paid.'

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

function RuleCard({ kind, rule: custom, onRemove, children }) {
  const rule = custom || RULES[kind]
  const Icon = rule.icon
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', rule.tint)}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-lg">{rule.title}</CardTitle>
              <CardDescription className="mt-1">{rule.help}</CardDescription>
            </div>
          </div>
          <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${custom?.removeLabel || rule.title}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ShiftFields({ id, rule, onChange }) {
  return (
    <div className="space-y-1.5 w-full sm:w-48">
      <Label htmlFor={`${id}-value`} className="text-xs font-medium text-foreground">Percent (%) of each service</Label>
      <Input
        id={`${id}-value`}
        type="number" min="0" max="100" step="any"
        value={rule.percent}
        onChange={(e) => onChange({ percent: e.target.value })}
      />
      <p className="text-xs text-muted-foreground">0 = pays nothing. Not paid to incentive-based staff.</p>
    </div>
  )
}

// A note when a rule saved earlier is limited to some staff / a branch)
function ScopeFields({ rule, showHint, onChange }) {
  const limited = !!rule.branch_id || rule.employee_ids.length > 0
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
      {showHint && <p className="text-xs text-muted-foreground">{SCOPE_HINT}</p>}
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
      ? 'If the employee’s earnings for the month reach the target below, they get this percent of all their earnings.'
      : 'Pays for each completed service that matches. Leave both lists empty to match every service; if you pick both, a service must match both.',
  }
  const pre = `custom-${rule.id}`
  return (
    <RuleCard rule={cardRule} onRemove={onRemove}>
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
  return (
    <RuleCard rule={cardRule} onRemove={onRemove}>
      <div className="space-y-4">
        <ScopeFields rule={rule} showHint={kind === 'monthly'} onChange={onChange} />
        {kind === 'monthly' ? (
          <div className="space-y-3 border-t pt-4">
            {rule.tiers.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salary (₹)</TableHead>
                    <TableHead>Earned amount (₹)</TableHead>
                    <TableHead>Percent (%)</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rule.tiers.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input
                          aria-label={`Salary, row ${i + 1}`}
                          type="number" min="0" step="any" className="w-36" list="inc-salary-list"
                          value={t.salary}
                          onChange={(e) => setTier(i, { salary: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Earned amount, row ${i + 1}`}
                          type="number" min="0" step="any" className="w-40"
                          value={t.earned_amount}
                          onChange={(e) => setTier(i, { earned_amount: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Percent, row ${i + 1}`}
                          type="number" min="0" max="100" step="any" className="w-28"
                          value={t.percent}
                          onChange={(e) => setTier(i, { percent: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button" size="sm" variant="ghost" aria-label={`Remove row ${i + 1}`}
                          onClick={() => onChange({ tiers: rule.tiers.filter((_, k) => k !== i) })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button" size="sm" variant="outline"
                disabled={rule.tiers.length >= MAX_MONTHLY_TIERS}
                onClick={() => onChange({ tiers: [...rule.tiers, { salary: '', earned_amount: '', percent: '' }] })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add row
              </Button>
              <span className="text-xs text-muted-foreground">Up to {MAX_MONTHLY_TIERS} rows. Pick a salary from the list or type one.</span>
            </div>
            <label className="flex items-start gap-3 cursor-pointer border-t pt-4">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={rule.pick_highest}
                onChange={(e) => onChange({ pick_highest: e.target.checked })}
              />
              <span className="text-sm text-foreground">
                Pay only the highest row (instead of adding the rows an employee qualifies for)
              </span>
            </label>
          </div>
        ) : (
          <div className="border-t pt-4">
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
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="block truncate text-base font-bold tabular-nums leading-tight text-foreground sm:text-xl">{value}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  )
}

const fmtDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d || '—')

function RankBadge({ rank, className }) {
  return (
    <span
      title={`Top performer #${rank}`}
      className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[11px] font-semibold', RANK_STYLE[rank], className)}
    >
      <Trophy className="h-3 w-3" />
      {rank}
    </span>
  )
}

function TopPerformers({ list }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning">
            <Trophy className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Top performers</p>
            <p className="text-xs text-muted-foreground">Highest earnings this month</p>
          </div>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No earnings yet this month.</p>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-3">
            {list.map((e) => (
              <li key={e.employee_id} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                <RankBadge rank={e.rank} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{e.full_name}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">{formatMoney(e.earnings)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function Amount({ label, value }) {
  return (
    <div className="rounded-md border bg-background px-3 py-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="block text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  )
}

const appliedText = (e) => e.applied_label || (e.applied ? APPLIED_LABEL[e.applied] || e.applied : null)

function EmployeeDetail({ e }) {
  const services = e.services || []
  const applied = appliedText(e)
  return (
    <div className="space-y-3 py-2">
      <div className="flex flex-wrap gap-2">
        <Amount label="Earnings" value={money(e.earnings)} />
        <Amount label="Services" value={e.services_count ?? '—'} />
        {e.pay_type !== 'incentive' && (
          <>
            <Amount label="Monthly earnings" value={money(e.monthly_incentive)} />
            <Amount label="Before shift" value={money(e.before_shift_incentive)} />
            <Amount label="After shift" value={money(e.after_shift_incentive)} />
          </>
        )}
        {(e.custom_incentives || []).map((c) => <Amount key={c.id} label={c.name} value={money(c.amount)} />)}
        <Amount label="Paid" value={money(e.paid_incentive)} />
      </div>
      <p className="text-xs text-muted-foreground">
        {applied ? `Paid: ${applied}.` : 'Nothing paid.'}
      </p>
      {Array.isArray(e.rule_amounts) && e.rule_amounts.length > 0 && (
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {e.rule_amounts.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3 border-b border-dashed py-0.5">
              <span className="truncate text-muted-foreground">{r.name}</span>
              <span className="font-medium tabular-nums text-foreground">{money(r.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">No services to show.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Bill no.</TableHead>
              <TableHead>Service</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((sv, i) => {
              const when = WHEN_BADGE[sv.when] || WHEN_BADGE.normal
              return (
                <TableRow key={i}>
                  <TableCell>{fmtDate(sv.date)}</TableCell>
                  <TableCell>{sv.time || '—'}</TableCell>
                  <TableCell>{sv.bill_number || '—'}</TableCell>
                  <TableCell>{sv.service_name || '—'}</TableCell>
                  <TableCell className="text-right">{money(sv.amount)}</TableCell>
                  <TableCell><Badge variant={when.variant}>{when.label}</Badge></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function ResultsCard() {
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [open, setOpen] = useState(() => new Set())
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const { data: branchesData } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
  })
  const branches = branchesData?.data || []
  const branchId = selectedBranchId || branches[0]?.branch_id || ''
  const branchName = branches.find((b) => b.branch_id === branchId)?.name || 'branch'

  const { data: res, isLoading, isError, error } = useQuery({
    queryKey: ['incentive-report', branchId, month],
    queryFn: () => incentiveService.getReport(branchId, month),
    enabled: !!branchId && !!month,
  })
  const employees = useMemo(() => res?.data?.employees || [], [res])
  const grand = employees.reduce((t, e) => t + Number(e.paid_incentive || 0), 0)
  const paidCount = employees.filter((e) => Number(e.paid_incentive || 0) > 0).length
  const top = employees.reduce((best, e) => (Number(e.paid_incentive || 0) > Number(best?.paid_incentive || 0) ? e : best), null)
  const hasTop = !!top && Number(top.paid_incentive) > 0
  const performers = useMemo(() => topPerformers(employees), [employees])
  const rankOf = new Map(performers.map((e) => [e.employee_id, e.rank]))

  const toggle = (id) => setOpen((o) => {
    const n = new Set(o)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const exportCsv = () => {
    const rules = []
    const seen = new Set()
    for (const e of employees) {
      for (const c of e.custom_incentives || []) {
        if (!seen.has(c.id)) { seen.add(c.id); rules.push({ id: c.id, name: c.name }) }
      }
    }
    const blob = new Blob([reportCsv(employees, rules)], { type: 'text/csv;charset=utf-8;' })
    const safeBranch = String(branchName).trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'branch'
    downloadBlob(blob, `incentives_${safeBranch}_${month}.csv`)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 w-full sm:w-64">
              <Label htmlFor="inc-branch" className="text-xs font-medium text-foreground">Branch</Label>
              <select
                id="inc-branch"
                className={SELECT_CLASS}
                value={branchId}
                onChange={(e) => { setSelectedBranchId(e.target.value); setOpen(new Set()) }}
              >
                {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 w-full sm:w-48">
              <Label htmlFor="inc-month" className="text-xs font-medium text-foreground">Month</Label>
              <Input id="inc-month" type="month" value={month} onChange={(e) => { setMonth(e.target.value); setOpen(new Set()) }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {employees.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile icon={Wallet} tint="bg-primary/10 text-primary" label="Total paid this month" value={formatMoney(grand)} />
            <SummaryTile icon={UserCheck} tint="bg-success/10 text-success" label="Employees paid" value={`${paidCount} of ${employees.length}`} />
            <SummaryTile
              icon={TrendingUp}
              tint="bg-info/10 text-info"
              label="Highest paid"
              value={hasTop ? top.full_name : '—'}
              sub={hasTop ? formatMoney(top.paid_incentive) : undefined}
            />
          </div>
          <TopPerformers list={performers} />
        </>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5" />
                Results
              </CardTitle>
              <CardDescription className="mt-1.5">
                What each employee earns for the month. Added to net pay in Payroll. Click a row to see the services.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={employees.length === 0} onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!branchId || !month ? (
            <p className="text-center text-muted-foreground py-8">Select a branch and month.</p>
          ) : isLoading ? (
            <Spinner />
          ) : isError ? (
            <p className="text-center text-destructive py-8">{errMsg(error, 'Failed to load incentives')}</p>
          ) : employees.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No employees to report for this branch.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Employee</TableHead>
                    <TableHead>Pay type</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead className="text-right">Earnings</TableHead>
                    <TableHead className="text-right">Services</TableHead>
                    <TableHead className="text-right">Monthly earnings</TableHead>
                    <TableHead className="text-right">Before shift</TableHead>
                    <TableHead className="text-right">After shift</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => {
                    const isOpen = open.has(e.employee_id)
                    const Chevron = isOpen ? ChevronDown : ChevronRight
                    const rank = rankOf.get(e.employee_id)
                    const salary = e.salary_used ?? e.base_salary
                    const applied = appliedText(e)
                    return (
                      <Fragment key={e.employee_id}>
                        <TableRow className="cursor-pointer" onClick={() => toggle(e.employee_id)}>
                          <TableCell>
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              aria-label={`${isOpen ? 'Hide' : 'Show'} services for ${e.full_name}`}
                              className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                              onClick={(ev) => { ev.stopPropagation(); toggle(e.employee_id) }}
                            >
                              <Chevron className="h-4 w-4" />
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 font-medium">
                              {e.full_name}
                              {rank && <RankBadge rank={rank} />}
                            </div>
                            {(e.warnings || []).map((w) => (
                              <div key={w} className="text-xs text-warning">{w}</div>
                            ))}
                          </TableCell>
                          <TableCell>{e.pay_type ? PAY_TYPE_LABEL[e.pay_type] || e.pay_type : '—'}</TableCell>
                          <TableCell className="text-right">
                            {money(salary)}
                          </TableCell>
                          <TableCell className="text-right">{money(e.earnings)}</TableCell>
                          <TableCell className="text-right">{e.services_count ?? '—'}</TableCell>
                          <TableCell className="text-right">{money(e.monthly_incentive)}</TableCell>
                          <TableCell className="text-right">{money(e.before_shift_incentive)}</TableCell>
                          <TableCell className="text-right">{money(e.after_shift_incentive)}</TableCell>
                          <TableCell className="text-right">
                            <div className="font-medium">{money(e.paid_incentive)}</div>
                            {applied && <div className="mt-0.5 text-xs text-muted-foreground">{applied}</div>}
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={10}><EmployeeDetail e={e} /></TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={9}>Total</TableCell>
                    <TableCell className="text-right">{formatMoney(grand)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">
                Paid = Monthly earnings + Before shift + After shift + any custom rules, all added together.
              </p>
            </>
          )}
        </CardContent>
      </Card>
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
