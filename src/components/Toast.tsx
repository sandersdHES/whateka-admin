import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { X } from 'lucide-react';

type Toast = { id: number; kind: 'error' | 'success' | 'info'; message: string };
type Ctx = {
  push: (kind: Toast['kind'], message: string) => void;
  error: (m: string) => void;
  success: (m: string) => void;
};

const ToastCtx = createContext<Ctx | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback<Ctx['push']>((kind, message) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const value: Ctx = {
    push,
    error: (m) => push('error', m),
    success: (m) => push('success', m),
  };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex min-w-[260px] max-w-sm items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ${
              t.kind === 'error'
                ? 'bg-rose-50 text-rose-900 ring-rose-200'
                : t.kind === 'success'
                  ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
                  : 'bg-white text-slate-800 ring-slate-200'
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              className="shrink-0 text-current/60 hover:text-current"
              onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
