"use client";

import { ArrowRight, GearSix, ShieldCheck } from "@phosphor-icons/react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { useState } from "react";
import { navPanelClasses } from "@/components/dashboard/nav-action-styles";
import { Avatar } from "@/components/ui/avatar";
import type { OfficeProfileView } from "@/lib/office-profile";

export function NavAccount({ profile }: { profile: OfficeProfileView }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Conta de ${profile.fullName}, abrir o menu`}
          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-transparent transition-colors duration-(--motion-fast) hover:border-brand-muted sm:min-h-0 sm:min-w-0"
        >
          <Avatar name={profile.fullName} photoSrc={profile.avatarSrc} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className={`w-80 max-w-(--overlay-max-width) ${navPanelClasses}`}
        >
          <div className="flex items-center gap-3">
            <Avatar
              name={profile.fullName}
              photoSrc={profile.avatarSrc}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-ink">{profile.fullName}</h2>
              <p className="text-xs text-ink-soft">
                {profile.role}, time {profile.team}
              </p>
              <p className="text-xs break-words text-ink-soft">
                {profile.email}
              </p>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-md bg-inset p-3 text-xs leading-relaxed text-ink">
            <ShieldCheck
              size={16}
              weight="bold"
              aria-hidden
              className="mt-0.5 shrink-0"
            />
            Você acessa exclusivamente os seus casos, as suas horas e a sua
            própria participação financeira. A regra é aplicada no banco, e a
            interface apenas a reflete.
          </p>

          <Popover.Close asChild>
            <Link
              href="/configuracoes"
              className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-4 py-3 transition-colors duration-(--motion-fast) hover:bg-inset"
            >
              <GearSix size={18} weight="bold" aria-hidden />
              <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
                Configurações
              </span>
              <ArrowRight size={16} weight="bold" aria-hidden />
            </Link>
          </Popover.Close>

          <p className="text-xs text-ink-soft">
            Encerrar sessão aparecerá aqui quando o módulo de autenticação
            existir. Enquanto não existir, o item não é exibido.
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
