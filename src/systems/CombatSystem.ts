import type {
  GameState,
  MonsterDefinition,
  CombatLogEntry,
  DamageType,
} from '../types';
import { MONSTER_MAP } from '../data/monsters';
import { LOCATION_MAP } from '../data/locations';
import { ITEM_MAP } from '../data/items';
import { SkillSystem } from './SkillSystem';
import { events } from '../core/EventBus';

const MAGIC_DAMAGE_SKILLS: Partial<Record<DamageType, string>> = {
  fire: 'fireMagic',
  water: 'waterMagic',
  wind: 'windMagic',
  earth: 'earthMagic',
  lightning: 'lightningMagic',
  dark: 'darkMagic',
  divine: 'divineMagic',
  spatial: 'spatialMagic',
  poison: 'poisonMagic',
};

export class CombatSystem {
  private skillSystem: SkillSystem;

  constructor(skillSystem: SkillSystem) {
    this.skillSystem = skillSystem;
  }

  /** Called each tick while in combat */
  tick(state: GameState): void {
    const combat = state.combat;
    if (!combat.active || !combat.currentMonster) return;

    const stats = this.skillSystem.computeStats(state);
    combat.ticksElapsed++;

    // === HP/MP Regen ===
    if (combat.playerHp < stats.maxHp) {
      combat.playerHp = Math.min(stats.maxHp, combat.playerHp + stats.hpRegen / 4);
    }
    if (combat.playerMp < stats.maxMp) {
      combat.playerMp = Math.min(stats.maxMp, combat.playerMp + stats.mpRegen / 4);
    }

    const monster = combat.currentMonster;

    // === Player attacks monster ===
    const attackResult = this.playerAttack(state, monster, stats);
    combat.monsterHp -= attackResult.damage;
    if (attackResult.damage > 0) {
      this.addCombatLog(state, {
        tick: combat.ticksElapsed,
        message: `You deal ${attackResult.damage.toFixed(0)} ${attackResult.type} damage to ${monster.name}${attackResult.isCrit ? ' (CRIT!)' : ''}.`,
        type: 'damage',
      });
    }

    // Give skill XP for dealing damage
    this.awardCombatSkillXp(state, attackResult.type, attackResult.damage);

    // === Check monster death ===
    if (combat.monsterHp <= 0) {
      this.onMonsterDeath(state, monster);
      return;
    }

    // === Monster attacks player ===
    const monsterAttack = this.monsterAttack(state, monster, stats);
    combat.playerHp -= monsterAttack.damage;
    if (monsterAttack.damage > 0) {
      this.addCombatLog(state, {
        tick: combat.ticksElapsed,
        message: `${monster.name} deals ${monsterAttack.damage.toFixed(0)} damage to you${monsterAttack.skillName ? ` (${monsterAttack.skillName})` : ''}.`,
        type: 'damage',
      });
    }

    // === Check player death ===
    if (combat.playerHp <= 0) {
      this.onPlayerDeath(state);
    }
  }

  private playerAttack(
    state: GameState,
    monster: MonsterDefinition,
    stats: ReturnType<SkillSystem['computeStats']>
  ): { damage: number; type: DamageType; isCrit: boolean } {
    const swordLevel = state.player.skills['swordFighting']?.level ?? 0;
    const bestMagicSkill = this.getBestMagicSkill(state);

    // Determine attack type: use magic if magic attack is stronger, else physical
    const usesMagic =
      bestMagicSkill !== null &&
      stats.magicAttack > stats.physicalAttack &&
      ((state.player.skills as Record<string, { level: number; active: boolean } | undefined>)[bestMagicSkill.id]?.level ?? 0) > 0;

    let rawDamage: number;
    let type: DamageType;

    if (usesMagic && bestMagicSkill) {
      rawDamage = stats.magicAttack * (1 + bestMagicSkill.level * 0.02);
      type = bestMagicSkill.element;
      rawDamage = Math.max(1, rawDamage - monster.magicDefense * 0.5);
    } else {
      rawDamage = stats.physicalAttack * (1 + swordLevel * 0.02);
      type = 'physical';
      rawDamage = Math.max(1, rawDamage - monster.physicalDefense * 0.5);
    }

    // Critical hit
    const critRoll = Math.random() * 100;
    const isCrit = critRoll < stats.critChance;
    if (isCrit) rawDamage *= 2;

    // Dodge check for monster (some monsters are quick)
    const monsterDodge = monster.speed * 0.1;
    if (Math.random() * 100 < monsterDodge) {
      return { damage: 0, type, isCrit: false };
    }

    return { damage: Math.max(1, Math.round(rawDamage)), type, isCrit };
  }

