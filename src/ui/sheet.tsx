import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Painel que sobe do rodapé. `<dialog>` nativo: prende o foco, fecha com Esc e não precisa de dependência. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-card p-0 text-foreground shadow-float backdrop:bg-[#0b1530]/55"
    >
      {open && (
        <div className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div
            aria-hidden="true"
            className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/25"
          />
          <div className="flex items-center justify-between py-1 pl-5 pr-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="flex size-11 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
