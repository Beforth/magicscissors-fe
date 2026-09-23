import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, X, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { skillService } from '@/services/skill.service'
import SkillModal from '@/components/modals/SkillModal'
import ConfirmDialog from '@/components/modals/ConfirmDialog'
import { cn } from '@/lib/utils'

function SkillPill({ skill, onEdit, onDeactivate }) {
  return (
    <div
      className="group inline-flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors cursor-pointer"
      onClick={() => onEdit(skill)}
      title="Click to edit"
    >
      <span className="text-sm font-medium text-primary">{skill.name}</span>
      <span className="text-xs text-primary/60">
        {(skill.employee_count ?? 0)}·{(skill.service_count ?? 0)}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDeactivate(skill) }}
        className="rounded-full p-0.5 text-primary/50 hover:bg-primary/20 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
        title="Deactivate skill"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function InactivePill({ skill, onReactivate }) {
  return (
    <div className="inline-flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-full bg-gray-100 border border-gray-200">
      <span className="text-sm text-gray-500 line-through">{skill.name}</span>
      <button
        type="button"
        onClick={() => onReactivate(skill)}
        className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
        title="Reactivate"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default function SkillsPage() {
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editSkill, setEditSkill] = useState(null)
  const [deactivateSkill, setDeactivateSkill] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: () => skillService.getSkills(),
  })
  const skills = data?.data || []
  const active = skills.filter((s) => s.is_active)
  const inactive = skills.filter((s) => !s.is_active)

  const deactivateMutation = useMutation({
    mutationFn: (id) => skillService.deactivateSkill(id),
    onSuccess: () => {
      toast.success('Skill deactivated')
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to deactivate'),
  })

  const reactivateMutation = useMutation({
    mutationFn: (id) => skillService.updateSkill(id, { is_active: true }),
    onSuccess: () => {
      toast.success('Skill reactivated')
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  })

  const handleEdit = (skill) => {
    setEditSkill(skill)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skills</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Define what your employees can do. Each service can require one or more skills, and the system auto-allocates the next available employee with the right skill at billing time.
          </p>
        </div>
        <Button onClick={() => { setEditSkill(null); setModalOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Skill
        </Button>
      </div>

      <Card>
        <CardContent className="py-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : skills.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No skills yet. Click "Add Skill" to create your first one.
            </p>
          ) : (
            <div className="space-y-6">
              {active.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Active</h2>
                    <span className="text-xs text-gray-400">{active.length} skill{active.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {active.map((s) => (
                      <SkillPill
                        key={s.id}
                        skill={s}
                        onEdit={handleEdit}
                        onDeactivate={(skill) => setDeactivateSkill(skill)}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Numbers on each pill: employees · services using this skill.
                  </p>
                </div>
              )}

              {inactive.length > 0 && (
                <div className={cn(active.length > 0 && 'pt-4 border-t')}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Inactive</h2>
                    <span className="text-xs text-gray-400">{inactive.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {inactive.map((s) => (
                      <InactivePill
                        key={s.id}
                        skill={s}
                        onReactivate={(sk) => reactivateMutation.mutate(sk.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <SkillModal
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) setEditSkill(null) }}
        skill={editSkill}
      />

      <ConfirmDialog
        open={!!deactivateSkill}
        onOpenChange={(open) => { if (!open) setDeactivateSkill(null) }}
        title="Deactivate Skill"
        description={`Deactivate "${deactivateSkill?.name}"? Employees and services using this skill will be unaffected but it won't appear for new assignments.`}
        confirmLabel="Deactivate"
        onConfirm={() => { deactivateMutation.mutate(deactivateSkill.id); setDeactivateSkill(null) }}
      />
    </div>
  )
}
