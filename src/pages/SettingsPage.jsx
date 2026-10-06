import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { settingsService } from '@/services/settings.service'
import { incentiveService } from '@/services/incentive.service'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Settings,
  Building2,
  Receipt,
  Globe,
  Bell,
  Users,
  Loader2,
  Save,
  RotateCcw,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  ListChecks,
  CheckCircle2,
  Circle,
  Info,
  ArrowRight,
  Key,
  MapPin,
} from 'lucide-react'
import { toast } from 'sonner'
import IncentiveConfigModal from '@/components/modals/IncentiveConfigModal'
import StaffIncentiveConfig from '@/components/StaffIncentiveConfig'
import AttendanceApiKeysPanel from '@/components/settings/AttendanceApiKeysPanel'
import GeofencePanel from '@/components/settings/GeofencePanel'

function SetupChecklist({ status, navigate, setActiveTab }) {
  const items = [
    // Essential
    {
      section: 'Essential',
      key: 'branches',
      label: 'Branches',
      done: (status.branches?.count || 0) > 0,
      doneText: `${status.branches?.count || 0} branch${(status.branches?.count || 0) !== 1 ? 'es' : ''} configured`,
      pendingText: 'No branches configured',
      link: () => navigate('/branches'),
    },
    {
      section: 'Essential',
      key: 'employees',
      label: 'Employees',
      done: (status.employees?.count || 0) > 0,
      doneText: `${status.employees?.count || 0} employee${(status.employees?.count || 0) !== 1 ? 's' : ''} active`,
      pendingText: 'No employees added',
      link: () => navigate('/staff'),
    },
    {
      section: 'Essential',
      key: 'services',
      label: 'Services',
      done: ((status.services?.count || 0) + (status.packages?.count || 0)) > 0,
      doneText: `${status.services?.count || 0} service${(status.services?.count || 0) !== 1 ? 's' : ''}, ${status.packages?.count || 0} package${(status.packages?.count || 0) !== 1 ? 's' : ''}`,
      pendingText: 'No services or packages added',
      link: () => navigate('/services'),
    },
    // Recommended
    {
      section: 'Recommended',
      key: 'chairs',
      label: 'Chairs',
      done: (status.chairs?.count || 0) > 0,
      doneText: `${status.chairs?.count || 0} chair${(status.chairs?.count || 0) !== 1 ? 's' : ''} set up`,
      pendingText: 'No chairs configured',
      link: () => navigate('/chairs'),
    },
    {
      section: 'Recommended',
      key: 'business_info',
      label: 'Business Info',
      done: !!status.business_info_complete,
      doneText: 'Name & address configured',
      pendingText: 'Not configured',
      link: () => setActiveTab('business'),
    },
    {
      section: 'Recommended',
      key: 'starting_cash',
      label: 'Starting Cash Balance',
      done: (() => {
        const details = status.branches?.details || []
        return details.length > 0 && details.every(b => b.has_starting_cash_balance)
      })(),
      doneText: 'Set for all branches',
      pendingText: (() => {
        const details = status.branches?.details || []
        const missing = details.filter(b => !b.has_starting_cash_balance).length
        if (missing > 0) return `Not set for ${missing} branch${missing !== 1 ? 'es' : ''}`
        return 'Not configured'
      })(),
      link: () => navigate('/cash-reconciliation'),
    },
    // Optional
    {
      section: 'Optional',
      key: 'upi_accounts',
      label: 'UPI Accounts',
      done: (status.upi_accounts?.count || 0) > 0,
      doneText: `${status.upi_accounts?.count || 0} UPI account${(status.upi_accounts?.count || 0) !== 1 ? 's' : ''} configured`,
      pendingText: 'Not configured',
      warningText: 'All payments will default to cash until UPI accounts are configured',
      link: () => navigate('/upi-accounts'),
    },
    {
      section: 'Optional',
      key: 'expense_categories',
      label: 'Expense Categories',
      done: (status.expense_categories?.count || 0) > 0,
      doneText: `${status.expense_categories?.count || 0} categor${(status.expense_categories?.count || 0) !== 1 ? 'ies' : 'y'} configured`,
      pendingText: 'Needed to categorize expenses',
      link: () => navigate('/expenses'),
    },
    {
      section: 'Optional',
      key: 'savings_pot_persons',
      label: 'Savings Pot Persons',
      done: (status.savings_pot_persons?.count || 0) > 0,
      doneText: `${status.savings_pot_persons?.count || 0} person${(status.savings_pot_persons?.count || 0) !== 1 ? 's' : ''} added`,
      pendingText: 'Only needed if using savings pots',
      link: () => navigate('/savings-pots'),
    },
  ]

  const completedCount = items.filter(i => i.done).length
  const totalCount = items.length
  const progressPercent = Math.round((completedCount / totalCount) * 100)
  const progressColor = completedCount < 3 ? 'bg-red-500' : completedCount < 6 ? 'bg-amber-500' : 'bg-green-500'

  const sections = [
    { name: 'Essential', pendingColor: 'text-red-500', pendingBg: 'bg-red-50' },
    { name: 'Recommended', pendingColor: 'text-amber-500', pendingBg: 'bg-amber-50' },
    { name: 'Optional', pendingColor: 'text-blue-500', pendingBg: 'bg-blue-50' },
  ]

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {completedCount} of {totalCount} steps complete
            </span>
            <span className="text-sm text-gray-500">{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      {sections.map(section => {
        const sectionItems = items.filter(i => i.section === section.name)
        return (
          <Card key={section.name}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{section.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {sectionItems.map(item => {
                const iconClass = item.done
                  ? 'text-green-500'
                  : section.name === 'Essential'
                    ? 'text-red-500'
                    : section.name === 'Recommended'
                      ? 'text-amber-500'
                      : 'text-blue-500'

                const StatusIcon = item.done
                  ? CheckCircle2
                  : section.name === 'Optional'
                    ? Info
                    : Circle

                return (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      item.done ? 'bg-green-50/50' : section.pendingBg
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon className={`h-5 w-5 flex-shrink-0 ${iconClass}`} />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{item.label}</p>
                        <p className="text-sm text-gray-500">
                          {item.done ? item.doneText : item.pendingText}
                        </p>
                        {!item.done && item.warningText && (
                          <p className="text-sm text-amber-600 mt-0.5">{item.warningText}</p>
                        )}
                      </div>
                    </div>
                    {!item.done && (
                      <div className="flex-shrink-0 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={item.link}
                          className="whitespace-nowrap"
                        >
                          Set up
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function SettingsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const isStrictOwner = user?.role === 'owner'

  const [formData, setFormData] = useState({})
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState('setup')

  // Incentive state
  const [incentiveModalOpen, setIncentiveModalOpen] = useState(false)
  const [editConfig, setEditConfig] = useState(null)

  // Fetch settings
  const { data, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsService.getSettings(),
  })

  // Fetch setup status
  const { data: setupStatusData, isLoading: setupLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => settingsService.getSetupStatus(),
    enabled: activeTab === 'setup',
  })
  const setupStatus = setupStatusData?.data || null

  const settings = data?.data || {}

  // Incentive queries
  const { data: incentiveConfigsData, isLoading: configsLoading } = useQuery({
    queryKey: ['incentive-configs', user?.branchId],
    queryFn: () => incentiveService.getConfigs({ branch_id: user?.branchId }),
    enabled: activeTab === 'incentives',
  })
  const configs = incentiveConfigsData?.data || []

  const deleteConfigMutation = useMutation({
    mutationFn: (id) => incentiveService.deleteConfig(id),
    onSuccess: () => {
      toast.success('Config deleted')
      queryClient.invalidateQueries({ queryKey: ['incentive-configs'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  })

  // Initialize form data when settings load
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      const initialData = {}
      Object.entries(settings).forEach(([key, setting]) => {
        initialData[key] = setting.value ?? ''
      })
      setFormData(initialData)
      setHasChanges(false)
    }
  }, [settings])

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: settingsService.updateSettings,
    onSuccess: () => {
      toast.success('Settings saved successfully')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setHasChanges(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to save settings')
    },
  })

  // Reset settings mutation
  const resetMutation = useMutation({
    mutationFn: settingsService.resetSettings,
    onSuccess: () => {
      toast.success('Settings reset to defaults')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to reset settings')
    },
  })

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = () => {
    // The selfie switch is owner-managed via the Geofences tab only
    const payload = { ...formData }
    delete payload.attendance_require_selfie
    updateMutation.mutate(payload)
  }

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      resetMutation.mutate()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-10 text-red-500">
        Error loading settings. Please try again.
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">View application settings</p>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            You don't have permission to modify settings. Contact your administrator.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Manage your salon configuration</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={resetMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-5 lg:grid-cols-10 lg:w-auto lg:inline-grid">
          <TabsTrigger value="setup" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Setup</span>
          </TabsTrigger>
          <TabsTrigger value="business" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Business</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Billing</span>
          </TabsTrigger>
          <TabsTrigger value="regional" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Regional</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Employees</span>
          </TabsTrigger>
          <TabsTrigger value="incentives" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Incentives</span>
          </TabsTrigger>
          <TabsTrigger value="staff-incentives" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Staff Incentives</span>
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="attendance-api" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">Attendance API</span>
            </TabsTrigger>
          )}
          {isStrictOwner && (
            <TabsTrigger value="geofence" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Geofence</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Setup Checklist */}
        <TabsContent value="setup">
          {setupLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : setupStatus ? (
            <SetupChecklist
              status={setupStatus}
              navigate={navigate}
              setActiveTab={setActiveTab}
            />
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-gray-500">
                Unable to load setup status. Please try again.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Business Settings */}
        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Information
              </CardTitle>
              <CardDescription>
                Configure your salon's basic information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="business_name">Business Name</Label>
                  <Input
                    id="business_name"
                    value={formData.business_name || ''}
                    onChange={(e) => handleChange('business_name', e.target.value)}
                    placeholder="My Salon"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business_tagline">Tagline</Label>
                  <Input
                    id="business_tagline"
                    value={formData.business_tagline || ''}
                    onChange={(e) => handleChange('business_tagline', e.target.value)}
                    placeholder="Your Beauty Partner"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="business_email">Email</Label>
                  <Input
                    id="business_email"
                    type="email"
                    value={formData.business_email || ''}
                    onChange={(e) => handleChange('business_email', e.target.value)}
                    placeholder="info@salon.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business_phone">Phone</Label>
                  <Input
                    id="business_phone"
                    value={formData.business_phone || ''}
                    onChange={(e) => handleChange('business_phone', e.target.value)}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_address">Address</Label>
                <Input
                  id="business_address"
                  value={formData.business_address || ''}
                  onChange={(e) => handleChange('business_address', e.target.value)}
                  placeholder="Full business address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_website">Website</Label>
                <Input
                  id="business_website"
                  value={formData.business_website || ''}
                  onChange={(e) => handleChange('business_website', e.target.value)}
                  placeholder="https://www.salon.com"
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="font-medium mb-4">Tax & Legal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="gst_number">GST Number</Label>
                    <Input
                      id="gst_number"
                      value={formData.gst_number || ''}
                      onChange={(e) => handleChange('gst_number', e.target.value.toUpperCase())}
                      placeholder="22AAAAA0000A1Z5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pan_number">PAN Number</Label>
                    <Input
                      id="pan_number"
                      value={formData.pan_number || ''}
                      onChange={(e) => handleChange('pan_number', e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gst_rate">GST Rate (%)</Label>
                    <Input
                      id="gst_rate"
                      type="number"
                      value={formData.gst_rate || ''}
                      onChange={(e) => handleChange('gst_rate', e.target.value)}
                      placeholder="18"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Settings */}
        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Billing Settings
              </CardTitle>
              <CardDescription>
                Configure bill generation and printing options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="bill_prefix">Bill Number Prefix</Label>
                  <Input
                    id="bill_prefix"
                    value={formData.bill_prefix || ''}
                    onChange={(e) => handleChange('bill_prefix', e.target.value.toUpperCase())}
                    placeholder="BILL"
                  />
                  <p className="text-xs text-gray-500">
                    Bills will be numbered as {formData.bill_prefix || 'BILL'}-001, {formData.bill_prefix || 'BILL'}-002, etc.
                  </p>
                </div>
                <div className="space-y-2 flex items-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.auto_print_bill === true || formData.auto_print_bill === 'true'}
                      onChange={(e) => handleChange('auto_print_bill', e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    <span>Auto-print bill after completion</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bill_footer_text">Bill Footer Text</Label>
                <Input
                  id="bill_footer_text"
                  value={formData.bill_footer_text || ''}
                  onChange={(e) => handleChange('bill_footer_text', e.target.value)}
                  placeholder="Thank you for visiting!"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bill_terms">Terms & Conditions</Label>
                <textarea
                  id="bill_terms"
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                  value={formData.bill_terms || ''}
                  onChange={(e) => handleChange('bill_terms', e.target.value)}
                  placeholder="Enter terms and conditions to display on bills"
                />
              </div>

              {/* Barcode labels */}
              <div className="pt-4 border-t space-y-2">
                <Label htmlFor="barcode_label_size">Barcode Label Size</Label>
                <select
                  id="barcode_label_size"
                  className="w-full md:w-1/2 h-10 px-3 border rounded-md"
                  value={formData['barcode.label_size'] || '50x25'}
                  onChange={(e) => handleChange('barcode.label_size', e.target.value)}
                >
                  <option value="50x25">50 × 25 mm</option>
                  <option value="38x25">38 × 25 mm</option>
                  <option value="100x50">100 × 50 mm</option>
                </select>
                <p className="text-xs text-gray-500">
                  Default size used by the Print Barcodes page. The page also lets you override per-print.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Regional Settings */}
        <TabsContent value="regional">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Regional Settings
              </CardTitle>
              <CardDescription>
                Configure date, time, and currency formats
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="default_currency">Currency</Label>
                  <select
                    id="default_currency"
                    className="w-full h-10 px-3 border rounded-md"
                    value={formData.default_currency || 'INR'}
                    onChange={(e) => handleChange('default_currency', e.target.value)}
                  >
                    <option value="INR">Indian Rupee (INR)</option>
                    <option value="USD">US Dollar (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="GBP">British Pound (GBP)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency_symbol">Currency Symbol</Label>
                  <Input
                    id="currency_symbol"
                    value={formData.currency_symbol || ''}
                    onChange={(e) => handleChange('currency_symbol', e.target.value)}
                    placeholder="₹"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="date_format">Date Format</Label>
                  <select
                    id="date_format"
                    className="w-full h-10 px-3 border rounded-md"
                    value={formData.date_format || 'DD/MM/YYYY'}
                    onChange={(e) => handleChange('date_format', e.target.value)}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time_format">Time Format</Label>
                  <select
                    id="time_format"
                    className="w-full h-10 px-3 border rounded-md"
                    value={formData.time_format || '12h'}
                    onChange={(e) => handleChange('time_format', e.target.value)}
                  >
                    <option value="12h">12 Hour (2:30 PM)</option>
                    <option value="24h">24 Hour (14:30)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  className="w-full h-10 px-3 border rounded-md"
                  value={formData.timezone || 'Asia/Kolkata'}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                >
                  <option value="Asia/Kolkata">India Standard Time (IST)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">Greenwich Mean Time (GMT)</option>
                  <option value="Asia/Dubai">Gulf Standard Time (GST)</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure alerts and notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-gray-500">Receive email alerts for important events</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.email_notifications === true || formData.email_notifications === 'true'}
                    onChange={(e) => handleChange('email_notifications', e.target.checked)}
                    className="h-5 w-5 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">SMS Notifications</p>
                    <p className="text-sm text-gray-500">Send SMS to customers for appointments</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.sms_enabled === true || formData.sms_enabled === 'true'}
                    onChange={(e) => handleChange('sms_enabled', e.target.checked)}
                    className="h-5 w-5 rounded"
                  />
                </label>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-medium mb-4">Inventory Alerts</h3>
                <div className="space-y-2">
                  <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
                  <Input
                    id="low_stock_threshold"
                    type="number"
                    value={formData.low_stock_threshold || ''}
                    onChange={(e) => handleChange('low_stock_threshold', e.target.value)}
                    placeholder="10"
                  />
                  <p className="text-xs text-gray-500">
                    Get alerts when product stock falls below this number
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employee Settings */}
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employee Settings
              </CardTitle>
              <CardDescription>
                Configure staff and attendance settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Star Points System</p>
                  <p className="text-sm text-gray-500">Enable star points tracking for employees</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.star_points_enabled === true || formData.star_points_enabled === 'true'}
                  onChange={(e) => handleChange('star_points_enabled', e.target.checked)}
                  className="h-5 w-5 rounded"
                />
              </label>

              <div className="border-t pt-6">
                <h3 className="font-medium mb-4">Working Hours</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="working_hours_start">Opening Time</Label>
                    <Input
                      id="working_hours_start"
                      type="time"
                      value={formData.working_hours_start || '09:00'}
                      onChange={(e) => handleChange('working_hours_start', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="working_hours_end">Closing Time</Label>
                    <Input
                      id="working_hours_end"
                      type="time"
                      value={formData.working_hours_end || '21:00'}
                      onChange={(e) => handleChange('working_hours_end', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Incentives */}
        <TabsContent value="incentives">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Incentive Rules
                    </CardTitle>
                    <CardDescription>Configure product sale incentive percentages per category. View the incentive report on the Staff Performance page.</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => { setEditConfig(null); setIncentiveModalOpen(true) }}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Rule
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
                          <TableCell className="font-medium">{c.product_category_name || 'All Categories'}</TableCell>
                          <TableCell><span className="text-lg font-semibold">{c.percentage}%</span></TableCell>
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
                              <Button size="sm" variant="ghost" onClick={() => { setEditConfig(c); setIncentiveModalOpen(true) }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => {
                                if (window.confirm('Delete this rule?')) deleteConfigMutation.mutate(c.config_id)
                              }}>
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

            <IncentiveConfigModal
              open={incentiveModalOpen}
              onOpenChange={(open) => { setIncentiveModalOpen(open); if (!open) setEditConfig(null) }}
              editConfig={editConfig}
            />
          </div>
        </TabsContent>

        <TabsContent value="staff-incentives">
          <StaffIncentiveConfig />
        </TabsContent>

        {isOwner && (
          <TabsContent value="attendance-api">
            <AttendanceApiKeysPanel />
          </TabsContent>
        )}

        {isStrictOwner && (
          <TabsContent value="geofence">
            <GeofencePanel />
          </TabsContent>
        )}
      </Tabs>

      {/* Floating Save Bar */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border shadow-lg rounded-lg px-6 py-3 flex items-center gap-4 z-50">
          <span className="text-sm text-gray-600">You have unsaved changes</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const initialData = {}
              Object.entries(settings).forEach(([key, setting]) => {
                initialData[key] = setting.value ?? ''
              })
              setFormData(initialData)
              setHasChanges(false)
            }}
          >
            Discard
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  )
}

export default SettingsPage
