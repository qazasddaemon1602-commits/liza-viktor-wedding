import { useState } from 'react';
import type { FinalFragment, FinalHint, FinalValues } from './final.service';

export type FinalPlayerModel = {
  remainingSeconds: number;
  title: string;
  wagon: { number: number; label: string };
  fragments: FinalFragment[];
  terminal: { solved: number; total: number; wrongAttempts: number; unlocked: boolean };
  hint: FinalHint;
  connection: 'online' | 'reconnecting';
  timeAdjustmentSeconds?: number;
};

const EMPTY: FinalValues = { coordinates: '', sector: '', accessCode: '', gateTime: '', password: '' };
const FIELDS: Array<{ key: keyof FinalValues; label: string; inputMode?: 'numeric'; autoCapitalize?: 'characters' }> = [
  { key: 'coordinates', label: 'Координаты' },
  { key: 'sector', label: 'Сектор', inputMode: 'numeric' },
  { key: 'accessCode', label: 'Код доступа', inputMode: 'numeric' },
  { key: 'gateTime', label: 'Время открытия ворот', inputMode: 'numeric' },
  { key: 'password', label: 'Пароль', autoCapitalize: 'characters' },
];

function timer(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

export function FinalPlayer({ model, onRequestAccess }: { model: FinalPlayerModel; onRequestAccess?: (values: FinalValues) => Promise<void> | void }) {
  const [values, setValues] = useState<FinalValues>(EMPTY);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState('');
  const complete = Object.values(values).every((value) => value.trim());
  const currentField = FIELDS[step];
  const reviewing = step === FIELDS.length;
  const set = <K extends keyof FinalValues>(key: K, value: FinalValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  const requestAccess = async () => {
    if (!onRequestAccess || busy) return;
    setBusy(true);
    setRequestFeedback('');
    try {
      await onRequestAccess(values);
      setRequestFeedback('Версия отправлена. Ожидайте подтверждения терминала.');
    } catch {
      setRequestFeedback('Версия не отправлена. Проверьте связь и попробуйте снова.');
    } finally {
      setBusy(false);
    }
  };

  if (model.terminal.unlocked) return <section className="bunker-v2-mission bunker-v2-final-player" aria-label="Финал · Бункер открыт"><h1>ДОСТУП ПОЛУЧЕН</h1><p>Шлюз Бункера разблокирован. Оставайтесь на своих экранах — начинается финальная сцена.</p></section>;

  return <section className="bunker-v2-mission bunker-v2-final-player" aria-label="Финал · 30 минут до Бункера">
    <header className="bunker-v2-mission__header"><div><span>ФИНАЛ</span><h1>{model.title.toLocaleUpperCase('ru-RU')}</h1></div><time aria-label="До прибытия">{timer(model.remainingSeconds)}</time></header>
    <div className="bunker-v2-final-player__brief"><strong>ЕДИНСТВЕННАЯ БЕЗОПАСНАЯ ТОЧКА — БУНКЕР</strong><p>У каждого вагона только часть данных. Обменивайтесь фрагментами вслух и вместе заполните пять полей терминала.</p>{model.timeAdjustmentSeconds !== undefined && model.timeAdjustmentSeconds !== 0 && <small>Решения прошлых заданий изменили запас времени: {model.timeAdjustmentSeconds > 0 ? '+' : ''}{Math.round(model.timeAdjustmentSeconds / 60)} мин.</small>}</div>
    {model.connection === 'reconnecting' && <p role="status">Связь восстанавливается. Фрагменты остаются на экране, введённый текст не потерян.</p>}
    <section aria-label="Данные вашего вагона"><h2>ДАННЫЕ {model.wagon.label}</h2>{model.fragments.length === 0 ? <p>Ваш вагон не хранит отдельного фрагмента. Помогайте команде собирать данные остальных вагонов.</p> : <div className="bunker-v2-final-fragments">{model.fragments.map((fragment, index) => <article key={`${fragment.parameter}:${fragment.part}:${index}`}><span>{fragment.label}{fragment.totalParts > 1 ? ` · ЧАСТЬ ${fragment.part} ИЗ ${fragment.totalParts}` : ''}</span><strong>{fragment.value}</strong><small>Передайте это другим вагонам.</small></article>)}</div>}</section>
    {model.hint.level > 0 && model.hint.text && <aside className="bunker-v2-final-hint" role="status"><strong>ПОДСКАЗКА СИСТЕМЫ</strong><p>{model.hint.text}</p></aside>}
    <section className="bunker-v2-final-terminal" aria-label="Терминал доступа">
      <header><h2>ТЕРМИНАЛ ДОСТУПА</h2><span>{model.terminal.solved} / {model.terminal.total} параметров подтверждено</span></header>
      <p>{reviewing ? 'Проверьте данные всей команды перед отправкой.' : `Шаг ${step + 1} из ${FIELDS.length}. Введите один параметр и продолжайте.`}</p>
      {model.terminal.wrongAttempts > 0 && <p role="status">Последняя версия не подошла. Сверьте неподтверждённые значения и попробуйте снова.</p>}
      {model.terminal.wrongAttempts === 0 && model.terminal.solved > 0 && <p role="status">Терминал подтвердил {model.terminal.solved} из {model.terminal.total} параметров.</p>}
      {requestFeedback && <p role="status">{requestFeedback}</p>}
      {!reviewing && currentField && <><label>{currentField.label}<input aria-label={currentField.label} inputMode={currentField.inputMode} autoCapitalize={currentField.autoCapitalize} autoComplete="off" value={values[currentField.key]} onChange={(event) => set(currentField.key, event.target.value)} /></label><div>{step > 0 && <button type="button" onClick={() => setStep((current) => current - 1)}>НАЗАД</button>}<button className="bunker-v2-mission__primary" type="button" disabled={!values[currentField.key].trim()} onClick={() => setStep((current) => current + 1)}>ПРОДОЛЖИТЬ</button></div></>}
      {reviewing && <><h3>ПРОВЕРЬТЕ ВСЕ ПЯТЬ ПАРАМЕТРОВ</h3><dl>{FIELDS.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{values[field.key]}</dd></div>)}</dl>{!onRequestAccess && <p role="alert">Обычный путь терминала недоступен. Обратитесь к ведущему: у него остаётся аварийное открытие Бункера.</p>}<div><button type="button" onClick={() => setStep(FIELDS.length - 1)}>НАЗАД</button><button className="bunker-v2-mission__primary" type="button" disabled={!complete || busy || !onRequestAccess} onClick={() => void requestAccess()}>ЗАПРОСИТЬ ДОСТУП</button></div></>}
    </section>
  </section>;
}
