#!/usr/bin/env node
// Validate all boss wave generators: syntax, enemy count, positions
const fs = require('fs');
const html = fs.readFileSync(require('path').resolve(__dirname, '..', 'index.html'), 'utf8');

const startMarker = 'const BOSS_WAVE_TYPES = [';
const startIdx = html.indexOf(startMarker);
if (startIdx === -1) { console.log('ERROR: BOSS_WAVE_TYPES not found'); process.exit(1); }

// Extract full array with balanced bracket counting (depth starts at 1 = already past opening [)
let depth = 1, inString = false, stringChar = null, endIdx = startIdx + startMarker.length;
for (let i = endIdx; i < html.length; i++) {
  const ch = html[i], prev = html[i - 1];
  if (inString) { if (ch === stringChar && prev !== '\\') inString = false; continue; }
  if (ch === "'" || ch === '"' || ch === '`') { inString = true; stringChar = ch; continue; }
  if (ch === '[') depth++; else if (ch === ']') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
}
if (depth !== 0) { console.log('ERROR: unbalanced brackets, depth=' + depth); process.exit(1); }

const arrayContent = html.slice(startIdx + startMarker.length, endIdx - 1);

// Set up the same globals that exist in the game
globalThis.W = 800;
globalThis.H = 600;
globalThis.ARENA = {
  BOSS_SPAWN: { x: 400, y: 55 },
  SIDE_COL: { left: 50, right: 750, yStart: 110, yEnd: 300, spacing: 38 }
};
globalThis.makeEnemy = function(x, y, sizeKey, diff) {
  return { x, y, sizeKey, hp: 1, maxHp: 1, isBoss: false, alive: true, bossDir: 1, bossSpeed: 0 };
};
globalThis.createBossEnemy = function(x, y, waveNum, diff) {
  return { x, y, w: 55, h: 50, hp: 10, maxHp: 10, isBoss: true, originalPoints: 100, bossDir: 1, bossSpeed: 40, alive: true };
};

let BOSS_WAVE_TYPES;
try { BOSS_WAVE_TYPES = eval('[' + arrayContent + ']'); }
catch (e) { console.log('EVAL ERROR:', e.message); process.exit(1); }

console.log('BOSS_WAVE_TYPES parsed: ' + BOSS_WAVE_TYPES.length + ' types');
console.log('');

let allOk = true;
BOSS_WAVE_TYPES.forEach((t, i) => {
  const enemies = t.gen(20, { bearHPBonus: 0, bearBaseSpeed: 30, waveSpeedBonus: 2, playerSpeed: 200, shootCooldown: 0.3 });
  const alive = enemies.filter(e => e.alive);
  const bosses = alive.filter(e => e.isBoss);
  const minions = alive.filter(e => !e.isBoss);
  console.log('[' + i + '] ' + t.name + ': ' + alive.length + ' total (' + bosses.length + ' boss, ' + minions.length + ' minions)');
  for (const e of alive) {
    if (e.x < -50 || e.x > globalThis.W + 50 || e.y > globalThis.H + 50) {
      console.log('  OUT OF BOUNDS: (' + e.x + ',' + e.y + ')');
      allOk = false;
    }
  }
  if (t.name === 'ARCTIC EMPEROR') {
    console.log('  Imperial Court formation:');
    for (const e of alive) {
      const role = e.isBoss ? 'EMPEROR' : (e.hp > 1 ? 'GUARD' : (e.y > 240 ? 'SCOUT' : (e.y > 200 ? 'V-FORM' : 'COURTIER')));
      console.log('    ' + role + ' @ (' + e.x.toFixed(0) + ', ' + e.y.toFixed(0) + ') hp=' + e.hp + ' size=' + e.sizeKey);
    }
  }
});

console.log('');
if (allOk && BOSS_WAVE_TYPES.length === 5) {
  console.log('ALL OK - 5 boss wave types, all enemies within playable bounds.');
  process.exit(0);
} else {
  console.log('ISSUES FOUND');
  process.exit(1);
}
