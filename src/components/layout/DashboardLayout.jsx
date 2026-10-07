import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileBottomNav from './MobileBottomNav'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import DocsFirstTimeModal from '@/components/DocsFirstTimeModal'

function DashboardContent() {
  const { collapsed, openMobile } = useSidebar()

  return (
    <div className="min-h-screen bg-transparent">
      <DocsFirstTimeModal />

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div
        className={`flex flex-col min-h-screen transition-[padding-left] duration-200 ease-in-out ${
          collapsed ? 'md:pl-16' : 'md:pl-64'
        }`}
      >
        <Header onMenuClick={openMobile} />

        <main className="flex-1 pb-24 pt-4 sm:pt-6 md:pb-8">
          <div className="w-full px-4 sm:px-6 lg:px-8 page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  )
}

function DashboardLayout() {
  return (
    <SidebarProvider>
      <DashboardContent />
    </SidebarProvider>
  )
}

export default DashboardLayout
