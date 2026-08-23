"use client";

import { Palette } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { type ThemeName, useTheme } from "@/components/theme/theme-state";

const themeOptions: { id: ThemeName; label: string; detail: string }[] = [
  {
    id: "light",
    label: "Claro",
    detail: "Padrão do sistema, pensado para leitura prolongada de documento.",
  },
  {
    id: "dark",
    label: "Escuro",
    detail: "Mesma paleta aprovada, com as superfícies invertidas.",
  },
];

export function AppearanceCard() {
  const { theme, mounted, setTheme } = useTheme();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const sync = () => setReducedMotion(query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <section
      aria-label="Aparência"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Palette size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">Aparência</h2>
          <p className="text-sm text-ink-soft">
            Preferência individual, guardada neste navegador e aplicada antes da
            primeira pintura da tela.
          </p>
        </div>
      </header>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold text-ink">
          Tema da interface
        </legend>
        {themeOptions.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-line px-4 py-3 transition-colors duration-(--motion-fast) hover:bg-inset has-checked:border-brand-muted has-checked:bg-inset"
          >
            <input
              type="radio"
              name="theme"
              value={option.id}
              checked={mounted && theme === option.id}
              onChange={() => setTheme(option.id)}
              className="mt-1 size-4 shrink-0 cursor-pointer accent-ink"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">
                {option.label}
              </span>
              <span className="block text-xs text-ink-soft">
                {option.detail}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1 border-t border-line pt-4">
        <p className="text-sm font-semibold text-ink">
          Movimento reduzido: {reducedMotion ? "ativo" : "inativo"}
        </p>
        <p className="text-xs text-ink-soft">
          Esta preferência vem do seu sistema operacional, não do Advprev CRM, e
          a interface já a respeita em todas as animações.
        </p>
      </div>
    </section>
  );
}
