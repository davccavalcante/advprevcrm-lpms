import type { ReactNode } from "react";

/*
 * Standing governance statement of every screen. It lives in one component
 * because it is a compliance statement: ten copies would drift, and a drifted
 * compliance statement is worse than none at all.
 *
 * The optional child carries the rule that matters on that particular screen,
 * such as the source of a deadline or the segregation of access, and it is
 * printed above the standing statement rather than replaced by it.
 */
export function GovernanceNote({ children }: { children?: ReactNode }) {
  return (
    <footer className="flex flex-col gap-2 px-6 pb-6 lg:px-10">
      {children ? <p className="text-xs text-ink-soft">{children}</p> : null}
      <p className="text-xs leading-relaxed text-ink-soft">
        Apoio à operação jurídica, não substitui o juízo do advogado. Cada saída
        é gerada por Inteligência Massiva (IM), marcada como assistida e
        registrada em cadeia auditável, projetada sobre os controles da ISO/IEC
        42001, do EU AI Act e da LGPD, com sigilo profissional preservado, pela
        arquitetura MAIC, HIMs e NHEs da{" "}
        <a
          href="https://teleologyhi.com"
          target="_blank"
          rel="noreferrer"
          className="cursor-pointer rounded-xs font-semibold text-ink underline underline-offset-2 transition-colors duration-(--motion-fast) hover:bg-inset"
        >
          TeleologyHI
          <span className="sr-only">, site externo, abre em nova aba</span>
        </a>
        .
      </p>
    </footer>
  );
}
