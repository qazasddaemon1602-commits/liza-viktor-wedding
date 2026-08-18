const rehearsalLinks = [
  { href: '/screen', label: 'ОТКРЫТЬ ТВ', hint: 'Главный экран' },
  { href: '/join', label: 'РЕГИСТРАЦИЯ ГОСТЯ', hint: 'Тестовый телефон' },
  { href: '/play', label: 'КВИЗ', hint: 'Экран гостя' },
  { href: '/mortal-kombat', label: 'MK', hint: 'Участие гостя' },
  { href: '/mortal-kombat/screen', label: 'MK НА ТВ', hint: 'Отдельный экран' },
] as const;

export function AdminRehearsalPanel() {
  return (
    <section className="admin-rehearsal" aria-labelledby="admin-rehearsal-title">
      <div className="admin-rehearsal__heading">
        <div>
          <p className="eyebrow">БЫСТРЫЙ ДОСТУП</p>
          <h2 id="admin-rehearsal-title">РЕПЕТИЦИЯ</h2>
        </div>
        <p>Открывайте тестовые экраны в новых вкладках — админка останется под рукой.</p>
      </div>

      <nav className="admin-rehearsal__links" aria-label="Ссылки для репетиции">
        {rehearsalLinks.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
            <span>{link.hint}</span>
            <strong>{link.label}</strong>
            <i aria-hidden="true">↗</i>
          </a>
        ))}
      </nav>
    </section>
  );
}