  private getBestMagicSkill(state: GameState): { id: string; level: number; element: DamageType } | null {
    const magicSkillIds: Array<{ id: string; element: DamageType }> = [
      { id: 'fireMagic', element: 'fire' },
      { id: 'waterMagic', element: 'water' },
      { id: 'windMagic', element: 'wind' },
      { id: 'earthMagic', element: 'earth' },
      { id: 'lightningMagic', element: 'lightning' },
      { id: 'darkMagic', element: 'dark' },
      { id: 'divineMagic', element: 'divine' },
      { id: 'spatialMagic', element: 'spatial' },
      { id: 'poisonMagic', element: 'poison' },
    ];

    let best: { id: string; level: number; element: DamageType } | null = null;
    for (const { id, element } of magicSkillIds) {
      const skill = state.player.skills[id as keyof typeof state.player.skills];
      if (skill && skill.active && skill.level > 0) {
        if (!best || skill.level > best.level) {
          best = { id, level: skill.level, element };
        }
      }
    }
    return best;
  }

  private monsterAttack(
    state: GameState,
    monster: MonsterDefinition,
    stats: ReturnType<SkillSystem['computeStats']>
  ): { damage: number; skillName?: string } {
    const combat = state.combat;

    // Try to use an ability
    for (const ability of monster.abilities) {
      if (ability.currentCooldown <= 0 && ability.powerMultiplier > 0) {
        if (combat.monsterMp >= ability.mpCost) {
          combat.monsterMp -= ability.mpCost;
          ability.currentCooldown = ability.cooldownTicks;

          const rawDamage =
            (monster.magicAttack > monster.physicalAttack
              ? monster.magicAttack
              : monster.physicalAttack) * ability.powerMultiplier;
          const defense =
            ability.damageType === 'physical' ? stats.physicalDefense : stats.magicDefense;
          const damage = Math.max(1, rawDamage - defense * 0.4);

          // Dodge
          if (Math.random() * 100 < stats.dodgeChance) {
            return { damage: 0, skillName: `${ability.name} (dodged!)` };
          }

          return { damage: Math.round(damage), skillName: ability.name };
        }
      }
      if (ability.currentCooldown > 0) {
        ability.currentCooldown--;
      }
    }

    // Normal attack
    let rawDamage = monster.physicalAttack;
    rawDamage = Math.max(1, rawDamage - stats.physicalDefense * 0.4);

    if (Math.random() * 100 < stats.dodgeChance) {
      this.addCombatLog(state, {
        tick: combat.ticksElapsed,
        message: `You dodged ${monster.name}'s attack!`,
        type: 'info',
      });
      return { damage: 0 };
    }

    return { damage: Math.round(rawDamage) };
  }

  private onMonsterDeath(state: GameState, monster: MonsterDefinition): void {
    const combat = state.combat;

    // Award XP and gold
    this.skillSystem.addPlayerXp(state, monster.xpReward);
    const gold = Math.floor(
      monster.goldReward[0] + Math.random() * (monster.goldReward[1] - monster.goldReward[0])
    );
    state.player.gold += gold;

    // Kill count
    state.player.killCount[monster.id] = (state.player.killCount[monster.id] ?? 0) + 1;

    this.addCombatLog(state, {
      tick: combat.ticksElapsed,
      message: `☠️ ${monster.name} defeated! +${monster.xpReward} XP, +${gold} gold.`,
      type: 'victory',
    });

    // Award skill XP for killing
    this.skillSystem.addSkillXp(state, 'swordFighting', Math.floor(monster.xpReward * 0.3));
    this.skillSystem.addSkillXp(state, 'running', Math.floor(monster.xpReward * 0.1));

    // Drops
    this.rollDrops(state, monster);

    // Log to activity
    state.activityLog.unshift({
      timestamp: Date.now(),
      message: `Defeated ${monster.name} (+${monster.xpReward} XP, +${gold} gold)`,
      type: 'combat',
    });

    events.emit('combat:victory', { monsterId: monster.id });

    if (combat.autoBattle) {
      this.startNewEncounter(state);
    } else {
      combat.active = false;
      combat.currentMonster = null;
    }
  }

