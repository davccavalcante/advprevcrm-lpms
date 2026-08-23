"use client";

import { ArrowCounterClockwise, Faders } from "@phosphor-icons/react";
import { Popover } from "radix-ui";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  navIconButtonClasses,
  navPanelClasses,
} from "@/components/dashboard/nav-action-styles";

const STORAGE_KEY = "advprevcrm-dashboard-sections";

/*
 * The blocks the operator may hide from the panel. The greeting block is out of
 * the list on purpose: it carries the identity and the week's deadlines, which
 * are the reason the screen opens.
 */
export const dashboardSections = [
  { id: "kpis", label: "Indicadores da semana" },
  { id: "activity", label: "Publicações e intimações" },
  { id: "phases", label: "Casos por fase" },
  { id: "criticalDeadlines", label: "Prazos críticos" },
  { id: "benefits", label: "Casos por benefício" },
  { id: "risks", label: "Alertas de risco" },
  { id: "grantRates", label: "Taxas de concessão" },
  { id: "capture", label: "Saúde da captura" },
  { id: "agenda", label: "Agenda da semana" },
  { id: "tasks", label: "Minhas tarefas" },
  { id: "finance", label: "Financeiro" },
] as const;

export type DashboardSectionId = (typeof dashboardSections)[number]["id"];

type DashboardFilterValue = {
  hiddenIds: DashboardSectionId[];
  isVisible: (id: DashboardSectionId) => boolean;
  toggle: (id: DashboardSectionId) => void;
  showAll: () => void;
};

const DashboardFilterContext = createContext<DashboardFilterValue | null>(null);

function readStored(): DashboardSectionId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const known = new Set<string>(dashboardSections.map((item) => item.id));
    return parsed.filter(
      (value): value is DashboardSectionId =>
        typeof value === "string" && known.has(value),
    );
  } catch {
    return [];
  }
}

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [hiddenIds, setHiddenIds] = useState<DashboardSectionId[]>([]);

  /* Read after mount so the server render and the first client render match. */
  useEffect(() => {
    setHiddenIds(readStored());
  }, []);

  const persist = useCallback((next: DashboardSectionId[]) => {
    setHiddenIds(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable, the choice stays for this session only */
    }
  }, []);

  const value = useMemo<DashboardFilterValue>(
    () => ({
      hiddenIds,
      isVisible: (id) => !hiddenIds.includes(id),
      toggle: (id) =>
        persist(
          hiddenIds.includes(id)
            ? hiddenIds.filter((entry) => entry !== id)
            : [...hiddenIds, id],
        ),
      showAll: () => persist([]),
    }),
    [hiddenIds, persist],
  );

  return (
    <DashboardFilterContext.Provider value={value}>
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilter(): DashboardFilterValue | null {
  return useContext(DashboardFilterContext);
}

export function DashboardSection({
  id,
  children,
}: {
  id: DashboardSectionId;
  children: ReactNode;
}) {
  const filter = useDashboardFilter();
  if (filter && !filter.isVisible(id)) {
    return null;
  }
  return children;
}

/*
 * A row of the panel disappears entirely when every block inside it is hidden,
 * so hiding a card never leaves an empty column behind.
 */
export function DashboardGroup({
  ids,
  children,
}: {
  ids: DashboardSectionId[];
  children: ReactNode;
}) {
  const filter = useDashboardFilter();
  if (filter && !ids.some((id) => filter.isVisible(id))) {
    return null;
  }
  return children;
}

export function NavFilter() {
  const filter = useDashboardFilter();
  const [open, setOpen] = useState(false);

  if (!filter) {
    return null;
  }

  const hiddenCount = filter.hiddenIds.length;
  const visibleCount = dashboardSections.length - hiddenCount;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={
            hiddenCount === 0
              ? "Filtrar visão do painel, nenhuma seção oculta"
              : `Filtrar visão do painel, ${hiddenCount === 1 ? "1 seção oculta" : `${hiddenCount} seções ocultas`}`
          }
          className={`relative ${navIconButtonClasses}`}
        >
          <Faders size={20} weight="bold" aria-hidden />
          {hiddenCount > 0 ? (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 inline-flex size-5 items-center justify-center rounded-full bg-panel text-xs font-bold text-ink-inverse"
            >
              {hiddenCount}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className={`max-h-(--overlay-max-height) w-80 overflow-y-auto ${navPanelClasses}`}
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-ink">Visão do painel</h2>
            <p className="text-sm text-ink-soft" aria-live="polite">
              {visibleCount} de {dashboardSections.length} seções visíveis. A
              escolha vale apenas para você e permanece no próximo acesso.
            </p>
          </div>
          <ul className="flex flex-col gap-1">
            {dashboardSections.map((section) => (
              <li key={section.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-ink transition-colors duration-(--motion-fast) hover:bg-inset">
                  <input
                    type="checkbox"
                    checked={filter.isVisible(section.id)}
                    onChange={() => filter.toggle(section.id)}
                    className="size-4 shrink-0 cursor-pointer accent-ink"
                  />
                  {section.label}
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={filter.showAll}
            disabled={hiddenCount === 0}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors duration-(--motion-fast) hover:bg-inset disabled:cursor-not-allowed disabled:text-ink-soft disabled:opacity-60"
          >
            <ArrowCounterClockwise size={16} weight="bold" aria-hidden />
            Mostrar todas
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
