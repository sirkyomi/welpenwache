export const internshipTemplateQueryKeys = {
  all: ['internship-templates'] as const,
  active: ['internship-templates', 'active'] as const,
  collection: (scope: 'active' | 'all') => ['internship-templates', scope] as const,
}
