import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Loader } from './ui/Loader';

type Props = {
  children: ReactNode;
  requireSuperAdmin?: boolean;
};

export function ProtectedRoute({ children, requireSuperAdmin = false }: Props) {
  const { session, loading, adminProfile, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (session && adminProfile === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">
          Accès refusé
        </h1>
        <p className="max-w-md text-sm text-slate-600">
          Votre compte n'a pas de droits administrateurs pour Whateka. Contactez
          un Super Admin si vous pensez que c'est une erreur.
        </p>
      </div>
    );
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return (
      <div className="card mx-auto mt-10 max-w-xl text-center">
        <h1 className="text-xl font-bold text-slate-900">
          Accès réservé aux Super Admins
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Cette page nécessite le rôle Super Admin.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
