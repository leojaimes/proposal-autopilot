export function matchesApifyJobText(raw: Record<string, unknown>, phrase: string): boolean {
  const text = [raw.title, raw.description]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
  const normalizedText = text.toLocaleLowerCase();
  return phrase.split('&&').every((group) => group.split('|').some((candidate) => {
    const normalized = candidate.trim().toLocaleLowerCase();
    if (normalized.length === 0) return false;
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?:^|\\W)${escaped}(?=$|\\W)`).test(normalizedText);
  }));
}
