import Image from "next/image";

/*
 * Member avatar. Renders the persona photo when photoSrc is given and falls
 * back to initials, so records without a photo keep a stable presentation.
 */
type AvatarSize = "sm" | "md" | "lg" | "xl";

type AvatarProps = {
  name: string;
  photoSrc?: string;
  size?: AvatarSize;
  tone?: "brand" | "panel";
};

const sizeClasses: Record<AvatarSize, string> = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-lg",
};

const sizePixels: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

const toneClasses: Record<NonNullable<AvatarProps["tone"]>, string> = {
  brand: "bg-brand text-brand-contrast",
  panel: "bg-panel text-ink-inverse",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? "";
  const last =
    parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export function Avatar({
  name,
  photoSrc,
  size = "md",
  tone = "brand",
}: AvatarProps) {
  if (photoSrc) {
    const pixels = sizePixels[size];
    return (
      <Image
        src={photoSrc}
        alt={name}
        width={pixels}
        height={pixels}
        /* A photo served by the application's own route must not pass
         * through the build-time optimizer: its bytes change when the user
         * changes them, and the route already answers with no-store. */
        unoptimized={photoSrc.startsWith("/api/")}
        className={`shrink-0 rounded-full object-cover select-none ${sizeClasses[size]}`}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold select-none ${sizeClasses[size]} ${toneClasses[tone]}`}
    >
      {initialsOf(name)}
    </span>
  );
}
