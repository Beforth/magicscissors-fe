import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customerService } from '@/services/customer.service'
import { serviceService } from '@/services/service.service'
import { productService } from '@/services/product.service'
import { branchService } from '@/services/branch.service'
import { billService } from '@/services/bill.service'
import { chairService } from '@/services/chair.service'
import { upiAccountService } from '@/services/upiAccount.service'
import { attendanceService } from '@/services/attendance.service'
import { rotationQueueService } from '@/services/rotationQueue.service'
import { tokenService } from '@/services/token.service'
import { parseTokenQrPayload } from '@/lib/tokenQr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Kbd } from '@/components/ui/kbd'
import { formatCurrency, fuzzyMatch, fuzzyScore } from '@/lib/utils'
import { computeBillTaxTotals } from '@/lib/gst'
import {
  Search,
  Plus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  Loader2,
  Check,
  Percent,
  Split,
  Calendar,
  Clock,
  ShoppingCart,
  Pencil,
  ArrowLeft,
  Package,
  ChevronRight,
  ChevronLeft,
  Star,
  Users,
  Armchair,
  Play,
  Ticket,
} from 'lucide-react'
import { toast } from 'sonner'
import CustomerModal from '@/components/modals/CustomerModal'
import EmployeeRotationPanel from '@/components/billing/EmployeeRotationPanel'
import ConfirmDialog from '@/components/modals/ConfirmDialog'
import { UserPlus } from 'lucide-react'
import { useSidebar } from '@/contexts/SidebarContext'

const IST = 'Asia/Kolkata'

/** Today's date string YYYY-MM-DD in IST */
function getTodayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST })
}

