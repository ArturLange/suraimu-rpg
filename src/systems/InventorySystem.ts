import type { GameState, EquipmentSlots } from '../types';
import { ITEM_MAP } from '../data/items';
import { events } from '../core/EventBus';

const HEAL_SMALL = 50;
const HEAL_MEDIUM = 150;
const HEAL_LARGE = 400;
const RESTORE_MANA = 100;

export class InventorySystem {
  useItem(state: GameState, itemId: string): boolean {
    const slotIdx = state.player.inventory.findIndex((s) => s.itemId === itemId);
    if (slotIdx === -1) return false;

    const slot = state.player.inventory[slotIdx];
    const def = ITEM_MAP.get(itemId);
    if (!def || !def.onUse) return false;

    const stats = this.getMaxStats(state);
    let used = false;

    switch (def.onUse) {
      case 'healSmall':
        if (state.combat.playerHp < stats.maxHp) {
          state.combat.playerHp = Math.min(stats.maxHp, state.combat.playerHp + HEAL_SMALL);
          used = true;
        }
        break;
      case 'healMedium':
        if (state.combat.playerHp < stats.maxHp) {
          state.combat.playerHp = Math.min(stats.maxHp, state.combat.playerHp + HEAL_MEDIUM);
          used = true;
        }
        break;
      case 'healLarge':
        if (state.combat.playerHp < stats.maxHp) {
          state.combat.playerHp = Math.min(stats.maxHp, state.combat.playerHp + HEAL_LARGE);
          used = true;
        }
        break;
      case 'restoreMana':
        if (state.combat.playerMp < stats.maxMp) {
          state.combat.playerMp = Math.min(stats.maxMp, state.combat.playerMp + RESTORE_MANA);
          used = true;
        }
        break;
      case 'healFull':
        state.combat.playerHp = stats.maxHp;
        state.combat.playerMp = stats.maxMp;
        used = true;
        break;
    }

    if (used) {
      slot.quantity--;
      if (slot.quantity <= 0) {
        state.player.inventory.splice(slotIdx, 1);
      }
      state.activityLog.unshift({
        timestamp: Date.now(),
        message: `Used ${def.name}.`,
        type: 'loot',
      });
      events.emit('inventory:used', { itemId });
    }

    return used;
  }

  equipItem(state: GameState, itemId: string): boolean {
    const slot = state.player.inventory.find((s) => s.itemId === itemId);
    if (!slot) return false;

    const def = ITEM_MAP.get(itemId);
    if (!def) return false;

    const equipSlot = this.getEquipSlot(def.type);
    if (!equipSlot) return false;

    // Unequip current if any
    const current = state.player.equipment[equipSlot];
    if (current) {
      this.unequipItem(state, equipSlot);
    }

    state.player.equipment[equipSlot] = itemId;
    state.activityLog.unshift({
      timestamp: Date.now(),
      message: `Equipped ${def.name}.`,
      type: 'loot',
    });
    events.emit('inventory:equipped', { itemId, slot: equipSlot });
    return true;
  }

  unequipItem(state: GameState, slot: keyof EquipmentSlots): boolean {
    const itemId = state.player.equipment[slot];
    if (!itemId) return false;

    state.player.equipment[slot] = null;
    events.emit('inventory:unequipped', { itemId, slot });
    return true;
  }

  sellItem(state: GameState, itemId: string, qty: number = 1): number {
    const slotIdx = state.player.inventory.findIndex((s) => s.itemId === itemId);
    if (slotIdx === -1) return 0;

    const slot = state.player.inventory[slotIdx];
    const def = ITEM_MAP.get(itemId);
    if (!def) return 0;

    const actualQty = Math.min(qty, slot.quantity);
    const gold = def.sellValue * actualQty;

    state.player.gold += gold;
    slot.quantity -= actualQty;
    if (slot.quantity <= 0) {
      state.player.inventory.splice(slotIdx, 1);
    }

    state.activityLog.unshift({
      timestamp: Date.now(),
      message: `Sold ${def.name} x${actualQty} for ${gold} gold.`,
      type: 'loot',
    });
    events.emit('inventory:sold', { itemId, qty: actualQty, gold });
    return gold;
  }

  private getEquipSlot(itemType: string): keyof EquipmentSlots | null {
    switch (itemType) {
      case 'weapon': return 'weapon';
      case 'armor': return 'armor';
      case 'accessory': return 'ring';
      default: return null;
    }
  }

  private getMaxStats(state: GameState): { maxHp: number; maxMp: number } {
    // Simplified: use combat state or fall back to 100/50
    return {
      maxHp: state.combat.playerHp > 0 ? state.combat.playerHp * 2 : 100,
      maxMp: state.combat.playerMp > 0 ? state.combat.playerMp * 2 : 50,
    };
  }

  getInventoryValue(state: GameState): number {
    return state.player.inventory.reduce((total, slot) => {
      const def = ITEM_MAP.get(slot.itemId);
      return total + (def ? def.sellValue * slot.quantity : 0);
    }, 0);
  }

  getTotalItems(state: GameState): number {
    return state.player.inventory.reduce((total, slot) => total + slot.quantity, 0);
  }
}
