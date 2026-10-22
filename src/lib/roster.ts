export const STEADY_GROUP = '穩健組';
export const ATTACK_GROUP = '進攻組';
export const UNGROUPED = '未分組';

export const TEAM_ORDER = [STEADY_GROUP, ATTACK_GROUP] as const;

export type RosterBot = {
  code: string;
  name: string;
  group: string;
  envPrefix: string;
};

export const ROSTER: readonly RosterBot[] = [
  { code: 'defense', name: 'Crypto防禦派', group: STEADY_GROUP, envPrefix: 'OKX_DEFENSE' },
  { code: 'conservative', name: 'Crypto保守派', group: STEADY_GROUP, envPrefix: 'OKX_CONSERVATIVE' },
  { code: 'aggressive', name: 'Crypto激進份子', group: ATTACK_GROUP, envPrefix: 'OKX_AGGRESSIVE' },
  { code: 'fanatic', name: 'Crypto狂熱份子', group: ATTACK_GROUP, envPrefix: 'OKX_FANATIC' },
];

export function teamTone(group: string): 'steady' | 'attack' | 'other' {
  if (group === STEADY_GROUP) return 'steady';
  if (group === ATTACK_GROUP) return 'attack';
  return 'other';
}

export function teamSortKey(group: string): string {
  const index = TEAM_ORDER.indexOf(group as (typeof TEAM_ORDER)[number]);
  if (index >= 0) return String(index).padStart(2, '0');
  if (group === UNGROUPED) return 'zz';
  return `yy${group}`;
}
