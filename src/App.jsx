import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './components/layout/DashboardLayout'
import OwnerDashboard from './pages/dashboards/OwnerDashboard'
import ManagerDashboard from './pages/dashboards/ManagerDashboard'
import CashierDashboard from './pages/dashboards/CashierDashboard'
import EmployeeDashboard from './pages/dashboards/EmployeeDashboard'
import CustomersPage from './pages/CustomersPage'
import CustomerDetailPage from './pages/CustomerDetailPage'
import BillsPage from './pages/BillsPage'
import BillCreatePage from './pages/BillCreatePage'
import BillDetailPage from './pages/BillDetailPage'
import ServicesPage from './pages/ServicesPage'
import ServiceFormPage from './pages/ServiceFormPage'
import PackagesPage from './pages/PackagesPage'
import ProductsPage from './pages/ProductsPage'
import ProductFormPage from './pages/ProductFormPage'
import InventoryPage from './pages/InventoryPage'
import StockTransfersPage from './pages/StockTransfersPage'
import ReportsPage from './pages/ReportsPage'
import BranchesPage from './pages/BranchesPage'
import BranchFormPage from './pages/BranchFormPage'
import StaffPage from './pages/StaffPage'
import StaffFormPage from './pages/StaffFormPage'
import StaffPerformancePage from './pages/StaffPerformancePage'
import SettingsPage from './pages/SettingsPage'
import CashReconciliationPage from './pages/CashReconciliationPage'
import ExpensesPage from './pages/ExpensesPage'
import ChairManagementPage from './pages/ChairManagementPage'
import SavingsPotsPage from './pages/SavingsPotsPage'
import CounterWithdrawalsPage from './pages/CounterWithdrawalsPage'
import UpiAccountsPage from './pages/UpiAccountsPage'
import MaintenancePage from './pages/MaintenancePage'
import SuppliersPage from './pages/SuppliersPage'
import PurchaseBatchesPage from './pages/PurchaseBatchesPage'
import PurchaseBatchCreatePage from './pages/PurchaseBatchCreatePage'
import PurchaseBatchDetailPage from './pages/PurchaseBatchDetailPage'
import BankDepositsPage from './pages/BankDepositsPage'
import EmployeeStatusPage from './pages/EmployeeStatusPage'
import VersionHistoryPage from './pages/VersionHistoryPage'
import JobsPage from './pages/JobsPage'
import MachinesPage from './pages/MachinesPage'
import ShiftPage from './pages/ShiftPage'
import ShiftAssignmentsPage from './pages/ShiftAssignmentsPage'
import AttendancePage from './pages/AttendancePage'
import SkillsPage from './pages/SkillsPage'
import TokensPage from './pages/TokensPage'
import SkusPage from './pages/SkusPage'
import BarcodePrintPage from './pages/BarcodePrintPage'
import WarehousesPage from './pages/WarehousesPage'
import WarehouseCreatePage from './pages/WarehouseCreatePage'
import DocsPage from './pages/DocsPage'
import ProtectedRoute from './components/auth/ProtectedRoute'

function App() {
  const { isAuthenticated, user } = useSelector((state) => state.auth)

  const getDashboardByRole = () => {
    if (!user) return '/dashboard/owner'
    switch (user.role) {
      case 'owner':
      case 'developer':
        return '/dashboard/owner'
      case 'manager':
        return '/dashboard/manager'
      case 'cashier':
        return '/dashboard/cashier'
      case 'employee':
        return '/dashboard/employee'
      default:
        return '/dashboard/owner'
    }
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={getDashboardByRole()} replace /> : <LoginPage />}
      />

      <Route
        path="/version-history"
        element={
          <ProtectedRoute>
            <VersionHistoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={getDashboardByRole()} replace />} />

        {/* Dashboards */}
        <Route path="dashboard/owner" element={<OwnerDashboard />} />
        <Route path="dashboard/manager" element={<ManagerDashboard />} />
        <Route path="dashboard/cashier" element={<CashierDashboard />} />
        <Route path="dashboard/employee" element={<EmployeeDashboard />} />

        {/* Main pages */}
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="chairs" element={<ChairManagementPage />} />
        <Route path="bills" element={<BillsPage />} />
        <Route path="bills/new" element={<BillCreatePage />} />
        <Route path="bills/:id" element={<BillDetailPage />} />
        <Route path="shifts" element={<ShiftPage />} />
        <Route path="shifts/assignments/:date" element={<ShiftAssignmentsPage />} />
        <Route path="employee-status" element={<EmployeeStatusPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/new" element={<ServiceFormPage />} />
        <Route path="services/:id/edit" element={<ServiceFormPage />} />
        <Route path="packages" element={<PackagesPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<ProductFormPage />} />
        <Route path="products/:id/edit" element={<ProductFormPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory/transfers" element={<StockTransfersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="branches/new" element={<BranchFormPage />} />
        <Route path="branches/:id/edit" element={<BranchFormPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="staff/new" element={<StaffFormPage />} />
        <Route path="staff/:id/edit" element={<StaffFormPage />} />
        <Route path="staff-performance" element={<StaffPerformancePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="cash-reconciliation" element={<CashReconciliationPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="savings-pots" element={<SavingsPotsPage />} />
        <Route path="counter-withdrawals" element={<CounterWithdrawalsPage />} />
        <Route path="upi-accounts" element={<UpiAccountsPage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="bank-deposits" element={<BankDepositsPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="purchase-batches" element={<PurchaseBatchesPage />} />
        <Route path="purchase-batches/new" element={<PurchaseBatchCreatePage />} />
        <Route path="purchase-batches/:id" element={<PurchaseBatchDetailPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="machines" element={<MachinesPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="tokens" element={<TokensPage />} />
        <Route path="skus" element={<SkusPage />} />
        <Route path="barcode-print" element={<BarcodePrintPage />} />
        <Route path="warehouses" element={<WarehousesPage />} />
        <Route path="warehouses/new" element={<WarehouseCreatePage />} />
        <Route path="docs" element={<DocsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
