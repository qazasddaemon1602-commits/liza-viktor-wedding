import { useState } from 'react';
import type { ActiveGuestBunkerRuntime } from './bunkerRuntime.service';
import { BunkerResponsivePicture, type BunkerAsset } from './BunkerResponsivePicture';
import type { BunkerV2ActiveGuestRuntime } from './v2/contracts';
import { bunkerArchiveLabel, bunkerContentTypeLabel, bunkerItemLabel, bunkerStageLabel, bunkerStatusLabel } from './v2/labels';
import { MissionOnePlayer, type MissionOnePlayerReadModel } from './v2/MissionOnePlayer';
import { MissionTwoPlayer, type MissionTwoPlayerReadModel } from './v2/MissionTwoPlayer';
import { MissionThreePlayer, type MissionThreePlayerReadModel } from './v2/MissionThreePlayer';
import { MissionFourPlayer, type MissionFourPlayerReadModel } from './v2/MissionFourPlayer';
import { MissionFivePlayer, type MissionFivePlayerReadModel } from './v2/MissionFivePlayer';
import { MissionSixPlayer, type MissionSixPlayerReadModel } from './v2/MissionSixPlayer';
import { UnknownPassengerPlayer, type UnknownPassengerPlayerModel } from './v2/UnknownPassengerPlayer';
import { FinalPlayer, type FinalPlayerModel } from './v2/FinalPlayer';
import type { FinalValues } from './v2/final.service';
import { BunkerResultsLivePlayer } from './v2/BunkerResultsLivePlayer';

const SECTIONS = ['МОЙ ВАГОН','ПЕРСОНАЖ','ПАССАЖИРЫ','ИНВЕНТАРЬ','АРХИВ','СОСТОЯНИЕ','ТЕКУЩЕЕ ЗАДАНИЕ'] as const;
type Section = typeof SECTIONS[number];
function rows(value: unknown[]): Record<string, unknown>[] { return value.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null && !Array.isArray(entry)); }
type ArchiveEntry = { artifactKey: string; contentType: string; decryptionStatus: string; scope: string };
function nonEmptyText(value: unknown) { return typeof value === 'string' && value.trim() ? value : null; }
function archiveEntries(value: unknown[]): ArchiveEntry[] { return rows(value).flatMap((entry) => { const artifactKey=nonEmptyText(entry.artifactKey),contentType=nonEmptyText(entry.contentType),decryptionStatus=nonEmptyText(entry.decryptionStatus),scope=nonEmptyText(entry.scope); return artifactKey&&contentType&&decryptionStatus&&scope ? [{artifactKey,contentType,decryptionStatus,scope}] : []; }); }
function artwork(entry: ArchiveEntry): BunkerAsset | null { const key=entry.artifactKey.toLowerCase(),type=entry.contentType.toLowerCase(); if(key.includes('bk17')||key.includes('bk-17'))return'archive-bk17'; if(type==='card')return'archive-card'; if(type==='document')return'archive-document'; return null; }

type Props = {
  runtime: ActiveGuestBunkerRuntime | BunkerV2ActiveGuestRuntime;
  connectionError?: string;
  missionOne?: MissionOnePlayerReadModel;
  missionTwo?: MissionTwoPlayerReadModel;
  missionThree?: MissionThreePlayerReadModel;
  missionFour?: MissionFourPlayerReadModel;
  missionFive?: MissionFivePlayerReadModel;
  missionSix?: MissionSixPlayerReadModel;
  unknownPassenger?: UnknownPassengerPlayerModel;
  final?: FinalPlayerModel;
  onConfirmMissionOne?: (ids: string[]) => Promise<void> | void;
  onSubmitMissionTwo?: (answers: string[]) => Promise<void> | void;
  onUseMissionTwoAbility?: (ability: 'system_access' | 'terminal_hack') => Promise<void> | void;
  onConfirmMissionThree?: (problems: string[]) => Promise<void> | void;
  onUseMissionThreeAbility?: (problem: string) => Promise<void> | void;
  onSendMissionFourMessage?: (message: string) => Promise<void> | void;
  onProposeMissionFourTrade?: (input: { targetWagonNumber: number; itemKey: string; quantity: number }) => Promise<void> | void;
  onRespondMissionFourTrade?: (id: string, response: 'accept' | 'reject') => Promise<void> | void;
  onSubmitMissionFourAnswer?: (answer: string) => Promise<void> | void;
  onCastMissionFiveVote?: (vote: 'A' | 'B') => Promise<void> | void;
  onUseMissionFiveAbility?: () => Promise<void> | void;
  onRevealMissionSixFragment?: () => Promise<void> | void;
  onCastMissionSixVote?: (vote: 'A' | 'B' | 'C') => Promise<void> | void;
  onUseMissionSixAbility?: () => Promise<void> | void;
  onRequestFinalAccess?: (values: FinalValues) => Promise<void> | void;
};

