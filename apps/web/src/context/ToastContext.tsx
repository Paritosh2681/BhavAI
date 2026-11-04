import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; tone: Tone };

type ToastState = {
  toast: (message: string, tone?: Tone) => void;
};

const ToastContext = createContext<ToastState | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: Tone = 'info') => {
      const id = nextId++;
      setItems((current) => [...current.slice(-3), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2 no-print"
        role="region"
        aria-label="Notifications"
      >
        {items.map((item) => {
          const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? XCircle : Info;
          return (
            <div
              key={item.id}
              role="status"
              className="glass animate-rise flex items-start gap-3 rounded-xl px-3.5 py-3 text-sm text-forest"
            >
              <Icon
                className={item.tone === 'error' ? 'mt-0.5 h-4 w-4 shrink-0 text-[#8a5a22]' : 'mt-0.5 h-4 w-4 shrink-0 text-teal-deep'}
                aria-hidden
              />
              <p className="flex-1 leading-snug">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded p-1 text-forest/60 hover:bg-forest/10 hover:text-forest"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
