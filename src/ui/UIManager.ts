import type { Game } from '../game';
import type { GameState } from '../types';
import { SKILL_DEFINITIONS } from '../data/skills';
import { ITEM_MAP } from '../data/items';
import { LOCATION_DEFINITIONS } from '../data/locations';
import { events } from '../core/EventBus';

export class UIManager {
  private game: Game;
  private activeTab = 'skills';

  constructor(game: Game) {
    this.game = game;
  }

  init(): void {
    this.buildLayout();
    this.bindEvents();
    this.scheduleRender();

    events.on('game:tick', () => {
      // Render is handled by rAF loop
    });
  }

  private buildLayout(): void {
    document.body.innerHTML = `
      <div id="game-root">
        <header id="game-header">
          <div id="header-title">
            <span class="title-icon">🌀</span>
            <span class="title-text">Suraimu RPG</span>
          </div>
          <div id="player-info">
            <span id="hdr-level">Lv.1</span>
            <span id="hdr-gold">💰 0</span>
            <button id="btn-save" class="btn-small">💾 Save</button>
            <button id="btn-reset" class="btn-small btn-danger">🗑️ Reset</button>
          </div>
        </header>

        <div id="player-bars">
          <div class="bar-group">
            <span class="bar-label">HP</span>
            <div class="bar hp-bar"><div class="bar-fill" id="hp-fill"></div></div>
            <span class="bar-value" id="hp-value">100/100</span>
          </div>
          <div class="bar-group">
            <span class="bar-label">MP</span>
            <div class="bar mp-bar"><div class="bar-fill" id="mp-fill"></div></div>
            <span class="bar-value" id="mp-value">50/50</span>
          </div>
          <div class="bar-group">
            <span class="bar-label">XP</span>
            <div class="bar xp-bar"><div class="bar-fill" id="xp-fill"></div></div>
            <span class="bar-value" id="xp-value">0/100</span>
          </div>
        </div>

        <nav id="tabs">
          <button class="tab-btn active" data-tab="skills">⚡ Skills</button>
          <button class="tab-btn" data-tab="combat">⚔️ Combat</button>
          <button class="tab-btn" data-tab="explore">🗺️ Explore</button>
          <button class="tab-btn" data-tab="inventory">🎒 Inventory</button>
          <button class="tab-btn" data-tab="stats">📊 Stats</button>
          <button class="tab-btn" data-tab="log">📜 Log</button>
        </nav>

        <main id="tab-content">
          <div id="tab-skills" class="tab-panel active"></div>
          <div id="tab-combat" class="tab-panel"></div>
          <div id="tab-explore" class="tab-panel"></div>
          <div id="tab-inventory" class="tab-panel"></div>
          <div id="tab-stats" class="tab-panel"></div>
          <div id="tab-log" class="tab-panel"></div>
        </main>
      </div>
    `;
  }

