/**
 * Formatea una fecha o string ISO en tiempo relativo amigable (ej: "Hace 2 h", "Hace 1 d").
 */
export function formatRelativeTime(dateInput?: string | Date | null): string {
  if (!dateInput) return 'Reciente';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'Reciente';

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0 || diffMs < 60_000) return 'Hace un momento';

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `Hace ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `Hace ${diffDays} d`;

  const diffMonths = Math.floor(diffDays / 30);
  return `Hace ${diffMonths} m`;
}

/**
 * Retorna el timestamp numérico (epoch ms) para ordenamiento cronológico. Retorna 0 si es nula o inválida.
 */
export function getTimestampOrZero(dateInput?: string | Date | null): number {
  if (!dateInput) return 0;
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const time = date.getTime();
  return isNaN(time) ? 0 : time;
}