export function BunkerPlayerDashboard({ runtime, connectionError='', missionOne, missionTwo, missionThree, missionFour, missionFive, missionSix, unknownPassenger, final, onConfirmMissionOne, onSubmitMissionTwo, onUseMissionTwoAbility, onConfirmMissionThree, onUseMissionThreeAbility, onSendMissionFourMessage, onProposeMissionFourTrade, onRespondMissionFourTrade, onSubmitMissionFourAnswer, onCastMissionFiveVote, onUseMissionFiveAbility, onRevealMissionSixFragment, onCastMissionSixVote, onUseMissionSixAbility, onRequestFinalAccess }: Props) {
  const isV2 = 'contractVersion' in runtime;
  const guest = isV2 ? { ...runtime.viewer.guest, joinedLate: runtime.character.m01Eligibility === 'late_joiner' } : runtime.guest;
  const activeId = missionOne?.instanceId ?? missionTwo?.instanceId ?? missionThree?.instanceId ?? missionFour?.instanceId ?? missionFive?.instanceId ?? missionSix?.instanceId ?? '';
  const wagon = isV2 ? { id: activeId, ...runtime.viewer.wagon } : runtime.wagon;
  const gameState = isV2 ? runtime.state : runtime.game.state;
  const v2Passengers = missionOne?.members.map((member) => ({ ...member, hiddenTraitRevealed: false })) ?? [];
  const hasMission = Boolean(missionOne || missionTwo || missionThree || missionFour || missionFive || missionSix || unknownPassenger || final);
  const [section, setSection] = useState<Section>(hasMission ? 'ТЕКУЩЕЕ ЗАДАНИЕ' : 'МОЙ ВАГОН');
  const inventory = rows(isV2 ? (missionThree?.inventory ?? missionFour?.inventory ?? []) : runtime.inventory);
  const passengers = rows(isV2 ? v2Passengers : runtime.passengers);
  const archive = archiveEntries(isV2 ? [] : runtime.archive);
  const mission = isV2 ? runtime.currentMission : null;
  const resultsStage = isV2 && (gameState === 'BUNKER_OPEN' || gameState === 'FINISHED');

  if (resultsStage) {
    return <section className="bunker-player-dashboard bunker-player-dashboard--results" aria-label="Игровой модуль Бункер"><BunkerResultsLivePlayer /></section>;
  }

  return <section className={`bunker-player-dashboard${hasMission?' bunker-player-dashboard--active-mission':''}`} aria-label="Игровой модуль Бункер">
    {missionOne && <MissionOnePlayer model={missionOne} onConfirm={onConfirmMissionOne}/>} 
    {missionTwo && <MissionTwoPlayer model={missionTwo} onSubmit={onSubmitMissionTwo} onUseAbility={onUseMissionTwoAbility}/>} 
    {missionThree && <MissionThreePlayer model={missionThree} onConfirm={onConfirmMissionThree} onUseAbility={onUseMissionThreeAbility}/>} 
    {missionFour && <MissionFourPlayer model={missionFour} onSend={onSendMissionFourMessage} onProposeTrade={onProposeMissionFourTrade} onRespondTrade={onRespondMissionFourTrade} onAnswer={onSubmitMissionFourAnswer}/>} 
    {missionFive && <MissionFivePlayer model={missionFive} onVote={onCastMissionFiveVote} onUseAbility={onUseMissionFiveAbility}/>} 
    {missionSix && <MissionSixPlayer model={missionSix} onReveal={onRevealMissionSixFragment} onVote={onCastMissionSixVote} onUseAbility={onUseMissionSixAbility}/>} 
    {unknownPassenger && <UnknownPassengerPlayer model={unknownPassenger}/>} 
    {final && <FinalPlayer model={final} onRequestAccess={onRequestFinalAccess}/>} 
    <header className="bunker-player-dashboard__header"><div><p className="bunker-player-dashboard__index">ПОСЛЕДНИЙ ВАГОН · {wagon.label}</p><h2 className="bunker-player-dashboard__guest-name">{guest.realName.toLocaleUpperCase('ru-RU')}</h2></div><span className="bunker-player-dashboard__state">{bunkerStageLabel(gameState).toLocaleUpperCase('ru-RU')}</span></header>
    {!hasMission && <BunkerResponsivePicture asset="tunnel-relief-wide" mobileAsset="tunnel-relief-mobile" className="bunker-player-dashboard__relief" testId="bunker-tunnel-relief" loading="eager"/>}
    {connectionError && <p className="bunker-player-dashboard__connection" role="alert">{connectionError}</p>}
    {guest.joinedLate && <p className="bunker-player-dashboard__late">Вы присоединились после отправления. Некоторые решения уже приняты вагоном — это нормально.</p>}
    <nav className="bunker-player-dashboard__nav" aria-label="Разделы игры">{SECTIONS.map((item)=><button key={item} type="button" aria-pressed={section===item} onClick={()=>setSection(item)}>{item}</button>)}</nav>
    <div className="bunker-player-dashboard__content">
      {section==='МОЙ ВАГОН'&&<article><h3>{wagon.label}</h3><p>{passengers.length} пассажиров · решения синхронизируются автоматически.</p></article>}
      {section==='ПЕРСОНАЖ'&&<article><h3>{runtime.character.profession}</h3><p>Здоровье: {runtime.character.health}</p><p>Навык: {runtime.character.visibleSkill}</p><p>Способность: {runtime.character.abilityDescription}</p></article>}
      {section==='ПАССАЖИРЫ'&&<div>{passengers.length?passengers.map((passenger)=><article key={String(passenger.guestId)}><h3>{String(passenger.realName)}</h3></article>):<p>Список появится после синхронизации.</p>}</div>}
      {section==='ИНВЕНТАРЬ'&&<div>{inventory.length?inventory.map((item,index)=><article key={`${String(item.itemKey)}:${index}`}><h3>{bunkerItemLabel(String(item.itemKey))}</h3><p>Количество: {String(item.quantity)}</p></article>):<p>Инвентарь пока пуст.</p>}</div>}
      {section==='АРХИВ'&&<article><h3>АРХИВ ВАГОНА</h3>{archive.length?archive.map((entry)=>{const image=artwork(entry),label=bunkerArchiveLabel(entry.artifactKey);return <article key={`${entry.scope}:${entry.artifactKey}`}>{image&&<BunkerResponsivePicture asset={image} className="bunker-player-archive__artwork" testId="bunker-archive-artwork"/>}<h3>{label.title}</h3><strong>{bunkerContentTypeLabel(entry.contentType)}</strong><p>{label.hint}</p></article>}):<p>Найденные материалы появятся здесь автоматически.</p>}</article>}
      {section==='СОСТОЯНИЕ'&&<article><h3>СОСТОЯНИЕ ВАГОНА</h3><p>{isV2?'Состояние меняется от решений команды и сохраняется автоматически.':`Питание · ${bunkerStatusLabel(String(runtime.wagonState.powerStatus))}`}</p></article>}
      {section==='ТЕКУЩЕЕ ЗАДАНИЕ'&&<article><h3>ТЕКУЩЕЕ ЗАДАНИЕ</h3><p>{hasMission?'Активное задание находится в верхней части экрана.':mission?`Сейчас: ${bunkerStageLabel(gameState)}`:'Сейчас активного задания нет.'}</p></article>}
    </div>
  </section>;
}
