import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency, formatDateStored } from '@/lib/utils'
import { incentiveService } from '@/services/incentive.service'
import { userService } from '@/services/user.service'
import IncentiveConfigModal from '@/components/modals/IncentiveConfigModal'

export default function IncentivesPage() {
  const { user } = useSelector((state) => state.auth)
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('config')
  const [modalOpen, setModalOpen] = useState(false)
  const [editConfig, setEditConfig] = useState(null)

  // Report filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [expandedEmployee, setExpandedEmployee] = useState(null)

  // Config query
  const { data: configsData, isLoading: configsLoading } = useQuery({
    queryKey: ['incentive-configs', user?.branchId],
    queryFn: () => incentiveService.getConfigs({ branch_id: user?.branchId }),
    enabled: activeTab === 'config',
  })
  const configs = configsData?.data || []

  // Report query
  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['incentive-report', { startDate, endDate, selectedEmployee, branch: user?.branchId }],
    queryFn: () => incentiveService.getReport({
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      employee_id: selectedEmployee || undefined,
      branch_id: user?.branchId || undefined,
    }),
    enabled: activeTab === 'report',
  })
  const report = reportData?.data || reportData || {}
  const summary = report.summary || {}
  const byEmployee = report.by_employee || []

  // Employees for filter
  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => userService.getUsers({ role: 'employee' }),
    enabled: activeTab === 'report',
  })
  const employees = employeesData?.data || []

  const deleteMutation = useMutation({
    mutationFn: (id) => incentiveService.deleteConfig(id),
    onSuccess: () => {
      toast.success('Config deleted')
      queryClient.invalidateQueries({ queryKey: ['incentive-configs'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incentives</h1>
          <p className="text-sm text-gray-500 mt-1">Configure product sale incentives and view reports</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Incentive Rules</CardTitle>
              <Button size="sm" onClick={() => { setEditConfig(null); setModalOpen(true) }}>
                <Plus className="h-4 w-4 mr-1" />
                Add Config
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {configsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : configs.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No incentive rules configured</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((c) => (
                    <TableRow key={c.config_id}>
                      <TableCell className="font-medium">
                        {c.product_category_name || 'All Categories'}
                      </TableCell>
                      <TableCell>
                        <span className="text-lg font-semibold">{c.percentage}%</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.is_default ? 'default' : 'outline'}>
                          {c.is_default ? 'Default' : 'Category-specific'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.is_active ? 'default' : 'secondary'}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditConfig(c); setModalOpen(true) }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => {
                              if (window.confirm('Delete this rule?')) deleteMutation.mutate(c.config_id)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Report Tab */}
      {activeTab === 'report' && (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-[150px]" />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-[150px]" />
                </div>
                <div>
                  <Label className="text-xs">Employee</Label>
                  <SearchableSelect
                    options={[
                      { value: 'all', label: 'All Employees' },
                      ...employees.map((e) => ({ value: e.user_id, label: e.full_name })),
                    ]}
                    value={selectedEmployee}
                    onChange={(val) => setSelectedEmployee(val === 'all' ? '' : val)}
                    placeholder="All employees"
                    triggerClassName="w-[180px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Total Sales</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.total_sales || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Total Incentive</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_incentive || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">Records</p>
                <p className="text-2xl font-bold">{summary.record_count || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Per-Employee Breakdown */}
          {reportLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : byEmployee.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No incentive data found for the selected period
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {byEmployee.map((emp) => (
                <Card key={emp.employee_id}>
                  <CardHeader
                    className="cursor-pointer py-3"
                    onClick={() => setExpandedEmployee(expandedEmployee === emp.employee_id ? null : emp.employee_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedEmployee === emp.employee_id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium">{emp.employee_name}</span>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span>Sales: <span className="font-semibold">{formatCurrency(emp.total_sales)}</span></span>
                        <span>Incentive: <span className="font-semibold text-green-600">{formatCurrency(emp.total_incentive)}</span></span>
                      </div>
                    </div>
                  </CardHeader>
                  {expandedEmployee === emp.employee_id && (
                    <CardContent className="p-0 pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bill #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Sale</TableHead>
                            <TableHead className="text-right">%</TableHead>
                            <TableHead className="text-right">Incentive</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(emp.records || []).map((r) => (
                            <TableRow key={r.incentive_id}>
                              <TableCell className="text-sm">{r.bill_number}</TableCell>
                              <TableCell className="text-sm">{formatDateStored(r.bill_date)}</TableCell>
                              <TableCell>{r.product_name}</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.sale_amount)}</TableCell>
                              <TableCell className="text-right">{r.percentage}%</TableCell>
                              <TableCell className="text-right font-medium text-green-600">{formatCurrency(r.incentive_amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <IncentiveConfigModal
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) setEditConfig(null) }}
        editConfig={editConfig}
      />
    </div>
  )
}
