import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery } from '@tanstack/react-query'
import { userService } from '@/services/user.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Scissors, Loader2, ChevronDown } from 'lucide-react'
import { formatDate } from '@/lib/utils'

function EmployeeDashboard() {
  const { user } = useSelector((state) => state.auth)
  const [offset, setOffset] = useState(0)
  const [allServices, setAllServices] = useState([])
  const limit = 10

  const { data, isLoading } = useQuery({
    queryKey: ['my-services', offset],
    queryFn: () => userService.getMyServices({ limit, offset }),
    onSuccess: (res) => {
      const newServices = res?.data || []
      if (offset === 0) {
        setAllServices(newServices)
      } else {
        setAllServices((prev) => [...prev, ...newServices])
      }
    },
  })

  // Fallback for react-query v5 where onSuccess is deprecated
  const services = data?.data || []
  const pagination = data?.pagination || {}
  const displayServices = offset === 0 ? services : allServices

  const handleLoadMore = () => {
    setOffset((prev) => prev + limit)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hello, {user?.fullName || 'Employee'}
        </h1>
        <p className="text-gray-500">
          {user?.branch?.name || 'Branch'} - Your recent services
        </p>
      </div>

      {/* Recent Services */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Recent Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && offset === 0 ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : displayServices.length === 0 ? (
            <p className="text-center text-gray-500 py-10">No services found</p>
          ) : (
            <div className="space-y-2">
              {displayServices.map((service, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{service.item_name}</p>
                    <p className="text-sm text-gray-500">{service.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{formatDate(service.date)}</p>
                  </div>
                </div>
              ))}

              {/* Load More */}
              {pagination.has_more && (
                <div className="pt-4 text-center">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    )}
                    Load More
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default EmployeeDashboard
