import { GearSix } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { NavFilter } from "@/components/dashboard/dashboard-filter";
import { NavAccount } from "@/components/dashboard/nav-account";
import { navIconButtonClasses } from "@/components/dashboard/nav-action-styles";
import {
  NavNotifications,
  type NoticeGroup,
} from "@/components/dashboard/nav-notifications";
import { NavSearch } from "@/components/dashboard/nav-search";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { captureHealth } from "@/lib/capture/runs";
import { criticalDeadlineList, searchIndex } from "@/lib/case-views";
import { officeProfile } from "@/lib/office-profile";
import { navigationItems } from "@/lib/persona";

/*
 * Every notice is a live reading of a record that already exists on a screen.
 * Nothing is stored, nothing is marked as read, and the order goes from the
 * failure that can hide a deadline to the deadline that is already counted.
 * A group with nothing in it does not appear, because an empty heading in a
 * panel of warnings is noise that teaches the office to stop reading it.
 */
async function noticeGroups(): Promise<NoticeGroup[]> {
  const [health, deadlines] = await Promise.all([
    captureHealth(),
    criticalDeadlineList(),
  ]);

  return [
    {
      id: "captures",
      heading: "Captura externa",
      items: health
        .filter((source) => !source.healthy)
        .map((source) => ({
          id: source.source,
          title: `${source.label}, ${source.statusLabel.toLowerCase()}`,
          detail: `${source.lastSuccessAt === null ? "Sem captura bem sucedida registrada" : `Última captura bem sucedida em ${source.lastSuccessAt}`}. ${source.role}`,
          href: "/judicial",
          destinationLabel: "Judicial",
        })),
    },
    {
      id: "deadlines",
      heading: "Prazos críticos",
      items: deadlines.map((deadline) => ({
        id: deadline.id,
        title: `${deadline.caseRef}, vence em ${deadline.dueOn}`,
        detail: `${deadline.clientName}. ${deadline.label}. Estado ${deadline.state === "confirmed" ? "confirmado" : "calculado"}.`,
        href: deadline.href,
        destinationLabel: "ficha do caso",
      })),
    },
  ].filter((group) => group.items.length > 0);
}

/* Same rule as the circular controls: 44 pixels tall under a finger, 40 under a
 * pointer, so the strip stays compact on the desktop it was designed for. */
const pillBaseClasses =
  "cursor-pointer rounded-full px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors duration-(--motion-fast) sm:py-2";
const pillActiveClasses = "bg-panel text-ink-inverse";
const pillIdleClasses = "text-ink-soft hover:bg-inset hover:text-ink";

export async function TopNav({
  activeId = "dashboard",
}: {
  activeId?: string;
}) {
  const profile = await officeProfile();
  const index = await searchIndex();
  const notices = await noticeGroups();
  return (
    <header className="flex w-full flex-wrap items-center gap-x-4 gap-y-3 px-6 py-5 lg:px-10">
      <Link
        href="/"
        aria-label="Advprev CRM, ir para o painel"
        className="inline-flex min-h-11 cursor-pointer items-center rounded-md transition-opacity duration-(--motion-fast) hover:opacity-80 sm:min-h-0"
      >
        <Logo />
      </Link>
      <nav
        aria-label="Navegação principal"
        className="order-last w-full min-w-0 xl:order-none xl:mx-auto xl:w-auto xl:max-w-full xl:flex-1"
      >
        <ul className="flex items-center gap-1 overflow-x-auto rounded-full border border-line bg-card p-1.5 shadow-card xl:mx-auto xl:w-fit">
          {navigationItems.map((item) => {
            const isActive = item.id === activeId;
            const pillClasses = `${pillBaseClasses} ${isActive ? pillActiveClasses : pillIdleClasses}`;
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-block ${pillClasses}`}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    className={pillClasses}
                  >
                    {item.label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="ml-auto flex items-center gap-2 xl:ml-0">
        <NavSearch index={index} />
        {activeId === "dashboard" ? <NavFilter /> : null}
        <ThemeToggle />
        <NavNotifications groups={notices} />
        <Link
          href="/configuracoes"
          aria-label="Configurações"
          aria-current={activeId === "settings" ? "page" : undefined}
          className={`${navIconButtonClasses} aria-[current=page]:border-brand-muted aria-[current=page]:text-ink`}
        >
          <GearSix size={20} weight="bold" aria-hidden />
        </Link>
        <NavAccount profile={profile} />
      </div>
    </header>
  );
}
