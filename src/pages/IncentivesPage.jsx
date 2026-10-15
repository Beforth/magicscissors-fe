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
  defaultSettings, validateSettings, newCustomRule, topPerformers, reportCsv, WHO_OPTIONS, MAX_CUSTOM_RULES, MAX_MONTHLY_TIERS,
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

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

// Server settings -> editable form state (numbers as strings so inputs can be blank while typing)
const toForm = (s) => ({
  pick_highest: !!s.pick_highest,
  monthly_tiers: (s.monthly_tiers || []).map((t) => ({
    salary: String(t.salary ?? ''), earned_amount: String(t.earned_amount), percent: String(t.percent),
  })),
  before_shift: { value: String(s.before_shift?.value ?? 0) },
  after_shift: { value: String(s.after_shift?.value ?? 0) },
  custom_rules: (s.custom_rules || []).map((r) => (r.kind === 'target'
    ? { ...r, earned_amount: String(r.earned_amount), percent: String(r.percent) }
    : { ...r, service_ids: [...(r.service_ids || [])], category_ids: [...(r.category_ids || [])], value: String(r.value) })),
})

const num = (v) => (v === '' ? NaN : Number(v))

const toPayload = (f) => ({
  pick_highest: f.pick_highest,
  monthly_tiers: f.monthly_tiers.map((t) => ({ salary: num(t.salary), earned_amount: num(t.earned_amount), percent: num(t.percent) })),
  before_shift: { value: num(f.before_shift.value) },
  after_shift: { value: num(f.after_shift.value) },
  custom_rules: f.custom_rules.map((r) => (r.kind === 'target'
    ? { id: r.id, kind: 'target', name: r.name.trim(), who: r.who, earned_amount: num(r.earned_amount), percent: num(r.percent) }
    : {
      id: r.id, kind: 'per_service', name: r.name.trim(), who: r.who, service_ids: r.service_ids,
      category_ids: r.category_ids, pay_as: r.pay_as, value: num(r.value),
    })),
})

// Which rule cards the saved settings contain something for
const hasRule = (s) => ({
  monthly: (s.monthly_tiers || []).length > 0,
  before_shift: Number(s.before_shift?.value) > 0,
  after_shift: Number(s.after_shift?.value) > 0,
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

function ShiftFields({ id, box, onChange }) {
  return (
    <div className="space-y-1.5 w-full sm:w-48">
      <Label htmlFor={`${id}-value`} className="text-xs font-medium text-foreground">Percent (%) of each service</Label>
      <Input
        id={`${id}-value`}
        type="number" min="0" max="100" step="any"
        value={box.value}
        onChange={(e) => onChange({ ...box, value: e.target.value })}
      />
      <p className="text-xs text-muted-foreground">0 = off. Not paid to incentive-based staff.</p>
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

function AddRuleDialog({ open, onOpenChange, shown, customCount, onPick, onPickCustom }) {
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
              <DialogDescription>Pick one. You can have one of each ready-made rule, and as many of your own as you like.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {RULE_KEYS.map((k) => (
                <RuleOption
                  key={k} icon={RULES[k].icon} tint={RULES[k].tint} title={RULES[k].title} text={RULES[k].pick}
                  disabled={shown.includes(k)} badge={shown.includes(k) ? 'Already added' : null}
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

function SettingsSection({ addOpen, setAddOpen }) {
  const queryClient = useQueryClient()
  const { data: res, isLoading, isError, error } = useQuery({
    queryKey: ['incentive-settings'],
    queryFn: incentiveService.getSettings,
  })
  const [form, setForm] = useState(() => toForm(defaultSettings()))
  const [shown, setShown] = useState([])
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
      const has = hasRule(res.data)
      setShown(RULE_KEYS.filter((k) => has[k]))
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
  const setTier = (i, patch) => set({ monthly_tiers: form.monthly_tiers.map((t, k) => (k === i ? { ...t, ...patch } : t)) })

  // A card that is off the page always has its default (off) values, so the form matches what is shown.
  const addRule = (k) => {
    setShown((s) => (s.includes(k) ? s : [...s, k]))
    if (k === 'monthly' && form.monthly_tiers.length === 0) set({ monthly_tiers: [{ salary: '', earned_amount: '', percent: '' }] })
    setAddOpen(false)
  }
  const addCustom = (kind) => {
    if (form.custom_rules.length >= MAX_CUSTOM_RULES) return
    set({ custom_rules: [...form.custom_rules, newCustomRule(kind, crypto.randomUUID())] })
    setAddOpen(false)
  }
  const setCustom = (id, patch) => set({ custom_rules: form.custom_rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  const removeRule = (k) => {
    setShown((s) => s.filter((x) => x !== k))
    const d = toForm(defaultSettings())
    if (k === 'monthly') set({ monthly_tiers: d.monthly_tiers, pick_highest: d.pick_highest })
    if (k === 'before_shift') set({ before_shift: d.before_shift })
    if (k === 'after_shift') set({ after_shift: d.after_shift })
  }

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

  return (
    <div className="space-y-4">
      {shown.length === 0 && form.custom_rules.length === 0 && (
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

      {shown.includes('monthly') && (
        <RuleCard kind="monthly" onRemove={() => removeRule('monthly')}>
          <div className="space-y-3">
            {form.monthly_tiers.length > 0 && (
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
                  {form.monthly_tiers.map((t, i) => (
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
                          onClick={() => set({ monthly_tiers: form.monthly_tiers.filter((_, k) => k !== i) })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <datalist id="inc-salary-list">
              {salaries.map((n) => <option key={n} value={n} />)}
            </datalist>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button" size="sm" variant="outline"
                disabled={form.monthly_tiers.length >= MAX_MONTHLY_TIERS}
                onClick={() => set({ monthly_tiers: [...form.monthly_tiers, { salary: '', earned_amount: '', percent: '' }] })}
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
                checked={form.pick_highest}
                onChange={(e) => set({ pick_highest: e.target.checked })}
              />
              <span className="text-sm text-foreground">
                Pay only the highest row (instead of adding the rows an employee qualifies for)
              </span>
            </label>
          </div>
        </RuleCard>
      )}

      {shown.includes('before_shift') && (
        <RuleCard kind="before_shift" onRemove={() => removeRule('before_shift')}>
          <ShiftFields id="before" box={form.before_shift} onChange={(b) => set({ before_shift: b })} />
        </RuleCard>
      )}

      {shown.includes('after_shift') && (
        <RuleCard kind="after_shift" onRemove={() => removeRule('after_shift')}>
          <ShiftFields id="after" box={form.after_shift} onChange={(b) => set({ after_shift: b })} />
        </RuleCard>
      )}

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
        open={addOpen} onOpenChange={setAddOpen} shown={shown}
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
          <p className="text-muted-foreground">Extra pay for staff, based on the services they complete. Same rules for all branches.</p>
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
