"use client";

import { ArrowRight, BellRinging } from "@phosphor-icons/react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { useState } from "react";
import {
  navIconButtonClasses,
  navPanelClasses,
} from "@/components/dashboard/nav-action-styles";

export type NoticeGroup = {
  id: string;
  heading: string;
  items: {
    id: string;
    title: string;
    detail: string;
    href: string;
    destinationLabel: string;
  }[];
};

export function NavNotifications({ groups }: { groups: NoticeGroup[] }) {
  const [open, setOpen] = useState(false);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={
            total === 1
              ? "Notificações, 1 aviso aberto"
              : `Notificações, ${total} avisos abertos`
          }
          className={`relative ${navIconButtonClasses}`}
        >
          <BellRinging size={20} weight="bold" aria-hidden />
          {total > 0 ? (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 inline-flex size-5 items-center justify-center rounded-full bg-panel text-xs font-bold text-ink-inverse"
            >
              {total}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className={`max-h-(--overlay-max-height) w-96 max-w-(--overlay-max-width) overflow-y-auto ${navPanelClasses}`}
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-ink">Notificações</h2>
            <p className="text-sm text-ink-soft">
              {total === 1 ? "1 aviso aberto" : `${total} avisos abertos`},
              lidos ao vivo dos registros dos seus casos.
            </p>
          </div>

          {groups.map((group) => (
            <section key={group.id} className="flex flex-col gap-2">
              <h3 className="text-xs font-bold tracking-wide text-ink-soft uppercase">
                {group.heading}
              </h3>
              <ol className="flex flex-col divide-y divide-line">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Popover.Close asChild>
                      <Link
                        href={item.href}
                        className="flex cursor-pointer flex-col gap-1 rounded-md px-2 py-3 transition-colors duration-(--motion-fast) hover:bg-inset"
                      >
                        <span className="text-sm font-bold text-ink">
                          {item.title}
                        </span>
                        <span className="text-xs text-ink-soft">
                          {item.detail}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-semibold text-ink-soft">
                          {item.destinationLabel}
                          <ArrowRight size={14} weight="bold" aria-hidden />
                        </span>
                      </Link>
                    </Popover.Close>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <p className="text-xs text-ink-soft">
            Aviso não confirma prazo. A transição de calculado para confirmado é
            ação humana do advogado, registrada em auditoria, e acontece na
            Agenda.
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
