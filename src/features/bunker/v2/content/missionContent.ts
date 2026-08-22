export type BunkerMissionKey = 'M01' | 'M02' | 'M03' | 'M04' | 'M05' | 'M06' | 'FINAL';

export type BunkerMissionContent = {
  key: BunkerMissionKey;
  title: string;
  story: string;
  goal: string;
  steps: readonly string[];
  items: readonly { key: string; purpose: string }[];
  consequences: readonly string[];
  host: {
    say: readonly string[];
    hints: readonly string[];
    afterCompletion: string;
  };
};

const M01: BunkerMissionContent = {
  key: 'M01',
  title: 'Лишний пассажир',
  story: 'После аварии система поезда потеряла часть данных пассажиров. Перед входом в Бункер вагон должен определить, какие сюжетные роли не продолжат путь.',
  goal: 'Всем вагоном выбрать персонажей, которые не помогут составу выжить дальше.',
  steps: [
    'Изучите карточки персонажей.',
    'Обсудите решение всей командой.',
    'Выберите нужное количество персонажей.',
    'Подтвердите решение вагона.',
  ],
  items: [
    { key: 'dossier', purpose: 'Карточки показывают профессию, состояние и навыки персонажей.' },
  ],
  consequences: [
    'Открывается информация о пассажирском протоколе.',
    'Состав получает первые данные об объекте BK-17.',
  ],
  host: {
    say: [
      'Поезд изменил маршрут. Перед Бункером система требует первое решение.',
      'Вы выбираете судьбу сюжетных персонажей, а не реальных гостей.',
    ],
    hints: [
      'Смотрите на пользу навыков, а не только на симпатию к персонажу.',
      'Попросите капитана вагона подвести итог обсуждения.',
    ],
    afterCompletion: 'После завершения всех вагонов переходите к восстановлению чёрного ящика.',
  },
};

const CONTENT: Partial<Record<BunkerMissionKey, BunkerMissionContent>> = { M01 };

export function getBunkerMissionContent(key: BunkerMissionKey): BunkerMissionContent | undefined {
  return CONTENT[key];
}
