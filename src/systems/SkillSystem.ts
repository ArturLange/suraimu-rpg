import type { GameState, SkillId, SkillState, StatModifiers, PlayerStats } from '../types';
import { SKILL_DEFINITIONS, SKILL_MAP } from '../data/skills';
import { events } from '../core/EventBus';

const BASE_STATS: PlayerStats = {
  maxHp: 100,
  maxMp: 50,
  hpRegen: 1,
  mpRegen: 0.5,
  physicalAttack: 10,
  magicAttack: 5,
  physicalDefense: 5,
  magicDefense: 3,
  speed: 5,
  critChance: 5,
  dodgeChance: 3,
  explorationSpeed: 1,
};

/** XP needed to go from level N to N+1 */
export function xpToNextLevel(skillId: SkillId, currentLevel: number): number {
  const def = SKILL_MAP.get(skillId);
  if (!def) return Infinity;
  return Math.floor(def.xpBase * Math.pow(currentLevel + 1, def.xpExponent));
}

/** How much player-level XP is needed for the next level */
export function playerXpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.8));
}

export class SkillSystem {
  /** Add XP to a skill; returns true if levelled up */
  addSkillXp(state: GameState, skillId: SkillId, amount: number): boolean {
    const skill = state.player.skills[skillId];
    if (!skill) return false;

    const def = SKILL_MAP.get(skillId);
    if (!def || skill.level >= def.maxLevel) return false;

    let levelled = false;
    skill.xp += amount;

    while (skill.xp >= skill.xpToNext && skill.level < def.maxLevel) {
      skill.xp -= skill.xpToNext;
      skill.level++;
      skill.xpToNext = xpToNextLevel(skillId, skill.level);
      levelled = true;
      this.onSkillLevelUp(state, skillId, skill.level);
    }

    return levelled;
  }

  private onSkillLevelUp(state: GameState, skillId: SkillId, newLevel: number): void {
    const def = SKILL_MAP.get(skillId);
    if (!def) return;

    const message = `🎉 ${def.name} reached level ${newLevel}!`;
    state.activityLog.unshift({
      timestamp: Date.now(),
      message,
      type: 'skill',
    });
    events.emit('skill:levelUp', { skillId, level: newLevel });
  }

  /** Award passive skill XP each tick */
  tickPassiveXp(state: GameState): void {
    const skills = state.player.skills;

    // Breathing always gains XP passively
    if (skills.breathing?.active) {
      this.addSkillXp(state, 'breathing', 0.5);
    }

    // Herbalism gains passive XP when exploring
    if (state.explore.exploring && skills.herbalism?.active) {
      this.addSkillXp(state, 'herbalism', 0.2);
    }
  }

  /** Compute all stat bonuses from skills + equipment */
  computeStats(state: GameState): PlayerStats {
    const stats: PlayerStats = { ...BASE_STATS };
    const playerLevel = state.player.level;

    // Base stat scaling with player level
    stats.maxHp += playerLevel * 8;
    stats.maxMp += playerLevel * 5;
    stats.physicalAttack += playerLevel * 1.5;
    stats.magicAttack += playerLevel * 1.2;
    stats.physicalDefense += playerLevel * 0.8;
    stats.magicDefense += playerLevel * 0.6;

    // Add skill bonuses
    for (const def of SKILL_DEFINITIONS) {
      const skillState = state.player.skills[def.id];
      if (!skillState || skillState.level === 0) continue;

      const effects = def.effectsPerLevel;
      const lvl = skillState.level;

      if (effects.maxHp) stats.maxHp += effects.maxHp * lvl;
      if (effects.maxMp) stats.maxMp += effects.maxMp * lvl;
      if (effects.hpRegen) stats.hpRegen += effects.hpRegen * lvl;
      if (effects.mpRegen) stats.mpRegen += effects.mpRegen * lvl;
      if (effects.physicalAttack) stats.physicalAttack += effects.physicalAttack * lvl;
      if (effects.magicAttack) stats.magicAttack += effects.magicAttack * lvl;
      if (effects.physicalDefense) stats.physicalDefense += effects.physicalDefense * lvl;
      if (effects.magicDefense) stats.magicDefense += effects.magicDefense * lvl;
      if (effects.speed) stats.speed += effects.speed * lvl;
      if (effects.critChance) stats.critChance += effects.critChance * lvl;
      if (effects.dodgeChance) stats.dodgeChance += effects.dodgeChance * lvl;
      if (effects.explorationSpeed) stats.explorationSpeed += effects.explorationSpeed * lvl;
    }

    // Equipment bonuses
    const { equipment, inventory } = state.player;
    const equippedIds = Object.values(equipment).filter(Boolean) as string[];
    for (const itemId of equippedIds) {
      const slot = inventory.find((s) => s.itemId === itemId);
      if (!slot) continue;
      // Item stat bonuses are handled via ITEM_MAP lookup in game.ts
    }

    return this.roundStats(stats);
  }

  private roundStats(stats: PlayerStats): PlayerStats {
    const result = {} as PlayerStats;
    for (const key of Object.keys(stats) as (keyof PlayerStats)[]) {
      result[key] = Math.max(0, Math.round((stats[key] as number) * 10) / 10);
    }
    return result;
  }

  /** Create an initial set of skills for a new player */
  createInitialSkills(): Record<SkillId, SkillState> {
    const result = {} as Record<SkillId, SkillState>;
    for (const def of SKILL_DEFINITIONS) {
      result[def.id] = {
        id: def.id,
        level: 0,
        xp: 0,
        xpToNext: xpToNextLevel(def.id, 0),
        active: def.id === 'breathing', // Breathing is active by default
      };
    }
    return result;
  }

  /** Add player XP and handle level-up */
  addPlayerXp(state: GameState, amount: number): void {
    state.player.xp += amount;
    while (state.player.xp >= state.player.xpToNext) {
      state.player.xp -= state.player.xpToNext;
      state.player.level++;
      state.player.xpToNext = playerXpForLevel(state.player.level);

      state.activityLog.unshift({
        timestamp: Date.now(),
        message: `⬆️ Player reached level ${state.player.level}!`,
        type: 'level',
      });
      events.emit('player:levelUp', { level: state.player.level });
    }
  }

  getStatModifiers(state: GameState): Partial<StatModifiers> {
    const computed = this.computeStats(state);
    return computed as unknown as Partial<StatModifiers>;
  }
}
