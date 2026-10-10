import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { serviceService } from '@/services/service.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import CategoryModal from '@/components/modals/CategoryModal'
import { formatCurrency, cn } from '@/lib/utils'
import { Plus, Search, Scissors, Loader2, Star, Pencil, FolderPlus, ChevronDown } from 'lucide-react'

function ServicesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['services', { search }],
    queryFn: () => serviceService.getServices({
      search,
      is_active: 'true',
    }),
  })

  const services = data?.data || []

  const groupedServices = useMemo(() => {
    const categoryMap = new Map()

    services.forEach((service) => {
      const catId = service.category?.category_id || 'uncategorized'
      const catName = service.category?.category_name || 'Uncategorized'
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, { category_id: catId, category_name: catName, services: [] })
      }
      categoryMap.get(catId).services.push(service)
    })

    return Array.from(categoryMap.values())
  }, [services])

  const [collapsedCategories, setCollapsedCategories] = useState({})

  const toggleCategory = (categoryId) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-500">Manage your service catalog</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setCategoryModalOpen(true)}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Manage Categories
          </Button>
          <Button onClick={() => navigate('/services/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search services..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Service Catalog
            <Badge variant="secondary" className="ml-2">
              {services.length} services
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-10 text-red-500">
              Error loading services. Please try again.
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Scissors className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No services found.</p>
              <Button className="mt-4" onClick={() => navigate('/services/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Add your first service
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {groupedServices.map((group) => {
                const isCollapsed = collapsedCategories[group.category_id]
                return (
                  <div key={group.category_id} className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleCategory(group.category_id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition-transform',
                            isCollapsed && '-rotate-90'
                          )}
                        />
                        <span className="font-semibold text-sm">{group.category_name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {group.services.length}
                        </Badge>
                      </div>
                    </button>

                    {!isCollapsed && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Service Name</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Employee Type</TableHead>
                            <TableHead>Star Points</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.services.map((service) => (
                            <TableRow key={service.service_id}>
                              <TableCell className="font-medium">
                                {service.service_name}
                              </TableCell>
                              <TableCell className="font-bold">
                                {formatCurrency(service.price)}
                              </TableCell>
                              <TableCell>
                                {service.duration_minutes
                                  ? `${service.duration_minutes} min`
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={service.is_multi_employee ? 'default' : 'outline'}>
                                  {service.is_multi_employee
                                    ? (service.employee_count ? `Multiple (${service.employee_count})` : 'Multiple')
                                    : 'Single'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  <Star className="h-4 w-4 mr-1 text-yellow-500 fill-yellow-500" />
                                  {service.star_points}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={service.is_active ? 'success' : 'secondary'}>
                                  {service.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/services/${service.service_id}/edit`)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CategoryModal
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
      />
    </div>
  )
}

export default ServicesPage
