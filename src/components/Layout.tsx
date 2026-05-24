import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileTopBar } from './MobileTopBar';

/**
 * Layout principal de l'admin.
 *
 * Desktop (>= lg) : sidebar fixe a gauche + main scrollable. Comportement
 * historique, identique au pixel pret a la version pre-mobile.
 *
 * Mobile (< lg) : MobileTopBar en haut, sidebar cachee en drawer overlay
 * declenche via le bouton burger. Tap a l'exterieur (backdrop) ou changement
 * de route ferment le drawer.
 */
export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Ferme le menu mobile a chaque changement de route (UX standard pour
  // drawers : on ne reste pas affiche sur la nouvelle page).
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen flex-col bg-surface lg:flex-row">
      {/* Barre top mobile uniquement — masquee en lg: */}
      <MobileTopBar
        isOpen={mobileMenuOpen}
        onToggle={() => setMobileMenuOpen((v) => !v)}
      />

      {/* Backdrop sombre quand drawer mobile ouvert. Cliquer ferme. */}
      {mobileMenuOpen && (
        <button
          aria-label="Fermer le menu"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      {/* Sidebar : drawer mobile + static desktop (cf. Sidebar.tsx) */}
      <Sidebar
        isMobileOpen={mobileMenuOpen}
        onNavigate={() => setMobileMenuOpen(false)}
      />

      {/* Main scrollable — padding identique desktop, reduit horizontalement mobile */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
