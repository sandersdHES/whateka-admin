import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';

type TableName = 'activities' | 'activity_submissions';

type Props = {
  /** Table cible : activities ou activity_submissions */
  table: TableName;
  /** ID de la ligne dans cette table */
  rowId: number;
  /** Valeur courante du flag */
  certified: boolean;
  /** Callback optionnelle après update OK (eg. refresh local) */
  onChange?: (next: boolean) => void;
  /** Taille du badge en px (defaut 28) */
  size?: number;
  /** Désactive le clic (lecture seule) */
  disabled?: boolean;
};

/**
 * Bouton-toggle "Whateka Verified" pour les listes admin.
 *
 * - Quand certified === true  : disque cyan plein avec un W blanc bold.
 * - Quand certified === false : cercle vide en pointillé gris, hover cyan léger.
 * - Tap = update optimiste + write Supabase. Rollback si erreur.
 *
 * Le flag se trouve sur la colonne is_whateka_certified de la table
 * cible (activities ou activity_submissions). Côté app Flutter, le
 * champ est lu par Activity.fromJson et déclenche l'affichage du
 * badge starburst cyan à côté des chips de catégorie.
 */
export function WhatekaCertifiedToggle({
  table,
  rowId,
  certified,
  onChange,
  size = 28,
  disabled = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [localState, setLocalState] = useState(certified);
  const toast = useToast();

  // Quand la prop certified change (re-fetch parent), on resync l'état local.
  // useEffect pas strictement nécessaire car les composants list re-rendent
  // avec une nouvelle key — mais évite un flash si on garde le composant monté.
  if (localState !== certified && !busy) {
    setLocalState(certified);
  }

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy || disabled) return;
    const next = !localState;
    setBusy(true);
    setLocalState(next); // optimiste
    const { error } = await supabase
      .from(table)
      .update({ is_whateka_certified: next })
      .eq('id', rowId);
    setBusy(false);
    if (error) {
      setLocalState(!next); // rollback
      toast.error(error.message);
      return;
    }
    toast.success(
      next
        ? 'Badge Whateka Verified ajouté.'
        : 'Badge Whateka Verified retiré.',
    );
    onChange?.(next);
  }

  const tooltip = localState
    ? 'Activité certifiée Whateka — cliquer pour retirer'
    : 'Marquer comme certifiée Whateka';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || disabled}
      title={tooltip}
      aria-label={tooltip}
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full transition ${
        localState
          ? 'bg-brand-cyan text-white shadow-sm ring-2 ring-brand-cyan/30 hover:bg-brand-cyan/90'
          : 'border-2 border-dashed border-slate-300 text-slate-300 hover:border-brand-cyan hover:text-brand-cyan'
      } ${busy ? 'opacity-60' : ''} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className="leading-none"
        style={{
          fontFamily: '"Concert One", "Fredoka", system-ui, sans-serif',
          fontWeight: 700,
          fontSize: size * 0.55,
        }}
      >
        W
      </span>
    </button>
  );
}