  private onPlayerDeath(state: GameState): void {
    const combat = state.combat;

    this.addCombatLog(state, {
      tick: combat.ticksElapsed,
      message: `💀 You were defeated by ${combat.currentMonster?.name}...`,
      type: 'death',
    });

    state.activityLog.unshift({
      timestamp: Date.now(),
      message: `Defeated by ${combat.currentMonster?.name}`,
      type: 'combat',
    });

    // Reset HP/MP
    const stats = this.skillSystem.computeStats(state);
    combat.playerHp = stats.maxHp * 0.3;
    combat.playerMp = stats.maxMp * 0.3;
    combat.active = false;
    combat.currentMonster = null;

    events.emit('combat:defeat');
  }

  private rollDrops(state: GameState, monster: MonsterDefinition): void {
    const combat = state.combat;

    for (const drop of monster.dropTable) {
      if (Math.random() <= drop.chance) {
        const qty = Math.floor(
          drop.minQty + Math.random() * (drop.maxQty - drop.minQty + 1)
        );
        this.addToInventory(state, drop.itemId, qty);

        const itemDef = ITEM_MAP.get(drop.itemId);
        if (itemDef) {
          this.addCombatLog(state, {
            tick: combat.ticksElapsed,
            message: `📦 Obtained ${itemDef.name} x${qty}`,
            type: 'loot',
          });
        }
      }
    }
  }

  addToInventory(state: GameState, itemId: string, qty: number): void {
    const def = ITEM_MAP.get(itemId);
    if (!def) return;

    if (def.stackable) {
      const existing = state.player.inventory.find((s) => s.itemId === itemId);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + qty, def.maxStack);
        return;
      }
    }

    if (state.player.inventory.length < 100) {
      state.player.inventory.push({ itemId, quantity: qty });
    }
  }

  private addCombatLog(state: GameState, entry: CombatLogEntry): void {
    const combat = state.combat;
    combat.log.unshift(entry);
    if (combat.log.length > 50) {
      combat.log.pop();
    }
    events.emit('combat:log', entry);
  }

  /** Start a new fight with a random monster in the current location */
  startNewEncounter(state: GameState): void {
    const location = LOCATION_MAP.get(state.combat.currentLocation);
    if (!location) return;

    const stats = this.skillSystem.computeStats(state);
    const combat = state.combat;

    // Check for boss spawn
    let monsterId: string;
    if (location.bossId && Math.random() < location.bossSpawnChance) {
      monsterId = location.bossId;
    } else {
      const idx = Math.floor(Math.random() * location.monsters.length);
      monsterId = location.monsters[idx];
    }

    const monster = MONSTER_MAP.get(monsterId);
    if (!monster) return;

    combat.currentMonster = JSON.parse(JSON.stringify(monster)) as MonsterDefinition;
    combat.monsterHp = monster.hp;
    combat.monsterMp = monster.mp;
    combat.playerHp = Math.min(combat.playerHp, stats.maxHp);
    combat.playerMp = Math.min(combat.playerMp, stats.maxMp);
    combat.ticksElapsed = 0;
    combat.active = true;

    this.addCombatLog(state, {
      tick: 0,
      message: `⚔️ A wild ${monster.name} appeared! [${monster.rank}-rank]`,
      type: 'info',
    });

    events.emit('combat:start', { monsterId });
  }

  /** Start combat at a location */
  startCombat(state: GameState, locationId: string): void {
    state.combat.currentLocation = locationId;
    this.startNewEncounter(state);
  }

  /** Stop combat */
  stopCombat(state: GameState): void {
    state.combat.active = false;
    state.combat.currentMonster = null;
    state.combat.autoBattle = false;
    events.emit('combat:stop');
  }

  private awardCombatSkillXp(state: GameState, damageType: DamageType, damage: number): void {
    const xpAmount = Math.max(1, damage * 0.05);

    if (damageType === 'physical') {
      this.skillSystem.addSkillXp(state, 'swordFighting', xpAmount);
    } else {
      const skillId = MAGIC_DAMAGE_SKILLS[damageType];
      if (skillId) {
        this.skillSystem.addSkillXp(state, skillId as any, xpAmount);
      }
    }

    // Breathing always gains XP during combat
    this.skillSystem.addSkillXp(state, 'breathing', xpAmount * 0.2);
  }

  getMonstersForLocation(locationId: string): MonsterDefinition[] {
    const location = LOCATION_MAP.get(locationId);
    if (!location) return [];
    return location.monsters
      .map((id) => MONSTER_MAP.get(id))
      .filter(Boolean) as MonsterDefinition[];
  }
}
