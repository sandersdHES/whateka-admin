import { CATEGORIES, PRICE_LEVELS } from './types';

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes && minutes !== 0) return '—';
  const hours = minutes / 60;
  return `${hours.toFixed(1).replace(/\.0$/, '')} h`;
}

export function formatPrice(level: number | null | undefined): string {
  if (!level) return '—';
  return PRICE_LEVELS.find((p) => p.value === level)?.label ?? `${level}`;
}

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .split(',')
    .map((v) => v.trim())
    .map((v) => CATEGORIES.find((c) => c.value === v)?.label ?? v)
    .join(' · ');
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-CH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-CH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked =
    local.length <= 2 ? local[0] + '*' : local.slice(0, 2) + '•'.repeat(Math.max(1, local.length - 3)) + local.slice(-1);
  return `${masked}@${domain}`;
}

export function toIndoorOutdoorLabel(is_indoor: boolean, is_outdoor: boolean | null): string {
  if (is_indoor && is_outdoor) return 'Both';
  if (is_indoor) return 'Indoor';
  if (is_outdoor) return 'Outdoor';
  return '—';
}
