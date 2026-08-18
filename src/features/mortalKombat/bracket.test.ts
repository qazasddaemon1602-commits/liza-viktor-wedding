import { describe, expect, it } from 'vitest';
import { affectedDownstreamMatches, buildBracket, nextMatchSlot } from './bracket';

describe('Mortal Kombat bracket model', () => {
  it('requires exactly sixteen players', () => {
    expect(() => buildBracket(['p1'])).toThrow(/16/i);
  });

  it('builds eight R16, four quarterfinals, two semifinals and one final', () => {
    const bracket = buildBracket(Array.from({ length: 16 }, (_, index) => `p${index + 1}`));

    expect(bracket.filter((match) => match.round === 'r16')).toHaveLength(8);
    expect(bracket.filter((match) => match.round === 'qf')).toHaveLength(4);
    expect(bracket.filter((match) => match.round === 'sf')).toHaveLength(2);
    expect(bracket.filter((match) => match.round === 'final')).toHaveLength(1);
    expect(bracket).toHaveLength(15);
  });

  it('places the initial sixteen players in stable first-round pairs', () => {
    const bracket = buildBracket(Array.from({ length: 16 }, (_, index) => `p${index + 1}`));

    expect(bracket.find((match) => match.matchKey === 'r16-1')).toMatchObject({
      player1GuestId: 'p1',
      player2GuestId: 'p2',
    });
    expect(bracket.find((match) => match.matchKey === 'r16-8')).toMatchObject({
      player1GuestId: 'p15',
      player2GuestId: 'p16',
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