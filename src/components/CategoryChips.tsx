import { CATEGORY_COLORS } from '../lib/types';
import { categoryLabel } from '../lib/format';

/**
 * Affiche les categories d'une activite sous forme de petites pastilles
 * colorees avec le label complet — pour utilisation inline dans tableaux
 * et listes denses (sans devoir ouvrir la fiche).
 *
 * Extrait de pages/Submissions.tsx (audit 2026-05) pour permettre l'import
 * sans charger l'ensemble du monolithe Submissions (1800+ lignes). L'usage
 * depuis Activities.tsx ou ailleurs doit pointer ici directement.
 */
export function CategoryChips({
  category,
  size = 'sm',
}: {
  category: string | null | undefined;
  size?: 'xs' | 'sm';
}) {
  if (!category) return null;
  const cats = category
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  if (cats.length === 0) return null;

  const padding = size === 'xs' ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
  const text = size === 'xs' ? 'text-[10px]' : 'text-[11px]';

  return (
    <div className="flex flex-wrap gap-1">
      {cats.map((c) => {
        const color = CATEGORY_COLORS[c] ?? '#94a3b8';
        return (
          <span
            key={c}
            className={`inline-flex items-center rounded-full font-semibold text-white ${padding} ${text}`}
            style={{ backgroundColor: color }}
          >
            {categoryLabel(c)}
          </span>
        );
      })}
    </div>
  );
}
