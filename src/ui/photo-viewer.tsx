import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface PhotoViewerProps {
  src: string | null | undefined;
  alt: string;
  open: boolean;
  onClose: () => void;
}

/** Foto em tela cheia, sobre fundo escuro. Fecha no X, no Esc ou tocando fora da foto. */
export function PhotoViewer({ src, alt, open, onClose }: PhotoViewerProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && src && !element.open) element.showModal();
    if ((!open || !src) && element.open) element.close();
  }, [open, src]);

  return (
    <dialog
      ref={dialog}
      aria-label={alt}
      onClose={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget.querySelector("img")) onClose();
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-black p-0 backdrop:bg-black"
    >
      {open && src && (
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 justify-end p-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
            <button
              type="button"
              aria-label="Fechar foto"
              onClick={onClose}
              className="flex size-11 items-center justify-center rounded-full text-white active:bg-white/10"
            >
              <X className="size-6" aria-hidden="true" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <img
              src={src}
              alt={alt}
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </dialog>
  );
}
