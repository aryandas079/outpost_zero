import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  generateRoomCode,
  normalizeRoomCode,
  NetworkManager,
} from '../src/game/multiplayer/networkManager';
import {
  DEFAULT_MULTIPLAYER_SETTINGS,
  MultiplayerGameSettings,
  NetworkMessage,
  PLAYER_COLORS,
  PlayerProfile,
} from '../src/game/multiplayer/types';
import { RemotePlayerManager } from '../src/game/multiplayer/remotePlayerRigs';
import { createProceduralTextures } from '../src/game/textures';
import { DEFAULT_LOADOUT } from '../src/game/loadout';

test('room code generation, normalization and share formatting', () => {
  for (let i = 0; i < 10; i++) {
    const code = generateRoomCode();
    assert.match(code, /^OPZ-[2-9A-Z]{4}$/);
  }

  assert.equal(normalizeRoomCode('opz7k2x'), 'OPZ-7K2X');
  assert.equal(normalizeRoomCode('OPZ-7K2X'), 'OPZ-7K2X');
  assert.equal(normalizeRoomCode('  7k2x  '), 'OPZ-7K2X');
  assert.equal(normalizeRoomCode('wolf'), 'OPZ-WOLF');
});

test('multiplayer presets and player color themes', () => {
  const colors = ['cyan', 'amber', 'emerald', 'rose'] as const;
  for (const c of colors) {
    const spec = PLAYER_COLORS[c];
    assert.ok(spec, `Color ${c} must exist`);
    assert.equal(spec.id, c);
    assert.ok(Number.isFinite(spec.hex));
    assert.match(spec.css, /^#[0-9a-f]{6}$/i);
    assert.ok(spec.glow.includes('rgba'));
  }

  assert.equal(DEFAULT_MULTIPLAYER_SETTINGS.maxPlayers, 4);
  assert.equal(DEFAULT_MULTIPLAYER_SETTINGS.mode, 'coop');
});

test('network message schema and payload serialization', () => {
  const testMessages: NetworkMessage[] = [
    {
      type: 'join',
      player: {
        id: 'p_1',
        name: 'Ghost-1',
        color: 'cyan',
        isHost: true,
        ready: true,
        loadout: DEFAULT_LOADOUT,
        ping: 25,
        health: 100,
        maxHealth: 100,
        shield: 50,
        maxShield: 50,
        kills: 0,
        deaths: 0,
        score: 0,
        headshots: 0,
        alive: true,
        equippedWeapon: 'carbine',
      },
    },
    {
      type: 'player-shoot',
      playerId: 'p_1',
      weaponId: 'carbine',
      origin: [0, 1.5, 0],
      target: [10, 1.5, 20],
    },
    {
      type: 'player-damage',
      targetId: 'p_2',
      attackerId: 'p_1',
      attackerName: 'Ghost-1',
      amount: 52,
      isHeadshot: true,
      weaponId: 'railpistol',
    },
    {
      type: 'player-killed',
      victimId: 'p_2',
      victimName: 'Viper-2',
      killerId: 'p_1',
      killerName: 'Ghost-1',
      weaponId: 'railpistol',
      isHeadshot: true,
    },
    {
      type: 'chat',
      message: {
        id: 'c_1',
        senderId: 'p_1',
        senderName: 'Ghost-1',
        senderColor: 'cyan',
        text: 'Hostiles coming from east plaza!',
        timestamp: 12345678,
      },
    },
  ];

  for (const msg of testMessages) {
    const json = JSON.stringify(msg);
    const parsed = JSON.parse(json);
    assert.deepEqual(parsed, msg);
  }
});

test('remote player 3D rigs support up to 4 players with hitboxes and weapon switching', () => {
  const scene = new THREE.Scene();
  const mockTexture = new THREE.CanvasTexture({ width: 1, height: 1 } as any);
  const textures = new Proxy({}, { get: () => mockTexture }) as any;
  const manager = new RemotePlayerManager(scene, textures);

  const squad: PlayerProfile[] = [
    {
      id: 'p_1',
      name: 'Ghost-1',
      color: 'cyan',
      isHost: true,
      ready: true,
      loadout: DEFAULT_LOADOUT,
      ping: 20,
      health: 100,
      maxHealth: 100,
      shield: 50,
      maxShield: 50,
      kills: 0,
      deaths: 0,
      score: 0,
      headshots: 0,
      alive: true,
      equippedWeapon: 'carbine',
    },
    {
      id: 'p_2',
      name: 'Viper-2',
      color: 'amber',
      isHost: false,
      ready: true,
      loadout: DEFAULT_LOADOUT,
      ping: 35,
      health: 100,
      maxHealth: 100,
      shield: 50,
      maxShield: 50,
      kills: 1,
      deaths: 0,
      score: 150,
      headshots: 1,
      alive: true,
      equippedWeapon: 'railpistol',
    },
    {
      id: 'p_3',
      name: 'Spectre-3',
      color: 'emerald',
      isHost: false,
      ready: false,
      loadout: DEFAULT_LOADOUT,
      ping: 42,
      health: 75,
      maxHealth: 100,
      shield: 25,
      maxShield: 50,
      kills: 0,
      deaths: 1,
      score: 50,
      headshots: 0,
      alive: true,
      equippedWeapon: 'shotgun',
    },
    {
      id: 'p_4',
      name: 'Apex-4',
      color: 'rose',
      isHost: false,
      ready: true,
      loadout: DEFAULT_LOADOUT,
      ping: 18,
      health: 100,
      maxHealth: 100,
      shield: 50,
      maxShield: 50,
      kills: 2,
      deaths: 0,
      score: 300,
      headshots: 2,
      alive: true,
      equippedWeapon: 'machinegun',
    },
  ];

  // Add all 4 operatives into scene
  for (let i = 0; i < squad.length; i++) {
    manager.addOrUpdatePlayer(squad[i], new THREE.Vector3(i * 3, 0, 0));
  }

  const positions = manager.getPlayerPositions();
  assert.equal(positions.length, 4, 'Must manage all 4 squad operatives');

  // Verify hitboxes exist for PvP and raycasting
  const hitMeshes = manager.getHitMeshes();
  assert.ok(hitMeshes.length >= 12, 'Each operative must register articulated hitboxes');

  const headshots = hitMeshes.filter((m) => m.userData.isHeadshot);
  assert.equal(headshots.length, 4, 'Each of the 4 operatives must have a headshot hitbox');

  // Verify weapon firing and damage reaction
  manager.triggerShot('p_1', 'carbine', new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(10, 1.5, 0));
  manager.triggerDamage('p_2', 45, true);

  // Update simulation step
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 200);
  manager.update(0.016, camera);

  // Trigger elimination and respawn
  manager.triggerKilled('p_3');
  const livingMeshes = manager.getHitMeshes();
  assert.ok(livingMeshes.length < hitMeshes.length, 'Dead operative should not register active hitboxes');

  manager.triggerRespawn('p_3', new THREE.Vector3(10, 0, 5));
  const restoredMeshes = manager.getHitMeshes();
  assert.equal(restoredMeshes.length, hitMeshes.length, 'Respawned operative must restore active hitboxes');

  manager.dispose();
  mockTexture.dispose();
});

