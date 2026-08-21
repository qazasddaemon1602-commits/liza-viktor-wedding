import '../../styles/admin-mobile-navigation.css';

const destinations = [
  ['СЕЙЧАС', '#admin-now'],
  ['СОСТАВ', '#admin-composition'],
  ['ПРЕМЬЕРА', '#admin-premiere'],
  ['LIVE QUIZ', '#admin-quiz'],
  ['ТУРНИР', '#admin-tournament'],
  ['БУНКЕР', '#admin-bunker'],
  ['ГОСТИ', '#admin-guests'],
  ['СБРОС', '#admin-reset'],
] as const;

export function AdminMobileNavigation() {
  return (
    <nav className="admin-mobile-navigation" aria-label="Быстрая навигация по админке">
      <span>ПУЛЬТ</span>
      <div>
        {destinations.map(([label, href]) => (
          <a key={href} href={href}>{label}</a>
        ))}
      </div>
    </nav>
  );
}
