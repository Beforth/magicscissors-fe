import { useNavigate } from 'react-router-dom'
import { useState, useMemo } from 'react'
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
import PackageCategoryModal from '@/components/modals/PackageCategoryModal'
import { formatCurrency, cn } from '@/lib/utils'
import { Package, Plus, Loader2, Pencil, Calendar, Tag, Search, FolderPlus, ChevronDown } from 'lucide-react'

function PackagesPage() {
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['packages'],
    queryFn: () => serviceService.getPackages(),
  })

  const packages = data?.data || []

  // Filter by search
  const filteredPackages = useMemo(() => {
    if (!search.trim()) return packages
    const q = search.toLowerCase()
    return packages.filter((pkg) => pkg.package_name.toLowerCase().includes(q))
  }, [packages, search])

  // Group packages by category
  const groupedPackages = useMemo(() => {
    const categoryMap = new Map()

    filteredPackages.forEach((pkg) => {
      const catId = pkg.category?.category_id || 'uncategorized'
      const catName = pkg.category?.name || 'Uncategorized'
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, { category_id: catId, category_name: catName, packages: [] })
      }
      categoryMap.get(catId).packages.push(pkg)
    })

    return Array.from(categoryMap.values())
  }, [filteredPackages])

  // Collapsed/expanded state — all expanded by default
  const [collapsedCategories, setCollapsedCategories] = useState({})

  const toggleCategory = (categoryId) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }))
  }

  const handleAddPackage = () => navigate('/packages/new')

  const handleEditPackage = (pkg) => navigate(`/packages/${pkg.package_id}/edit`)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Packages</h1>
          <p className="text-gray-500">Create and manage service packages</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setCategoryModalOpen(true)}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Manage Categories
          </Button>
          <Button onClick={handleAddPackage}>
            <Plus className="h-4 w-4 mr-2" />
            Create Package
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search packages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Packages by Category */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-10 text-red-500">
          Error loading packages. Please try again.
        </div>
      ) : filteredPackages.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No packages found.</p>
              <Button className="mt-4" onClick={handleAddPackage}>
                Create Your First Package
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        groupedPackages.map((group) => {
          const isCollapsed = collapsedCategories[group.category_id]

          return (
            <Card key={group.category_id}>
              {/* Category Header */}
              <div
                className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-gray-50 border-b"
                onClick={() => toggleCategory(group.category_id)}
              >
                <div className="flex items-center gap-2">
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isCollapsed && '-rotate-90'
                    )}
                  />
                  <span className="font-semibold text-gray-900">{group.category_name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {group.packages.length}
                  </Badge>
                </div>
              </div>

              {/* Collapsible Table */}
              {!isCollapsed && (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Package Name</TableHead>
                        <TableHead>Services</TableHead>
                        <TableHead>Individual Price</TableHead>
                        <TableHead>Package Price</TableHead>
                        <TableHead>Savings</TableHead>
                        <TableHead>Validity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.packages.map((pkg) => (
                        <TableRow key={pkg.package_id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-primary" />
                              {pkg.package_name}
                            </div>
                            {pkg.description && (
                              <p className="text-xs text-gray-500 mt-1">{pkg.description}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {pkg.services?.slice(0, 3).map((s, i) => (
                                <Badge key={i} variant="outline" className="text-xs mr-1">
                                  {s.service_name} &times; {s.quantity}
                                </Badge>
                              ))}
                              {pkg.services?.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{pkg.services.length - 3} more
                                </Badge>
                              )}
                            </div>
                            {pkg.total_services > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                {pkg.total_services} services total
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {pkg.individual_price > 0 ? formatCurrency(pkg.individual_price) : '—'}
                          </TableCell>
                          <TableCell className="font-bold text-primary">
                            {pkg.package_price != null
                              ? formatCurrency(pkg.package_price)
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {pkg.savings > 0 ? (
                              <Badge variant="success" className="bg-green-100 text-green-700">
                                <Tag className="h-3 w-3 mr-1" />
                                Save {formatCurrency(pkg.savings)}
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-gray-600">
                              <Calendar className="h-3 w-3" />
                              {pkg.validity_days} days
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={pkg.is_active ? 'success' : 'secondary'}>
                              {pkg.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPackage(pkg)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          )
        })
      )}

      {/* Modals */}
      <PackageCategoryModal
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
      />
    </div>
  )
}

export default PackagesPage
