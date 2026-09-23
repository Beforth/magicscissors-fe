import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { PiggyBank, Plus, ArrowDownToLine, ArrowUpFromLine, History, Pencil, Trash2, Loader2, AlertTriangle, ChevronDown, ChevronRight, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { savingsPotService } from '@/services/savingsPot.service'
import SavingsPotModal from '@/components/modals/SavingsPotModal'
import SavingsPotDepositModal from '@/components/modals/SavingsPotDepositModal'
import SavingsPotWithdrawModal from '@/components/modals/SavingsPotWithdrawModal'
import SavingsPotHistoryModal from '@/components/modals/SavingsPotHistoryModal'
import SavingsPotPersonModal from '@/components/modals/SavingsPotPersonModal'
import ConfirmDialog from '@/components/modals/ConfirmDialog'

function PotCard({ pot, onWithdraw, onHistory, onEdit, onDelete, canEdit, canDelete }) {
  const getProgressPercent = (balance, target) => {
    if (!target || target === 0) return 0
    return Math.min(100, Math.round((balance / target) * 100))
  }

  const getMaturityStatus = (pot) => {
    if (!pot.maturity_date) return null
    const now = new Date()
    const maturity = new Date(pot.maturity_date)
    const daysLeft = Math.ceil((maturity - now) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 0) return { label: 'Matured', variant: 'default' }
    if (daysLeft <= 30) return { label: `${daysLeft}d left`, variant: 'secondary' }
    return { label: `${daysLeft}d left`, variant: 'outline' }
  }

  const progress = getProgressPercent(pot.balance, pot.target_amount)
  const maturity = getMaturityStatus(pot)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{pot.name}</CardTitle>
            {pot.account_number && (
              <p className="text-sm text-gray-500 font-mono mt-0.5">{pot.account_number}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {maturity && <Badge variant={maturity.variant}>{maturity.label}</Badge>}
            {pot.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Balance</span>
            <span className="font-semibold">{formatCurrency(pot.balance)}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Target</span>
            <span className="text-gray-600">{formatCurrency(pot.target_amount)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{progress}% of target</p>
        </div>
        <div className="text-sm text-gray-500 space-y-0.5">
          {pot.duration_months && <p>Duration: {pot.duration_months} months</p>}
          {pot.start_date && <p>Started: {formatDate(pot.start_date)}</p>}
          {pot.maturity_date && <p>Maturity: {formatDate(pot.maturity_date)}</p>}
          {pot.branch_name && <p>Branch: {pot.branch_name}</p>}
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" onClick={() => onWithdraw(pot)}>
            <ArrowUpFromLine className="h-3 w-3 mr-1" /> Withdraw
          </Button>
          <Button size="sm" variant="outline" onClick={() => onHistory(pot)}>
            <History className="h-3 w-3 mr-1" /> History
          </Button>
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => onEdit(pot)}>
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => onDelete(pot)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function SavingsPotsPage() {
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const canManagePots = isOwner || user?.role === 'manager' || user?.role === 'cashier'
  const queryClient = useQueryClient()

  const [potModalOpen, setPotModalOpen] = useState(false)
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [personModalOpen, setPersonModalOpen] = useState(false)
  const [editPot, setEditPot] = useState(null)
  const [editPerson, setEditPerson] = useState(null)
  const [selectedPot, setSelectedPot] = useState(null)
  const [showReminders, setShowReminders] = useState(true)
  const [expandedPersons, setExpandedPersons] = useState({})
  const [depositPersonId, setDepositPersonId] = useState(null)
  const [depositPersonName, setDepositPersonName] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data: potsData, isLoading: potsLoading } = useQuery({
    queryKey: ['savings-pots', user?.branchId],
    queryFn: () => savingsPotService.getPots({ branch_id: user?.branchId }),
  })
  const pots = potsData?.data || []

  const { data: personsData, isLoading: personsLoading } = useQuery({
    queryKey: ['savings-pot-persons', user?.branchId],
    queryFn: () => savingsPotService.getPersons({ branch_id: user?.branchId }),
  })
  const persons = personsData?.data || []

  const { data: remindersData } = useQuery({
    queryKey: ['savings-pot-reminders', user?.branchId],
    queryFn: () => savingsPotService.getReminders({ branch_id: user?.branchId }),
  })
  const reminders = remindersData?.data || []

  const deletePotMutation = useMutation({
    mutationFn: (id) => savingsPotService.deletePot(id),
    onSuccess: () => {
      toast.success('Savings pot deleted')
      queryClient.invalidateQueries({ queryKey: ['savings-pots'] })
      queryClient.invalidateQueries({ queryKey: ['savings-pot-persons'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to delete'),
    onSettled: () => { setDeleteConfirmOpen(false); setDeleteTarget(null) },
  })

  const deletePersonMutation = useMutation({
    mutationFn: (id) => savingsPotService.deletePerson(id),
    onSuccess: () => {
      toast.success('Person deleted')
      queryClient.invalidateQueries({ queryKey: ['savings-pot-persons'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to delete'),
    onSettled: () => { setDeleteConfirmOpen(false); setDeleteTarget(null) },
  })

  const handleDeletePot = (pot) => {
    setDeleteTarget({ type: 'pot', item: pot })
    setDeleteConfirmOpen(true)
  }

  const handleDeletePerson = (person) => {
    setDeleteTarget({ type: 'person', item: person })
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'pot') {
      deletePotMutation.mutate(deleteTarget.item.pot_id)
    } else {
      deletePersonMutation.mutate(deleteTarget.item.id)
    }
  }

  const togglePerson = (personId) => {
    setExpandedPersons((prev) => ({ ...prev, [personId]: !prev[personId] }))
  }

  const handlePersonDeposit = (person) => {
    const personPots = pots.filter((p) => p.person_id === person.id && p.is_active)
    if (personPots.length === 0) {
      toast.error('No active pots for this person')
      return
    }
    setDepositPersonId(person.id)
    setDepositPersonName(person.name)
    setDepositModalOpen(true)
  }

  const handleGlobalDeposit = () => {
    setDepositPersonId(null)
    setDepositPersonName('')
    setDepositModalOpen(true)
  }

  // Group pots by person
  const potsByPerson = {}
  const unassignedPots = []
  for (const pot of pots) {
    if (pot.person_id) {
      if (!potsByPerson[pot.person_id]) potsByPerson[pot.person_id] = []
      potsByPerson[pot.person_id].push(pot)
    } else {
      unassignedPots.push(pot)
    }
  }

  const isLoading = potsLoading || personsLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Savings Pots</h1>
          <p className="text-sm text-gray-500 mt-1">Manage fixed deposits and savings accounts</p>
        </div>
        <div className="flex gap-2">
          {canManagePots && (
            <Button variant="outline" onClick={handleGlobalDeposit} disabled={pots.filter(p => p.is_active).length === 0}>
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Deposit
            </Button>
          )}
          {isOwner && (
            <Button variant="outline" onClick={() => { setEditPerson(null); setPersonModalOpen(true) }}>
              <User className="h-4 w-4 mr-2" />
              Add Person
            </Button>
          )}
          {canManagePots && (
            <Button onClick={() => { setEditPot(null); setPotModalOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              New Pot
            </Button>
          )}
        </div>
      </div>

      {/* Reminders Banner */}
      {showReminders && reminders.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 px-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Maturity Reminders</p>
                  <ul className="text-sm text-amber-700 mt-1 space-y-0.5">
                    {reminders.map((pot) => (
                      <li key={pot.pot_id}>
                        <span className="font-medium">{pot.name}</span> — {formatCurrency(pot.balance)} balance, matures {formatDate(pot.maturity_date)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <button onClick={() => setShowReminders(false)} className="text-amber-600 hover:text-amber-800 text-sm">
                Dismiss
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : pots.length === 0 && persons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PiggyBank className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No savings pots yet. Create a person and add pots to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Person Accordion Sections */}
          {persons.map((person) => {
            const personPots = potsByPerson[person.id] || []
            const isExpanded = expandedPersons[person.id]
            const totalBalance = personPots.reduce((sum, p) => sum + (p.balance || 0), 0)

            return (
              <Card key={person.id}>
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => togglePerson(person.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{person.name}</span>
                        {person.phone && <span className="text-sm text-gray-500">{person.phone}</span>}
                        <Badge variant="outline">{personPots.length} pot{personPots.length !== 1 ? 's' : ''}</Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        Total: {formatCurrency(totalBalance)}
                        {person.branch_name && ` · ${person.branch_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {canManagePots && (
                      <Button size="sm" variant="outline" onClick={() => handlePersonDeposit(person)} disabled={personPots.filter(p => p.is_active).length === 0}>
                        <ArrowDownToLine className="h-3 w-3 mr-1" /> Deposit
                      </Button>
                    )}
                    {isOwner && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => { setEditPerson(person); setPersonModalOpen(true) }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDeletePerson(person)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4">
                    {personPots.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">No pots assigned to this person.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {personPots.map((pot) => (
                          <PotCard
                            key={pot.pot_id}
                            pot={pot}
                            onWithdraw={(pot) => { setSelectedPot(pot); setWithdrawModalOpen(true) }}
                            onHistory={(pot) => { setSelectedPot(pot); setHistoryModalOpen(true) }}
                            onEdit={(pot) => { setEditPot(pot); setPotModalOpen(true) }}
                            onDelete={handleDeletePot}
                            canEdit={canManagePots}
                            canDelete={isOwner}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}

          {/* Unassigned Pots */}
          {unassignedPots.length > 0 && (
            <Card>
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => togglePerson('_unassigned')}
              >
                <div className="flex items-center gap-3">
                  {expandedPersons['_unassigned'] ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-500">Unassigned Pots</span>
                      <Badge variant="secondary">{unassignedPots.length} pot{unassignedPots.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    <p className="text-sm text-gray-400">
                      Total: {formatCurrency(unassignedPots.reduce((sum, p) => sum + (p.balance || 0), 0))}
                    </p>
                  </div>
                </div>
              </div>
              {expandedPersons['_unassigned'] && (
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {unassignedPots.map((pot) => (
                      <PotCard
                        key={pot.pot_id}
                        pot={pot}
                        onWithdraw={(pot) => { setSelectedPot(pot); setWithdrawModalOpen(true) }}
                        onHistory={(pot) => { setSelectedPot(pot); setHistoryModalOpen(true) }}
                        onEdit={(pot) => { setEditPot(pot); setPotModalOpen(true) }}
                        onDelete={handleDeletePot}
                        canEdit={canManagePots}
                        canDelete={isOwner}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Modals */}
      <SavingsPotModal
        open={potModalOpen}
        onOpenChange={(open) => { setPotModalOpen(open); if (!open) setEditPot(null) }}
        editPot={editPot}
      />
      <SavingsPotDepositModal
        open={depositModalOpen}
        onOpenChange={(open) => { setDepositModalOpen(open); if (!open) { setDepositPersonId(null); setDepositPersonName('') } }}
        allPots={pots}
        persons={persons}
        personId={depositPersonId}
        personName={depositPersonName}
      />
      <SavingsPotWithdrawModal
        open={withdrawModalOpen}
        onOpenChange={(open) => { setWithdrawModalOpen(open); if (!open) setSelectedPot(null) }}
        pot={selectedPot}
      />
      <SavingsPotHistoryModal
        open={historyModalOpen}
        onOpenChange={(open) => { setHistoryModalOpen(open); if (!open) setSelectedPot(null) }}
        pot={selectedPot}
        canManage={canManagePots}
      />
      <SavingsPotPersonModal
        open={personModalOpen}
        onOpenChange={(open) => { setPersonModalOpen(open); if (!open) setEditPerson(null) }}
        editPerson={editPerson}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => { setDeleteConfirmOpen(open); if (!open) setDeleteTarget(null) }}
        title={
          deleteTarget?.type === 'pot'
            ? `Delete "${deleteTarget.item.name}"?`
            : deleteTarget?.type === 'person'
              ? `Delete person "${deleteTarget?.item.name}"?`
              : 'Delete?'
        }
        description={
          deleteTarget?.type === 'pot'
            ? 'This will permanently delete the savings pot along with all its deposit and withdrawal records. This action cannot be undone.'
            : 'This action cannot be undone.'
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={deletePotMutation.isPending || deletePersonMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
