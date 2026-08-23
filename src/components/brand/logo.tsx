/*
 * Temporary logomark. The final brand asset will replace the <svg> block below;
 * keep the component name and props stable so the swap is a one-file change.
 */
type LogoProps = {
  withWordmark?: boolean;
  markSize?: number;
};

export function Logo({ withWordmark = true, markSize = 36 }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-3">
      <svg
        role="img"
        aria-label="Advprev CRM"
        width={markSize}
        height={markSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Advprev CRM</title>
        <rect width="48" height="48" rx="14" fill="var(--surface-panel)" />
        <path
          d="M24 10 L36 38 H30.6 L24 21.4 L17.4 38 H12 Z"
          fill="var(--brand)"
        />
        <rect
          x="19"
          y="31"
          width="10"
          height="3.4"
          rx="1.7"
          fill="var(--text-inverse)"
        />
      </svg>
      {withWordmark ? (
        <span className="flex items-baseline gap-1.5 select-none">
          <span className="text-xl font-bold tracking-tight text-ink">
            Advprev
          </span>
          <span className="text-xl font-light text-brand">CRM</span>
        </span>
      ) : null}
    </span>
  );
}
