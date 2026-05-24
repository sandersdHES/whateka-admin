import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  CalendarClock,
  KeyRound,
  RefreshCw,
  Inbox,
  MessageSquare,
  ListChecks,
  Users,
  BarChart3,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

const NAV = [
  { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/activities', label: 'Activités', icon: Calendar },
  { to: '/conditional', label: 'Activités à condition', icon: CalendarClock },
  { to: '/scheduled', label: 'À tenir à jour', icon: RefreshCw },
  { to: '/submissions', label: 'Soumissions', icon: Inbox },
  { to: '/feedbacks', label: 'Feedbacks', icon: MessageSquare },
  { to: '/questionnaires', label: 'Questionnaire feedback', icon: ListChecks },
  { to: '/stats', label: 'Statistiques', icon: BarChart3 },
  { to: '/users', label: 'Gestion utilisateurs', icon: Users, superAdmin: true },
  { to: '/access', label: 'Accès', icon: KeyRound, superAdmin: true },
];

type Props = {
  /** Sur mobile, controle l'ouverture/fermeture du drawer. Ignore sur >=lg. */
  isMobileOpen?: boolean;
  /** Callback quand l'utilisateur clique un lien (pour fermer le drawer mobile). */
  onNavigate?: () => void;
};

/**
 * Sidebar de navigation admin.
 *
 * Desktop (>= lg) : sidebar fixe gauche, 256px (w-64), toujours visible.
 * Identique a la version pre-refonte responsive — zero changement visuel.
 *
 * Mobile (< lg) : drawer qui slide depuis la gauche. Visible quand
 * isMobileOpen=true (set par MobileTopBar via Layout). Cliquer un lien
 * declenche onNavigate() pour fermer auto.
 */
export function Sidebar({ isMobileOpen = false, onNavigate }: Props) {
  const { adminProfile, isSuperAdmin, signOut } = useAuth();

  // Sur mobile : fixed + translate pour slide animation. Sur lg+ : static
  // dans le flex parent (comportement actuel).
  const mobileTransform = isMobileOpen ? 'translate-x-0' : '-translate-x-full';

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col
        bg-surface-sidebar text-slate-200 shadow-2xl transition-transform
        duration-200 ${mobileTransform}
        lg:static lg:translate-x-0 lg:shadow-none
      `}
    >
      <div className="flex items-center gap-3 px-6 py-6">
        <img src="/logo.png" alt="Whateka" className="h-9 w-9 rounded-lg" />
        <div>
          <div className="text-lg font-bold text-white">Whateka</div>
          <div className="text-xs text-slate-400">Administration</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV.map(({ to, label, icon: Icon, superAdmin }) => {
          if (superAdmin && !isSuperAdmin) return null;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-cyan/20 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="mb-2 text-xs text-slate-400">Connecté en tant que</div>
        <div className="truncate text-sm font-medium text-white">
          {adminProfile?.name ?? adminProfile?.email ?? '—'}
        </div>
        <div className="mb-3 text-xs text-slate-400 capitalize">
          {adminProfile?.role?.replace('_', ' ') ?? 'invité'}
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
