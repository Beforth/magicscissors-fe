import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { geofenceService } from '@/services/geofence.service'
import { branchService } from '@/services/branch.service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MapPin, Plus, Pencil, Trash2, Loader2, LocateFixed } from 'lucide-react'

const EMPTY_FORM = { name: '', latitude: '', longitude: '', radius_m: '100', is_active: true }

export default function GeofencePanel() {
  const queryClient = useQueryClient()
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [locating, setLocating] = useState(false)

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })
  const branches = branchesData?.data || []
  const branchId = selectedBranchId || branches[0]?.branch_id || ''

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['geofences', branchId],
    queryFn: () => geofenceService.list(branchId),
    enabled: !!branchId,
  })
  const geofences = Array.isArray(data?.data?.geofences) ? data.data.geofences : []
  const requireSelfie = !!data?.data?.require_selfie

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['geofences'] })
  const onError = (fallback) => (err) =>
    toast.error(err.response?.data?.error?.message || fallback)

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }) =>
      id ? geofenceService.update(id, payload) : geofenceService.create(payload),
    onSuccess: (_res, vars) => {
      toast.success(vars.id ? 'Location updated' : 'Location added')
      setDialogOpen(false)
      invalidate()
    },
    onError: onError('Failed to save location'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => geofenceService.remove(id),
    onSuccess: () => {
      toast.success('Location deleted')
      invalidate()
    },
    onError: onError('Failed to delete location'),
  })

  const settingsMutation = useMutation({
    mutationFn: (payload) => geofenceService.updateSettings(payload),
    onSuccess: () => {
      toast.success('Setting saved')
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: onError('Failed to update setting'),
  })

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (g) => {
    setEditing(g)
    setForm({
      name: g.name,
      latitude: String(g.latitude),
      longitude: String(g.longitude),
      radius_m: String(g.radius_m),
      is_active: !!g.is_active,
    })
    setDialogOpen(true)
  }

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }))
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        toast.error(err?.message || 'Could not get your location')
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const name = form.name.trim()
    const latitude = Number(form.latitude)
    const longitude = Number(form.longitude)
    const radius = Number(form.radius_m)
    if (!name) return toast.error('Enter a location name')
    if (form.latitude === '' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return toast.error('Latitude must be between -90 and 90')
    }
    if (form.longitude === '' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return toast.error('Longitude must be between -180 and 180')
    }
    if (form.radius_m === '' || !Number.isInteger(radius) || radius < 5 || radius > 5000) {
      return toast.error('Radius must be a whole number between 5 and 5000 metres')
    }
    const payload = { name, latitude, longitude, radius_m: radius, is_active: form.is_active }
    if (!editing) payload.branch_id = branchId
    saveMutation.mutate({ id: editing?.id, payload })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Geofence attendance
          </CardTitle>
          <CardDescription>
            Staff can punch only within the radius of an active location.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="geofence-branch">Branch</Label>
            <select
              id="geofence-branch"
              className="w-full h-10 px-3 border rounded-md bg-white text-sm"
              value={branchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg gap-4">
            <div>
              <p className="font-medium">Require Live Photo &amp; GPS Capture</p>
              <p className="text-sm text-gray-500">
                When enabled, employees must take a live photo/selfie to check in or out. Their
                location coordinates and timestamp will be captured and watermarked on the photo.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-medium">{requireSelfie ? 'ON' : 'OFF'}</span>
              <input
                type="checkbox"
                className="h-5 w-5 rounded"
                checked={requireSelfie}
                disabled={!branchId || settingsMutation.isPending}
                onChange={(e) => settingsMutation.mutate({ require_selfie: e.target.checked })}
              />
            </div>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Locations</CardTitle>
            <Button size="sm" onClick={openAdd} disabled={!branchId}>
              <Plus className="h-4 w-4 mr-1" />
              Add location
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!branchId ? (
            <p className="text-center text-gray-500 py-8">No branches available.</p>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : isError ? (
            <p className="text-center text-red-500 py-8">
              {error?.response?.data?.error?.message || error?.message || 'Failed to load locations'}
            </p>
          ) : geofences.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No locations yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location name</TableHead>
                  <TableHead>Latitude</TableHead>
                  <TableHead>Longitude</TableHead>
                  <TableHead>Radius</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {geofences.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell>{g.latitude}</TableCell>
                    <TableCell>{g.longitude}</TableCell>
                    <TableCell>{g.radius_m} m</TableCell>
                    <TableCell>
                      <Badge variant={g.is_active ? 'default' : 'secondary'}>
                        {g.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete "${g.name}"?`)) deleteMutation.mutate(g.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit location' : 'Add location'}</DialogTitle>
              <DialogDescription>
                Staff can punch only within the radius of an active location.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="geofence-name">Location name</Label>
              <Input
                id="geofence-name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Main salon"
              />
            </div>

            <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={locating}>
              {locating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LocateFixed className="h-4 w-4 mr-2" />
              )}
              Use my current location
            </Button>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="geofence-lat">Latitude</Label>
                <Input
                  id="geofence-lat"
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => setField('latitude', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="geofence-lng">Longitude</Label>
                <Input
                  id="geofence-lng"
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => setField('longitude', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="geofence-radius">Radius (metres)</Label>
              <Input
                id="geofence-radius"
                type="number"
                min="5"
                max="5000"
                value={form.radius_m}
                onChange={(e) => setField('radius_m', e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                checked={form.is_active}
                onChange={(e) => setField('is_active', e.target.checked)}
              />
              <span>Active</span>
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Save changes' : 'Add location'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
