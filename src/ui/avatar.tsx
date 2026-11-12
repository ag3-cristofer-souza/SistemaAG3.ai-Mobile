import { useState } from "react";
import { initials, nameHue } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  photo?: string | null;
  className?: string;
}

/** Foto, ou as iniciais quando não há foto ou o link dela já venceu (fotos do WhatsApp vencem). */
export function Avatar({ name, photo, className }: AvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const base = "size-12 shrink-0 rounded-full";
  if (photo && failed !== photo) {
    return (
      <img
        src={photo}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className={cn(base, "bg-muted object-cover", className)}
        onError={() => setFailed(photo)}
      />
    );
  }
  const hue = nameHue(name);
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: `hsl(${hue} 85% 93%)`, color: `hsl(${hue} 60% 32%)` }}
      className={cn(base, "flex items-center justify-center text-sm font-semibold", className)}
    >
      {initials(name)}
    </span>
  );
}
