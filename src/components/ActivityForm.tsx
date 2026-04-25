import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import {
  CATEGORIES,
  Category,
  FEATURES,
  PRICE_LEVELS,
  SEASONS,
  SOCIAL_TAGS,
  type Activity,
} from '../lib/types';

// Fix l'icone de marqueur par defaut Leaflet (probleme de URL avec Vite)
const _markerIcon = L.divIcon({
  html: '<div style="width:24px;height:24px;background:#FF6F61;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3);"></div>',
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function _MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function _MapCenterUpdater({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
}


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
  date_label: string;
  date_start: string;
  date_end: string;
  recurrence_type: '' | 'one_off' | 'weekly' | 'seasonal';
  seasonal_months: number[];
  weekly_days: number[];
  update_frequency: '' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'before_season' | 'manual';
  next_update_at: string;
  update_notes: string;
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
    date_label: '',
    date_start: '',
    date_end: '',
    recurrence_type: '',
    seasonal_months: [],
    weekly_days: [],
    update_frequency: '',
    next_update_at: '',
    update_notes: '',
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
    date_label: (a as any).date_label ?? '',
    date_start: (a as any).date_start ?? '',
    date_end: (a as any).date_end ?? '',
    recurrence_type: ((a as any).recurrence_type ?? '') as ActivityFormValues['recurrence_type'],
    seasonal_months: (a as any).seasonal_months ?? [],
    weekly_days: (a as any).weekly_days ?? [],
    update_frequency: ((a as any).update_frequency ?? '') as ActivityFormValues['update_frequency'],
    next_update_at: (a as any).next_update_at ?? '',
    update_notes: (a as any).update_notes ?? '',
  };
}

export function formToPayload(v: ActivityFormValues) {
  const hasDateConstraint =
    v.date_label.trim() !== '' ||
    v.date_start !== '' ||
    v.date_end !== '' ||
    v.recurrence_type !== '' ||
    v.seasonal_months.length > 0 ||
    v.weekly_days.length > 0;

  // Auto-coche "Horaires restreints" si une contrainte temporelle est définie
  let features = v.features;
  if (hasDateConstraint && !features.includes('Horaires restreints')) {
    features = [...features, 'Horaires restreints'];
  }

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
    features,
    seasons: v.seasons,
    social_tags: v.social_tags,
    is_indoor: v.is_indoor,
    is_outdoor: v.is_outdoor,
    date_label: v.date_label.trim() || null,
    date_start: v.date_start || null,
    date_end: v.date_end || null,
    recurrence_type: v.recurrence_type || null,
    seasonal_months: v.seasonal_months.length > 0 ? v.seasonal_months : null,
    weekly_days: v.weekly_days.length > 0 ? v.weekly_days : null,
    update_frequency: v.update_frequency || null,
    next_update_at: v.next_update_at || null,
    update_notes: v.update_notes.trim() || null,
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

export type ExtraAction = {
  label: string;
  icon?: ReactNode;
  color: 'emerald' | 'amber' | 'rose' | 'sky';
  /**
   * Appelé après la sauvegarde réussie du formulaire. Reçoit les valeurs.
   * Si rejette, l'action n'est pas executée mais le save est conserve.
   */
  onClick: (values: ActivityFormValues) => Promise<void> | void;
};

type Props = {
  initial?: Partial<Activity>;
  submitLabel?: string;
  onSubmit: (values: ActivityFormValues) => Promise<void> | void;
  onCancel?: () => void;
  /**
   * Actions additionnelles affichees dans le footer du formulaire
   * (ex: Approuver / Mettre en attente / Rejeter pour les soumissions).
   * Chaque action sauvegarde d'abord les valeurs puis execute son callback.
   */
  extraActions?: ExtraAction[];
};

export function ActivityForm({
  initial,
  submitLabel = 'Enregistrer',
  onSubmit,
  onCancel,
  extraActions,
}: Props) {
  const [values, setValues] = useState<ActivityFormValues>(emptyActivityForm());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeInfo, setGeocodeInfo] = useState<string | null>(null);

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

  async function autoGeocode() {
    const title = values.title.trim();
    const loc = values.location_name.trim();
    if (!title && !loc) {
      setError('Remplis au moins le titre et le lieu pour la localisation auto.');
      return;
    }
    setGeocoding(true);
    setError(null);
    setGeocodeInfo(null);

    // Appelle l'edge function Supabase qui proxie Google Places API.
    // La cle Google reste cote serveur (secret Supabase), jamais exposee ici.
    const query = [title, loc].filter(Boolean).join(', ');

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        'geocode-place',
        { body: { query } },
      );
      if (invokeErr) {
        setError(`Erreur géolocalisation : ${invokeErr.message}`);
        return;
      }
      if (data && typeof data === 'object') {
        const d = data as {
          lat?: number;
          lng?: number;
          display_name?: string;
          error?: string;
        };
        if (typeof d.lat === 'number' && typeof d.lng === 'number') {
          setValues((v) => ({ ...v, latitude: d.lat!, longitude: d.lng! }));
          const name = d.display_name || '';
          setGeocodeInfo(name.length > 80 ? `${name.slice(0, 80)}...` : name);
          return;
        }
        if (d.error) {
          setError(`${d.error}. Saisis manuellement ou clique sur la carte.`);
          return;
        }
      }
      setError('Aucun lieu trouvé. Saisis manuellement ou clique sur la carte.');
    } catch (e: unknown) {
      setError(
        `Erreur géolocalisation : ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setGeocoding(false);
    }
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

  async function handleExtraAction(action: ExtraAction) {
    const err = validate(values);
    if (err) return setError(err);
    setError(null);
    setBusy(true);
    try {
      await onSubmit(values);
      await action.onClick(values);
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : 'Erreur lors de l\'action.');
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

      {values.image_url.trim() && (
        <div>
          <label className="label">Aperçu de l'image</label>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <img
              key={values.image_url}
              src={values.image_url}
              alt="Aperçu"
              className="block h-56 w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (sib) sib.style.display = 'flex';
              }}
            />
            <div
              className="h-56 w-full items-center justify-center text-xs text-slate-400"
              style={{ display: 'none' }}
            >
              Image introuvable
            </div>
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={autoGeocode}
          disabled={geocoding}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-cyan bg-brand-cyan/10 px-4 py-2 text-sm font-medium text-brand-cyan transition hover:bg-brand-cyan/20 disabled:opacity-50"
        >
          {geocoding ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
          ) : (
            <span>📍</span>
          )}
          {geocoding ? 'Localisation...' : 'Localiser automatiquement (titre + lieu)'}
        </button>
        {geocodeInfo && (
          <p className="mt-2 text-xs text-emerald-700">
            ✓ {geocodeInfo}
          </p>
        )}
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

      {/* Mini-carte de previsualisation : tap pour ajuster la position */}
      <div>
        <label className="label">Aperçu sur la carte (clique pour ajuster)</label>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <MapContainer
            center={[
              typeof values.latitude === 'number' ? values.latitude : 46.5197,
              typeof values.longitude === 'number' ? values.longitude : 6.6323,
            ]}
            zoom={
              typeof values.latitude === 'number' &&
              typeof values.longitude === 'number'
                ? 14
                : 9
            }
            style={{ height: '280px', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
              subdomains={['a', 'b', 'c', 'd']}
              attribution="© OpenStreetMap, © CARTO"
            />
            <_MapClickHandler
              onPick={(lat, lng) => {
                setValues((v) => ({ ...v, latitude: lat, longitude: lng }));
              }}
            />
            {typeof values.latitude === 'number' &&
              typeof values.longitude === 'number' && (
                <>
                  <Marker
                    position={[values.latitude, values.longitude]}
                    icon={_markerIcon}
                  />
                  <_MapCenterUpdater
                    lat={values.latitude}
                    lng={values.longitude}
                    zoom={14}
                  />
                </>
              )}
          </MapContainer>
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

        {values.features.includes('Horaires restreints') && (
          <div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <div>
              <label className="label">Description de la contrainte (affichée à l'utilisateur)</label>
              <input
                className="input"
                type="text"
                value={values.date_label}
                onChange={(e) => update('date_label', e.target.value)}
                placeholder='Ex: "6 au 8 août 2026", "Tous les samedis", "Mars à mai"'
              />
            </div>
            <div>
              <label className="label">Type de contrainte (étiquette)</label>
              <select
                className="input"
                value={values.recurrence_type}
                onChange={(e) => {
                  const t = e.target.value as ActivityFormValues['recurrence_type'];
                  update('recurrence_type', t);
                }}
              >
                <option value="">— (aucune)</option>
                <option value="one_off">Événement ponctuel (dates précises)</option>
                <option value="weekly">Récurrence hebdomadaire (jour(s) de la semaine)</option>
                <option value="seasonal">Saisonnier (mois de l'année)</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Astuce : les 3 contraintes ci-dessous se combinent (ex: marché folklorique
                de Vevey = samedis + juillet-août).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date de début (optionnel)</label>
                <input
                  className="input"
                  type="date"
                  value={values.date_start}
                  onChange={(e) => update('date_start', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Date de fin (optionnel)</label>
                <input
                  className="input"
                  type="date"
                  value={values.date_end}
                  onChange={(e) => update('date_end', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Jour(s) de la semaine (optionnel)</label>
              <div className="flex flex-wrap gap-2">
                {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((d, i) => (
                  <label
                    key={d}
                    className={`cursor-pointer rounded-md border px-3 py-1 text-xs font-medium transition ${
                      values.weekly_days.includes(i)
                        ? 'border-brand-cyan bg-brand-cyan text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={values.weekly_days.includes(i)}
                      onChange={() => {
                        const next = values.weekly_days.includes(i)
                          ? values.weekly_days.filter((x) => x !== i)
                          : [...values.weekly_days, i].sort();
                        update('weekly_days', next);
                      }}
                    />
                    {d}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Mois de l'année (optionnel)</label>
              <div className="flex flex-wrap gap-2">
                {['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'].map((m, i) => {
                  const monthNum = i + 1;
                  const active = values.seasonal_months.includes(monthNum);
                  return (
                    <label
                      key={m}
                      className={`cursor-pointer rounded-md border px-3 py-1 text-xs font-medium transition ${
                        active
                          ? 'border-brand-cyan bg-brand-cyan text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={active}
                        onChange={() => {
                          const next = active
                            ? values.seasonal_months.filter((x) => x !== monthNum)
                            : [...values.seasonal_months, monthNum].sort((a, b) => a - b);
                          update('seasonal_months', next);
                        }}
                      />
                      {m}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="label">À tenir à jour (optionnel)</legend>
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">Fréquence de mise à jour</label>
              <select
                className="input"
                value={values.update_frequency}
                onChange={(e) =>
                  update('update_frequency', e.target.value as ActivityFormValues['update_frequency'])
                }
              >
                <option value="">— (aucune)</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuelle</option>
                <option value="quarterly">Trimestrielle</option>
                <option value="yearly">Annuelle</option>
                <option value="before_season">2 semaines avant saison</option>
                <option value="manual">Manuelle (à la demande)</option>
              </select>
            </div>
            <div>
              <label className="label">Prochaine mise à jour</label>
              <input
                className="input"
                type="date"
                value={values.next_update_at}
                onChange={(e) => update('next_update_at', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Notes de mise à jour (optionnel)</label>
            <input
              className="input"
              type="text"
              value={values.update_notes}
              onChange={(e) => update('update_notes', e.target.value)}
              placeholder="Ex: récupérer le calendrier officiel des matchs sur sfl.ch"
            />
          </div>
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

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost" disabled={busy}>
            Annuler
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Enregistrement...' : submitLabel}
        </button>
        {extraActions && extraActions.length > 0 && (
          <>
            <div className="hidden h-9 w-px bg-slate-200 sm:block" />
            {extraActions.map((a, i) => {
              const colorMap: Record<ExtraAction['color'], string> = {
                emerald:
                  'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm',
                amber: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm',
                rose: 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm',
                sky: 'bg-sky-500 hover:bg-sky-600 text-white shadow-sm',
              };
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleExtraAction(a)}
                  disabled={busy}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${colorMap[a.color]}`}
                >
                  {a.icon}
                  {a.label}
                </button>
              );
            })}
          </>
        )}
      </div>
    </form>
  );
}
