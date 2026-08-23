import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

/*
 * Form primitives. The label is always visible, never a placeholder, and the
 * error sits beside the field that caused it, never only at the top of the form.
 *
 * The palette carries no red, so an error is signalled by the attention surface,
 * an icon and the wording, never by colour alone.
 */

export const controlClasses =
  "w-full rounded-md border border-line bg-inset px-4 py-3 text-base text-ink transition-colors duration-(--motion-fast) placeholder:text-ink-soft hover:border-line-strong aria-[invalid=true]:border-brand";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | undefined;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
        {required ? (
          <span className="font-normal text-ink-soft"> (obrigatório)</span>
        ) : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-soft">{hint}</p> : null}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="flex items-start gap-2 rounded-md bg-attention-soft px-3 py-2 text-xs font-semibold text-ink"
        >
          <WarningCircle
            size={16}
            weight="bold"
            aria-hidden
            className="mt-px shrink-0"
          />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormNotice({
  tone,
  children,
}: {
  tone: "attention" | "neutral";
  children: ReactNode;
}) {
  const toneClasses =
    tone === "attention" ? "bg-attention-soft" : "bg-neutral-soft";
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-md px-4 py-3 text-sm text-ink ${toneClasses}`}
    >
      <WarningCircle
        size={18}
        weight="bold"
        aria-hidden
        className="mt-0.5 shrink-0"
      />
      {children}
    </p>
  );
}

export const primaryButtonClasses =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-panel px-6 py-2.5 text-sm font-bold text-ink-inverse transition-colors duration-(--motion-fast) hover:bg-panel-hover disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClasses =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-line px-6 py-2.5 text-sm font-bold text-ink transition-colors duration-(--motion-fast) hover:bg-inset disabled:cursor-not-allowed disabled:opacity-60";
