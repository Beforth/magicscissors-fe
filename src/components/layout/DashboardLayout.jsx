import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileBottomNav from './MobileBottomNav'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import DocsFirstTimeModal from '@/components/DocsFirstTimeModal'
import CommandCenter from './CommandCenter'
import LicenseBanner from './LicenseBanner'
import InstallAppBanner from '@/components/InstallAppBanner'

function DashboardContent() {
  const { collapsed, openMobile } = useSidebar()

  return (
    <div className="min-h-screen bg-transparent">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <DocsFirstTimeModal />
      <CommandCenter />

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div
        className={`flex flex-col min-h-screen transition-[padding-left] duration-200 ease-in-out ${
          collapsed ? 'md:pl-16' : 'md:pl-64'
        }`}
      >
        <LicenseBanner />
        <InstallAppBanner />
        <Header onMenuClick={openMobile} />

        <main id="main-content" tabIndex={-1} className="flex-1 outline-none pb-24 pt-4 sm:pt-6 md:pb-8">
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
