import { GearSix } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { NavFilter } from "@/components/dashboard/dashboard-filter";
import { NavAccount } from "@/components/dashboard/nav-account";
import { navIconButtonClasses } from "@/components/dashboard/nav-action-styles";
import { NavNotifications } from "@/components/dashboard/nav-notifications";
import { NavSearch } from "@/components/dashboard/nav-search";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { officeProfile } from "@/lib/office-profile";
import { navigationItems } from "@/lib/persona";

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
        <NavSearch />
        {activeId === "dashboard" ? <NavFilter /> : null}
        <ThemeToggle />
        <NavNotifications />
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
