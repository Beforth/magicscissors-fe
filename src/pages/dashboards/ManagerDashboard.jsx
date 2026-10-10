import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import DashboardHero from '@/components/dashboard/DashboardHero'
import InsightsPanel from '@/components/dashboard/InsightsPanel'
import LowStockAlertsCard from '@/components/dashboard/LowStockAlertsCard'

function ManagerDashboard() {
  const { user } = useSelector((state) => state.auth)
  const navigate = useNavigate()

  useEffect(() => {
    if (user && !['manager', 'developer'].includes(user.role)) {
      if (['owner'].includes(user.role)) navigate('/dashboard/owner', { replace: true })
      else if (user.role === 'employee') navigate('/dashboard/employee', { replace: true })
      else if (user.role === 'cashier') navigate('/dashboard/cashier', { replace: true })
    }
  }, [user, navigate])

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <DashboardHero
        name={user?.fullName?.split(' ')[0] || 'Manager'}
        tag={user?.branch?.name || 'Branch'}
        subtitle="Here is your branch at a glance."
      />
      <InsightsPanel />
      <LowStockAlertsCard maxItems={4} />
    </div>
  )
}

export default ManagerDashboard
