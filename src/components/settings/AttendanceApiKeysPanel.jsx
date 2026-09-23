import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { attendanceApiKeyService } from '@/services/attendanceApiKey.service'
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
import { Key, Plus, Trash2, Loader2, Copy, Check } from 'lucide-react'

export default function AttendanceApiKeysPanel() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [type, setType] = useState('attendance_api')
  const [branchId, setBranchId] = useState('')
  const [newToken, setNewToken] = useState(null)
  const [copied, setCopied] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['attendance-api-keys'],
    queryFn: () => attendanceApiKeyService.listKeys(),
  })
  const keys = Array.isArray(data?.data) ? data.data : []

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })
  const branches = branchesData?.data || []

  const createMutation = useMutation({
    mutationFn: (payload) => attendanceApiKeyService.createKey(payload),
    onSuccess: (res) => {
      const created = res?.data
      setNewToken(created?.token || null)
      setName('')
      setType('attendance_api')
      setBranchId('')
      toast.success('API key created — copy it now; it won’t be shown again.')
      queryClient.invalidateQueries({ queryKey: ['attendance-api-keys'] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to create API key')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id) => attendanceApiKeyService.revokeKey(id),
    onSuccess: () => {
      toast.success('API key revoked')
      queryClient.invalidateQueries({ queryKey: ['attendance-api-keys'] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to revoke API key')
    },
  })

  const handleCreate = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Enter a name for this key')
      return
    }
    createMutation.mutate({
      name: name.trim(),
      type,
      branch_id: branchId || null,
    })
  }

  const handleCopy = async () => {
    if (!newToken) return
    try {
      await navigator.clipboard.writeText(newToken)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — select and copy manually')
    }
  }

  const formatDate = (value) => {
    if (!value) return '—'
    return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Attendance API keys
          </CardTitle>
          <CardDescription>
            Create long-lived bearer tokens for external systems to read attendance or ingest punch data.
            Use as <code className="text-xs bg-gray-100 px-1 rounded">Authorization: Bearer sal_att_…</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="api-key-name">Key name</Label>
              <Input
                id="api-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Payroll export, Punch machine"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key-type">Key type</Label>
              <select
                id="api-key-type"
                className="w-full h-10 px-3 border rounded-md bg-white text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="attendance_api">Attendance API</option>
                <option value="webhook">Webhook (device punch ingest)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key-branch">Branch scope (optional)</Label>
              <select
                id="api-key-branch"
                className="w-full h-10 px-3 border rounded-md bg-white text-sm"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create key
            </Button>
          </form>

          {newToken && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-900">New API key — copy now</p>
              <p className="text-xs text-amber-800">This token is shown once and cannot be retrieved later.</p>
              <div className="flex gap-2">
                <Input readOnly value={newToken} className="font-mono text-xs bg-white" />
                <Button type="button" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-amber-800" onClick={() => setNewToken(null)}>
                Dismiss
              </Button>
            </div>
          )}

          <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
            <p className="font-medium text-gray-800">Allowed endpoints by key type</p>
            <p className="pt-1 font-medium text-gray-700">Attendance API</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><code>GET /api/v1/attendance/today?branch_id=…</code></li>
              <li><code>GET /api/v1/attendance/monthly?branch_id=…&month=YYYY-MM</code></li>
              <li><code>POST /api/v1/attendance/punches</code> (machine ingest)</li>
            </ul>
            <p className="pt-1 font-medium text-gray-700">Webhook</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><code>POST /api/v1/attendance/punches/from-app</code> (device punch ingest)</li>
            </ul>
            <p className="pt-1">Keys do not expire. Revoke any time to disable access.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active keys</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : isError ? (
            <p className="text-center text-red-500 py-8">
              {error?.response?.data?.error?.message || error?.message || 'Failed to load API keys'}
            </p>
          ) : keys.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No API keys yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <Badge variant={key.type === 'webhook' ? 'default' : 'secondary'}>
                        {key.type === 'webhook' ? 'Webhook' : 'Attendance API'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{key.key_prefix}…</code>
                    </TableCell>
                    <TableCell>
                      {key.branch_name ? (
                        <Badge variant="secondary">{key.branch_name}</Badge>
                      ) : (
                        <span className="text-gray-500 text-sm">All branches</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{formatDate(key.last_used_at)}</TableCell>
                    <TableCell className="text-sm text-gray-600">{formatDate(key.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (window.confirm(`Revoke "${key.name}"? Systems using this key will stop working.`)) {
                            revokeMutation.mutate(key.id)
                          }
                        }}
                        disabled={revokeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
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
