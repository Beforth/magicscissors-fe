import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { branchService } from '@/services/branch.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BranchColorDot } from '@/components/ui/branch-color-dot'
import { Building2, Plus, Loader2, MapPin, Phone, Mail, Pencil } from 'lucide-react'

function BranchesPage() {
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })

  const branches = data?.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
          <p className="text-gray-500">Manage your salon branches</p>
        </div>
        <Button onClick={() => navigate('/branches/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Branch
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Branches
            <Badge variant="secondary" className="ml-2">
              {branches.length} branches
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
              Error loading branches. Please try again.
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No branches found.</p>
              <Button className="mt-4" onClick={() => navigate('/branches/new')}>
                Add Your First Branch
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.branch_id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2 flex-wrap">
                        <BranchColorDot color={branch.color_code} className="w-3 h-3" />
                        {!branch.color_code && <Building2 className="h-4 w-4 text-gray-400" />}
                        <span>{branch.name}</span>
                        {branch.is_warehouse && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-800">
                            Warehouse
                          </span>
                        )}
                        {!branch.is_salon && branch.is_warehouse && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                            no salon
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{branch.code}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {branch.address && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <MapPin className="h-3 w-3" />
                            {branch.address}
                          </div>
                        )}
                        {branch.city && (
                          <div className="text-gray-500">
                            {branch.city}{branch.state ? `, ${branch.state}` : ''}
                            {branch.pincode ? ` - ${branch.pincode}` : ''}
                          </div>
                        )}
                        {!branch.address && !branch.city && '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        {branch.phone && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Phone className="h-3 w-3" />
                            {branch.phone}
                          </div>
                        )}
                        {branch.email && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Mail className="h-3 w-3" />
                            {branch.email}
                          </div>
                        )}
                        {!branch.phone && !branch.email && '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={branch.is_active ? 'success' : 'secondary'}>
                        {branch.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/branches/${branch.branch_id}/edit`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default BranchesPage
