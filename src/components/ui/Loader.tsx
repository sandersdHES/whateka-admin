export function Loader({ label = 'Chargement...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-cyan" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
