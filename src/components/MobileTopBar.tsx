import { Menu, X } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onToggle: () => void;
};

/**
 * Barre superieure visible uniquement sur ecrans < lg (1024px). Affiche le
 * logo Whateka + un bouton burger pour ouvrir le drawer Sidebar.
 *
 * Sur desktop, cette barre est entierement masquee (lg:hidden) et la sidebar
 * fixe gauche prend le relais. Aucun impact visuel desktop.
 */
export function MobileTopBar({ isOpen, onToggle }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-surface-sidebar px-4 text-slate-200 shadow-soft lg:hidden">
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="Whateka" className="h-8 w-8 rounded-md" />
        <div className="text-sm font-bold text-white">Whateka</div>
        <span className="text-[11px] text-slate-400">Admin</span>
      </div>
      <button
        onClick={onToggle}
        aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-200 hover:bg-slate-800"
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
    </header>
  );
}
