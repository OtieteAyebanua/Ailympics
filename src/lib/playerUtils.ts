import { type DbPlayer, type OwnedPlayer, type StatLabel } from '../models/models';

/** Converts column-based stats to the label/val array the UI components use. */
export function getPlayerStats(p: DbPlayer): { label: string; val: number }[] {
  if (p.position === 'GK') {
    return [
      { label: 'REF', val: p.reflexes    ?? 0 },
      { label: 'POS', val: p.positioning ?? 0 },
      { label: 'KIC', val: p.kicking     ?? 0 },
      { label: 'HAN', val: p.handling    ?? 0 },
      { label: 'DIS', val: p.distribution ?? 0 },
    ].filter(s => s.val > 0);
  }
  return [
    { label: 'PAC', val: p.pace        ?? 0 },
    { label: 'SHO', val: p.finishing   ?? 0 },
    { label: 'DRI', val: p.dribbling   ?? 0 },
    { label: 'STA', val: p.stamina     ?? 0 },
    { label: 'PAS', val: p.passing     ?? 0 },
    { label: 'DEF', val: p.defending   ?? 0 },
    { label: 'PHY', val: p.physicality ?? 0 },
  ].filter(s => s.val > 0);
}

/**
 * Returns stats with training boosts applied on top of base values.
 * Used in Training and Squad views for owned players.
 */
export function getEffectiveStats(p: OwnedPlayer): { label: string; val: number }[] {
  const statLabelMap: Record<string, StatLabel> = {
    PAC: 'pace', SHO: 'finishing', DRI: 'dribbling',
    STA: 'stamina', PAS: 'passing', DEF: 'defending', PHY: 'physicality',
    REF: 'reflexes', POS: 'positioning', KIC: 'kicking',
    HAN: 'handling', DIS: 'distribution',
  };

  return getPlayerStats(p).map(s => ({
    label: s.label,
    val:   Math.min(99, s.val + (p.boosts[statLabelMap[s.label]] ?? 0)),
  }));
}
