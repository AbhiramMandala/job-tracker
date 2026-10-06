import { useEffect, useRef, useState } from "react";
import { toastEnter, toastExit } from "../animations/anime";

export interface ToastItem {
  id: number;
  message: string;
  kind: "success" | "error";
}

let nextId = 1;

/** Animated toast stack (aria-live). Success auto-dismisses; errors persist
 *  with a dismiss button. Replaces ad-hoc toast divs. */
export function ToastStack({ items, onDone }: { items: ToastItem[]; onDone: (id: number) => void }) {
  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {items.map((t) => (
        <Toast key={t.id} item={t} onDone={onDone} />
      ))}
    </div>
  );
}

function Toast({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    toastEnter(ref.current);
    if (item.kind === "success") {
      const timer = window.setTimeout(() => setLeaving(true), 3200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [item.kind]);

  useEffect(() => {
    if (leaving) toastExit(ref.current, () => onDone(item.id));
  }, [leaving, item.id, onDone]);

  const error = item.kind === "error";
  return (
    <div
      ref={ref}
      role={error ? "alert" : "status"}
      className={`rounded-lg border px-4 py-2.5 text-sm shadow-md ${
        error
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
          : "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p>{item.message}</p>
        {error && (
          <button onClick={() => setLeaving(true)} className="shrink-0 underline" aria-label="Dismiss error">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

export function useToasts(): {
  toasts: ToastItem[];
  notify: (message: string, kind?: ToastItem["kind"]) => void;
  dismiss: (id: number) => void;
} {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  return {
    toasts,
    notify: (message: string, kind: ToastItem["kind"] = "success") =>
      setToasts((prev) => [...prev.slice(-2), { id: nextId++, message, kind }]),
    dismiss: (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)),
  };
}
