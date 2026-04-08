import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileCog, Plus, SquarePen } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/features/auth/auth-provider'
import { useLanguage } from '@/features/localization/language-provider'
import { ApiError, api } from '@/lib/api'
import type { DocumentTemplate, DocumentTemplatePurpose, LanguagePreference } from '@/lib/types'

interface DocumentTemplateFormState {
  name: string
  purpose: DocumentTemplatePurpose
  language: LanguagePreference
  isActive: boolean
  file: File | null
}

const emptyForm: DocumentTemplateFormState = {
  name: '',
  purpose: 'completion',
  language: 'de',
  isActive: true,
  file: null,
}

const scalarPlaceholders = [
  'first_name',
  'last_name',
  'full_name',
  'salutation',
  'gender',
  'school',
  'notes',
  'start_date',
  'end_date',
  'team',
  'internship_count',
] as const

const assignmentPlaceholders = [
  'team_name',
  'supervisor_name',
  'start_date',
  'end_date',
  'internship_start_date',
  'internship_end_date',
] as const

export function DocumentTemplatesPage() {
  const { token } = useAuth()
  const { formatDate, t } = useLanguage()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null)
  const [form, setForm] = useState<DocumentTemplateFormState>(emptyForm)

  const templatesQuery = useQuery({
    queryKey: ['document-templates'],
    queryFn: () => api.getDocumentTemplates(token!),
    enabled: Boolean(token),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        return null
      }

      if (!editingTemplate && !form.file) {
        throw new Error(t('documentTemplates.fileRequired'))
      }

      if (editingTemplate) {
        return api.updateDocumentTemplate(token, editingTemplate.id, {
          name: form.name,
          purpose: form.purpose,
          language: form.language,
          isActive: form.isActive,
          file: form.file,
        })
      }

      return api.createDocumentTemplate(token, {
        name: form.name,
        purpose: form.purpose,
        language: form.language,
        isActive: form.isActive,
        file: form.file!,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['document-templates'] })
      toast.success(editingTemplate ? t('documentTemplates.updated') : t('documentTemplates.created'))
      setOpen(false)
      setEditingTemplate(null)
      setForm(emptyForm)
    },
    onError: (error) => {
      toast.error(error instanceof ApiError || error instanceof Error ? error.message : t('documentTemplates.saveFailed'))
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async (template: DocumentTemplate) => {
      if (!token) {
        return null
      }

      return api.updateDocumentTemplate(token, template.id, {
        name: template.name,
        purpose: template.purpose,
        language: template.language,
        isActive: !template.isActive,
      })
    },
    onSuccess: async (_, template) => {
      await queryClient.invalidateQueries({ queryKey: ['document-templates'] })
      toast.success(
        template.isActive ? t('documentTemplates.deactivated') : t('documentTemplates.activated'),
      )
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('documentTemplates.statusFailed'))
    },
  })

  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data])

  const openCreate = () => {
    setEditingTemplate(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (template: DocumentTemplate) => {
    setEditingTemplate(template)
    setForm({
      name: template.name,
      purpose: template.purpose,
      language: template.language,
      isActive: template.isActive,
      file: null,
    })
    setOpen(true)
  }

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t('documentTemplates.title')}</CardTitle>
            <CardDescription>{t('documentTemplates.description')}</CardDescription>
          </div>
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen)

              if (!nextOpen) {
                setEditingTemplate(null)
                setForm(emptyForm)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {t('documentTemplates.create')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? t('documentTemplates.editTitle') : t('documentTemplates.createTitle')}
                </DialogTitle>
                <DialogDescription>{t('documentTemplates.formDescription')}</DialogDescription>
              </DialogHeader>

              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  void saveMutation.mutateAsync()
                }}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">{t('documentTemplates.name')}</Label>
                    <Input
                      id="template-name"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-language">{t('documentTemplates.language')}</Label>
                    <Select
                      value={form.language}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, language: value as LanguagePreference }))
                      }
                    >
                      <SelectTrigger id="template-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="de">{t('language.german')}</SelectItem>
                        <SelectItem value="en">{t('language.english')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="template-purpose">{t('documentTemplates.purpose')}</Label>
                    <Select
                      value={form.purpose}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, purpose: value as DocumentTemplatePurpose }))
                      }
                    >
                      <SelectTrigger id="template-purpose">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completion">{t('documentTemplates.purposeCompletion')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-file">
                      {editingTemplate ? t('documentTemplates.replaceFile') : t('documentTemplates.file')}
                    </Label>
                    <Input
                      id="template-file"
                      type="file"
                      accept=".docx"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          file: event.target.files?.[0] ?? null,
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {editingTemplate
                        ? t('documentTemplates.fileOptional', {
                            fileName: editingTemplate.originalFileName,
                          })
                        : t('documentTemplates.fileHint')}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 p-4">
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={form.isActive}
                      onCheckedChange={(checked) =>
                        setForm((current) => ({ ...current, isActive: checked === true }))
                      }
                    />
                    {t('documentTemplates.active')}
                  </label>
                </div>

                <Button className="w-full" type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? t('common.saving') : t('common.save')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/70 bg-card/80 lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('documentTemplates.placeholdersTitle')}</CardTitle>
              <CardDescription>{t('documentTemplates.placeholdersDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('documentTemplates.placeholdersSimple')}</p>
                <div className="flex flex-wrap gap-2">
                  {scalarPlaceholders.map((placeholder) => (
                    <code
                      key={placeholder}
                      className="rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-xs"
                    >
                      {`{{${placeholder}}}`}
                    </code>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">{t('documentTemplates.placeholdersAssignments')}</p>
                <div className="flex flex-wrap gap-2">
                  {assignmentPlaceholders.map((placeholder) => (
                    <code
                      key={placeholder}
                      className="rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-xs"
                    >
                      {`{{.${placeholder}}}`}
                    </code>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('documentTemplates.placeholdersLoopTitle')}</p>
                  <pre className="overflow-x-auto rounded-2xl border border-border/70 bg-background/80 p-4 text-xs leading-6 text-muted-foreground">
{`{{#team_assignments}}
- {{.team_name}} ({{.start_date}} - {{.end_date}})
{{/team_assignments}}`}
                  </pre>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('documentTemplates.placeholdersHintsTitle')}</p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>{t('documentTemplates.placeholdersHintRoot')}</p>
                    <p>{t('documentTemplates.placeholdersHintLoop')}</p>
                    <p>{t('documentTemplates.placeholdersHintFallback')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {templatesQuery.isPending ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-5 text-sm text-muted-foreground">
              {t('documentTemplates.loading')}
            </div>
          ) : null}

          {templatesQuery.isError ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-5 text-sm text-muted-foreground">
              {t('documentTemplates.loadFailed')}
            </div>
          ) : null}

          {!templatesQuery.isPending && !templatesQuery.isError && templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-5 text-sm text-muted-foreground">
              {t('documentTemplates.empty')}
            </div>
          ) : null}

          {!templatesQuery.isPending && !templatesQuery.isError
            ? templates.map((template) => (
            <Card key={template.id} className="border-border/70 bg-card/80">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileCog className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle>{template.name}</CardTitle>
                        <CardDescription>{template.relativeFilePath}</CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={template.isActive ? 'default' : 'secondary'}>
                        {template.isActive ? t('documentTemplates.statusActive') : t('documentTemplates.statusInactive')}
                      </Badge>
                      <Badge variant="outline">
                        {template.language === 'de' ? t('language.german') : t('language.english')}
                      </Badge>
                      <Badge variant="outline">{t('documentTemplates.purposeCompletion')}</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(template)}>
                    <SquarePen className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 rounded-2xl border border-border/70 bg-background/60 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="font-medium">{t('documentTemplates.originalFile')}</p>
                    <p className="text-muted-foreground">{template.originalFileName}</p>
                  </div>
                  <div>
                    <p className="font-medium">{t('documentTemplates.uploadedAt')}</p>
                    <p className="text-muted-foreground">{formatDate(template.uploadedUtc)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void toggleStatusMutation.mutateAsync(template)}
                    disabled={toggleStatusMutation.isPending}
                  >
                    {template.isActive ? t('documentTemplates.deactivate') : t('documentTemplates.activate')}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => openEdit(template)}>
                    {t('common.edit')}
                  </Button>
                </div>
              </CardContent>
            </Card>
              ))
            : null}
        </CardContent>
      </Card>
    </section>
  )
}
