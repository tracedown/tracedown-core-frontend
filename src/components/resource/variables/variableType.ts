import type { VariableSummary, VariableType } from '@/data/variables/VariableDto';

/** `t()` as the variables UI uses it — key in, translated string out. */
type Translate = (key: string) => string;

/** Badge text of a variable's type; system variables collapse to one label. */
export function variableTypeLabel(variable: VariableSummary, t: Translate): string {
  if (variable.systemType) return t('variables.typeSystem');
  const labels: Record<VariableType, string> = {
    secret: t('variables.typeSecret'),
    variable: t('variables.typeVariable'),
    metric: t('variables.typeMetric'),
  };
  return labels[variable.type];
}

/** Badge colours matching `variableTypeLabel`. */
export function variableTypeClasses(variable: VariableSummary): string {
  if (variable.systemType) return 'bg-text-secondary/30 text-text-secondary';
  const classes: Record<VariableType, string> = {
    secret: 'bg-status-failure/10 text-status-failure',
    variable: 'bg-accent-primary/10 text-accent-primary',
    // accent-secondary (#3c3c3c) is invisible on dark surfaces — use the
    // bright blue text token instead.
    metric: 'bg-text-primary/10 text-text-primary',
  };
  return classes[variable.type];
}