  private bindEvents(): void {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = (e.target as HTMLElement).dataset['tab'];
        if (tab) this.switchTab(tab);
      });
    });

    document.getElementById('btn-save')?.addEventListener('click', () => {
      this.game.save();
      this.showToast('Game saved!');
    });

    document.getElementById('btn-reset')?.addEventListener('click', () => {
      if (confirm('Reset all progress? This cannot be undone!')) {
        this.game.resetSave();
        location.reload();
      }
    });
  }

  private switchTab(tab: string): void {
    this.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset['tab'] === tab);
    });
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `tab-${tab}`);
    });
  }

  private scheduleRender(): void {
    const render = () => {
      this.render();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  private render(): void {
    const state = this.game.state;
    const stats = this.game.getComputedStats();

    // Update header
    this.setText('hdr-level', `Lv.${state.player.level}`);
    this.setText('hdr-gold', `💰 ${Math.floor(state.player.gold)}`);

    // HP bar
    const hpPct = Math.max(0, Math.min(100, (state.combat.playerHp / stats.maxHp) * 100));
    this.setBarFill('hp-fill', hpPct);
    this.setText('hp-value', `${Math.floor(state.combat.playerHp)}/${Math.floor(stats.maxHp)}`);

    // MP bar
    const mpPct = Math.max(0, Math.min(100, (state.combat.playerMp / stats.maxMp) * 100));
    this.setBarFill('mp-fill', mpPct);
    this.setText('mp-value', `${Math.floor(state.combat.playerMp)}/${Math.floor(stats.maxMp)}`);

    // XP bar
    const xpPct = Math.max(0, Math.min(100, (state.player.xp / state.player.xpToNext) * 100));
    this.setBarFill('xp-fill', xpPct);
    this.setText('xp-value', `${Math.floor(state.player.xp)}/${Math.floor(state.player.xpToNext)}`);

    // Render active tab
    switch (this.activeTab) {
      case 'skills': this.renderSkills(state); break;
      case 'combat': this.renderCombat(state, stats); break;
      case 'explore': this.renderExplore(state); break;
      case 'inventory': this.renderInventory(state); break;
      case 'stats': this.renderStats(state, stats); break;
      case 'log': this.renderLog(state); break;
    }
  }

  // ============================================================
  // Skills Tab
  // ============================================================
  private renderSkills(state: GameState): void {
    const container = document.getElementById('tab-skills')!;
    const categories = ['physical', 'magic', 'survival', 'crafting'] as const;

    let html = '';
    for (const cat of categories) {
      const defs = SKILL_DEFINITIONS.filter((d) => d.category === cat);
      html += `<div class="skill-category">
        <h3 class="category-title">${this.categoryLabel(cat)}</h3>
        <div class="skill-grid">`;

      for (const def of defs) {
        const skill = state.player.skills[def.id];
        const locked = state.player.level < def.unlockLevel;
        const xpPct = skill ? (skill.xp / skill.xpToNext) * 100 : 0;
        const activeClass = skill?.active ? 'skill-active' : '';
        const lockedClass = locked ? 'skill-locked' : '';

        html += `
          <div class="skill-card ${activeClass} ${lockedClass}" data-skill-id="${def.id}">
            <div class="skill-header">
              <span class="skill-icon">${def.icon}</span>
              <div class="skill-title">
                <span class="skill-name">${def.name}</span>
                <span class="skill-level">Lv.${skill?.level ?? 0}/${def.maxLevel}</span>
              </div>
              ${locked ? '<span class="lock-icon">🔒</span>' : `<button class="toggle-btn ${skill?.active ? 'on' : 'off'}" data-skill="${def.id}">${skill?.active ? 'ON' : 'OFF'}</button>`}
            </div>
            <div class="skill-xp-bar">
              <div class="skill-xp-fill" style="width:${xpPct.toFixed(1)}%"></div>
            </div>
            <div class="skill-desc">${locked ? `Unlock at player level ${def.unlockLevel}` : def.description}</div>
          </div>`;
      }

      html += '</div></div>';
    }

    if (container.innerHTML !== html) {
      container.innerHTML = html;
      // Bind toggle buttons
      container.querySelectorAll('.toggle-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const skillId = (e.target as HTMLElement).dataset['skill'];
          if (skillId) this.game.toggleSkill(skillId as any);
        });
      });
    } else {
      // Just update dynamic values without full re-render
      SKILL_DEFINITIONS.forEach((def) => {
        const skill = state.player.skills[def.id];
        if (!skill) return;
        const card = container.querySelector(`[data-skill-id="${def.id}"]`);
        if (!card) return;
        const xpPct = (skill.xp / skill.xpToNext) * 100;
        const fill = card.querySelector('.skill-xp-fill') as HTMLElement;
        if (fill) fill.style.width = `${xpPct.toFixed(1)}%`;
        const lvl = card.querySelector('.skill-level');
        if (lvl) lvl.textContent = `Lv.${skill.level}/${def.maxLevel}`;
        const btn = card.querySelector('.toggle-btn');
        if (btn) {
          btn.textContent = skill.active ? 'ON' : 'OFF';
          btn.classList.toggle('on', skill.active);
          btn.classList.toggle('off', !skill.active);
        }
        card.classList.toggle('skill-active', skill.active ?? false);
      });
    }
  }

  private categoryLabel(cat: string): string {
    return { physical: '⚔️ Physical', magic: '✨ Magic', survival: '🌿 Survival', crafting: '🔨 Crafting' }[cat] ?? cat;
  }

  // ============================================================
  // Combat Tab
  // ============================================================
  private renderCombat(state: GameState, _stats: ReturnType<Game['getComputedStats']>): void {
    const container = document.getElementById('tab-combat')!;
    const combat = state.combat;
    const location = LOCATION_DEFINITIONS.find((l) => l.id === combat.currentLocation);

    let html = `
      <div class="combat-panel">
        <div class="combat-top">
          <div class="combat-location">📍 ${location?.name ?? 'Unknown'}</div>
          <div class="combat-controls">
            ${combat.active
              ? `<button id="btn-stop-combat" class="btn-primary btn-danger">🛑 Stop</button>`
              : `<button id="btn-start-combat" class="btn-primary">⚔️ Fight!</button>`}
            <button id="btn-auto-battle" class="btn-secondary ${combat.autoBattle ? 'active' : ''}">
              🔄 Auto ${combat.autoBattle ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>`;

    if (combat.active && combat.currentMonster) {
      const m = combat.currentMonster;
      const mHpPct = Math.max(0, Math.min(100, (combat.monsterHp / m.hp) * 100));
      html += `
        <div class="monster-card">
          <div class="monster-header">
            <span class="monster-icon">${m.icon}</span>
            <div class="monster-info">
              <span class="monster-name">${m.name}</span>
              <span class="monster-rank rank-${m.rank.toLowerCase()}">[${m.rank}-Rank]</span>
            </div>
          </div>
          <div class="monster-hp-bar">
            <div class="monster-hp-fill" style="width:${mHpPct.toFixed(1)}%"></div>
          </div>
          <span class="monster-hp-text">${Math.ceil(combat.monsterHp)} / ${m.hp} HP</span>
        </div>`;
    } else {
      html += `<div class="no-combat"><p>Not in combat.</p><p class="hint">Choose a location in the Explore tab, then press Fight!</p></div>`;
    }

    // Combat log
    html += `<div class="combat-log">`;
    for (const entry of combat.log.slice(0, 15)) {
      html += `<div class="log-entry log-${entry.type}">${entry.message}</div>`;
    }
    html += `</div></div>`;

    container.innerHTML = html;

    document.getElementById('btn-start-combat')?.addEventListener('click', () => {
      this.game.startCombat(state.explore.currentLocation || 'forestEdge');
    });
    document.getElementById('btn-stop-combat')?.addEventListener('click', () => {
      this.game.stopCombat();
    });
    document.getElementById('btn-auto-battle')?.addEventListener('click', () => {
      this.game.toggleAutoBattle();
    });
  }

  // ============================================================
  // Explore Tab
  // ============================================================
  private renderExplore(state: GameState): void {
    const container = document.getElementById('tab-explore')!;
    const explore = state.explore;

    let html = `
      <div class="explore-panel">
        <div class="explore-controls">
          <div class="explore-progress-row">
            <span>Exploring: ${explore.exploring ? '✅' : '❌'}</span>
            <div class="bar explore-prog-bar">
              <div class="bar-fill" style="width:${explore.explorationProgress.toFixed(1)}%"></div>
            </div>
            <span>${explore.explorationProgress.toFixed(0)}%</span>
          </div>
          <button id="btn-toggle-explore" class="btn-primary ${explore.exploring ? 'btn-danger' : ''}">
            ${explore.exploring ? '⏸️ Stop Exploring' : '🗺️ Start Exploring'}
          </button>
        </div>

        <h3>Locations</h3>
        <div class="location-grid">`;

    const allLocations = LOCATION_DEFINITIONS;
    for (const loc of allLocations) {
      const unlocked = state.player.unlockedLocations.includes(loc.id);
      const isCurrent = explore.currentLocation === loc.id;

      html += `
        <div class="location-card ${isCurrent ? 'location-current' : ''} ${!unlocked ? 'location-locked' : ''}"
             data-location="${loc.id}">
          <div class="location-name">
            ${isCurrent ? '📍 ' : ''}${loc.name}
            <span class="location-tier">T${loc.tier}</span>
          </div>
          <div class="location-desc">${unlocked ? loc.description : '🔒 Locked'}</div>
          ${unlocked && !isCurrent ? `<button class="btn-small btn-travel" data-loc="${loc.id}">Go →</button>` : ''}
        </div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;

    document.getElementById('btn-toggle-explore')?.addEventListener('click', () => {
      this.game.toggleExploring();
    });

    container.querySelectorAll('.btn-travel').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const locId = (e.target as HTMLElement).dataset['loc'];
        if (locId) this.game.setLocation(locId);
      });
    });
  }

  // ============================================================
  // Inventory Tab
  // ============================================================
  private renderInventory(state: GameState): void {
    const container = document.getElementById('tab-inventory')!;
    const inv = state.player.inventory;

    let html = `
      <div class="inventory-panel">
        <div class="inv-header">
          <span>Items: ${inv.length}/100</span>
          <span>Gold: 💰 ${Math.floor(state.player.gold)}</span>
        </div>

        <h3>Equipment</h3>
        <div class="equipment-slots">`;

    const slots = state.player.equipment;
    for (const [slot, itemId] of Object.entries(slots)) {
      const def = itemId ? ITEM_MAP.get(itemId) : null;
      html += `
        <div class="equip-slot">
          <span class="equip-slot-name">${slot}</span>
          <span class="equip-slot-item">${def ? `${def.icon} ${def.name}` : '—'}</span>
          ${itemId ? `<button class="btn-tiny btn-unequip" data-slot="${slot}">↩</button>` : ''}
        </div>`;
    }

    html += `</div>

        <h3>Bag</h3>
        <div class="item-grid">`;

    if (inv.length === 0) {
      html += '<p class="empty-inv">Your inventory is empty.</p>';
    } else {
      for (const slot of inv) {
        const def = ITEM_MAP.get(slot.itemId);
        if (!def) continue;
        html += `
          <div class="item-card rarity-${def.rarity}" title="${def.description}">
            <span class="item-icon">${def.icon}</span>
            <div class="item-info">
              <span class="item-name">${def.name}</span>
              <span class="item-qty">x${slot.quantity}</span>
            </div>
            <div class="item-actions">
              ${def.onUse ? `<button class="btn-tiny btn-use" data-item="${slot.itemId}">Use</button>` : ''}
              ${def.type === 'weapon' || def.type === 'armor' || def.type === 'accessory' ? `<button class="btn-tiny btn-equip" data-item="${slot.itemId}">Equip</button>` : ''}
              <button class="btn-tiny btn-sell" data-item="${slot.itemId}">Sell</button>
            </div>
          </div>`;
      }
    }

    html += `</div></div>`;
    container.innerHTML = html;

    container.querySelectorAll('.btn-use').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const itemId = (e.target as HTMLElement).dataset['item'];
        if (itemId) this.game.useItem(itemId);
      });
    });
    container.querySelectorAll('.btn-equip').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const itemId = (e.target as HTMLElement).dataset['item'];
        if (itemId) this.game.equipItem(itemId);
      });
    });
    container.querySelectorAll('.btn-sell').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const itemId = (e.target as HTMLElement).dataset['item'];
        if (itemId) this.game.sellItem(itemId);
      });
    });
    container.querySelectorAll('.btn-unequip').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const slot = (e.target as HTMLElement).dataset['slot'];
        if (slot) this.game.inventorySystem.unequipItem(this.game.state, slot as any);
      });
    });
  }

  // ============================================================
  // Stats Tab
  // ============================================================
  private renderStats(state: GameState, stats: ReturnType<Game['getComputedStats']>): void {
    const container = document.getElementById('tab-stats')!;
    const p = state.player;

    const statRows = [
      ['❤️ Max HP', stats.maxHp.toFixed(0)],
      ['💙 Max MP', stats.maxMp.toFixed(0)],
      ['❤️‍🩹 HP Regen/s', stats.hpRegen.toFixed(2)],
      ['💙 MP Regen/s', stats.mpRegen.toFixed(2)],
      ['⚔️ Physical ATK', stats.physicalAttack.toFixed(0)],
      ['✨ Magic ATK', stats.magicAttack.toFixed(0)],
      ['🛡️ Physical DEF', stats.physicalDefense.toFixed(0)],
      ['🔮 Magic DEF', stats.magicDefense.toFixed(0)],
      ['💨 Speed', stats.speed.toFixed(1)],
      ['🎯 Crit Chance', `${stats.critChance.toFixed(1)}%`],
      ['🌀 Dodge', `${stats.dodgeChance.toFixed(1)}%`],
      ['🗺️ Explore Speed', stats.explorationSpeed.toFixed(2)],
    ];

    let html = `
      <div class="stats-panel">
        <div class="player-profile">
          <h2>${p.name}</h2>
          <div class="profile-row"><span>Level</span><span>${p.level}</span></div>
          <div class="profile-row"><span>Total XP</span><span>${Math.floor(p.xp)}</span></div>
          <div class="profile-row"><span>Gold</span><span>💰 ${Math.floor(p.gold)}</span></div>
          <div class="profile-row"><span>Play Time</span><span>${this.formatTime(p.totalPlayTime)}</span></div>
          <div class="profile-row"><span>Total Kills</span><span>${Object.values(p.killCount).reduce((a, b) => a + b, 0)}</span></div>
        </div>

        <h3>Combat Stats</h3>
        <div class="stat-grid">
          ${statRows.map(([label, value]) => `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`).join('')}
        </div>

        <h3>Kill History</h3>
        <div class="kill-list">
          ${Object.entries(p.killCount).length === 0 ? '<p class="empty">No kills yet.</p>' :
          Object.entries(p.killCount)
            .sort(([, a], [, b]) => b - a)
            .map(([id, count]) => `<div class="kill-row"><span>${id}</span><span>×${count}</span></div>`)
            .join('')}
        </div>
      </div>`;

    container.innerHTML = html;
  }

  // ============================================================
  // Activity Log Tab
  // ============================================================
  private renderLog(state: GameState): void {
    const container = document.getElementById('tab-log')!;
    let html = '<div class="log-panel">';
    for (const entry of state.activityLog.slice(0, 80)) {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      html += `<div class="activity-row log-type-${entry.type}">
        <span class="log-time">${time}</span>
        <span class="log-msg">${entry.message}</span>
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  }

  // ============================================================
  // Utilities
  // ============================================================
  private setText(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el && el.textContent !== text) el.textContent = text;
  }

  private setBarFill(id: string, pct: number): void {
    const el = document.getElementById(id) as HTMLElement | null;
    if (el) el.style.width = `${pct.toFixed(1)}%`;
  }

  private showToast(message: string): void {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  }
}
