import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, RotateCcw, Save, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { branchService } from '@/services/branch.service'
import { incentiveConfigService } from '@/services/incentiveConfig.service'

const num = (v) => (v === '' || v === null || v === undefined ? '' : Number(v))

export default function StaffIncentiveConfig() {
  const { user } = useSelector((state) => state.auth)
  const queryClient = useQueryClient()
  const isOwner = user?.role === 'owner' || user?.role === 'developer'

  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [draft, setDraft] = useState(null)

  const { data: branchesResp } = useQuery({
    queryKey: ['branches', { active: true }],
    queryFn: () => branchService.getBranches({ active: true }),
  })
  const branches = useMemo(
    () => branchesResp?.data?.data?.filter((b) => b.is_salon !== false) || [],
    [branchesResp]
  )

  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].branch_id || branches[0].id)
    }
  }, [branches, selectedBranchId])

  const { data: configResp, isLoading } = useQuery({
    queryKey: ['incentive-config', selectedBranchId],
    queryFn: () => incentiveConfigService.getForBranch(selectedBranchId),
    enabled: !!selectedBranchId,
  })

  useEffect(() => {
    if (configResp?.data?.data) {
      const c = configResp.data.data
      setDraft({
        punctualityTiers: [...(c.punctuality_tiers || [])],
        p1RevenueMultiplier: c.p1_revenue_multiplier,
        p1PayoutRate: c.p1_payout_rate,
        p2Tiers: [...(c.p2_tiers || [])],
        p3DailyThresholdRatio: c.p3_daily_threshold_ratio,
        p3DailyBonus: c.p3_daily_bonus ?? c.daily_earnings_payout_rate,
        dailyStarTiers: [...(c.daily_star_tiers || [])],
        salaryCapMultiplier: c.salary_cap_multiplier ?? 3,
        targetSalaryMultiplier: c.target_salary_multiplier ?? 0.95,
        targetFactor: c.target_factor ?? 5,
        dailyThresholdDivisor: c.daily_threshold_divisor ?? 30,
        femaleIncentives: { ...(c.female_incentives || {}) },
        enabled: c.enabled,
      })
    }
  }, [configResp])

  const saveMutation = useMutation({
    mutationFn: (payload) => incentiveConfigService.updateForBranch(selectedBranchId, payload),
    onSuccess: () => {
      toast.success('Incentive config updated')
      queryClient.invalidateQueries({ queryKey: ['incentive-config', selectedBranchId] })
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || 'Failed to update incentive config'),
  })

  const resetMutation = useMutation({
    mutationFn: () => incentiveConfigService.resetForBranch(selectedBranchId),
    onSuccess: () => {
      toast.success('Reset to defaults')
      queryClient.invalidateQueries({ queryKey: ['incentive-config', selectedBranchId] })
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || 'Failed to reset incentive config'),
  })

  const updateDraft = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const updatePunctualityTier = (idx, key, value) => {
    setDraft((d) => {
      const tiers = d.punctualityTiers.map((t, i) => (i === idx ? { ...t, [key]: value } : t))
      return { ...d, punctualityTiers: tiers }
    })
  }

  const addPunctualityTier = () => {
    setDraft((d) => ({
      ...d,
      punctualityTiers: [...d.punctualityTiers, { arrivalTime: '07:15', amount: 0 }],
    }))
  }

  const removePunctualityTier = (idx) => {
    setDraft((d) => ({
      ...d,
      punctualityTiers: d.punctualityTiers.filter((_, i) => i !== idx),
    }))
  }

  const updateStarTier = (listKey, idx, key, value) => {
    setDraft((d) => {
      const tiers = d[listKey].map((t, i) => (i === idx ? { ...t, [key]: num(value) } : t))
      return { ...d, [listKey]: tiers }
    })
  }

  const addStarTier = (listKey) => {
    setDraft((d) => ({
      ...d,
      [listKey]: [...d[listKey], { minStars: 0, rate: 0 }],
    }))
  }

  const removeStarTier = (listKey, idx) => {
    setDraft((d) => ({ ...d, [listKey]: d[listKey].filter((_, i) => i !== idx) }))
  }

  if (!isOwner) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          Owner access required to view or edit staff incentive configuration.
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !draft) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Staff Incentive Configuration</CardTitle>
              <CardDescription>
                Incentive Distribution Policy — target = salary × 0.95 × 5, star tiers,
                daily earnings bonus, punctuality, and female employee add-ons.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Branch</Label>
              <SearchableSelect
                options={branches.map((b) => ({ value: b.branch_id || b.id, label: b.name }))}
                value={selectedBranchId}
                onChange={setSelectedBranchId}
                placeholder="Select branch"
                triggerClassName="w-[220px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-3 rounded border bg-gray-50">
            <div>
              <div className="font-medium">Incentive computation enabled</div>
              <p className="text-xs text-gray-500">When off, all employees in this branch get ₹0 incentive.</p>
            </div>
            <Button
              size="sm"
              variant={draft.enabled ? 'default' : 'outline'}
              onClick={() => updateDraft({ enabled: !draft.enabled })}
            >
              {draft.enabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <section>
            <h3 className="font-semibold mb-2">Monthly target</h3>
            <p className="text-xs text-gray-500 mb-3">
              Target = salary × salary multiplier × factor (default 0.95 × 5). When met,
              bonus = target × achievement rate (default 10%).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Salary multiplier</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={draft.targetSalaryMultiplier}
                  onChange={(e) => updateDraft({ targetSalaryMultiplier: num(e.target.value) })}
                />
              </div>
              <div>
                <Label>Target factor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.targetFactor}
                  onChange={(e) => updateDraft({ targetFactor: num(e.target.value), p1RevenueMultiplier: num(e.target.value) * (draft.targetSalaryMultiplier || 0.95) })}
                />
              </div>
              <div>
                <Label>Target achievement rate</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={draft.p1PayoutRate}
                  onChange={(e) => updateDraft({ p1PayoutRate: num(e.target.value) })}
                />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Monthly star tiers (when target met)</h3>
              <Button size="sm" variant="outline" onClick={() => addStarTier('p2Tiers')}>
                <Plus className="h-3 w-3 mr-1" /> Add tier
              </Button>
            </div>
            <p className="text-xs text-gray-500 mb-3">% of total monthly earnings. Highest qualifying tier wins.</p>
            <div className="space-y-2">
              {draft.p2Tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 w-24">If ≥</span>
                  <Input
                    type="number"
                    value={t.minStars ?? t.minServices}
                    onChange={(e) => updateStarTier('p2Tiers', i, 'minStars', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-sm text-gray-600">stars →</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={t.rate}
                    onChange={(e) => updateStarTier('p2Tiers', i, 'rate', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-sm text-gray-600">× earnings</span>
                  <Button size="sm" variant="ghost" onClick={() => removeStarTier('p2Tiers', i)}>
                    <Trash2 className="h-3 w-3 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Daily earnings bonus</h3>
            <p className="text-xs text-gray-500 mb-3 flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              Threshold = (effective salary × ratio) ÷ divisor. Effective salary = X if earnings ≥ 3X, else earnings.
              Bonus = 5% of that day&apos;s earnings when above threshold.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Salary cap multiplier (3X)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.salaryCapMultiplier}
                  onChange={(e) => updateDraft({ salaryCapMultiplier: num(e.target.value) })}
                />
              </div>
              <div>
                <Label>Daily threshold ratio</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={draft.p3DailyThresholdRatio}
                  onChange={(e) => updateDraft({ p3DailyThresholdRatio: num(e.target.value) })}
                />
              </div>
              <div>
                <Label>Threshold divisor (days)</Label>
                <Input
                  type="number"
                  value={draft.dailyThresholdDivisor}
                  onChange={(e) => updateDraft({ dailyThresholdDivisor: num(e.target.value) })}
                />
              </div>
              <div>
                <Label>Daily earnings payout rate</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={draft.p3DailyBonus}
                  onChange={(e) => updateDraft({ p3DailyBonus: num(e.target.value) })}
                />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Daily star tiers</h3>
              <Button size="sm" variant="outline" onClick={() => addStarTier('dailyStarTiers')}>
                <Plus className="h-3 w-3 mr-1" /> Add tier
              </Button>
            </div>
            <div className="space-y-2">
              {draft.dailyStarTiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 w-24">If ≥</span>
                  <Input
                    type="number"
                    value={t.minStars}
                    onChange={(e) => updateStarTier('dailyStarTiers', i, 'minStars', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-sm text-gray-600">stars/day →</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={t.rate}
                    onChange={(e) => updateStarTier('dailyStarTiers', i, 'rate', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-sm text-gray-600">× day earnings</span>
                  <Button size="sm" variant="ghost" onClick={() => removeStarTier('dailyStarTiers', i)}>
                    <Trash2 className="h-3 w-3 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Punctuality (arrival time)</h3>
              <Button size="sm" variant="outline" onClick={addPunctualityTier}>
                <Plus className="h-3 w-3 mr-1" /> Add tier
              </Button>
            </div>
            <div className="space-y-2">
              {draft.punctualityTiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 w-24">By</span>
                  <Input
                    type="time"
                    value={t.arrivalTime || ''}
                    onChange={(e) => updatePunctualityTier(i, 'arrivalTime', e.target.value)}
                    className="w-36"
                  />
                  <span className="text-sm text-gray-600">→ ₹</span>
                  <Input
                    type="number"
                    value={t.amount}
                    onChange={(e) => updatePunctualityTier(i, 'amount', num(e.target.value))}
                    className="w-28"
                  />
                  <Button size="sm" variant="ghost" onClick={() => removePunctualityTier(i)}>
                    <Trash2 className="h-3 w-3 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Female employee add-ons</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Early arrival before</Label>
                <Input
                  type="time"
                  value={draft.femaleIncentives?.earlyArrivalBefore || '09:00'}
                  onChange={(e) => updateDraft({
                    femaleIncentives: { ...draft.femaleIncentives, earlyArrivalBefore: e.target.value },
                  })}
                />
              </div>
              <div>
                <Label>Early arrival amount (₹)</Label>
                <Input
                  type="number"
                  value={draft.femaleIncentives?.earlyArrivalAmount ?? 20}
                  onChange={(e) => updateDraft({
                    femaleIncentives: { ...draft.femaleIncentives, earlyArrivalAmount: num(e.target.value) },
                  })}
                />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                if (window.confirm('Reset incentive config for this branch to defaults?')) {
                  resetMutation.mutate()
                }
              }}
              disabled={resetMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Reset to defaults
            </Button>
            <Button
              onClick={() => saveMutation.mutate({
                ...draft,
                p1RevenueMultiplier: (draft.targetSalaryMultiplier || 0.95) * (draft.targetFactor || 5),
                dailyEarningsPayoutRate: draft.p3DailyBonus,
              })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
