import { describe, expect, it } from 'vitest';
import { affectedDownstreamMatches, buildBracket, nextMatchSlot } from './bracket';

describe('Mortal Kombat bracket model', () => {
  it('requires exactly sixteen players', () => {
    expect(() => buildBracket(['p1'])).toThrow(/2/i);
  });

  it('builds eight R16, four quarterfinals, two semifinals and one final', () => {
    const bracket = buildBracket(Array.from({ length: 16 }, (_, index) => `p${index + 1}`));

    expect(bracket.filter((match) => match.round === 'r16')).toHaveLength(8);
    expect(bracket.filter((match) => match.round === 'qf')).toHaveLength(4);
    expect(bracket.filter((match) => match.round === 'sf')).toHaveLength(2);
    expect(bracket.filter((match) => match.round === 'final')).toHaveLength(1);
    expect(bracket).toHaveLength(15);
  });

  it('places the initial sixteen players in standard seed slot pairs', () => {
    const bracket = buildBracket(Array.from({ length: 16 }, (_, index) => `p${index + 1}`));

    expect(bracket.find((match) => match.matchKey === 'r16-1')).toMatchObject({
      player1GuestId: 'p1',
      player2GuestId: 'p16',
    });
    expect(bracket.find((match) => match.matchKey === 'r16-8')).toMatchObject({
      player1GuestId: 'p2',
      player2GuestId: 'p15',
    });
  });


  it('maps adjacent upstream matches into alternating downstream slots', () => {
    expect(nextMatchSlot({ round: 'r16', position: 1 })).toEqual({ matchKey: 'qf-1', slot: 'player1' });
    expect(nextMatchSlot({ round: 'r16', position: 2 })).toEqual({ matchKey: 'qf-1', slot: 'player2' });
    expect(nextMatchSlot({ round: 'qf', position: 4 })).toEqual({ matchKey: 'sf-2', slot: 'player2' });
    expect(nextMatchSlot({ round: 'sf', position: 1 })).toEqual({ matchKey: 'final-1', slot: 'player1' });
    expect(nextMatchSlot({ round: 'final', position: 1 })).toBeNull();
  });

  it('returns only the downstream branch affected by a correction', () => {
    const bracket = buildBracket(Array.from({ length: 16 }, (_, index) => `p${index + 1}`));

    expect(affectedDownstreamMatches(bracket, 'r16-1')).toEqual(['qf-1', 'sf-1', 'final-1']);
    expect(affectedDownstreamMatches(bracket, 'qf-4')).toEqual(['sf-2', 'final-1']);
    expect(affectedDownstreamMatches(bracket, 'final-1')).toEqual([]);
  });
});
describe('Mortal Kombat bracket with fewer than sixteen players', () => {
  const seededPlayers = (count: number) => Array.from({ length: count }, (_, index) => `p${index + 1}`);

  it('rejects fewer than two players but accepts 2..16', () => {
    expect(() => buildBracket(seededPlayers(1))).toThrow(/2/);
    expect(() => buildBracket(seededPlayers(2))).not.toThrow();
    expect(() => buildBracket(seededPlayers(9))).not.toThrow();
    expect(() => buildBracket(seededPlayers(17))).toThrow();
  });

  it('places 16 seeds in standard tournament slot order', () => {
    const bracket = buildBracket(seededPlayers(16));

    expect(bracket.find((match) => match.matchKey === 'r16-1')).toMatchObject({
      player1GuestId: 'p1',
      player2GuestId: 'p16',
    });
    expect(bracket.find((match) => match.matchKey === 'r16-2')).toMatchObject({
      player1GuestId: 'p8',
      player2GuestId: 'p9',
    });
    expect(bracket.find((match) => match.matchKey === 'r16-8')).toMatchObject({
      player1GuestId: 'p2',
      player2GuestId: 'p15',
    });
  });

  it('gives 9 players exactly one real R16 fight and seven byes', () => {
    const bracket = buildBracket(seededPlayers(9));
    const r16 = bracket.filter((match) => match.round === 'r16');
    const real = r16.filter((match) => match.player1GuestId && match.player2GuestId);
    const byes = r16.filter((match) => Boolean(match.player1GuestId) !== Boolean(match.player2GuestId));

    expect(real).toHaveLength(1);
    expect(real[0]).toMatchObject({ matchKey: 'r16-2', player1GuestId: 'p8', player2GuestId: 'p9' });
    expect(byes).toHaveLength(7);
    expect(bracket).toHaveLength(15);
  });

  it('gives 8 players no real R16 fight so play effectively starts at the quarterfinals', () => {
    const bracket = buildBracket(seededPlayers(8));
    const r16 = bracket.filter((match) => match.round === 'r16');

    expect(r16.filter((match) => match.player1GuestId && match.player2GuestId)).toHaveLength(0);
    expect(r16.filter((match) => match.player1GuestId || match.player2GuestId)).toHaveLength(8);
  });

  it('gives 4 players only semifinal-level play and 2 players only a final', () => {
    const four = buildBracket(seededPlayers(4)).filter((match) => match.round === 'r16');
    expect(four.filter((match) => match.player1GuestId || match.player2GuestId)).toHaveLength(4);

    const two = buildBracket(seededPlayers(2)).filter((match) => match.round === 'r16');
    expect(two.filter((match) => match.player1GuestId || match.player2GuestId)).toHaveLength(2);
    expect(two.find((match) => match.matchKey === 'r16-1')?.player1GuestId).toBe('p1');
    expect(two.find((match) => match.matchKey === 'r16-8')?.player1GuestId).toBe('p2');
  });
});
