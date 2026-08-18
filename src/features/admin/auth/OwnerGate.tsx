import { type ReactNode, useEffect, useState } from 'react';

export type OwnerAccess = 'owner' | 'denied';

type OwnerGateProps = {
  children: ReactNode;
  resolveAccess: () => Promise<OwnerAccess>;
};

export function OwnerGate({ children, resolveAccess }: OwnerGateProps) {
  const [state, setState] = useState<'checking' | OwnerAccess>('checking');

  useEffect(() => {
    let cancelled = false;
    void resolveAccess()
      .then((access) => {
        if (!cancelled) setState(access);
      })
      .catch(() => {
        if (!cancelled) setState('denied');
      });

    return () => {
      cancelled = true;
    };
  }, [resolveAccess]);

  if (state === 'checking') {
    return (
      <main className="page-shell">
        <section className="placeholder-card" aria-live="polite">
          <p className="eyebrow">OWNER ONLY</p>
          <h1>ПРОВЕРЯЕМ ДОСТУП…</h1>
        </section>
      </main>
    );
  }

  if (state === 'denied') {
    return (
      <main className="page-shell">
        <section className="placeholder-card" role="alert">
          <p className="eyebrow">OWNER ONLY</p>
          <h1>ДОСТУП ЗАПРЕЩЁН</h1>
          <p>Эта панель доступна только владельцу события.</p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
