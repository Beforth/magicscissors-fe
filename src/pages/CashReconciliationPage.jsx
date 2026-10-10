import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { cashService } from '@/services/cash.service'
import { branchService } from '@/services/branch.service'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import {
  Wallet,
  Banknote,
  CreditCard,
  Smartphone,
  Building,
  Calculator,
  Loader2,
  CheckCircle,
  AlertTriangle,
  MinusCircle,
  PlusCircle,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react'
import { toast } from 'sonner'

const DENOMINATIONS = [
  { value: 2000, label: '₹2000' },
  { value: 500, label: '₹500' },
  { value: 200, label: '₹200' },
  { value: 100, label: '₹100' },
  { value: 50, label: '₹50' },
  { value: 20, label: '₹20' },
  { value: 10, label: '₹10' },
  { value: 5, label: '₹5' },
  { value: 2, label: '₹2' },
  { value: 1, label: '₹1' },
]

function CashReconciliationPage() {
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const canSeeRevenue = isOwner

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedBranch, setSelectedBranch] = useState(user?.branchId || '')
  const [showReconcileModal, setShowReconcileModal] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [denominations, setDenominations] = useState({})
  const [reconcileNotes, setReconcileNotes] = useState('')
  const [depositData, setDepositData] = useState({
    bank_name: '',
    account_number: '',
    amount: '',
    reference_number: '',
    notes: '',
  })

  // Fetch branches for owner
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: isOwner,
  })

  const branches = branchesData?.data || []

  // Fetch daily cash summary
  const { data: summaryData, isLoading, refetch } = useQuery({
    queryKey: ['cash-summary', selectedDate, selectedBranch || user?.branchId],
    queryFn: () => cashService.getDailySummary({
      date: selectedDate,
      branch_id: selectedBranch || user?.branchId,
    }),
    enabled: !!(selectedBranch || user?.branchId),
  })

  const summary = summaryData?.data

  // Reconciliation mutation
  const reconcileMutation = useMutation({
    mutationFn: cashService.recordReconciliation,
    onSuccess: (data) => {
      const result = data.data
      if (result.status === 'balanced') {
        toast.success('Cash drawer balanced successfully!')
      } else if (result.status === 'surplus') {
        toast.warning(`Cash surplus of ${formatCurrency(result.difference)} recorded`)
      } else {
        toast.error(`Cash shortage of ${formatCurrency(Math.abs(result.difference))} recorded`)
      }
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] })
      setShowReconcileModal(false)
      resetDenominations()
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to record reconciliation')
    },
  })

  // Deposit mutation
  const depositMutation = useMutation({
    mutationFn: cashService.recordBankDeposit,
    onSuccess: () => {
      toast.success('Bank deposit recorded successfully')
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] })
      setShowDepositModal(false)
      setDepositData({
        bank_name: '',
        account_number: '',
        amount: '',
        reference_number: '',
        notes: '',
      })
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to record deposit')
    },
  })

  const resetDenominations = () => {
    setDenominations({})
    setReconcileNotes('')
  }

  const handleDenominationChange = (denom, count) => {
    setDenominations(prev => ({
      ...prev,
      [denom]: Math.max(0, parseInt(count) || 0),
    }))
  }

  const calculateTotalCash = () => {
    return Object.entries(denominations).reduce((total, [denom, count]) => {
      return total + (parseInt(denom) * (parseInt(count) || 0))
    }, 0)
  }

  const handleReconcile = () => {
    const actualCash = calculateTotalCash()
    reconcileMutation.mutate({
      branch_id: selectedBranch || user?.branchId,
      date: selectedDate,
      actual_cash: actualCash,
      denominations,
      notes: reconcileNotes,
    })
  }

  const handleDeposit = () => {
    if (!depositData.bank_name || !depositData.amount) {
      toast.error('Bank name and amount are required')
      return
    }
    depositMutation.mutate({
      branch_id: selectedBranch || user?.branchId,
      date: selectedDate,
      ...depositData,
      amount: parseFloat(depositData.amount),
    })
  }

  const actualCash = calculateTotalCash()
  const difference = summary ? actualCash - summary.expected_cash : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cash Reconciliation</h1>
          <p className="text-gray-500">End of day cash drawer balancing</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setShowDepositModal(true)}>
            <Building className="h-4 w-4 mr-2" />
            Bank Deposit
          </Button>
          <Button onClick={() => setShowReconcileModal(true)}>
            <Calculator className="h-4 w-4 mr-2" />
            Count Cash
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="mb-2 block">Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            {isOwner && (
              <div>
                <Label className="mb-2 block">Branch</Label>
                <select
                  className="h-10 px-3 border rounded-md min-w-[180px]"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  <option value="">Select Branch</option>
                  {branches.map((branch) => (
                    <option key={branch.branch_id} value={branch.branch_id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button variant="outline" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !summary ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            Select a branch to view cash summary
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className={`grid grid-cols-1 gap-4 ${canSeeRevenue ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
            {canSeeRevenue && (
              <Card className="bg-gray-50 border-gray-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <Wallet className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Opening Balance</p>
                      <p className="text-2xl font-bold text-gray-700">
                        {formatCurrency(summary.opening_balance || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!canSeeRevenue && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Receipt className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-green-600">Bills Today</p>
                      <p className="text-2xl font-bold text-green-700">{summary.bills_count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {canSeeRevenue && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Banknote className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-blue-600">Cash Sales</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {formatCurrency(summary.payment_breakdown.cash)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <ArrowDownCircle className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-purple-600">Bank Deposits</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {formatCurrency(summary.bank_deposits)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {canSeeRevenue && (
              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <Wallet className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-orange-600">Expected Cash</p>
                      <p className="text-2xl font-bold text-orange-700">
                        {formatCurrency(summary.expected_cash)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Payment Breakdown & Cash Flow - owner only */}
          {canSeeRevenue && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(summary.payment_breakdown).map(([mode, amount]) => {
                    const icons = {
                      cash: Banknote,
                      card: CreditCard,
                      upi: Smartphone,
                      bank_transfer: Building,
                      other: Wallet,
                    }
                    const Icon = icons[mode] || Wallet
                    const totalPayments = Object.values(summary.payment_breakdown).reduce((a, b) => a + b, 0)
                    const percentage = totalPayments > 0
                      ? ((amount / totalPayments) * 100).toFixed(1)
                      : 0

                    return (
                      <div key={mode} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-gray-400" />
                          <span className="capitalize">{mode.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="font-bold w-24 text-right">
                            {formatCurrency(amount)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Cash Flow
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle className="h-5 w-5 text-green-600" />
                      <span>Cash from Sales</span>
                    </div>
                    <span className="font-bold text-green-600">
                      +{formatCurrency(summary.payment_breakdown.cash)}
                    </span>
                  </div>

                  {summary.cash_sources > 0 && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <PlusCircle className="h-5 w-5 text-blue-600" />
                        <span>Other Cash In</span>
                      </div>
                      <span className="font-bold text-blue-600">
                        +{formatCurrency(summary.cash_sources)}
                      </span>
                    </div>
                  )}

                  {summary.bank_deposits > 0 && (
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <MinusCircle className="h-5 w-5 text-purple-600" />
                        <span>Bank Deposits</span>
                      </div>
                      <span className="font-bold text-purple-600">
                        -{formatCurrency(summary.bank_deposits)}
                      </span>
                    </div>
                  )}

                  {summary.cash_expenses > 0 && (
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <MinusCircle className="h-5 w-5 text-red-600" />
                        <span>Cash Expenses</span>
                      </div>
                      <span className="font-bold text-red-600">
                        -{formatCurrency(summary.cash_expenses)}
                      </span>
                    </div>
                  )}

                  {summary.savings_pot_deposits > 0 && (
                    <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <MinusCircle className="h-5 w-5 text-pink-600" />
                        <span>Savings Pot Deposits (Cash)</span>
                      </div>
                      <span className="font-bold text-pink-600">
                        -{formatCurrency(summary.savings_pot_deposits)}
                      </span>
                    </div>
                  )}

                  {summary.counter_withdrawals > 0 && (
                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <MinusCircle className="h-5 w-5 text-amber-600" />
                        <span>Counter Withdrawals</span>
                      </div>
                      <span className="font-bold text-amber-600">
                        -{formatCurrency(summary.counter_withdrawals)}
                      </span>
                    </div>
                  )}

                  {summary.opening_balance > 0 && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <PlusCircle className="h-5 w-5 text-gray-600" />
                        <span>Opening Balance</span>
                      </div>
                      <span className="font-bold text-gray-600">
                        +{formatCurrency(summary.opening_balance)}
                      </span>
                    </div>
                  )}

                  <div className="border-t pt-4 flex items-center justify-between">
                    <span className="font-semibold">Expected in Drawer</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(summary.expected_cash)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>}

          {/* Bank Deposits Detail */}
          {summary.bank_deposits_detail.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Today's Bank Deposits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary.bank_deposits_detail.map((deposit) => (
                    <div
                      key={deposit.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{deposit.bank_name}</p>
                        {deposit.reference && (
                          <p className="text-xs text-gray-500">Ref: {deposit.reference}</p>
                        )}
                      </div>
                      <span className="font-bold">{formatCurrency(deposit.amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Cash Count Modal */}
      <Dialog open={showReconcileModal} onOpenChange={setShowReconcileModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Cash Drawer Count
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Denomination Counter */}
            <div>
              <Label className="mb-3 block">Enter denomination counts</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DENOMINATIONS.map((denom) => (
                  <div
                    key={denom.value}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                  >
                    <span className="w-16 font-medium">{denom.label}</span>
                    <span className="text-gray-400">×</span>
                    <Input
                      type="number"
                      min="0"
                      className="w-20 text-center"
                      value={denominations[denom.value] || ''}
                      onChange={(e) => handleDenominationChange(denom.value, e.target.value)}
                      placeholder="0"
                    />
                    <span className="text-sm text-gray-500 w-20 text-right">
                      = {formatCurrency((denominations[denom.value] || 0) * denom.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span>Total Counted</span>
                <span className="font-bold text-lg">{formatCurrency(actualCash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Expected</span>
                <span>{formatCurrency(summary?.expected_cash || 0)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span>Difference</span>
                <span className={`font-bold ${
                  difference === 0
                    ? 'text-green-600'
                    : difference > 0
                      ? 'text-blue-600'
                      : 'text-red-600'
                }`}>
                  {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                </span>
              </div>
              {difference !== 0 && (
                <Badge
                  variant={difference > 0 ? 'warning' : 'destructive'}
                  className="w-full justify-center py-2"
                >
                  {difference > 0 ? (
                    <>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Cash Surplus
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Cash Shortage
                    </>
                  )}
                </Badge>
              )}
              {difference === 0 && actualCash > 0 && (
                <Badge variant="success" className="w-full justify-center py-2">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Cash Balanced
                </Badge>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={reconcileNotes}
                onChange={(e) => setReconcileNotes(e.target.value)}
                placeholder="Add any notes about the reconciliation"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReconcileModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReconcile}
              disabled={actualCash === 0 || reconcileMutation.isPending}
            >
              {reconcileMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Submit Count
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Deposit Modal */}
      <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Record Bank Deposit
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Bank Name *</Label>
              <Input
                id="bank_name"
                value={depositData.bank_name}
                onChange={(e) => setDepositData({ ...depositData, bank_name: e.target.value })}
                placeholder="e.g., State Bank of India"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_number">Account Number</Label>
              <Input
                id="account_number"
                value={depositData.account_number}
                onChange={(e) => setDepositData({ ...depositData, account_number: e.target.value })}
                placeholder="Enter account number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                value={depositData.amount}
                onChange={(e) => setDepositData({ ...depositData, amount: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference Number</Label>
              <Input
                id="reference"
                value={depositData.reference_number}
                onChange={(e) => setDepositData({ ...depositData, reference_number: e.target.value })}
                placeholder="Transaction reference"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit_notes">Notes</Label>
              <Input
                id="deposit_notes"
                value={depositData.notes}
                onChange={(e) => setDepositData({ ...depositData, notes: e.target.value })}
                placeholder="Additional notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepositModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeposit}
              disabled={depositMutation.isPending}
            >
              {depositMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Record Deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CashReconciliationPage
