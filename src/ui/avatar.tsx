import { useState } from "react";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  photo?: string | null;
  className?: string;
}

/** Foto, ou as iniciais quando não há foto ou o link dela já venceu (fotos do WhatsApp vencem). */
export function Avatar({ name, photo, className }: AvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const base = "size-11 shrink-0 rounded-full";
  if (photo && failed !== photo) {
    return (
      <img
        src={photo}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className={cn(base, "object-cover", className)}
        onError={() => setFailed(photo)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        base,
        "flex items-center justify-center bg-secondary text-sm font-semibold text-secondary-foreground",
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
