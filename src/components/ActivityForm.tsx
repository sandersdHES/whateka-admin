import { FormEvent, useEffect, useState } from 'react';
import {
  CATEGORIES,
  Category,
  FEATURES,
  PRICE_LEVELS,
  SEASONS,
  SOCIAL_TAGS,
  type Activity,
} from '../lib/types';

export type ActivityFormValues = {
  title: string;
  location_name: string;
  categories: Category[];
  description: string;
  activity_url: string;
  image_url: string;
  latitude: number | '';
  longitude: number | '';
  duration_hours: number | '';
  price_level: number;
  features: string[];
  seasons: string[];
  social_tags: string[];
  is_indoor: boolean;
  is_outdoor: boolean;
};

export function emptyActivityForm(): ActivityFormValues {
  return {
    title: '',
    location_name: '',
    categories: [],
    description: '',
    activity_url: '',
    image_url: '',
    latitude: '',
    longitude: '',
    duration_hours: '',
    price_level: 1,
    features: [],
    seasons: [],
    social_tags: [],
    is_indoor: false,
    is_outdoor: true,
  };
}

export function activityToForm(a: Partial<Activity>): ActivityFormValues {
  const cats = (a.category ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean) as Category[];
  return {
    title: a.title ?? '',
    location_name: a.location_name ?? '',
    categories: cats,
    description: a.description ?? '',
    activity_url: a.activity_url ?? '',
    image_url: a.image_url ?? '',
    latitude: a.latitude ?? '',
    longitude: a.longitude ?? '',
    duration_hours: a.duration_minutes != null ? a.duration_minutes / 60 : '',
    price_level: a.price_level ?? 1,
    features: a.features ?? [],
    seasons: a.seasons ?? [],
    social_tags: a.social_tags ?? [],
    is_indoor: a.is_indoor ?? false,
    is_outdoor: a.is_outdoor ?? true,
  };
}

export function formToPayload(v: ActivityFormValues) {
  return {
    title: v.title.trim(),
    location_name: v.location_name.trim(),
    category: v.categories.join(','),
    description: v.description.trim() || null,
    activity_url: v.activity_url.trim() || null,
    image_url: v.image_url.trim() || null,
    latitude: Number(v.latitude),
    longitude: Number(v.longitude),
    duration_minutes: Math.round(Number(v.duration_hours) * 60),
    price_level: v.price_level,
    features: v.features,
    seasons: v.seasons,
    social_tags: v.social_tags,
    is_indoor: v.is_indoor,
    is_outdoor: v.is_outdoor,
  };
}

function validate(v: ActivityFormValues): string | null {
  if (!v.title.trim()) return 'Le titre est requis.';
  if (!v.location_name.trim()) return 'Le lieu est requis.';
  if (v.categories.length === 0) return 'Sélectionne au moins une catégorie.';
  if (!v.description.trim()) return 'La description est requise.';
  if (v.latitude === '' || v.latitude < -90 || v.latitude > 90)
    return 'Latitude invalide (-90 à 90).';
  if (v.longitude === '' || v.longitude < -180 || v.longitude > 180)
    return 'Longitude invalide (-180 à 180).';
  if (v.duration_hours === '' || Number(v.duration_hours) <= 0)
    return 'Durée invalide.';
  if (v.seasons.length === 0) return 'Sélectionne au moins une saison.';
  if (v.social_tags.length === 0) return 'Sélectionne au moins un tag social.';
  if (!v.is_indoor && !v.is_outdoor)
    return 'Indoor ou Outdoor doit être coché.';
  return null;
}

type Props = {
  initial?: Partial<Activity>;
  submitLabel?: string;
  onSubmit: (values: ActivityFormValues) => Promise<void> | void;
  onCancel?: () => void;
};

export function ActivityForm({
  initial,
  submitLabel = 'Enregistrer',
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState<ActivityFormValues>(emptyActivityForm());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValues(initial ? activityToForm(initial) : emptyActivityForm());
    setError(null);
  }, [initial]);

  function update<K extends keyof ActivityFormValues>(
    k: K,
    value: ActivityFormValues[K],
  ) {
    setValues((v) => ({ ...v, [k]: value }));
  }

  function toggleList<T extends string>(
    list: T[],
    value: T,
  ): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  async function handle(e: FormEvent) {
    e.preventDefault();
    const err = validate(values);
    if (err) return setError(err);
    setError(null);
    setBusy(true);
    try {
      await onSubmit(values);
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Titre *</label>
          <input
            className="input"
            value={values.title}
            onChange={(e) => update('title', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Lieu *</label>
          <input
            className="input"
            value={values.location_name}
            onChange={(e) => update('location_name', e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className="label">Catégories *</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = values.categories.includes(c.value);
            return (
              <label
                key={c.value}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
                  active
                    ? 'border-brand-cyan bg-brand-cyan/10 text-brand-cyan'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={active}
                  onChange={() =>
                    update('categories', toggleList(values.categories, c.value))
                  }
                />
                {c.label}
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label">Description *</label>
        <textarea
          className="input min-h-[120px]"
          value={values.description}
          onChange={(e) => update('description', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">URL de l'activité</label>
          <input
            className="input"
            type="url"
            value={values.activity_url}
            onChange={(e) => update('activity_url', e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="label">URL de l'image</label>
          <input
            className="input"
            type="url"
            value={values.image_url}
            onChange={(e) => update('image_url', e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="label">Latitude *</label>
          <input
            className="input"
            type="number"
            step="any"
            min={-90}
            max={90}
            value={values.latitude}
            onChange={(e) =>
              update('latitude', e.target.value === '' ? '' : Number(e.target.value))
            }
            required
          />
        </div>
        <div>
          <label className="label">Longitude *</label>
          <input
            className="input"
            type="number"
            step="any"
            min={-180}
            max={180}
            value={values.longitude}
            onChange={(e) =>
              update('longitude', e.target.value === '' ? '' : Number(e.target.value))
            }
            required
          />
        </div>
        <div>
          <label className="label">Durée (heures) *</label>
          <input
            className="input"
            type="number"
            step="0.5"
            min={0}
            value={values.duration_hours}
            onChange={(e) =>
              update('duration_hours', e.target.value === '' ? '' : Number(e.target.value))
            }
            required
          />
        </div>
      </div>

      <div>
        <label className="label">Niveau de prix *</label>
        <select
          className="input"
          value={values.price_level}
          onChange={(e) => update('price_level', Number(e.target.value))}
        >
          {PRICE_LEVELS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="label">Informations utiles</legend>
        <div className="grid grid-cols-2 gap-2">
          {FEATURES.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan"
                checked={values.features.includes(f)}
                onChange={() => update('features', toggleList(values.features, f))}
              />
              {f}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Saisons *</legend>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {SEASONS.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan"
                checked={values.seasons.includes(s)}
                onChange={() => update('seasons', toggleList(values.seasons, s))}
              />
              {s}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Tags sociaux *</legend>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {SOCIAL_TAGS.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan"
                checked={values.social_tags.includes(t)}
                onChange={() => update('social_tags', toggleList(values.social_tags, t))}
              />
              {t}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Type (Indoor / Outdoor — au moins un) *</legend>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan"
              checked={values.is_indoor}
              onChange={(e) => update('is_indoor', e.target.checked)}
            />
            Indoor
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan"
              checked={values.is_outdoor}
              onChange={(e) => update('is_outdoor', e.target.checked)}
            />
            Outdoor
          </label>
        </div>
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            Annuler
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Enregistrement...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