/** Current time HH:mm in IST */
function getCurrentTimeIST() {
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** Current date and time formatted for display in IST */
function getCurrentDateTimeIST() {
  const d = new Date()
  return {
    date: d.toLocaleDateString('en-IN', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { timeZone: IST, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  }
}

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'upi', label: 'UPI', icon: Smartphone },
]

function BillCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const { collapsed: sidebarCollapsed, collapse: collapseSidebar, setCollapsed: setSidebarCollapsed } = useSidebar()
  const branchId = user?.branchId || null

  // Bill type from URL param or default to 'current'
  const initialBillType = searchParams.get('type') === 'previous' ? 'previous' : 'current'
  const [billType, setBillType] = useState(initialBillType)

  // Edit mode: /bills/:id/edit reuses this screen with the bill's lines in the cart.
  const { id: editId } = useParams()
  const isEdit = !!editId
  const { data: editBillData, isLoading: editLoading, error: editError } = useQuery({
    queryKey: ['bill', editId],
    queryFn: () => billService.getBillById(editId),
    enabled: isEdit,
  })
  const editBill = editBillData?.data
  const editCompleted = isEdit && editBill?.status === 'completed'
  const [keptPackages, setKeptPackages] = useState({}) // package_instance_id -> still on the bill
  const [editReason, setEditReason] = useState('')
  const seededRef = useRef(false)

  // Date/time for previous bills
  const [billDate, setBillDate] = useState('')
  const [billTime, setBillTime] = useState('')

  // Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [consumedTokenId, setConsumedTokenId] = useState(null)
  const [tokenInput, setTokenInput] = useState('')
  const [loadingToken, setLoadingToken] = useState(false)
  const [showTokenDropdown, setShowTokenDropdown] = useState(false)
  const tokenBoxRef = useRef(null)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false)

  // Branch
  const [selectedBranch, setSelectedBranch] = useState(branchId)

  // Chair (optional)
  const [selectedChair, setSelectedChair] = useState('')
  // Bill book number / No. (optional)
  const [bookNumber, setBookNumber] = useState('')

  // Item selection
  const [selectedCategory, setSelectedCategory] = useState('services')
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [itemSearch, setItemSearch] = useState('') // search filter for service/package/product name
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false)
  const itemComboboxRef = useRef(null)
  const [itemPrice, setItemPrice] = useState('')
  const [itemQuantity, setItemQuantity] = useState(1)
  const [componentEmployees, setComponentEmployees] = useState({}) // { componentIndex: [employeeIds] }
  const [sameEmployeeForAll, setSameEmployeeForAll] = useState(false)
  const [globalEmployee, setGlobalEmployee] = useState('')

  // Cart
  const [cartItems, setCartItems] = useState([])
  const [cartCollapsedRaw, setCartCollapsed] = useState(false)
  // The side-by-side cart (and its collapsed rail) only exists on large screens; phones always get the full cart below.
  const [isLg, setIsLg] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setIsLg(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const cartCollapsed = cartCollapsedRaw && isLg
  const [catalogCategory, setCatalogCategory] = useState('all')
  const cartPanelRef = useRef(null)
  const detailsRef = useRef(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [pendingCartItem, setPendingCartItem] = useState(null)
  const [skillWarnOpen, setSkillWarnOpen] = useState(false)
  const [skillWarnMsg, setSkillWarnMsg] = useState('')

  // Employees held by cart lines being started now (removed from "next up"; pending stays ready)
  const heldEmployeeIds = useMemo(() => {
    const ids = new Set()
    const addIds = (list) => {
      for (const id of list || []) {
        if (id) ids.add(String(id))
      }
    }
    for (const item of cartItems) {
      if (item.item_type === 'package') {
        for (const svc of item.selected_services || []) {
          if (svc.item_status !== 'pending') addIds(svc.employee_ids)
        }
      } else if (item.item_type === 'service' && item.item_status !== 'pending') {
        addIds(item.employee_ids)
      }
    }
    return [...ids]
  }, [cartItems])

  const pickFromRotationQueue = async ({ serviceId, exclude = [] } = {}) => {
    if (!selectedBranch) return null
    try {
      const res = await rotationQueueService.pickNext({
        branchId: selectedBranch,
        serviceId: serviceId || undefined,
        exclude,
      })
      const picked = res?.data?.data ?? res?.data ?? null
      return picked?.employee_id ? picked : null
    } catch (err) {
      console.warn('Rotation queue pick failed:', err)
      return null
    }
  }

  const pickEmployeesFromQueue = async (serviceId, count = 1, exclude = []) => {
    const pickedIds = []
    const excludeSet = [...exclude]
    for (let i = 0; i < count; i += 1) {
      const row = await pickFromRotationQueue({ serviceId, exclude: excludeSet })
      if (!row) break
      pickedIds.push(row.employee_id)
      excludeSet.push(row.employee_id)
    }
    return pickedIds
  }

  const handleAddEmployeeFromQueue = async (componentIndex = 0, serviceId = null) => {
    const svcId =
      serviceId
      || (selectedCategory === 'services' ? selectedItemId : null)

    // (The queue itself only returns employees who have the service's required skills.)

    // Exclude every employee already picked for any component of this selection,
    // plus employees already assigned to existing cart items, so the same person
    // isn't re-picked for the next service from the queue.
    const current = (componentEmployees[componentIndex] || []).filter(Boolean)
    const excludeAll = new Set()
    for (const arr of Object.values(componentEmployees)) {
      for (const id of arr || []) {
        if (id) excludeAll.add(String(id))
      }
    }
    // Employees already on other cart lines are NOT excluded: the same person can do several services on one bill.
    const row = await pickFromRotationQueue({ serviceId: svcId, exclude: [...excludeAll] })
    if (!row) {
      toast.warning('No eligible employee in the check-in queue')
      return
    }
    setComponentEmployees((prev) => ({
      ...prev,
      [componentIndex]: [...current, row.employee_id],
    }))
    toast.success(`Added ${row.full_name} from queue`)
  }

  // Edit modal
  const [editingItemIndex, setEditingItemIndex] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)

  // Checkout
  const [billDiscountPercent, setBillDiscountPercent] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [addDiscountPercent, setAddDiscountPercent] = useState(0)
  const [addDiscountAmount, setAddDiscountAmount] = useState('')
  const [packageGroupSelections, setPackageGroupSelections] = useState({}) // { [packageId]: [ serviceId for group0, ... ] }
  const [payments, setPayments] = useState([{ payment_mode: 'cash', amount: '' }])
  const [notes, setNotes] = useState('')

  // Queries
  const { data: openTokensData } = useQuery({
    queryKey: ['tokens', { branchId: selectedBranch, status: 'open' }],
    queryFn: () => tokenService.getOpenTokens({ status: 'open', branch_id: selectedBranch }),
    enabled: !!selectedBranch,
    staleTime: 30 * 1000,  // tokens churn fast — refetch every 30s when used
  })
  const openTokens = openTokensData?.data || []

  // Close token dropdown on outside click
  useEffect(() => {
    const onDown = (e) => {
      if (tokenBoxRef.current && !tokenBoxRef.current.contains(e.target)) {
        setShowTokenDropdown(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const filteredOpenTokens = useMemo(() => {
    const q = (tokenInput || '').trim().toLowerCase()
    if (!q) return openTokens
    return openTokens.filter((t) =>
      (t.token_number || '').toLowerCase().includes(q) ||
      (t.customer_name_snap || '').toLowerCase().includes(q) ||
      (t.customer_phone_snap || '').includes(q)
    )
  }, [openTokens, tokenInput])

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['customers', customerSearch],
    queryFn: () => customerService.getCustomers({ search: customerSearch, limit: 10 }),
    enabled: customerSearch.length >= 2,
  })

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'active'],
    queryFn: () => serviceService.getServices({ is_active: 'true' }),
    enabled: !!selectedBranch,
  })

  const { data: packagesData } = useQuery({
    queryKey: ['packages', 'active'],
    queryFn: () => serviceService.getPackages({ is_active: 'true' }),
    enabled: !!selectedBranch,
  })

  const { data: productsData } = useQuery({
    queryKey: ['products', 'active', selectedBranch],
    queryFn: () =>
      productService.getProducts({
        is_active: 'true',
        product_type: 'retail',
        branch_id: selectedBranch,
        limit: 500,
      }),
    enabled: !!selectedBranch,
  })

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: !branchId,
  })

  const { data: employeesData } = useQuery({
    queryKey: ['employees', selectedBranch],
    queryFn: () => branchService.getBranchEmployees(selectedBranch),
    enabled: !!selectedBranch,
  })

  // Today's attendance roster — used to exclude on-leave staff from the picker.
  const { data: rosterData } = useQuery({
    queryKey: ['attendance-today', selectedBranch],
    queryFn: () => attendanceService.getTodayRoster({ branch_id: selectedBranch }),
    enabled: !!selectedBranch,
    staleTime: 60_000,
  })

  const { data: chairsData } = useQuery({
    queryKey: ['chairs', { branch_id: selectedBranch, status: 'available' }],
    queryFn: () => chairService.getChairs({ branch_id: selectedBranch, status: 'available' }),
    enabled: !!selectedBranch,
  })

  const { data: upiAccountsData } = useQuery({
    queryKey: ['upi-accounts', 'active'],
    queryFn: () => upiAccountService.getAccounts({ is_active: 'true' }),
  })

  const customers = customersData?.data || []
  const services = servicesData?.data || []
  const packages = packagesData?.data || []
  const products = productsData?.data || []
  const branches = branchesData?.data || []
  // Exclude staff marked on leave today — they can't be assigned to new bills.
  // Everyone else (not-yet-arrived, on-floor, on-break, checked-out) stays selectable
  // so manual punch gaps don't block billing.
  const onLeaveIds = useMemo(() => {
    const rows = rosterData?.data?.employees || []
    return new Set(rows.filter((e) => e.current_status === 'on_leave').map((e) => e.id))
  }, [rosterData])
  const employees = useMemo(() => {
    const all = employeesData?.data || []
    return all.filter((emp) => !onLeaveIds.has(emp.employee_id))
  }, [employeesData, onLeaveIds])
  const availableChairs = chairsData?.data || []
  const upiAccounts = upiAccountsData?.data || []

  // Item options based on selected category
  const itemOptions = useMemo(() => {
    if (selectedCategory === 'services') {
      return services.map((s) => ({
        id: s.service_id,
        name: s.service_name,
        price: s.price,
        tax_rate: s.tax_rate ?? 0,
        hsn_sac_code: s.hsn_sac_code || null,
        duration: s.duration_minutes,
        category: s.category?.category_name ?? s.category?.name,
        star_points: s.star_points ?? 0,
        is_multi_employee: s.is_multi_employee ?? false,
        employee_count: s.employee_count ?? null,
        skills: s.skills || [],
      }))
    }
    if (selectedCategory === 'packages') {
      return packages.map((p) => ({
        id: p.package_id,
        name: p.package_name,
        price: p.package_price ?? p.individual_price ?? 0,
        description: p.description,
        services: p.services,
        service_groups: p.service_groups,
        individual_price: p.individual_price,
        savings: p.savings,
      }))
    }
    if (selectedCategory === 'products') {
      return products.map((p) => {
        const baseAvailable = p.branch_available_stock ?? p.total_available_stock ?? p.total_stock ?? 0
        const inCart = cartItems
          .filter((i) => i.item_type === 'product' && i.product_id === p.product_id)
          .reduce((sum, i) => sum + (i.quantity || 0), 0)
        return {
          id: p.product_id,
          name: p.product_name,
          price: parseFloat(p.selling_price || p.mrp || 0),
          tax_rate: p.tax_rate ?? 0,
          hsn_sac_code: p.hsn_sac_code || null,
          brand: p.brand,
          stock: Math.max(0, baseAvailable - inCart),
        }
      })
    }
    return []
  }, [selectedCategory, services, packages, products, cartItems])

  // Filtered item options (fuzzy search): type "hircut" → matches "Haircut", etc.
  const filteredItemOptions = useMemo(() => {
    const q = (itemSearch || '').trim()
    if (!q) return itemOptions
    const nameKey = 'name'
    return itemOptions
      .filter((o) => fuzzyMatch(o[nameKey] || '', q))
      .sort((a, b) => fuzzyScore(b[nameKey] || '', q) - fuzzyScore(a[nameKey] || '', q))
  }, [itemOptions, itemSearch])

  // Selected item details
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null
    return itemOptions.find((o) => o.id === selectedItemId)
  }, [selectedItemId, itemOptions])

  // Star points for a package service: use package API value, or fallback to services list by service_id
  const getPackageServiceStarPoints = (ps) => {
    const fromPackage = ps.star_points ?? ps.starPoints ?? 0
    if (fromPackage > 0) return fromPackage
    const fromService = services.find((s) => s.service_id === ps.service_id)
    return fromService?.star_points ?? 0
  }

  // Item discount: either fixed amount (discount_amount_override) or percent
  const getItemDiscount = (item) => {
    const lineTotal = item.unit_price * item.quantity
    if (item.discount_amount_override != null && item.discount_amount_override >= 0) {
      return Math.min(Number(item.discount_amount_override), lineTotal)
    }
    return Math.round((lineTotal * (item.discount_percent || 0)) / 100)
  }

  // Calculate totals (incl. GST)
  // Packages that already sit on the bill being edited (priced as a distribution, so they are not editable here).
  const keptPackageLines = isEdit
    ? (editBill?.items || [])
        .filter((i) => i.package_instance_id && keptPackages[i.package_instance_id])
        .map((i) => ({ unitPrice: i.unit_price, quantity: i.quantity, discountAmount: i.discount_amount || 0, taxRate: i.tax_rate || 0 }))
    : []
  const taxPreviewItems = [
    ...cartItems.map((item) => ({
      unitPrice: item.unit_price,
      quantity: item.quantity,
      discountAmount: getItemDiscount(item),
      taxRate: item.tax_rate ?? 0,
    })),
    ...keptPackageLines,
  ]
  const grossBeforeBillDisc =
    taxPreviewItems.reduce((s, l) => s + l.unitPrice * l.quantity, 0) -
    taxPreviewItems.reduce((s, l) => s + l.discountAmount, 0)
  const billDiscount =
    grossBeforeBillDisc > 0
      ? Math.round(grossBeforeBillDisc * (billDiscountPercent / 100))
      : 0
  const taxTotals = computeBillTaxTotals(taxPreviewItems, billDiscount)
  const subtotal = taxTotals.subtotal
  const itemsDiscount = taxTotals.itemsDiscount
  const totalDiscount = taxTotals.discountAmount
  const taxableSubtotal = taxTotals.taxableSubtotal
  const taxAmount = taxTotals.taxAmount
  const totalAmount = Math.round(taxTotals.totalAmount)
  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  const remaining = totalAmount - totalPaid

  // Create bill mutation
  const createBillMutation = useMutation({
    mutationFn: billService.createBill,
    onSuccess: (response) => {
      toast.success('Bill created successfully!')
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['rotation-queue'] })
      const billId = response.data?.bill_id
      if (billId) {
        navigate(`/bills/${billId}`)
      } else {
        navigate('/bills')
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create bill')
    },
  })

  // Build prefill for inline customer add modal
  const customerPrefill = useMemo(() => {
    if (!customerSearch || customerSearch.length < 2) return null
    const isPhone = /^\d+$/.test(customerSearch.trim())
    return isPhone
      ? { phone: customerSearch.trim() }
      : { customer_name: customerSearch.trim() }
  }, [customerSearch])

  // Handlers
  const handleSelectCustomer = (customer) => {
    setTimeout(() => catalogSearchRef.current?.focus(), 0)
    setSelectedCustomer(customer)
    setCustomerSearch(customer.customer_name)
    setShowCustomerDropdown(false)
  }

  // Build a package cart line from token data (auto-picks first OR option + queue employees).
  const buildTokenPackageCartItem = async (rawPkg) => {
    const pkg = {
      id: rawPkg.package_id,
      name: rawPkg.package_name,
      price: rawPkg.package_price ?? rawPkg.individual_price ?? 0,
      services: rawPkg.services || [],
      service_groups: rawPkg.service_groups || [],
      individual_price: rawPkg.individual_price ?? 0,
    }
    const standaloneServices = pkg.services
    const serviceGroups = pkg.service_groups
    const hasGroups = serviceGroups.length > 0
    const packagePrice = parseFloat(pkg.price) || pkg.individual_price || 0
    let unallocated = 0
    let usedDefaultOrChoices = hasGroups

    const assignEmployees = async (ps) => {
      return []
    }

    if (standaloneServices.length > 0 || hasGroups) {
      const selectedServices = []

      for (const ps of standaloneServices) {
        const empIds = await assignEmployees(ps)
        selectedServices.push({
          service_id: ps.service_id,
          service_name: ps.service_name,
          original_service_price: ps.service_price,
          employee_ids: empIds,
          star_points: getPackageServiceStarPoints(ps),
          is_multi_employee: ps.is_multi_employee ?? false,
          employee_count: ps.employee_count ?? null,
          quantity: ps.quantity,
          item_status: 'completed',
        })
      }

      for (const g of serviceGroups) {
        const chosen = (g.services || [])[0]
        if (!chosen) continue
        const empIds = await assignEmployees(chosen)
        selectedServices.push({
          service_id: chosen.service_id,
          service_name: chosen.service_name,
          original_service_price: chosen.service_price,
          employee_ids: empIds,
          star_points: getPackageServiceStarPoints(chosen),
          is_multi_employee: chosen.is_multi_employee ?? false,
          employee_count: chosen.employee_count ?? null,
          quantity: chosen.quantity,
          item_status: 'completed',
        })
      }

      try {
        const previewRes = await serviceService.previewPackageDistribution({
          package_id: pkg.id,
          package_price: packagePrice,
          selected_services: selectedServices.map((s) => ({ service_id: s.service_id })),
        })
        const distributed = previewRes.data?.services || previewRes.data?.data?.services || []
        distributed.forEach((ds) => {
          const match = selectedServices.find((s) => s.service_id === ds.service_id)
          if (match) match.distributed_price = ds.distributed_price
        })
      } catch {
        // Continue without distributed prices
      }

      const totalStarPoints = selectedServices.reduce((sum, s) => sum + (s.star_points || 0), 0)

      return {
        cartItem: {
          cart_id: crypto.randomUUID(),
          item_type: 'package',
          package_id: pkg.id,
          item_name: pkg.name,
          unit_price: packagePrice,
          quantity: 1,
          employee_ids: [],
          employee_id: null,
          discount_percent: 0,
          star_points: totalStarPoints,
          source_package_name: pkg.name,
          source_individual_price: pkg.individual_price,
          selected_services: selectedServices,
          item_status: 'completed',
        },
        unallocated,
        usedDefaultOrChoices,
      }
    }

    // Flat package — no component services to assign
    return {
      cartItem: {
        cart_id: crypto.randomUUID(),
        item_type: 'package',
        package_id: pkg.id,
        item_name: pkg.name,
        unit_price: packagePrice,
        quantity: 1,
        employee_ids: [],
        employee_id: null,
        discount_percent: 0,
        source_package_name: pkg.name,
        source_individual_price: pkg.individual_price,
        selected_services: [],
        item_status: 'completed',
      },
      unallocated: 0,
      usedDefaultOrChoices: false,
    }
  }

  // Load a token: prefill the customer + push pre-selected services into the cart with auto-allocation.
  const loadTokenIntoBill = async (token) => {
    if (!token) return
    if (token.branch_id && selectedBranch && token.branch_id !== selectedBranch) {
      toast.error('Token belongs to a different branch')
      return
    }

    // Prefill customer
    const customerForCart = {
      customer_id: token.customer?.id || token.customer_id,
      customer_name: token.customer?.customer_name || token.customer_name_snap,
      phone: token.customer?.phone || token.customer_phone_snap,
      customer_code: token.customer?.customer_code || null,
    }
    setSelectedCustomer(customerForCart)
    setCustomerSearch(customerForCart.customer_name || '')
    setShowCustomerDropdown(false)
    setConsumedTokenId(token.id)

    // Push token services and packages into cart (allocate employees from check-in queue).
    const tokenItems = token.services_requested || []
    if (tokenItems.length === 0) {
      toast.success(`Token ${token.token_number} loaded`)
      return
    }

    const additions = []
    let unallocatedCount = 0
    let packageOrDefaultCount = 0
    const missingPackages = []

    for (const ts of tokenItems) {
      // Legacy shape: no `kind`, but `service_id` set → treat as service.
      const kind = ts.kind || (ts.service_id ? 'service' : ts.package_id ? 'package' : null)

      if (kind === 'package') {
        const rawPkg = packages.find((p) => p.package_id === ts.package_id)
        if (!rawPkg) {
          missingPackages.push(ts.name || ts.service_name || 'Package')
          continue
        }
        try {
          const { cartItem, unallocated, usedDefaultOrChoices } = await buildTokenPackageCartItem(rawPkg)
          additions.push(cartItem)
          unallocatedCount += unallocated
          if (usedDefaultOrChoices) packageOrDefaultCount += 1
        } catch {
          missingPackages.push(ts.name || rawPkg.package_name || 'Package')
        }
        continue
      }

      const svc = services.find((s) => s.service_id === ts.service_id)
      if (!svc) continue
      const empIds = []
      additions.push({
        cart_id: crypto.randomUUID(),
        item_type: 'service',
        service_id: svc.service_id,
        item_name: svc.service_name || svc.name || '',
        unit_price: parseFloat(svc.price ?? 0),
        quantity: 1,
        employee_ids: empIds,
        employee_id: null,
        star_points: svc.star_points ?? 0,
        discount_percent: 0,
        is_multi_employee: svc.is_multi_employee ?? false,
        employee_count: svc.employee_count ?? null,
        item_status: 'completed',
      })
    }
    setCartItems((prev) => [...prev, ...additions])

    const serviceCount = additions.filter((a) => a.item_type === 'service').length
    const packageCount = additions.filter((a) => a.item_type === 'package').length

    if (additions.length > 0) {
      const parts = []
      if (serviceCount) parts.push(`${serviceCount} service${serviceCount === 1 ? '' : 's'}`)
      if (packageCount) parts.push(`${packageCount} package${packageCount === 1 ? '' : 's'}`)
      toast.success(`Token ${token.token_number} loaded with ${parts.join(' and ')}`)
      if (unallocatedCount > 0) {
        toast.warning(
          `${unallocatedCount} item component${unallocatedCount === 1 ? '' : 's'} still need a manual employee pick`,
          { duration: 5000 }
        )
      }
      if (packageOrDefaultCount > 0) {
        toast.info(
          `${packageOrDefaultCount} package${packageOrDefaultCount === 1 ? '' : 's'} used default OR choices — review in cart if needed`,
          { duration: 6000 }
        )
      }
    } else if (missingPackages.length === 0) {
      toast.success(`Token ${token.token_number} loaded`)
    }
    if (missingPackages.length > 0) {
      toast.warning(
        `Could not load package(s): ${missingPackages.join(', ')} — add manually from Packages tab`,
        { duration: 6000 }
      )
    }
  }

  const handleLookupToken = async () => {
    const number = parseTokenQrPayload(tokenInput)
    if (!number) return
    if (!selectedBranch) {
      toast.error('Select a branch first')
      return
    }
    setLoadingToken(true)
    try {
      const res = await tokenService.lookupToken({ branchId: selectedBranch, number })
      await loadTokenIntoBill(res?.data)
      setTokenInput('')
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Token not found')
    } finally {
      setLoadingToken(false)
    }
  }

  const handleItemSelect = (id) => {
    setSelectedItemId(id || null)
    setComponentEmployees({})
    setSameEmployeeForAll(false)
    setGlobalEmployee('')
    if (!id) {
      setItemPrice('')
      return
    }
    const item = itemOptions.find((o) => o.id === id)
    if (item) {
      setItemPrice(item.price.toString())
      if (selectedCategory === 'packages' && item.service_groups?.length) {
        setPackageGroupSelections((prev) => ({
          ...prev,
          [id]: item.service_groups.map((g) => g.services?.[0]?.service_id ?? null),
        }))
      }
    }
    setItemQuantity(1)
  }

  const handleAddToCart = async () => {
    if (!selectedItemId || !itemPrice) return

    if (selectedCategory === 'packages') {
      const pkg = selectedItem
      if (!pkg) return

      const standaloneServices = pkg.services || []
      const serviceGroups = pkg.service_groups || []
      const hasGroups = serviceGroups.length > 0

      if (hasGroups) {
        const selections = packageGroupSelections[pkg.id] || []
        const missing = serviceGroups.some((g, i) => !selections[i] && (g.services?.length ?? 0) > 0)
        if (missing) {
          toast.error('Choose one service for each "OR" group before adding to cart')
          return
        }
      }

      const packagePrice = parseFloat(itemPrice) || (pkg.individual_price || 0)

      if (standaloneServices.length > 0 || hasGroups) {
        // Build selected_services array from standalone + OR-group chosen services
        const selectedServices = []
        let idx = 0

        standaloneServices.forEach((ps) => {
          selectedServices.push({
            service_id: ps.service_id,
            service_name: ps.service_name,
            original_service_price: ps.service_price,
            employee_ids: (componentEmployees[idx] || []).filter(Boolean),
            star_points: getPackageServiceStarPoints(ps),
            is_multi_employee: ps.is_multi_employee ?? false,
            employee_count: ps.employee_count ?? null,
            quantity: ps.quantity,
            item_status: 'completed',
          })
          idx += 1
        })

        serviceGroups.forEach((g, gi) => {
          const selectedId = (packageGroupSelections[pkg.id] || [])[gi]
          const chosen = (g.services || []).find((s) => s.service_id === selectedId)
          if (chosen) {
            selectedServices.push({
              service_id: chosen.service_id,
              service_name: chosen.service_name,
              original_service_price: chosen.service_price,
              employee_ids: (componentEmployees[idx] || []).filter(Boolean),
              star_points: getPackageServiceStarPoints(chosen),
              is_multi_employee: chosen.is_multi_employee ?? false,
              employee_count: chosen.employee_count ?? null,
              quantity: chosen.quantity,
              item_status: 'completed',
            })
            idx += 1
          }
        })

        // Fetch distributed prices from backend
        try {
          const previewRes = await serviceService.previewPackageDistribution({
            package_id: pkg.id,
            package_price: packagePrice,
            selected_services: selectedServices.map((s) => ({ service_id: s.service_id })),
          })
          const distributed = previewRes.data?.services || previewRes.data?.data?.services || []
          distributed.forEach((ds) => {
            const match = selectedServices.find((s) => s.service_id === ds.service_id)
            if (match) match.distributed_price = ds.distributed_price
          })
        } catch (err) {
          // Preview failed — continue without distributed prices
          console.warn('Package distribution preview failed:', err)
        }

        const totalStarPoints = selectedServices.reduce((sum, s) => sum + (s.star_points || 0), 0)

        setCartItems([
          ...cartItems,
          {
            cart_id: crypto.randomUUID(),
            item_type: 'package',
            package_id: pkg.id,
            item_name: pkg.name,
            unit_price: packagePrice,
            quantity: 1,
            employee_ids: [],
            employee_id: null,
            discount_percent: parseFloat(addDiscountAmount) > 0 ? 0 : addDiscountPercent,
            discount_amount_override: parseFloat(addDiscountAmount) > 0 ? parseFloat(addDiscountAmount) : undefined,
            star_points: totalStarPoints,
            source_package_name: pkg.name,
            source_individual_price: pkg.individual_price || 0,
            selected_services: selectedServices,
            item_status: 'completed',
          },
        ])
      } else {
        // Flat package — single cart item with selected_services: []
        setCartItems([
          ...cartItems,
          {
            cart_id: crypto.randomUUID(),
            item_type: 'package',
            package_id: pkg.id,
            item_name: pkg.name,
            unit_price: packagePrice,
            quantity: 1,
            employee_ids: (componentEmployees[0] || []).filter(Boolean),
            employee_id: null,
            discount_percent: parseFloat(addDiscountAmount) > 0 ? 0 : addDiscountPercent,
            discount_amount_override: parseFloat(addDiscountAmount) > 0 ? parseFloat(addDiscountAmount) : undefined,
            source_package_name: pkg.name,
            source_individual_price: pkg.individual_price || 0,
            selected_services: [],
            item_status: 'completed',
          },
        ])
      }
    } else if (selectedCategory === 'services') {
      let empIds = (componentEmployees[0] || []).filter(Boolean)

      const newItem = {
        cart_id: crypto.randomUUID(),
        item_type: 'service',
        service_id: selectedItemId,
        item_name: selectedItem?.name || '',
        unit_price: parseFloat(itemPrice),
        quantity: itemQuantity,
        employee_ids: empIds,
        employee_id: null,
        star_points: selectedItem?.star_points ?? 0,
        tax_rate: selectedItem?.tax_rate ?? 0,
        hsn_sac_code: selectedItem?.hsn_sac_code || null,
        discount_percent: parseFloat(addDiscountAmount) > 0 ? 0 : addDiscountPercent,
        discount_amount_override: parseFloat(addDiscountAmount) > 0 ? parseFloat(addDiscountAmount) : undefined,
        is_multi_employee: selectedItem?.is_multi_employee ?? false,
        employee_count: selectedItem?.employee_count ?? null,
        item_status: 'completed',
      }

      if (empIds.length === 0) {
        setPendingCartItem(newItem)
        return
      } else {
        setCartItems((prev) => [...prev, newItem])
      }
    } else if (selectedCategory === 'products') {
      const available = selectedItem?.stock ?? 0
      if (itemQuantity > available) {
        toast.error(`Insufficient stock (available: ${available})`)
        return
      }
      setCartItems([
        ...cartItems,
        {
          cart_id: crypto.randomUUID(),
          item_type: 'product',
          product_id: selectedItemId,
          item_name: selectedItem?.name || '',
          unit_price: parseFloat(itemPrice),
          quantity: itemQuantity,
          employee_ids: (componentEmployees[0] || []).filter(Boolean),
          employee_id: null,
          tax_rate: selectedItem?.tax_rate ?? 0,
          hsn_sac_code: selectedItem?.hsn_sac_code || null,
          discount_percent: parseFloat(addDiscountAmount) > 0 ? 0 : addDiscountPercent,
          discount_amount_override: parseFloat(addDiscountAmount) > 0 ? parseFloat(addDiscountAmount) : undefined,
          item_status: 'completed',
        },
      ])
    }

    // Reset selection
    setSelectedItemId(null)
    setItemPrice('')
    setItemQuantity(1)
    setAddDiscountPercent(0)
    setAddDiscountAmount('')
    setComponentEmployees({})
    setSameEmployeeForAll(false)
    setGlobalEmployee('')
  }

  const updateCartItem = (index, field, value) => {
    setCartItems((items) =>
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  const toggleItemPending = (index) => {
    setCartItems((items) =>
      items.map((item, i) =>
        i === index
          ? { ...item, item_status: item.item_status === 'pending' ? 'completed' : 'pending' }
          : item
      )
    )
  }

  // Set entire package + all its services to pending/completed
  const setPackagePending = (cartIndex, pending) => {
    const nextStatus = pending ? 'pending' : 'completed'
    setCartItems((items) =>
      items.map((item, i) =>
        i === cartIndex
          ? {
              ...item,
              item_status: nextStatus,
              selected_services: (item.selected_services || []).map((svc) => ({
                ...svc, item_status: nextStatus,
              })),
            }
          : item
      )
    )
  }

  // Toggle one service's status within a package
  const togglePackageServicePending = (cartIndex, serviceIdx) => {
    setCartItems((items) =>
      items.map((item, i) => {
        if (i !== cartIndex) return item
        const updated = item.selected_services.map((svc, si) =>
          si === serviceIdx
            ? { ...svc, item_status: svc.item_status === 'pending' ? 'completed' : 'pending' }
            : svc
        )
        const allPending = updated.every((s) => s.item_status === 'pending')
        const allDone = updated.every((s) => s.item_status === 'completed')
        return {
          ...item,
          selected_services: updated,
          item_status: allPending ? 'pending' : allDone ? 'completed' : item.item_status,
        }
      })
    )
  }

  // Update employee_ids for one service within a package
  const updatePackageServiceEmployees = (cartIndex, serviceIdx, newEmployeeIds) => {
    setCartItems((items) =>
      items.map((item, i) =>
        i !== cartIndex ? item : {
          ...item,
          selected_services: item.selected_services.map((svc, si) =>
            si === serviceIdx ? { ...svc, employee_ids: newEmployeeIds } : svc
          ),
        }
      )
    )
  }

  const handleRemoveItem = (index) => {
    setCartItems((items) => items.filter((_, i) => i !== index))
  }

  // Group cart items: packages as single items, standalone items separate
  const groupedCart = useMemo(() => {
    const groups = []
    cartItems.forEach((item, index) => {
      if (item.item_type === 'package' && item.selected_services) {
        const lineTotal = item.unit_price * item.quantity
        const lineDiscount = getItemDiscount(item)
        const total = lineTotal - lineDiscount
        const individualPrice = item.source_individual_price
        const savings = individualPrice != null && individualPrice > total ? individualPrice - total : 0
        groups.push({
          type: 'package',
          index,
          item,
          total,
          subtotal: lineTotal,
          discount: lineDiscount,
          individual_price: individualPrice,
          savings,
        })
      } else {
        groups.push({ type: 'single', item, index })
      }
    })
    return groups
  }, [cartItems])

  // Payment handlers
  const handleAddPayment = () => {
    setPayments([...payments, { payment_mode: 'cash', amount: '' }])
  }

  const handleRemovePayment = (index) => {
    if (payments.length > 1) {
      setPayments(payments.filter((_, i) => i !== index))
    }
  }

  const handlePaymentChange = (index, field, value) => {
    setPayments(payments.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  const handleSetFullAmount = (index) => {
    const otherPayments = payments.reduce(
      (sum, p, i) => (i !== index ? sum + (parseFloat(p.amount) || 0) : sum),
      0
    )
    const remainingAmount = Math.max(0, totalAmount - otherPayments)
    handlePaymentChange(index, 'amount', remainingAmount.toFixed(2))
  }

  // Barcode scan handler
  const handleBarcodeScan = async (barcode) => {
    try {
      const res = await productService.getByBarcode(barcode)
      const product = res?.data || res
      if (!product?.product_id) {
        toast.error('Product not found for barcode')
        return
      }
      setCartItems([
        ...cartItems,
        {
          cart_id: crypto.randomUUID(),
          item_type: 'product',
          product_id: product.product_id,
          item_name: product.name || product.product_name || '',
          unit_price: parseFloat(product.selling_price || product.price || 0),
          quantity: 1,
          employee_ids: [],
          employee_id: null,
          discount_percent: 0,
          item_status: 'completed',
        },
      ])
      toast.success(`Added: ${product.name || product.product_name}`)
    } catch {
      toast.error('Product not found for this barcode')
    }
  }

  const getCartItemStatusLabel = (status) => {
    if (status === 'pending') return 'Pending'
    if (status === 'in_progress') return 'Started'
    return 'Done'
  }

  const mapSubmitItemStatus = (itemStatus, { startService = false, itemType = 'service' } = {}) => {
    if (itemStatus === 'pending') return 'pending'
    if (itemType === 'product') return 'completed'
    if (startService) return 'in_progress'
    if (itemStatus === 'in_progress') return 'in_progress'
    return 'completed'
  }

  // Convert cart items into the API format at submit time
  const buildSubmitItems = (items, { startService = false } = {}) => {
    return items.map((item) => {
      if (item.item_type === 'package') {
        const lineTotal = item.unit_price * item.quantity
        const discount = getItemDiscount(item)
        const selectedServices = (item.selected_services || []).map((svc) => {
          const empIds = (svc.employee_ids || []).filter(Boolean)
          return {
            service_id: svc.service_id,
            ...(empIds.length > 1
              ? { employee_ids: empIds }
              : empIds.length === 1
                ? { employee_id: empIds[0] }
                : {}),
            status: startService ? (empIds.length > 0 ? 'in_progress' : 'pending') : mapSubmitItemStatus(svc.item_status, { startService: startService && empIds.length > 0, itemType: 'service' }),
          }
        })
        return {
          item_type: 'package',
          package_id: item.package_id || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: parseFloat(discount.toFixed(2)),
          discount_percentage:
            lineTotal > 0 ? parseFloat(((discount / lineTotal) * 100).toFixed(2)) : 0,
          selected_services: selectedServices,
          notes: item.source_package_name || null,
          status: mapSubmitItemStatus(item.item_status, { startService, itemType: 'package' }),
        }
      }

      // Non-package items
      return {
        item_type: item.item_type,
        service_id: item.service_id || null,
        package_id: item.package_id || null,
        product_id: item.product_id || null,
        employee_id: null,
        employee_ids: (item.employee_ids || []).filter(Boolean).length > 0
          ? (item.employee_ids || []).filter(Boolean)
          : null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: parseFloat(getItemDiscount(item).toFixed(2)),
        discount_percentage:
          item.unit_price * item.quantity > 0
            ? parseFloat(
                ((getItemDiscount(item) / (item.unit_price * item.quantity)) * 100).toFixed(2)
              )
            : 0,
        notes: item.source_package_name || null,
            status: item.item_type === 'service' && startService
              ? (item.employee_ids?.filter(Boolean).length > 0 ? 'in_progress' : 'pending')
              : mapSubmitItemStatus(item.item_status, { startService: startService && (item.employee_ids || []).filter(Boolean).length > 0, itemType: item.item_type }),
      }
    })
  }

  const handleSubmit = () => {
    if (isEdit) return handleSaveEdit()
    if (!selectedCustomer) {
      toast.error('Please select a customer')
      return
    }
    if (!selectedBranch) {
      toast.error('Please select a branch')
      return
    }
    if (cartItems.length === 0) {
      toast.error('Please add at least one item')
      return
    }
    if (totalAmount < 0) {
      toast.error('Total amount cannot be negative')
      return
    }
    if (billType === 'previous' && !billDate) {
      toast.error('Please select a date for the previous bill')
      return
    }

    const validPayments = payments.filter((p) => parseFloat(p.amount) > 0)
    if (validPayments.length === 0) {
      toast.error('Please add at least one payment')
      return
    }

    const paymentTotal = validPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
    if (Math.abs(paymentTotal - totalAmount) > 0.01) {
      toast.error(
        `Payment total (${formatCurrency(paymentTotal)}) must equal bill total (${formatCurrency(totalAmount)})`
      )
      return
    }

    let billDateTime = null
    if (billType === 'previous') {
      const time = billTime || '12:00'
      billDateTime = `${billDate}T${time}:00.000Z`
    }

    const billData = {
      customer_id: selectedCustomer.customer_id,
      branch_id: selectedBranch,
      bill_type: billType,
      bill_date: billDateTime,
      chair_id: selectedChair || undefined,
      book_number: bookNumber.trim() || undefined,
      items: buildSubmitItems(cartItems),
      payments: validPayments.map((p) => ({
        payment_mode: p.payment_mode,
        amount: parseFloat(p.amount),
        ...(p.upi_account_id ? { upi_account_id: p.upi_account_id } : {}),
      })),
      discount_amount: parseFloat(billDiscount.toFixed(2)),
      discount_reason: discountReason,
      notes,
      ...(consumedTokenId ? { token_id: consumedTokenId } : {}),
    }

    createBillMutation.mutate(billData)
  }

  const reviseMutation = useMutation({
    mutationFn: (body) => billService.reviseBill(editId, body),
    onSuccess: () => {
      toast.success('Bill updated')
      for (const key of [['bills'], ['bill', editId], ['bill-audit', editId], ['pending-services'], ['dashboard-stats'], ['customers']]) {
        queryClient.invalidateQueries({ queryKey: key })
      }
      navigate(`/bills/${editId}`)
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Could not update the bill'),
  })

  const handleSaveEdit = () => {
    if (!selectedCustomer) return toast.error('Please select a customer')
    if (cartItems.length + keptPackageLines.length === 0) return toast.error('A bill needs at least one item')
    const validPayments = payments.filter((p) => parseFloat(p.amount) > 0)
    if (editCompleted) {
      const paymentTotal = validPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
      if (validPayments.length === 0) return toast.error('Please add at least one payment')
      if (Math.abs(paymentTotal - totalAmount) > 0.01) {
        return toast.error(`Payment total (${formatCurrency(paymentTotal)}) must equal the new total (${formatCurrency(totalAmount)})`)
      }
      if (editReason.trim().length < 3) return toast.error('Give a short reason for the change')
    }
    const submitted = cartItems.map((item) =>
      item.source_item_id
        ? {
            item_id: item.source_item_id,
            item_type: item.item_type,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_amount: parseFloat(getItemDiscount(item).toFixed(2)),
            employee_ids: item.item_type === 'service' ? (item.employee_ids || []).filter(Boolean) : undefined,
          }
        : buildSubmitItems([item])[0]
    )
    reviseMutation.mutate({
      customer_id: selectedCustomer.customer_id,
      book_number: bookNumber.trim() || null,
      notes: notes || null,
      discount_amount: parseFloat(billDiscount.toFixed(2)),
      reason: editReason.trim() || undefined,
      keep_package_instance_ids: Object.keys(keptPackages).filter((k) => keptPackages[k]),
      items: submitted,
      ...(editCompleted
        ? {
            payments: validPayments.map((p) => ({
              ...(p.payment_id ? { payment_id: p.payment_id } : {}),
              payment_mode: p.payment_mode,
              amount: parseFloat(p.amount),
              ...(p.payment_mode === 'upi' && p.upi_account_id ? { upi_account_id: p.upi_account_id } : {}),
            })),
          }
        : {}),
    })
  }

  // Start service — creates a pending bill without payments
  const handleStartService = () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer')
      return
    }
    if (!selectedBranch) {
      toast.error('Please select a branch')
      return
    }
    if (cartItems.length === 0) {
      toast.error('Please add at least one item')
      return
    }
    if (billType === 'previous' && !billDate) {
      toast.error('Please select a date for the previous bill')
      return
    }

    let billDateTime = null
    if (billType === 'previous') {
      const time = billTime || '12:00'
      billDateTime = `${billDate}T${time}:00.000Z`
    }

    const billData = {
      customer_id: selectedCustomer.customer_id,
      branch_id: selectedBranch,
      bill_type: billType,
      bill_date: billDateTime,
      chair_id: selectedChair || undefined,
      book_number: bookNumber.trim() || undefined,
      items: buildSubmitItems(cartItems, { startService: true }),
      payments: [],
      discount_amount: parseFloat(billDiscount.toFixed(2)),
      discount_reason: discountReason,
      notes,
      status: 'pending',
      ...(consumedTokenId ? { token_id: consumedTokenId } : {}),
    }

    createBillMutation.mutate(billData)
  }

  // Set default branch for non-owner users
  useEffect(() => {
    if (branchId && !selectedBranch) {
      setSelectedBranch(branchId)
    }
  }, [branchId, selectedBranch])

  // Default date/time to today and current time in IST when switching to Previous Bill
  useEffect(() => {
    if (billType === 'previous' && !billDate) {
      setBillDate(getTodayIST())
      setBillTime(getCurrentTimeIST())
    }
  }, [billType, billDate])

  // Edit mode: load the bill into the cart once
  useEffect(() => {
    if (!isEdit || !editBill || seededRef.current) return
    seededRef.current = true
    const bid = editBill.branch?.branch_id
    if (bid && bid !== selectedBranch) setSelectedBranch(bid)
    setSelectedCustomer({ customer_id: editBill.customer.customer_id, customer_name: editBill.customer.customer_name, phone_masked: editBill.customer.phone_masked })
    setCustomerSearch(editBill.customer.customer_name)
    setBookNumber(editBill.book_number || '')
    setNotes(editBill.notes || '')
    const singles = editBill.items.filter((i) => !i.package_instance_id)
    setCartItems(
      singles.map((i) => ({
        cart_id: crypto.randomUUID(),
        source_item_id: i.item_id,
        item_type: i.item_type,
        service_id: i.service?.service_id ?? null,
        product_id: i.product?.product_id ?? null,
        package_id: i.package?.package_id ?? null,
        item_name: i.item_name,
        unit_price: i.unit_price,
        quantity: i.quantity,
        employee_ids: (i.employees || []).map((e) => e.employee_id),
        employee_id: null,
        star_points: 0,
        tax_rate: i.tax_rate || 0,
        hsn_sac_code: i.hsn_sac_code || null,
        discount_percent: 0,
        discount_amount_override: i.discount_amount > 0 ? i.discount_amount : undefined,
        item_status: i.status === 'pending' ? 'pending' : i.status === 'in_progress' ? 'in_progress' : 'completed',
        selected_services: [],
      }))
    )
    setKeptPackages(Object.fromEntries((editBill.package_summary || []).map((p) => [p.package_instance_id, true])))
    if (editBill.status === 'completed') {
      setPayments(
        (editBill.payments || []).map((p) => ({
          payment_id: p.payment_id,
          payment_mode: p.payment_mode,
          amount: String(p.amount),
          ...(p.upi_account_id ? { upi_account_id: p.upi_account_id } : {}),
        }))
      )
    }
    // Bill-level discount as a percentage of the pre-discount value (this screen's model).
    const lineDisc = editBill.items.reduce((n, i) => n + (i.discount_amount || 0), 0)
    const gross = editBill.items.reduce((n, i) => n + i.unit_price * i.quantity, 0) - lineDisc
    const extra = Math.max(0, editBill.discount_amount - lineDisc)
    setBillDiscountPercent(gross > 0 ? (extra / gross) * 100 : 0)
  }, [isEdit, editBill]) // eslint-disable-line react-hooks/exhaustive-deps

  // Default OR group selections when a package with service_groups is selected (e.g. after branch switch)
  useEffect(() => {
    if (selectedCategory !== 'packages' || !selectedItemId || !selectedItem?.service_groups?.length) return
    const current = packageGroupSelections[selectedItemId] || []
    const defaults = selectedItem.service_groups.map((g, i) => current[i] ?? g.services?.[0]?.service_id ?? null)
    if (defaults.some((d, i) => d !== current[i])) {
      setPackageGroupSelections((prev) => ({ ...prev, [selectedItemId]: defaults }))
    }
  }, [selectedCategory, selectedItemId, selectedItem?.service_groups, packageGroupSelections])

  // Close item combobox dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (itemComboboxRef.current && !itemComboboxRef.current.contains(e.target)) {
        setItemDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-set payment amount when total changes (single payment)
  useEffect(() => {
    if (payments.length === 1 && totalAmount >= 0) {
      setPayments([{ ...payments[0], amount: totalAmount > 0 ? totalAmount.toFixed(2) : '' }])
    }
  }, [totalAmount])

  // Auto-collapse sidebar on mount, restore on unmount
  useEffect(() => {
    const wasCollapsed = sidebarCollapsed
    collapseSidebar()
    return () => {
      if (!wasCollapsed) setSidebarCollapsed(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Today in IST for max date on picker and defaults
  const todayStr = getTodayIST()

  const switchCategory = (v) => {
    setSelectedCategory(v)
    setCatalogCategory('all')
    setSelectedItemId(null)
    setItemSearch('')
    setItemPrice('')
  }

  // ---- Keyboard layer (capture phase, so it wins over the global shortcuts while on this screen) ----
  const kbRef = useRef({})
  kbRef.current = { handleSubmit, handleStartService, switchCategory, handlePaymentChange, paymentsLength: payments.length, isEdit, editCompleted }
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key
      const lower = k.toLowerCase()
      const h = kbRef.current
      const dialogOpen = !!document.querySelector('[role=dialog]')
      const typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable

      if ((e.ctrlKey || e.metaKey) && k === 'Enter' && !dialogOpen) {
        e.preventDefault()
        e.stopPropagation()
        if (e.shiftKey && !h.isEdit) h.handleStartService()
        else h.handleSubmit()
        return
      }
      if (dialogOpen) return
      if (k === 'F2') {
        e.preventDefault()
        customerInputRef.current?.focus()
        customerInputRef.current?.select()
      } else if (k === 'F3' && !h.isEdit) {
        e.preventDefault()
        tokenBoxRef.current?.querySelector('input')?.focus()
      } else if (k === '/' && !typing) {
        e.preventDefault()
        e.stopPropagation()
        catalogSearchRef.current?.focus()
        catalogSearchRef.current?.select()
      } else if (e.altKey && ['1', '2', '3'].includes(k)) {
        e.preventDefault()
        h.switchCategory(['services', 'packages', 'products'][Number(k) - 1])
        setTimeout(() => catalogSearchRef.current?.focus(), 0)
      } else if (e.altKey && ['c', 'd', 'u'].includes(lower) && (!h.isEdit || h.editCompleted) && h.paymentsLength > 0) {
        e.preventDefault()
        h.handlePaymentChange(h.paymentsLength - 1, 'payment_mode', { c: 'cash', d: 'card', u: 'upi' }[lower])
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // Fast billing: land in the customer box, and return to the catalog search after each item.
  useEffect(() => {
    if (!isEdit) customerInputRef.current?.focus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const prevSelectedRef = useRef(null)
  useEffect(() => {
    if (prevSelectedRef.current && !selectedItemId) setTimeout(() => catalogSearchRef.current?.focus(), 0)
    prevSelectedRef.current = selectedItemId
  }, [selectedItemId])

  // Arrow keys move through the catalog grid; ArrowUp from the first row returns to the search box.
  const handleGridKey = (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    const tiles = [...e.currentTarget.querySelectorAll('[data-tile]')]
    const i = tiles.indexOf(document.activeElement)
    if (i < 0 || tiles.length === 0) return
    const top0 = tiles[0].offsetTop
    const cols = Math.max(1, tiles.filter((t) => t.offsetTop === top0).length)
    let n = i
    if (e.key === 'ArrowRight') n = i + 1
    else if (e.key === 'ArrowLeft') n = i - 1
    else if (e.key === 'ArrowDown') n = i + cols
    else if (e.key === 'ArrowUp') n = i - cols
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = tiles.length - 1
    e.preventDefault()
    if (n < 0) return catalogSearchRef.current?.focus()
    if (n < tiles.length) {
      tiles[n].focus()
      tiles[n].scrollIntoView({ block: 'nearest' })
    }
  }

  // Branch picker: a single-branch account never needs to choose
  useEffect(() => {
    if (!selectedBranch && branches.length === 1) setSelectedBranch(branches[0].branch_id)
  }, [branches, selectedBranch])

  // Fit the whole screen into the window on desktop: no page scrollbar, only the lists scroll.
  const rootRef = useRef(null)
  useLayoutEffect(() => {
    const fit = () => {
      const el = rootRef.current
      if (!el) return
      if (isEdit || !window.matchMedia('(min-width: 1024px)').matches) {
        el.style.height = ''
        return
      }
      const top = el.getBoundingClientRect().top
      // Leave room for the layout's own bottom padding so the document itself never scrolls
      const pad = parseFloat(getComputedStyle(el.closest('main') || el.parentElement).paddingBottom) || 0
      el.style.height = `${Math.max(440, window.innerHeight - top - pad - 2)}px`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [editLoading, !!editBill]) // eslint-disable-line react-hooks/exhaustive-deps

  // Package: give the next eligible employee from the check-in queue to every service they are qualified for
  const assignPackageFromQueue = async () => {
    const standaloneServices = selectedItem.services || []
    const serviceGroups = selectedItem.service_groups || []

    const allPkgServices = []
    for (const ps of standaloneServices) {
      allPkgServices.push({ service_id: ps.service_id, service_name: ps.service_name, slot_type: 'standalone', slot_index: allPkgServices.length })
    }
    for (let gi = 0; gi < serviceGroups.length; gi++) {
      const selectedId = (packageGroupSelections[selectedItemId] || [])[gi]
      const chosen = (serviceGroups[gi].services || []).find((s) => s.service_id === selectedId)
      if (chosen) allPkgServices.push({ service_id: chosen.service_id, service_name: chosen.service_name, slot_type: 'group', slot_index: standaloneServices.length + gi })
    }

    if (allPkgServices.length === 0) return

    const row = await pickFromRotationQueue({})
    if (!row) {
      toast.warning('No eligible employee in the check-in queue')
      return
    }

    const empSkillIds = new Set((row.skills || []).map((s) => String(s.id)))
    const known = []
    const unknown = []

    for (const svc of allPkgServices) {
      const svcData = services.find((s) => s.service_id === svc.service_id)
      const requiredSkills = svcData?.skills || []
      if (requiredSkills.length === 0) {
        known.push(svc)
      } else {
        const allMatch = requiredSkills.every((sk) => empSkillIds.has(String(sk.id)))
        if (allMatch) known.push(svc)
        else unknown.push(svc)
      }
    }

    const updated = { ...componentEmployees }
    for (const svc of known) {
      const idx = svc.slot_index
      const current = (updated[idx] || []).filter(Boolean)
      if (!current.includes(row.employee_id)) {
        updated[idx] = [...current, row.employee_id]
      }
    }

    setComponentEmployees(updated)

    if (unknown.length === 0) {
      toast.success(`Assigned ${row.full_name} to all ${known.length} service(s)`)
    } else if (known.length > 0) {
      toast.success(`Assigned ${row.full_name} to ${known.length} service(s)`)
      const unknownNames = unknown.map((s) => s.service_name).join(', ')
      setSkillWarnMsg(
        `${row.full_name} doesn't know: ${unknownNames}. You can assign someone later from the bill details page.`
      )
      setSkillWarnOpen(true)
    } else {
      const unknownNames = unknown.map((s) => s.service_name).join(', ')
      setSkillWarnMsg(
        `${row.full_name} doesn't know: ${unknownNames}. You can assign someone later from the bill details page.`
      )
      setSkillWarnOpen(true)
    }
  }

  const canQueuePick =
    selectedCategory === 'services' ||
    (selectedCategory === 'packages' && !!selectedItem && (selectedItem.services?.length > 0 || selectedItem.service_groups?.length > 0))
  const runQueuePick = () => {
    if (selectedCategory === 'packages') return assignPackageFromQueue()
    return handleAddEmployeeFromQueue(0, selectedItemId)
  }

  // Billing fits the window (lists scroll inside); editing lets the page grow so no line is ever squeezed out of view.
  const ovH = isEdit ? '' : 'lg:overflow-hidden'
  const ovA = isEdit ? '' : 'lg:overflow-auto'
  const hasLines = cartItems.length > 0 || keptPackageLines.length > 0
  const customerInputRef = useRef(null)
  const catalogSearchRef = useRef(null)
  const [custIdx, setCustIdx] = useState(0)
  useEffect(() => setCustIdx(0), [customers])
  const handleCustomerKeyDown = (e) => {
    if (!showCustomerDropdown || customerSearch.length < 2) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCustIdx((i) => Math.min(customers.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCustIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && customers[custIdx]) {
      e.preventDefault()
      handleSelectCustomer(customers[custIdx])
      setTimeout(() => catalogSearchRef.current?.focus(), 0)
    } else if (e.key === 'Escape') {
      setShowCustomerDropdown(false)
    }
  }

  const catalogCategories = useMemo(() => {
    if (selectedCategory !== 'services') return []
    return [...new Set(itemOptions.map((o) => o.category).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [itemOptions, selectedCategory])

  const filteredCatalog = useMemo(
    () =>
      filteredItemOptions.filter(
        (o) => selectedCategory !== 'services' || catalogCategory === 'all' || o.category === catalogCategory
      ),
    [filteredItemOptions, selectedCategory, catalogCategory]
  )

  const cartCountFor = (id) =>
    cartItems.filter((i) => (i.service_id || i.package_id || i.product_id) === id).reduce((n, i) => n + (i.quantity || 1), 0)

  const pickCatalogItem = (id) => {
    handleItemSelect(id)
    setItemSearch('')
    // On phones the details panel sits above the grid: bring it into view.
    setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  if (isEdit && editLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (isEdit && (editError || !editBill)) {
    return <Card><CardContent className="py-10 text-center text-red-500">{editError?.response?.data?.error?.message || 'Bill not found'}</CardContent></Card>
  }
  if (isEdit && (!['owner', 'manager', 'developer'].includes(user?.role) || editBill.status === 'cancelled')) {
    return (
      <Card>
        <CardContent className="space-y-3 py-10 text-center">
          <p>{editBill.status === 'cancelled' ? 'A cancelled bill cannot be edited.' : 'Only an owner or manager can edit a bill.'}</p>
          <Button variant="outline" onClick={() => navigate(`/bills/${editId}`)}>Back to bill</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div ref={rootRef} className={`flex min-h-0 flex-col pb-20 ${ovH} lg:pb-0`}>
      {/* Header: compact, two short rows so the whole billing screen fits without scrolling */}
      <div className="mb-2 rounded-xl border bg-card px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate(isEdit ? `/bills/${editId}` : '/bills')}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-base font-semibold">
            {isEdit ? `Edit bill ${editBill?.bill_number || ''}` : 'New bill'}
          </h1>
          {isEdit && editBill && (
            <Badge variant={editCompleted ? 'success' : 'warning'}>{editBill.status.toUpperCase()}</Badge>
          )}
          {!isEdit && (
            <Tabs value={billType} onValueChange={(v) => setBillType(v)} className="h-8">
              <TabsList className="h-8">
                <TabsTrigger value="current" className="h-7 px-3 text-xs">Current</TabsTrigger>
                <TabsTrigger value="previous" className="h-7 px-3 text-xs">Previous</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {/* Date / time: the live clock, or the old bill's date and time picker, top right */}
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {isEdit ? (
              <span>
                Bill date: {editBill ? new Date(editBill.bill_date).toLocaleString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            ) : billType === 'previous' ? (
              <>
                <span className="font-medium text-foreground">Bill date</span>
                <Input type="date" className="h-8 w-[9.5rem] text-sm" value={billDate} onChange={(e) => setBillDate(e.target.value)} max={todayStr} />
                <Input type="time" className="h-8 w-[7.5rem] text-sm" value={billTime} onChange={(e) => setBillTime(e.target.value)} />
              </>
            ) : (
              <span>{getCurrentDateTimeIST().date}, {getCurrentDateTimeIST().time}</span>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-[2]">
          <div className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Customer * (F2): name, phone or ID"
              className="h-9 pl-8 pr-8 text-sm"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                setShowCustomerDropdown(true)
                if (!e.target.value) { setSelectedCustomer(null); setConsumedTokenId(null) }
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              onKeyDown={handleCustomerKeyDown}
              ref={customerInputRef}
            />
            {selectedCustomer && (
              <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500" />
            )}
          </div>
          {showCustomerDropdown && customerSearch.length >= 2 && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
              {customersLoading ? (
                <div className="p-3 text-center text-gray-500 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" />
                  Searching...
                </div>
              ) : customers.length === 0 ? (
                <div className="p-3 text-center">
                  <p className="text-gray-500 text-xs mb-2">No customers found</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setShowCustomerDropdown(false)
                      setAddCustomerModalOpen(true)
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    Add New
                  </Button>
                </div>
              ) : (
                customers.map((customer, cIdx) => (
                  <div
                    key={customer.customer_id}
                    className={`px-3 py-2 cursor-pointer border-b last:border-b-0 ${cIdx === custIdx ? 'bg-accent' : 'hover:bg-gray-50'}`}
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <div className="font-medium text-sm">
                      {customer.customer_code && <span className="text-gray-400 font-mono text-xs mr-1">#{customer.customer_code}</span>}
                      {customer.customer_name}
                    </div>
                    <div className="text-xs text-gray-500">{customer.phone_masked}</div>
                  </div>
                ))
              )}
            </div>
          )}
          </div>
          </div>
          {!isEdit && (
            <div className="w-36">
          {!branchId ? (
          <select
            className="h-9 px-2 text-sm border rounded-md w-full bg-background"
            value={selectedBranch || ''}
            onChange={(e) => {
              // Items belong to a branch's catalog, so picking another branch starts a fresh cart.
              setSelectedBranch(e.target.value)
              setCartItems([])
            }}
            title="Branch"
          >
            <option value="">Select branch...</option>
            {branches.map((branch) => (
              <option key={branch.branch_id} value={branch.branch_id}>
                {branch.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="inline-flex w-full items-center h-9 px-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-md">
            {user?.branch?.name || 'Branch'}
          </span>
        )}
            </div>
          )}
          {!isEdit && (
            <div className="w-36">
          <div className="relative" ref={tokenBoxRef}>
          <div className="relative">
            <Ticket className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Token # (F3)"
              className="h-9 pl-7 pr-2 text-sm w-full"
              value={tokenInput}
              onChange={(e) => { setTokenInput(e.target.value); setShowTokenDropdown(true) }}
              onFocus={() => setShowTokenDropdown(true)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLookupToken() } }}
              disabled={loadingToken}
            />
            {loadingToken && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-gray-400" />
            )}
          </div>
          {showTokenDropdown && (
            <div className="absolute z-50 mt-1 w-72 bg-white border rounded-lg shadow-lg max-h-72 overflow-auto">
              {filteredOpenTokens.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-500">
                  {tokenInput.trim()
                    ? 'No matching open tokens. Press Enter to look up by exact number.'
                    : 'No open tokens for today.'}
                </div>
              ) : (
                filteredOpenTokens.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={async () => {
                      setShowTokenDropdown(false)
                      setTokenInput('')
                      await loadTokenIntoBill(t)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 flex items-center gap-3"
                  >
                    <span className="font-bold text-primary text-sm w-20 shrink-0">
                      {t.token_number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.customer_name_snap}</div>
                      {t.customer_phone_snap && (
                        <div className="text-xs text-gray-500">{t.customer_phone_snap}</div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
          </div>
            </div>
          )}
          {!isEdit && (
            <div className="w-32">
          {selectedBranch && (
          <select
            className="h-9 px-2 text-sm border rounded-md w-full bg-background"
            value={selectedChair}
            onChange={(e) => setSelectedChair(e.target.value)}
            title="Chair (optional)"
          >
            <option value="">Chair...</option>
            {availableChairs.map((chair) => (
              <option key={chair.chair_id} value={chair.chair_id}>
                {chair.chair_number}{chair.chair_name ? ` - ${chair.chair_name}` : ''}
              </option>
            ))}
          </select>
        )}
            </div>
          )}
          <div className="w-40">
            <Input
              type="text"
              placeholder="Notes (optional)"
              className="h-9 w-full text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </div>
          <div className="w-24">
          <Input
          type="text"
          placeholder="Book No."
          className="h-9 w-full text-sm"
          value={bookNumber}
          onChange={(e) => setBookNumber(e.target.value)}
          maxLength={50}
        />
          </div>
        </div>
      </div>

      {/* Main Content - Two Panels */}
      <div className={`flex flex-1 flex-col gap-4 lg:flex-row ${ovH}`}>
        {/* Left Panel - Item Selection */}
        <div className={`flex flex-1 flex-col ${ovH}`}>
          <Card className={`flex-1 flex flex-col ${ovH}`}>
            <CardHeader className="pb-2">
              <Tabs
                value={selectedCategory}
                onValueChange={switchCategory}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="services" className="flex-1">
                    Services
                  </TabsTrigger>
                  <TabsTrigger value="packages" className="flex-1">
                    Packages
                  </TabsTrigger>
                  <TabsTrigger value="products" className="flex-1">
                    Products
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {selectedBranch && (selectedCategory === 'services' || selectedCategory === 'packages') && (
                <div className="mt-2">
                  <EmployeeRotationPanel
                    strip
                    branchId={selectedBranch}
                    serviceId={selectedCategory === 'services' ? (selectedItemId || undefined) : undefined}
                    serviceName={selectedCategory === 'services' ? selectedItem?.name : undefined}
                    accordionOpen={queueOpen}
                    onAccordionToggle={() => setQueueOpen((o) => !o)}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className={`flex flex-1 flex-col gap-4 p-3 sm:p-4 ${ovA}`}>
              {/* Barcode Scan Input — products only */}
              {selectedCategory === 'products' && (
                <div>
                  <Input
                    placeholder="Scan barcode..."
                    className="font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        handleBarcodeScan(e.target.value.trim())
                        e.target.value = ''
                      }
                    }}
                  />
                </div>
              )}
              {/* Catalog: search, category chips and a tap-to-select grid */}
              <div className="order-2 space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={catalogSearchRef}
                    type="text"
                    placeholder={`Search ${selectedCategory}... ( / )  Enter picks the first match, ↓ moves into the list`}
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filteredCatalog[0]) {
                        e.preventDefault()
                        pickCatalogItem(filteredCatalog[0].id)
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        document.querySelector('[data-tile]')?.focus()
                      } else if (e.key === 'Escape') {
                        setItemSearch('')
                      }
                    }}
                    className="h-10 pl-9"
                  />
                </div>
                {catalogCategories.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {['all', ...catalogCategories].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCatalogCategory(c)}
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          catalogCategory === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-secondary'
                        }`}
                      >
                        {c === 'all' ? 'All' : c}
                      </button>
                    ))}
                  </div>
                )}
                {filteredCatalog.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No matching {selectedCategory === 'services' ? 'service' : selectedCategory === 'packages' ? 'package' : 'product'} found.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" onKeyDown={handleGridKey}>
                    {filteredCatalog.map((opt) => {
                      const inCart = cartCountFor(opt.id)
                      const outOfStock = selectedCategory === 'products' && (opt.stock ?? 0) <= 0
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-tile
                          disabled={outOfStock}
                          onClick={() => pickCatalogItem(opt.id)}
                          className={`relative flex min-h-[84px] flex-col justify-between rounded-lg border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                            selectedItemId === opt.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card hover:border-primary/50 hover:bg-secondary/50'
                          }`}
                        >
                          <span className="line-clamp-2 text-sm font-medium leading-snug">
                            {opt.description && selectedCategory === 'packages' ? <span className="text-primary">[{opt.description}] </span> : null}
                            {opt.name}
                          </span>
                          <span className="mt-1.5 flex items-center justify-between text-xs">
                            <span className="font-semibold">{formatCurrency(opt.price)}</span>
                            <span className="text-muted-foreground">
                              {selectedCategory === 'services' && opt.star_points > 0 ? `⭐ ${opt.star_points}` : null}
                              {selectedCategory === 'products' ? (outOfStock ? 'Out of stock' : `${opt.stock} in stock`) : null}
                            </span>
                          </span>
                          {inCart > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                              {inCart}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Item Details */}
              <Dialog
                open={!!selectedItem}
                onOpenChange={(o) => {
                  if (!o) handleItemSelect(null)
                }}
              >
                <DialogContent
                  className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
                  onOpenAutoFocus={(e) => {
                    e.preventDefault()
                    const target = document.getElementById('bill-item-qty') || document.querySelector('[role=dialog] input')
                    target?.focus()
                  }}
                  onKeyDown={(e) => {
                    if (e.altKey && e.key.toLowerCase() === 'q' && canQueuePick) {
                      e.preventDefault()
                      runQueuePick()
                      return
                    }
                    // Enter adds the item from any plain field (not inside a search list or on a button)
                    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
                    const t = e.target
                    if (t.tagName === 'BUTTON' || t.closest('[data-searchable-select-dropdown]') || t.tagName === 'TEXTAREA') return
                    e.preventDefault()
                    handleAddToCart()
                  }}
                >
                  <DialogTitle className="sr-only">Add item to bill</DialogTitle>
                  {selectedItem && (
                    <div ref={detailsRef} className="space-y-3">
                  <div>
                    <div className="font-semibold text-lg">{selectedItem.name}</div>
                    {selectedCategory === 'services' && (
                      <div className="text-sm text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {selectedItem.category && <span>Category: {selectedItem.category}</span>}
                        {selectedItem.duration != null && <span>Duration: {selectedItem.duration} min</span>}
                        {(selectedItem.star_points ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <Star className="h-3.5 w-3.5 fill-amber-500" />
                            {selectedItem.star_points} stars
                          </span>
                        )}
                        {(selectedItem.skills?.length ?? 0) > 0 && (
                          <span className="inline-flex flex-wrap gap-1">
                            {selectedItem.skills.map((sk) => (
                              <Badge key={sk.id} variant="outline" className="text-[10px] font-normal py-0">
                                {sk.name}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </div>
                    )}
                    {selectedCategory === 'products' && (
                      <div className="text-sm text-gray-500">
                        {selectedItem.brand && `Brand: ${selectedItem.brand} | `}
                        Available at branch: {selectedItem.stock ?? 0}
                      </div>
                    )}
                    {selectedCategory === 'packages' && (
                      <div className="text-sm text-gray-500 space-y-1">
                        {selectedItem.description && (
                          <span className="text-primary font-medium">{selectedItem.description}</span>
                        )}
                        {selectedItem.service_groups?.length > 0 && (
                          <p className="text-amber-700 font-medium">
                            Choose one service per group below before adding to cart.
                          </p>
                        )}
                        {(() => {
                          const ind = selectedItem.individual_price || 0
                          const current = parseFloat(itemPrice) || 0
                          const savings = ind - current
                          return savings > 0 ? (
                            <span className="text-green-600 ml-2">
                              Save {formatCurrency(savings)}
                            </span>
                          ) : null
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[100px]">
                      <Label className="mb-1 block text-sm">Price</Label>
                      <Input
                        type="number"
                        min="0"
                        value={itemPrice}
                        onChange={(e) => setItemPrice(e.target.value)}
                      />
                    </div>
                    {selectedCategory !== 'packages' && (
                      <div className="w-24">
                        <Label className="mb-1 block text-sm">Qty</Label>
                        <Input
                          id="bill-item-qty"
                          type="number"
                          min="1"
                          value={itemQuantity}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                        />
                      </div>
                    )}
                    <div className="w-24">
                      <Label className="mb-1 block text-sm">Discount %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={addDiscountPercent || ''}
                        onChange={(e) => {
                          setAddDiscountPercent(
                            Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                          )
                          setAddDiscountAmount('')
                        }}
                      />
                    </div>
                    <div className="w-24">
                      <Label className="mb-1 block text-sm">Discount ₹</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={addDiscountAmount}
                        onChange={(e) => {
                          const v = e.target.value
                          setAddDiscountAmount(v)
                          if (parseFloat(v) > 0) setAddDiscountPercent(0)
                        }}
                      />
                    </div>
                  </div>


                  {/* Same employee for all services (packages only) */}
                  {selectedCategory === 'packages' && (selectedItem.services?.length > 0 || selectedItem.service_groups?.length > 0) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-2 bg-blue-50 rounded border border-blue-200">
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={sameEmployeeForAll}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setSameEmployeeForAll(checked)
                              if (!checked) setGlobalEmployee('')
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="text-blue-700 font-medium">Same employee for all services</span>
                        </label>
                        {sameEmployeeForAll && (
                          <SearchableSelect
                            className="flex-1 min-w-[150px]"
                            options={employees.map((emp) => ({ value: emp.employee_id, label: emp.full_name }))}
                            value={globalEmployee}
                            onChange={(val) => {
                              setGlobalEmployee(val)
                              if (val) {
                                const totalComponents = (selectedItem.services?.length || 0) + (selectedItem.service_groups?.length || 0)
                                const updated = {}
                                for (let i = 0; i < totalComponents; i++) updated[i] = [val]
                                setComponentEmployees(updated)
                              }
                            }}
                            placeholder="Select employee..."
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Package services — inline single-row: name, stars, qty, price, employee dropdowns */}
                  {selectedCategory === 'packages' && selectedItem.services?.length > 0 && (
                    <div className="text-sm space-y-1">
                      {selectedItem.services.map((ps, idx) => {
                        const slots = (componentEmployees[idx] || []).length ? (componentEmployees[idx] || []) : ['']
                        return (
                          <div key={ps.service_id} className="flex items-start gap-2 p-1.5 bg-white rounded border flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-[130px]">
                              <span className="text-gray-700 text-xs font-medium truncate max-w-[140px]" title={ps.service_name}>
                                {ps.service_name}
                              </span>
                              {getPackageServiceStarPoints(ps) > 0 && (
                                <span className="inline-flex items-center text-amber-600 text-[10px] shrink-0">
                                  <Star className="h-2.5 w-2.5 fill-amber-500" />
                                  {getPackageServiceStarPoints(ps)}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400 shrink-0">x{ps.quantity} {formatCurrency(ps.service_price)}</span>
                            </div>
                            <div className="flex items-center gap-1 ml-auto flex-wrap">
                              {slots.map((_, slotIdx) => (
                                <div key={slotIdx} className="flex items-center gap-0.5">
                                  <SearchableSelect
                                    compact
                                    className="min-w-[100px]"
                                    options={employees.filter((emp) => {
                                      const others = (componentEmployees[idx] || []).filter((id, i) => i !== slotIdx && id).map(String)
                                      return !others.includes(String(emp.employee_id))
                                    }).map((emp) => ({ value: emp.employee_id, label: emp.full_name }))}
                                    value={(componentEmployees[idx] || [])[slotIdx] || ''}
                                    onChange={(val) => {
                                      const current = [...(componentEmployees[idx] || [])]
                                      while (current.length <= slotIdx) current.push('')
                                      current[slotIdx] = val || ''
                                      setComponentEmployees((prev) => ({ ...prev, [idx]: current }))
                                    }}
                                    placeholder="Staff..."
                                    disabled={sameEmployeeForAll}
                                  />
                                  {slots.length > 1 && (
                                    <button
                                      type="button"
                                      className="h-5 w-5 flex items-center justify-center rounded text-red-400 hover:text-red-600 shrink-0"
                                      title="Remove employee"
                                      onClick={() => {
                                        const current = (componentEmployees[idx] || []).filter((_, i) => i !== slotIdx)
                                        setComponentEmployees((prev) => ({ ...prev, [idx]: current.length ? current : [''] }))
                                      }}
                                    >
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                type="button"
                                className="h-6 w-6 flex items-center justify-center rounded border border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600 shrink-0"
                                title="Add employee slot"
                                onClick={() => {
                                  const current = (componentEmployees[idx] || []).length ? (componentEmployees[idx] || []) : ['']
                                  setComponentEmployees((prev) => ({ ...prev, [idx]: [...current, ''] }))
                                }}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              {!sameEmployeeForAll && (
                                <button
                                  type="button"
                                  className="h-6 px-1.5 flex items-center gap-0.5 rounded border border-primary/40 text-primary text-[10px] font-medium hover:bg-primary/10 shrink-0"
                                  title={`Pick from queue for ${ps.service_name}`}
                                  onClick={() => handleAddEmployeeFromQueue(idx, ps.service_id)}
                                >
                                  <Users className="h-2.5 w-2.5" />
                                  Queue
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* OR groups — inline: service selector + employee dropdowns on same row */}
                  {selectedCategory === 'packages' &&
                    selectedItem.service_groups?.length > 0 &&
                    (() => {
                      const standaloneLen = (selectedItem.services || []).length
                      return (
                        <div className="text-sm space-y-1.5">
                          {selectedItem.service_groups.map((group, groupIdx) => {
                            const selectedId = (packageGroupSelections[selectedItemId] || [])[groupIdx]
                            const chosen = (group.services || []).find((s) => s.service_id === selectedId)
                            const groupServices = group.services || []
                            const idx = standaloneLen + groupIdx
                            const slots = (componentEmployees[idx] || []).length ? (componentEmployees[idx] || []) : ['']
                            return (
                              <div key={group.group_id || groupIdx} className="p-1.5 bg-amber-50/50 rounded border border-amber-200">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-medium text-amber-700 shrink-0">{group.group_label || `OR ${groupIdx + 1}`}</span>
                                  <select
                                    className="h-6 px-1 text-[11px] border rounded min-w-[120px] flex-1 border-amber-300"
                                    value={selectedId || ''}
                                    onChange={(e) => {
                                      const sid = e.target.value || null
                                      setPackageGroupSelections((prev) => {
                                        const arr = [...(prev[selectedItemId] || [])]
                                        while (arr.length <= groupIdx) arr.push(null)
                                        arr[groupIdx] = sid
                                        return { ...prev, [selectedItemId]: arr }
                                      })
                                    }}
                                  >
                                    <option value="">Select...</option>
                                    {groupServices.map((s) => {
                                      const bonusNames = (s.bonus_services || []).map(b => b.service_name).join(', ')
                                      return (
                                        <option key={s.service_id} value={s.service_id}>
                                          {s.service_name} {formatCurrency(s.service_price)}{getPackageServiceStarPoints(s) > 0 ? ` (${getPackageServiceStarPoints(s)}pts)` : ''}{bonusNames ? ` +Free: ${bonusNames}` : ''}
                                        </option>
                                      )
                                    })}
                                  </select>
                                  {chosen && (
                                    <>
                                      {slots.map((_, slotIdx) => (
                                        <div key={slotIdx} className="flex items-center gap-0.5">
                                          <SearchableSelect
                                            compact
                                            className="min-w-[100px]"
                                            options={employees.filter((emp) => {
                                              const others = (componentEmployees[idx] || []).filter((id, i) => i !== slotIdx && id).map(String)
                                              return !others.includes(String(emp.employee_id))
                                            }).map((emp) => ({ value: emp.employee_id, label: emp.full_name }))}
                                            value={(componentEmployees[idx] || [])[slotIdx] || ''}
                                            onChange={(val) => {
                                              const current = [...(componentEmployees[idx] || [])]
                                              while (current.length <= slotIdx) current.push('')
                                              current[slotIdx] = val || ''
                                              setComponentEmployees((prev) => ({ ...prev, [idx]: current }))
                                            }}
                                            placeholder="Staff..."
                                            disabled={sameEmployeeForAll}
                                          />
                                          {slots.length > 1 && (
                                            <button
                                              type="button"
                                              className="h-5 w-5 flex items-center justify-center rounded text-red-400 hover:text-red-600 shrink-0"
                                              title="Remove employee"
                                              onClick={() => {
                                                const current = (componentEmployees[idx] || []).filter((_, i) => i !== slotIdx)
                                                setComponentEmployees((prev) => ({ ...prev, [idx]: current.length ? current : [''] }))
                                              }}
                                            >
                                              <Trash2 className="h-2.5 w-2.5" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        className="h-6 w-6 flex items-center justify-center rounded border border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600 shrink-0"
                                        title="Add employee"
                                        onClick={() => {
                                          const current = (componentEmployees[idx] || []).length ? (componentEmployees[idx] || []) : ['']
                                          setComponentEmployees((prev) => ({ ...prev, [idx]: [...current, ''] }))
                                        }}
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                      {!sameEmployeeForAll && (
                                        <button
                                          type="button"
                                          className="h-6 px-1.5 flex items-center gap-0.5 rounded border border-primary/40 text-primary text-[10px] font-medium hover:bg-primary/10 shrink-0"
                                          title={`Pick from queue for ${chosen.service_name}`}
                                          onClick={() => handleAddEmployeeFromQueue(idx, chosen.service_id)}
                                        >
                                          <Users className="h-2.5 w-2.5" />
                                          Queue
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                                {chosen?.bonus_services?.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1 mt-1">
                                    <span className="text-[10px] text-green-600 font-medium">Free:</span>
                                    {chosen.bonus_services.map((bs) => (
                                      <span key={bs.service_id} className="text-[10px] bg-green-50 text-green-700 px-1 py-0.5 rounded border border-green-200">
                                        {bs.service_name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}

                  {/* Flat package — inline employee assignment */}
                  {selectedCategory === 'packages' &&
                    (!selectedItem.services || selectedItem.services.length === 0) &&
                    !(selectedItem.service_groups?.length > 0) && (
                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        <span className="text-xs text-gray-500 shrink-0">Staff:</span>
                        {((componentEmployees[0] || []).length ? componentEmployees[0] : ['']).map((_, slotIdx) => {
                          const allSlots = (componentEmployees[0] || []).length ? componentEmployees[0] : ['']
                          return (
                            <div key={slotIdx} className="flex items-center gap-0.5">
                              <select
                                className="h-7 px-1 text-xs border rounded min-w-[90px]"
                                value={(componentEmployees[0] || [])[slotIdx] || ''}
                                onChange={(e) => {
                                  const current = [...(componentEmployees[0] || [])]
                                  while (current.length <= slotIdx) current.push('')
                                  current[slotIdx] = e.target.value || ''
                                  setComponentEmployees((prev) => ({ ...prev, [0]: current }))
                                }}
                              >
                                <option value="">Staff...</option>
                                {employees.filter((emp) => {
                                  const others = (componentEmployees[0] || []).filter((id, i) => i !== slotIdx && id).map(String)
                                  return !others.includes(String(emp.employee_id))
                                }).map((emp) => (
                                  <option key={emp.employee_id} value={emp.employee_id}>
                                    {emp.full_name}
                                  </option>
                                ))}
                              </select>
                              {allSlots.length > 1 && (
                                <button
                                  type="button"
                                  className="h-5 w-5 flex items-center justify-center rounded text-red-400 hover:text-red-600 shrink-0"
                                  title="Remove employee"
                                  onClick={() => {
                                    const current = (componentEmployees[0] || []).filter((_, i) => i !== slotIdx)
                                    setComponentEmployees((prev) => ({ ...prev, [0]: current.length ? current : [''] }))
                                  }}
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          )
                        })}
                        <button
                          type="button"
                          className="h-7 w-7 flex items-center justify-center rounded border border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600 shrink-0"
                          title="Add employee"
                          onClick={() => {
                            const current = (componentEmployees[0] || []).length ? (componentEmployees[0] || []) : ['']
                            setComponentEmployees((prev) => ({ ...prev, [0]: [...current, ''] }))
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                  {/* Employee selector for single service/product — multiple employees allowed for any item */}
                  {selectedCategory !== 'packages' && (
                    <div>
                      {selectedCategory === 'services' && selectedItemId && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Select an employee manually or leave blank to add without assignment
                        </p>
                      )}
                      <Label className="mb-1 block text-sm flex items-center gap-2">
                        Assign Employee(s) (optional)
                        {selectedCategory === 'services' && (selectedItem?.star_points ?? 0) > 0 && (
                          <span className="inline-flex items-center text-amber-600 text-xs font-normal">
                            <Star className="h-3 w-3 fill-amber-500 mr-0.5" />
                            {selectedItem.star_points} stars
                          </span>
                        )}
                      </Label>
                      <div className="space-y-2">
                        {((componentEmployees[0] || []).length ? componentEmployees[0] : ['']).map((_, slotIdx) => (
                          <div key={slotIdx} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20 shrink-0">
                              Employee {slotIdx + 1}
                            </span>
                            <SearchableSelect
                              className="flex-1 min-w-0"
                              options={employees.filter((emp) => {
                                const others = (componentEmployees[0] || []).filter((id, i) => i !== slotIdx && id).map(String)
                                return !others.includes(String(emp.employee_id))
                              }).map((emp) => ({ value: emp.employee_id, label: emp.full_name }))}
                              value={((componentEmployees[0] || [])[slotIdx] || '').toString()}
                              onChange={(val) => {
                                const current = [...(componentEmployees[0] || [])]
                                while (current.length <= slotIdx) current.push('')
                                current[slotIdx] = val || ''
                                setComponentEmployees({ 0: current })
                              }}
                              placeholder="-- None --"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                const current = [...(componentEmployees[0] || [])]
                                const next = current.filter((_, i) => i !== slotIdx)
                                setComponentEmployees({ 0: next.length ? next : [''] })
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setComponentEmployees({
                              0: [...((componentEmployees[0] || []).length ? componentEmployees[0] : ['']), ''],
                            })
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add employee
                        </Button>
                      </div>
                    </div>
                  )}


                  <div className="flex items-center gap-2">
                    {canQueuePick && (
                      <Button type="button" variant="secondary" className="flex-1" onClick={runQueuePick}>
                        <Users className="mr-2 h-4 w-4" />
                        From queue
                        <Kbd className="ml-2">Alt+Q</Kbd>
                      </Button>
                    )}
                    <Button type="button" className="flex-1" onClick={handleAddToCart}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add to cart
                      <Kbd className="ml-2 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground">Enter</Kbd>
                    </Button>
                  </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    <Kbd>Alt+Q</Kbd> next from queue (press again for another) &nbsp; <Kbd>Enter</Kbd> add to cart &nbsp; <Kbd>Esc</Kbd> cancel
                  </p>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Cart + Checkout (collapsible) */}
        <div
          ref={cartPanelRef}
          className={`flex w-full flex-col transition-[width] duration-200 ease-in-out lg:flex-shrink-0 ${
            cartCollapsed ? 'lg:w-14' : 'lg:w-[480px]'
          }`}
        >
          <Card className={`flex-1 flex flex-col ${ovH}`}>
            {/* Sticky Cart Header */}
            <CardHeader className="pb-0 flex flex-row items-center gap-0 p-0 min-h-0 flex-shrink-0 border-b">
              {cartCollapsed ? (
                <div className="flex flex-col items-center w-14 py-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCartCollapsed(false)}
                    className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                    title="Expand cart"
                  >
                    <ChevronLeft className="h-5 w-5 text-gray-600" />
                  </button>
                  <ShoppingCart className="h-5 w-5 text-gray-600" />
                  <Badge variant="secondary" className="text-xs w-6 h-6 flex items-center justify-center p-0">
                    {cartItems.length}
                  </Badge>
                  {totalAmount > 0 && (
                    <span className="text-xs font-bold text-primary [writing-mode:vertical-lr] rotate-180">
                      {formatCurrency(totalAmount)}
                    </span>
                  )}
                </div>
              ) : (
                <CardTitle className="flex items-center justify-between flex-1 py-2.5 px-4">
                  <span className="flex items-center gap-2 text-sm">
                    <ShoppingCart className="h-4 w-4" />
                    {isEdit ? 'Bill items' : 'Cart'}
                    <Badge variant="secondary" className="text-xs">{cartItems.length}</Badge>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCartCollapsed(true)}
                    className="hidden rounded-md p-1 transition-colors hover:bg-gray-100 lg:block"
                    title="Collapse cart"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </button>
                </CardTitle>
              )}
            </CardHeader>

            {!cartCollapsed && (
            <>
            {/* Scrollable Cart + Checkout Content */}
            <CardContent className={`min-h-0 flex-1 space-y-3 p-3 ${ovA}`}>
              {!hasLines ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No items in cart</p>
                  <p className="text-xs">Select items from the left panel</p>
                </div>
              ) : (
                <>
                {/* Packages already on the bill being edited */}
                {isEdit && (editBill?.package_summary || []).length > 0 && (
                  <div className="space-y-1.5">
                    {editBill.package_summary.map((p) => {
                      const kept = keptPackages[p.package_instance_id]
                      const pkgItems = editBill.items.filter((i) => i.package_instance_id === p.package_instance_id)
                      const total = pkgItems.reduce((n, i) => n + i.total_price, 0)
                      return (
                        <div key={p.package_instance_id} className={`flex items-center justify-between gap-2 rounded-lg border p-2 text-sm ${kept ? 'border-blue-200 bg-blue-50/50' : 'bg-red-50 opacity-60'}`}>
                          <span className="min-w-0">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <Package className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                              <span className="truncate font-medium">{p.package_name}</span>
                              <Badge variant="outline" className="text-[10px]">Package</Badge>
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {pkgItems.map((i) => `${i.item_name}${(i.employees || []).length ? ` (${i.employees.map((e) => e.full_name).join(', ')})` : ''}`).join(' · ')}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="font-medium">{formatCurrency(total)}</span>
                            <button type="button" className="text-xs underline text-muted-foreground hover:text-foreground" onClick={() => setKeptPackages((k) => ({ ...k, [p.package_instance_id]: !kept }))}>
                              {kept ? 'Remove' : 'Undo'}
                            </button>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Cart Items */}
                <div className="space-y-2">
                  {groupedCart.map((group) => {
                    if (group.type === 'package') {
                      const pkgItem = group.item
                      const lineDiscount = getItemDiscount(pkgItem)
                      return (
                        <div
                          key={pkgItem.cart_id}
                          className="bg-gray-50 rounded-lg border overflow-hidden"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5 p-2.5 bg-gray-100">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <Package className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                              <span className="font-medium text-sm truncate">
                                {pkgItem.item_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {pkgItem.item_status === 'pending' || (pkgItem.selected_services || []).every((s) => s.item_status === 'pending') ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] px-1.5"
                                  onClick={() => setPackagePending(group.index, false)}
                                >
                                  Mark done
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] px-1.5 text-amber-700 border-amber-300"
                                  onClick={() => setPackagePending(group.index, true)}
                                >
                                  Mark pending
                                </Button>
                              )}
                              {group.savings > 0 && (
                                <span className="text-[10px] text-green-600 font-medium">
                                  Save {formatCurrency(group.savings)}
                                </span>
                              )}
                              <span className="font-bold text-sm">
                                {formatCurrency(group.total)}
                              </span>
                              <button
                                className="p-0.5 hover:bg-gray-200 rounded"
                                onClick={() => {
                                  setEditingItemIndex(group.index)
                                  setEditModalOpen(true)
                                }}
                              >
                                <Pencil className="h-3 w-3 text-gray-500" />
                              </button>
                              <button
                                className="p-0.5 hover:bg-red-100 rounded"
                                onClick={() => handleRemoveItem(group.index)}
                              >
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </button>
                            </div>
                          </div>
                          {/* Package-level discount */}
                          <div className="px-2.5 py-1.5 flex flex-wrap items-center gap-1.5 border-b">
                            <span className="text-[10px] text-gray-500">Disc:</span>
                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] text-gray-400">%</span>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                className="h-5 w-10 text-[10px] px-1"
                                value={pkgItem.discount_amount_override != null ? '' : (pkgItem.discount_percent ?? '')}
                                placeholder={pkgItem.discount_amount_override != null ? '—' : '0'}
                                onChange={(e) => {
                                  const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                                  setCartItems((items) =>
                                    items.map((it, i) =>
                                      i === group.index
                                        ? { ...it, discount_percent: v, discount_amount_override: undefined }
                                        : it
                                    )
                                  )
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] text-gray-400">₹</span>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                className="h-5 w-10 text-[10px] px-1"
                                value={pkgItem.discount_amount_override != null ? pkgItem.discount_amount_override : ''}
                                placeholder="0"
                                onChange={(e) => {
                                  const v = e.target.value
                                  const num = parseFloat(v)
                                  setCartItems((items) =>
                                    items.map((it, i) =>
                                      i === group.index
                                        ? {
                                            ...it,
                                            discount_amount_override:
                                              v === '' || !Number.isFinite(num) ? undefined : Math.max(0, num),
                                            discount_percent: v === '' || !Number.isFinite(num) ? it.discount_percent : 0,
                                          }
                                        : it
                                    )
                                  )
                                }}
                              />
                            </div>
                            {lineDiscount > 0 && (
                              <span className="text-[10px] text-red-500">(-{formatCurrency(lineDiscount)})</span>
                            )}
                          </div>
                          {(pkgItem.selected_services || []).length > 0 && (
                            <div className="px-2 py-1.5">
                              <div className="grid grid-cols-2 gap-1.5">
                                {pkgItem.selected_services.map((svc, svcIdx) => (
                                  <div
                                    key={svcIdx}
                                    className="p-1.5 bg-white rounded border text-[11px]"
                                  >
                                    <div className="flex items-center gap-1 min-w-0">
                                      <span className="font-medium text-gray-700 truncate" title={svc.service_name}>
                                        {svc.service_name}
                                      </span>
                                      {(svc.star_points || 0) > 0 && (
                                        <span className="inline-flex items-center text-amber-600 font-normal shrink-0">
                                          <Star className="h-2.5 w-2.5 fill-amber-500" />
                                          {svc.star_points}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => togglePackageServicePending(group.index, svcIdx)}
                                        className={`shrink-0 text-[10px] px-1 py-0.5 rounded border font-medium ml-auto ${
                                          svc.item_status === 'pending'
                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-amber-50'
                                        }`}
                                      >
                                        {getCartItemStatusLabel(svc.item_status)}
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                      <span className="text-gray-500 text-[10px]">
                                        {formatCurrency(svc.distributed_price ?? svc.original_service_price)}
                                        {svc.distributed_price != null && svc.distributed_price !== svc.original_service_price && (
                                          <span className="line-through text-gray-300 ml-0.5">{formatCurrency(svc.original_service_price)}</span>
                                        )}
                                      </span>
                                      {svc.employee_ids?.length > 0 &&
                                        svc.employee_ids.map((eid) => {
                                          const emp = employees.find((e) => e.employee_id === eid)
                                          return (
                                            <Badge key={eid} className="text-[9px] px-1 py-0 h-3.5 bg-primary text-white">
                                              {emp?.full_name || '?'}
                                            </Badge>
                                          )
                                        })
                                      }
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    }

                    // Single item
                    const { item, index } = group
                    const lineTotal = item.unit_price * item.quantity
                    const lineDiscount = getItemDiscount(item)
                    const lineNet = lineTotal - lineDiscount
                    return (
                      <div
                        key={item.cart_id}
                        className="p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
                            <span className="font-medium text-sm truncate">{item.item_name}</span>
                            {(item.star_points ?? 0) > 0 && (
                              <span className="inline-flex items-center text-amber-600 text-[10px] shrink-0">
                                <Star className="h-2.5 w-2.5 fill-amber-500" />
                                {item.star_points}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleItemPending(index)}
                              className={`shrink-0 text-[10px] px-1 py-0.5 rounded border ${
                                item.item_status === 'pending'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-amber-50'
                              }`}
                            >
                              {getCartItemStatusLabel(item.item_status)}
                            </button>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              className="p-0.5 hover:bg-gray-200 rounded"
                              onClick={() => {
                                setEditingItemIndex(index)
                                setEditModalOpen(true)
                              }}
                            >
                              <Pencil className="h-3 w-3 text-gray-500" />
                            </button>
                            <button
                              type="button"
                              className="p-0.5 hover:bg-red-100 rounded"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mt-1">
                          <span className="text-gray-500">
                            {formatCurrency(item.unit_price)} x {item.quantity}
                          </span>
                          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <span className="text-gray-400 text-[10px]">%</span>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              className="h-5 w-10 text-[10px] px-1"
                              value={item.discount_amount_override != null ? '' : (item.discount_percent ?? '')}
                              placeholder={item.discount_amount_override != null ? '—' : '0'}
                              onChange={(e) => {
                                const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                                setCartItems((items) =>
                                  items.map((it, i) =>
                                    i === index
                                      ? { ...it, discount_percent: v, discount_amount_override: undefined }
                                      : it
                                  )
                                )
                              }}
                            />
                            <span className="text-gray-400 text-[10px]">₹</span>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              className="h-5 w-10 text-[10px] px-1"
                              value={item.discount_amount_override != null ? item.discount_amount_override : ''}
                              placeholder="0"
                              onChange={(e) => {
                                const v = e.target.value
                                const num = parseFloat(v)
                                setCartItems((items) =>
                                  items.map((it, i) =>
                                    i === index
                                      ? {
                                          ...it,
                                          discount_amount_override:
                                            v === '' || !Number.isFinite(num) ? undefined : Math.max(0, num),
                                          discount_percent:
                                            v === '' || !Number.isFinite(num) ? it.discount_percent : 0,
                                        }
                                      : it
                                  )
                                )
                              }}
                            />
                          </div>
                          <span className="font-semibold ml-auto">
                            {formatCurrency(lineNet)}
                            {lineDiscount > 0 && (
                              <span className="text-[10px] text-red-500 font-normal ml-0.5">
                                (-{formatCurrency(lineDiscount)})
                              </span>
                            )}
                          </span>
                        </div>
                        {item.employee_ids?.length > 0 && (
                          <div className="flex gap-0.5 flex-wrap mt-1">
                            {item.employee_ids.map((eid) => {
                              const emp = employees.find((e) => e.employee_id === eid)
                              return (
                                <Badge key={eid} className="text-[10px] px-1 py-0 h-4 bg-primary text-white">
                                  {emp?.full_name || 'Unknown'}
                                </Badge>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                </>
              )}
            </CardContent>

            {/* Checkout: stays in view while the item list scrolls */}
            {hasLines && (
              <div className="shrink-0 space-y-2 border-t bg-card p-3">
                {/* Summary */}
                <div className="space-y-1 text-sm">
                  {(itemsDiscount > 0 || billDiscount > 0 || taxAmount > 0) && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                  )}
                  {itemsDiscount > 0 && (
                    <div className="flex justify-between text-red-500 text-xs">
                      <span>Item Discounts</span>
                      <span>-{formatCurrency(itemsDiscount)}</span>
                    </div>
                  )}
                  {billDiscount > 0 && (
                    <div className="flex justify-between text-red-500 text-xs">
                      <span>Bill Discount ({billDiscountPercent}%)</span>
                      <span>-{formatCurrency(billDiscount)}</span>
                    </div>
                  )}
                  {taxAmount > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Taxable value</span>
                        <span>{formatCurrency(taxableSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>GST</span>
                        <span>{formatCurrency(taxAmount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1 border-t">
                    <span>Grand Total</span>
                    <span className="text-primary">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>

                {/* Bill Discount */}
                <div className="border-t pt-2">
                  <div className="flex gap-1.5">
                    <div className="w-20 relative">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Disc %"
                        className="h-8 text-sm pr-5"
                        value={billDiscountPercent || ''}
                        onChange={(e) =>
                          setBillDiscountPercent(
                            Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                          )
                        }
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                        %
                      </span>
                    </div>
                    <Input
                      placeholder="Bill discount reason"
                      className="h-8 text-sm flex-1"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                    />
                  </div>
                </div>

                {/* Payment */}
                {(!isEdit || editCompleted) && (
                <div className="border-t pt-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Split className="h-3 w-3" /> Payment
                      {payments.length > 1 && ` (${payments.length})`}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddPayment}
                      className="h-5 text-[10px] px-1.5 ml-auto"
                    >
                      <Plus className="h-2.5 w-2.5 mr-0.5" /> Split
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {payments.map((payment, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-1.5">
                        <div className="flex gap-1">
                          {PAYMENT_MODES.map((mode) => (
                            <button
                              key={mode.value}
                              type="button"
                              onClick={() =>
                                handlePaymentChange(index, 'payment_mode', mode.value)
                              }
                              className={`flex items-center gap-1 px-2 py-1 rounded border text-xs transition-colors ${
                                payment.payment_mode === mode.value
                                  ? 'border-primary bg-primary/5 text-primary font-medium'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              <mode.icon className="h-3.5 w-3.5" />
                              {mode.label}
                            </button>
                          ))}
                        </div>
                        {payment.payment_mode === 'upi' && upiAccounts.length > 0 && (
                          <SearchableSelect
                            className="order-last basis-full"
                            value={payment.upi_account_id || ''}
                            onChange={(val) => handlePaymentChange(index, 'upi_account_id', val)}
                            placeholder="Select UPI Account"
                            options={upiAccounts.map(acc => ({ value: acc.account_id, label: acc.name }))}
                            triggerClassName="h-8 text-sm"
                          />
                        )}
                        <div className="flex min-w-[130px] flex-1 items-center gap-1.5">
                          <div className="flex-1 relative">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Amount"
                              className="h-8 text-sm pr-10"
                              value={payment.amount}
                              onChange={(e) =>
                                handlePaymentChange(index, 'amount', e.target.value)
                              }
                            />
                            <button
                              type="button"
                              onClick={() => handleSetFullAmount(index)}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-primary hover:underline font-medium"
                            >
                              Full
                            </button>
                          </div>
                          {payments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePayment(index)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {payments.length > 1 && (
                    <div className="text-[10px] flex gap-3 mt-1">
                      <span className="text-gray-500">
                        Paid: {formatCurrency(totalPaid)}
                      </span>
                      {remaining !== 0 && (
                        <span
                          className={
                            remaining > 0 ? 'text-red-500' : 'text-green-500'
                          }
                        >
                          {remaining > 0 ? 'Remaining' : 'Excess'}:{' '}
                          {formatCurrency(Math.abs(remaining))}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                )}

                {editCompleted && (
                  <div className="border-t pt-2">
                    <Label className="text-xs font-medium mb-1 block">Why are you changing this bill? *</Label>
                    <Input
                      placeholder="e.g. Customer returned a bottle; wrong price entered"
                      className="h-8 text-sm"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      maxLength={500}
                    />
                  </div>
                )}

                {/* Notes */}
              </div>
            )}

            {/* Sticky Footer - Submit Buttons */}
            {hasLines && (
            <div className="flex-shrink-0 space-y-1 border-t bg-white p-2.5">
              <Button
                className="h-9 w-full text-sm"
                onClick={handleSubmit}
                disabled={
                  createBillMutation.isPending ||
                  reviseMutation.isPending ||
                  !selectedCustomer ||
                  !hasLines ||
                  ((!isEdit || editCompleted) && Math.abs(totalPaid - totalAmount) > 0.01)
                }
              >
                {createBillMutation.isPending || reviseMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    {isEdit ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1.5" />
                    {isEdit ? 'Save changes' : 'Complete Bill'} - {formatCurrency(totalAmount)}
                    <Kbd className="ml-2 hidden lg:inline-flex">Ctrl+Enter</Kbd>
                  </>
                )}
              </Button>
              {!isEdit && (
              <Button
                variant="outline"
                className="h-7 w-full border-primary text-xs text-primary hover:bg-primary/5"
                onClick={handleStartService}
                disabled={
                  createBillMutation.isPending ||
                  !selectedCustomer ||
                  cartItems.length === 0
                }
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Start Service (Save as Pending)
                <Kbd className="ml-2 hidden lg:inline-flex">Ctrl+Shift+Enter</Kbd>
              </Button>
              )}
            </div>
            )}
            </>
            )}
          </Card>
        </div>
      </div>

      {/* Keyboard hints (desktop) */}
      <div className="mt-1.5 hidden shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-[10px] text-muted-foreground lg:flex">
        <span><Kbd>F2</Kbd> customer</span>
        <span><Kbd>/</Kbd> search</span>
        <span><Kbd>↑↓←→</Kbd> move</span>
        <span><Kbd>Enter</Kbd> pick / add</span>
        <span><Kbd>Alt+1</Kbd><Kbd>2</Kbd><Kbd>3</Kbd> tabs</span>
        {(!isEdit || editCompleted) && <span><Kbd>Alt+C</Kbd><Kbd>D</Kbd><Kbd>U</Kbd> cash / card / UPI</span>}
        <span><Kbd>Ctrl+Enter</Kbd> {isEdit ? 'save' : 'complete'}</span>
        {!isEdit && <span><Kbd>Ctrl+Shift+Enter</Kbd> pending</span>}
      </div>

      {/* Phones: always-visible total with a jump to the cart */}
      {hasLines && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t bg-background/95 p-2.5 backdrop-blur lg:hidden">
          <Button className="h-11 w-full justify-between" onClick={() => cartPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              {cartItems.length} item{cartItems.length === 1 ? '' : 's'} in cart
            </span>
            <span className="font-semibold">{formatCurrency(totalAmount)} - Review &amp; pay</span>
          </Button>
        </div>
      )}

      {/* Edit Cart Item Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          {/* Package Edit */}
          {editingItemIndex !== null && cartItems[editingItemIndex]?.item_type === 'package' && (() => {
            const pkgItem = cartItems[editingItemIndex]
            const pkgTotal = pkgItem.unit_price * pkgItem.quantity
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" /> Edit Package
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-lg">{pkgItem.item_name}</span>
                    <span className="font-bold text-lg text-primary">{formatCurrency(pkgTotal)}</span>
                  </div>

                  {/* Package-level discount */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-gray-500">Discount %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        className="h-8 w-16 text-xs"
                        value={pkgItem.discount_amount_override != null ? '' : (pkgItem.discount_percent ?? '')}
                        placeholder={pkgItem.discount_amount_override != null ? '—' : '0'}
                        onChange={(e) => {
                          const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                          setCartItems((items) =>
                            items.map((it, i) =>
                              i === editingItemIndex
                                ? { ...it, discount_percent: v, discount_amount_override: undefined }
                                : it
                            )
                          )
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-gray-500">Discount ₹</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        className="h-8 w-16 text-xs"
                        value={pkgItem.discount_amount_override != null ? pkgItem.discount_amount_override : ''}
                        placeholder="0"
                        onChange={(e) => {
                          const v = e.target.value
                          const num = parseFloat(v)
                          setCartItems((items) =>
                            items.map((it, i) =>
                              i === editingItemIndex
                                ? {
                                    ...it,
                                    discount_amount_override:
                                      v === '' || !Number.isFinite(num) ? undefined : Math.max(0, num),
                                    discount_percent: v === '' || !Number.isFinite(num) ? it.discount_percent : 0,
                                  }
                                : it
                            )
                          )
                        }}
                      />
                    </div>
                  </div>

                  {(pkgItem.selected_services || []).length > 0 && (
                    <div>
                      <Label className="mb-2 block">Services — status & employees (per service)</Label>
                      <div className="space-y-2 max-h-60 overflow-auto">
                        {pkgItem.selected_services.map((svc, svcIdx) => {
                          const currentIds = svc.employee_ids || []
                          const slots = currentIds.length ? currentIds : ['']
                          return (
                            <div key={svcIdx} className="p-2 bg-gray-50 rounded border space-y-2">
                              <div className="text-sm font-medium truncate flex items-center gap-1.5 flex-wrap">
                                {svc.service_name}
                                {(svc.star_points || 0) > 0 && (
                                  <span className="inline-flex items-center text-amber-600 text-xs font-normal shrink-0">
                                    <Star className="h-3 w-3 fill-amber-500" />
                                    {svc.star_points}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatCurrency(svc.distributed_price ?? svc.original_service_price)}
                                {svc.distributed_price != null && svc.distributed_price !== svc.original_service_price && (
                                  <span className="line-through text-gray-300 ml-1">{formatCurrency(svc.original_service_price)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Label className="text-xs text-gray-500">Status</Label>
                                <button
                                  type="button"
                                  onClick={() => togglePackageServicePending(editingItemIndex, svcIdx)}
                                  className={`text-xs px-2 py-1 rounded border font-medium ${
                                    svc.item_status === 'pending'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-amber-50'
                                  }`}
                                >
                                  {getCartItemStatusLabel(svc.item_status)}
                                </button>
                              </div>
                              {slots.map((eid, slotIdx) => (
                                <div key={slotIdx} className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 w-16 shrink-0">E{slotIdx + 1}</span>
                                  <select
                                    className="flex-1 h-8 px-2 text-xs border rounded-md min-w-0"
                                    value={(currentIds[slotIdx] || '').toString()}
                                    onChange={(e) => {
                                      const updated = [...currentIds]
                                      while (updated.length <= slotIdx) updated.push('')
                                      updated[slotIdx] = e.target.value || ''
                                      updatePackageServiceEmployees(editingItemIndex, svcIdx, updated)
                                    }}
                                  >
                                    <option value="">— None —</option>
                                    {employees.filter((emp) => {
                                      const othersSelected = currentIds.filter((id, i) => i !== slotIdx && id).map(String)
                                      return !othersSelected.includes(String(emp.employee_id))
                                    }).map((emp) => (
                                      <option key={emp.employee_id} value={emp.employee_id}>
                                        {emp.full_name}
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 text-red-500"
                                    onClick={() => {
                                      const updated = currentIds.filter((_, i) => i !== slotIdx)
                                      updatePackageServiceEmployees(editingItemIndex, svcIdx, updated.length ? updated : [])
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                  updatePackageServiceEmployees(editingItemIndex, svcIdx, [...currentIds, ''])
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add employee
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <DialogFooter className="gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        handleRemoveItem(editingItemIndex)
                        setEditModalOpen(false)
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Remove Package
                    </Button>
                    <Button onClick={() => setEditModalOpen(false)}>Done</Button>
                  </DialogFooter>
                </div>
              </>
            )
          })()}

          {/* Single Item Edit */}
          {editingItemIndex !== null && cartItems[editingItemIndex]?.item_type !== 'package' && cartItems[editingItemIndex] && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="font-medium text-lg flex items-center gap-2">
                  {cartItems[editingItemIndex]?.item_name}
                  {(cartItems[editingItemIndex]?.star_points ?? 0) > 0 && (
                    <span className="inline-flex items-center text-amber-600 text-sm font-normal">
                      <Star className="h-4 w-4 fill-amber-500" />
                      {cartItems[editingItemIndex].star_points} stars
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="mb-1 block">Price</Label>
                    <Input
                      type="number"
                      min="0"
                      value={cartItems[editingItemIndex]?.unit_price || ''}
                      onChange={(e) =>
                        updateCartItem(
                          editingItemIndex,
                          'unit_price',
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={cartItems[editingItemIndex]?.quantity || 1}
                      onChange={(e) =>
                        updateCartItem(
                          editingItemIndex,
                          'quantity',
                          parseInt(e.target.value) || 1
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block">Discount %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={
                        cartItems[editingItemIndex]?.discount_amount_override != null
                          ? ''
                          : (cartItems[editingItemIndex]?.discount_percent ?? '')
                      }
                      placeholder={
                        cartItems[editingItemIndex]?.discount_amount_override != null ? '—' : '0'
                      }
                      onChange={(e) => {
                        const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                        setCartItems((items) =>
                          items.map((it, i) =>
                            i === editingItemIndex
                              ? { ...it, discount_percent: v, discount_amount_override: undefined }
                              : it
                          )
                        )
                      }}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block">Discount ₹</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        cartItems[editingItemIndex]?.discount_amount_override != null
                          ? cartItems[editingItemIndex].discount_amount_override
                          : ''
                      }
                      placeholder="0"
                      onChange={(e) => {
                        const v = e.target.value
                        const num = parseFloat(v)
                        setCartItems((items) =>
                          items.map((it, i) =>
                            i === editingItemIndex
                              ? {
                                  ...it,
                                  discount_amount_override:
                                    v === '' || !Number.isFinite(num) ? undefined : Math.max(0, num),
                                  discount_percent:
                                    v === '' || !Number.isFinite(num) ? it.discount_percent : 0,
                                }
                              : it
                          )
                        )
                      }}
                    />
                  </div>
                </div>

                {/* Employee assignment — multiple employees allowed for any item */}
                <div>
                  <Label className="mb-2 block">
                    Assign Employee(s) (optional)
                  </Label>
                  {employees.length === 0 ? (
                    <p className="text-sm text-gray-500 p-1">No employees available</p>
                  ) : (
                    <div className="space-y-2">
                      {((currentIds) => (currentIds.length ? currentIds : ['']))(cartItems[editingItemIndex]?.employee_ids || []).map((eid, slotIdx) => (
                        <div key={slotIdx} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-20 shrink-0">Employee {slotIdx + 1}</span>
                          <select
                            className="flex-1 h-9 px-3 text-sm border rounded-md min-w-0"
                            value={((cartItems[editingItemIndex]?.employee_ids || [])[slotIdx] || '').toString()}
                            onChange={(e) => {
                              const currentIds = cartItems[editingItemIndex]?.employee_ids || []
                              const updated = [...currentIds]
                              while (updated.length <= slotIdx) updated.push('')
                              updated[slotIdx] = e.target.value || ''
                              updateCartItem(editingItemIndex, 'employee_ids', updated)
                            }}
                          >
                            <option value="">— None —</option>
                            {employees.filter((emp) => {
                              const currentIds = cartItems[editingItemIndex]?.employee_ids || []
                              const othersSelected = currentIds.filter((id, i) => i !== slotIdx && id).map(String)
                              return !othersSelected.includes(String(emp.employee_id))
                            }).map((emp) => (
                              <option key={emp.employee_id} value={emp.employee_id}>
                                {emp.full_name}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              const currentIds = cartItems[editingItemIndex]?.employee_ids || []
                              const updated = currentIds.filter((_, i) => i !== slotIdx)
                              updateCartItem(editingItemIndex, 'employee_ids', updated.length ? updated : [])
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const currentIds = cartItems[editingItemIndex]?.employee_ids || []
                          updateCartItem(editingItemIndex, 'employee_ids', [...currentIds, ''])
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add employee
                      </Button>
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      handleRemoveItem(editingItemIndex)
                      setEditModalOpen(false)
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Remove
                  </Button>
                  <Button onClick={() => setEditModalOpen(false)}>Done</Button>
                </DialogFooter>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Inline Add Customer Modal */}
      <CustomerModal
        open={addCustomerModalOpen}
        onOpenChange={setAddCustomerModalOpen}
        minimal
        prefill={customerPrefill}
        onCreated={(newCustomer) => {
          handleSelectCustomer(newCustomer)
        }}
      />

      <ConfirmDialog
        open={!!pendingCartItem}
        onOpenChange={(open) => { if (!open) setPendingCartItem(null) }}
        onConfirm={() => {
          if (pendingCartItem) {
            setCartItems((prev) => [...prev, { ...pendingCartItem, item_status: 'pending' }])
            setPendingCartItem(null)
            setSelectedItemId(null)
            setItemPrice('')
            setItemQuantity(1)
            setAddDiscountPercent(0)
            setAddDiscountAmount('')
            setComponentEmployees({})
            setSameEmployeeForAll(false)
            setGlobalEmployee('')
          }
        }}
        title="No Employee Assigned"
        description="No employee has been assigned to this service. It will be added as a pending service, and you can assign who served it later from the bill or from Pending Services."
        confirmLabel="Add as pending"
        autoFocusConfirm
      />

      <ConfirmDialog
        open={skillWarnOpen}
        onOpenChange={setSkillWarnOpen}
        confirmLabel="OK"
        onConfirm={() => setSkillWarnOpen(false)}
        title="Insufficient Skills"
        description={skillWarnMsg}
      />

    </div>
  )
}

export default BillCreatePage