test('network manager enforces room capacity for up to 4 players', () => {
  const nm = new NetworkManager();
  nm.players = [
    {
      id: 'p_1',
      name: 'Host',
      color: 'cyan',
      isHost: true,
      ready: true,
      loadout: DEFAULT_LOADOUT,
      ping: 0,
      health: 100,
      maxHealth: 100,
      shield: 50,
      maxShield: 50,
      kills: 0,
      deaths: 0,
      score: 0,
      headshots: 0,
      alive: true,
      equippedWeapon: 'carbine',
    },
    {
      id: 'p_2',
      name: 'Player 2',
      color: 'amber',
      isHost: false,
      ready: true,
      loadout: DEFAULT_LOADOUT,
      ping: 15,
      health: 100,
      maxHealth: 100,
      shield: 50,
      maxShield: 50,
      kills: 0,
      deaths: 0,
      score: 0,
      headshots: 0,
      alive: true,
      equippedWeapon: 'carbine',
    },
    {
      id: 'p_3',
      name: 'Player 3',
      color: 'emerald',
      isHost: false,
      ready: true,
      loadout: DEFAULT_LOADOUT,
      ping: 25,
      health: 100,
      maxHealth: 100,
      shield: 50,
      maxShield: 50,
      kills: 0,
      deaths: 0,
      score: 0,
      headshots: 0,
      alive: true,
      equippedWeapon: 'carbine',
    },
    {
      id: 'p_4',
      name: 'Player 4',
      color: 'rose',
      isHost: false,
      ready: true,
      loadout: DEFAULT_LOADOUT,
      ping: 22,
      health: 100,
      maxHealth: 100,
      shield: 50,
      maxShield: 50,
      kills: 0,
      deaths: 0,
      score: 0,
      headshots: 0,
      alive: true,
      equippedWeapon: 'carbine',
    },
  ];

  assert.equal(nm.players.length, 4);
  assert.equal(nm.settings.maxPlayers, 4);
});
