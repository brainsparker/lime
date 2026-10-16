import type { ReactNode } from "react";

/** 复用 Settings 壳的滚动 owner，避免嵌套滚动。 */
export function ProfileLayout({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="w-full max-w-[732px] pb-8 text-foreground"
      data-testid="settings-profile-page"
      aria-labelledby="profile-heading"
    >
      <h2 id="profile-heading" className="mb-6 text-xl font-semibold">
        {header}
      </h2>
      {children}
    </section>
  );
}
