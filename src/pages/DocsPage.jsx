import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { docsService } from '@/services/docs.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Youtube,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { getYoutubeEmbedUrl } from '@/lib/utils'

const emptyForm = { title: '', youtube_link: '', description: '' }

export default function DocsPage() {
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })

  const { data, isLoading } = useQuery({
    queryKey: ['docs'],
    queryFn: () => docsService.getDocs(),
    refetchOnWindowFocus: false,
  })
  const docs = data?.data || []

  const createMutation = useMutation({
    mutationFn: (data) => docsService.createDoc(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs'] })
      toast.success('Doc created')
      closeDialog()
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to create'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => docsService.updateDoc(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs'] })
      toast.success('Doc updated')
      closeDialog()
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => docsService.deleteDoc(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs'] })
      toast.success('Doc deleted')
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to delete'),
  })

  function openCreate() {
    setEditingDoc(null)
    setForm({ ...emptyForm })
    setDialogOpen(true)
  }

  function openEdit(doc) {
    setEditingDoc(doc)
    setForm({
      title: doc.title || '',
      youtube_link: doc.youtube_link || '',
      description: doc.description || '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingDoc(null)
    setForm({ ...emptyForm })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }
    const payload = {
      title: form.title.trim(),
      youtube_link: form.youtube_link.trim() || null,
      description: form.description.trim() || null,
    }
    if (editingDoc) {
      updateMutation.mutate({ id: editingDoc.doc_id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Docs & Guides</h1>
          <p className="text-gray-500">
            Tutorials and documentation on how to use the Magic Scissor system
          </p>
        </div>
        {isOwner && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Doc
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : docs.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center text-slate-500">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <FileText className="h-6 w-6" />
          </div>
          <p className="text-base font-bold text-slate-700">No documentation guides yet</p>
          <p className="text-xs text-slate-400 mt-1">Add video guides or tutorials to help your staff</p>
          {isOwner && (
            <Button
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add the first doc
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {docs.map((doc) => (
            <div key={doc.doc_id} className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 hover:shadow-lg transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 shrink-0 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <FileText className="h-4.5 w-4.5" />
                    </div>
                    <h3 className="font-bold text-base text-slate-800 truncate">{doc.title}</h3>
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-xl hover:bg-blue-50 hover:text-blue-600"
                        onClick={() => openEdit(doc)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-xl hover:bg-rose-50 text-rose-600 hover:text-rose-700"
                        onClick={() => {
                          if (window.confirm(`Delete "${doc.title}"?`)) {
                            deleteMutation.mutate(doc.doc_id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {doc.description && (
                  <p className="text-xs sm:text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {doc.description}
                  </p>
                )}

                {doc.youtube_link && (() => {
                  const embedUrl = getYoutubeEmbedUrl(doc.youtube_link)
                  return embedUrl ? (
                    <div className="aspect-video w-full rounded-2xl overflow-hidden border border-slate-200/80 shadow-2xs mt-2 bg-slate-900">
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={doc.title}
                      />
                    </div>
                  ) : (
                    <a
                      href={doc.youtube_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors mt-2"
                    >
                      <Youtube className="h-4 w-4 text-red-600" />
                      Watch Tutorial on YouTube
                    </a>
                  )
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDoc ? 'Edit Doc' : 'Add Doc'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="How to create a bill"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="youtube_link">YouTube Video Link</Label>
              <Input
                id="youtube_link"
                value={form.youtube_link}
                onChange={(e) => setForm({ ...form, youtube_link: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of this guide..."
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingDoc ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
