/*
 * Shared appearance of the circular controls in the top bar. Kept in one place
 * so the search, filter, theme, notification, and settings controls stay a
 * single visual family while each one owns its own behaviour.
 *
 * The control is 44 pixels wide on a touch screen, which is the smallest target
 * a finger hits reliably, and returns to 40 from the small breakpoint upwards,
 * where the target is a pointer and the vertical space of the bar is worth more.
 */
export const navIconButtonClasses =
  "inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-line bg-card text-ink-soft shadow-card transition-colors duration-(--motion-fast) hover:text-ink sm:size-10";

/*
 * Panels dropped from the top bar: same surface, same elevation, same spacing,
 * whether they are anchored to a control or centred on the viewport.
 */
export const navPanelClasses =
  "z-50 flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-panel";
