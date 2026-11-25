import React, { useState, useEffect, useCallback } from 'react';
import {
  Check,
  ChevronRight,
  Crosshair,
  Crown,
  Footprints,
  Globe,
  HelpCircle,
  Layers,
  Monitor,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  Sliders,
  User,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  DifficultyId,
  DIFFICULTY_SPECS,
  GameSettings,
  GrenadeId,
  Loadout,
  MapId,
  MAP_SPECS,
  MissionConfig,
  WeaponId,
  WEAPON_SPECS,
} from '../game/types';
import {
  DEFAULT_LOADOUT,
  GRENADES,
  LAUNCHERS,
  normalizeLoadout,
  PRIMARY_WEAPONS,
  SIDEARMS,
} from '../game/loadout';
import {
  AUDIO_DYNAMIC_RANGE_ORDER,
  AUDIO_DYNAMIC_RANGE_PRESETS,
  getAudioDynamicRangeSpec,
} from '../game/audioCompression';
import {
  DEFAULT_MULTIPLAYER_SETTINGS,
  DEFAULT_PLAYER_CALLSIGNS,
  MultiplayerGameSettings,
  PLAYER_COLORS,
  PlayerColorId,
} from '../game/multiplayer/types';
import { DEFAULT_GAME_SETTINGS } from '../game/graphicsSettings';
import { parseRoomFromUrl } from '../game/multiplayer/networkManager';
import {
  computeRankFromScore,
  getOperatorById,
  loadSavedLoadoutSlots,
  loadSavedOperatorId,
  OperatorId,
  OPERATORS,
  PERK_CATALOG,
  SavedLoadoutSlot,
  saveLoadoutSlots,
  saveOperatorId,
} from '../game/operators';
import { GraphicsSettings } from './GraphicsSettings';
import { ControlsSettings } from './ControlsSettings';
import { OperatorPortrait } from './OperatorArtwork';
import { HelpOverlayModal } from './HelpOverlayModal';
import { nativeBridge } from '../utilities/NativeBridge';
import { toAssetUrl } from '../utils/assets';
import { WeaponCardVisual } from './WeaponSilhouette';
import { BrandEmblem } from './BrandEmblem';

export type MainMenuSection = 'home' | 'play' | 'operators' | 'armory' | 'settings' | 'solo' | 'multiplayer';

interface TitleOverlayProps {
  bestScore: number;
  settings: GameSettings;
  initialDifficulty: DifficultyId;
  initialMap: MapId;
  initialLoadout?: Loadout;
  initialSection?: MainMenuSection;
  onStartMission: (config: MissionConfig) => void;
  onSensitivityChange: (val: number) => void;
  onToggleMute: () => void;
  onSettingsChange: (patch: Partial<GameSettings>) => void;
  onOpenMultiplayer?: () => void;
  onHostRoom?: (
    profile: { name: string; color: PlayerColorId; loadout: Loadout },
    settings: MultiplayerGameSettings,
  ) => void;
  onJoinRoom?: (
    roomCode: string,
    profile: { name: string; color: PlayerColorId; loadout: Loadout },
  ) => void;
  onLoadoutChange?: (loadout: Loadout) => void;
}

const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'normal', 'hard'];
const COLOR_KEYS: PlayerColorId[] = ['cyan', 'amber', 'emerald', 'rose'];

type NavTab = 'home' | 'play' | 'operators' | 'armory' | 'settings';
type ArmoryPickerMode = null | 'primary1' | 'primary2' | 'sidearm' | 'launcher' | 'grenade';

function normalizeInitialTab(section?: MainMenuSection): NavTab {
  if (section === 'play' || section === 'solo' || section === 'multiplayer') return 'play';
  if (section === 'operators' || section === 'armory' || section === 'settings') return section;
  return 'home';
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  bestScore,
  settings,
  initialDifficulty,
  initialMap,
  initialLoadout = DEFAULT_LOADOUT,
  initialSection = 'home',
  onStartMission,
  onSensitivityChange,
  onToggleMute,
  onSettingsChange,
  onOpenMultiplayer,
  onHostRoom,
  onJoinRoom,
  onLoadoutChange,
}) => {
  const [activeTab, setActiveTab] = useState<NavTab>(() => normalizeInitialTab(initialSection));
  const [playMode, setPlayMode] = useState<'solo' | 'multiplayer'>(() =>
    initialSection === 'multiplayer' ? 'multiplayer' : 'solo',
  );
  const [showHelp, setShowHelp] = useState(false);

  // Mission configuration
  const [difficulty, setDifficulty] = useState<DifficultyId>(initialDifficulty);
  const [endlessMode, setEndlessMode] = useState(false);
  const [mapId, setMapId] = useState<MapId>(initialMap);

  // Operators state
  const [equippedOperatorId, setEquippedOperatorId] = useState<OperatorId>(() => loadSavedOperatorId());
  const [inspectedOperatorId, setInspectedOperatorId] = useState<OperatorId>(() => loadSavedOperatorId());
  const [operatorNotice, setOperatorNotice] = useState<string | null>(null);

  // Custom Loadout slots (Armory)
  const [loadoutSlots, setLoadoutSlots] = useState<SavedLoadoutSlot[]>(() => {
    const slots = loadSavedLoadoutSlots();
    if (initialLoadout && slots.length > 0) {
      return [{ ...slots[0], loadout: normalizeLoadout(initialLoadout) }, ...slots.slice(1)];
    }
    return slots;
  });
  const [activeSlotIdx, setActiveSlotIdx] = useState(0);
  const [armoryPicker, setArmoryPicker] = useState<ArmoryPickerMode>(null);

  // Settings sidebar tab
  const [settingsTab, setSettingsTab] = useState<'graphics' | 'audio' | 'controls'>('graphics');

  // Multiplayer profile & room state
  const [multiplayerTab, setMultiplayerTab] = useState<'host' | 'join'>('host');
  const [callsign, setCallsign] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('opz_player_name') : null;
    return saved || getOperatorById(loadSavedOperatorId()).callsign;
  });
  const [color, setColor] = useState<PlayerColorId>(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('opz_player_color') as PlayerColorId) : null;
    return saved && PLAYER_COLORS[saved] ? saved : getOperatorById(loadSavedOperatorId()).color;
  });
  const [joinCode, setJoinCode] = useState('');
  const [networkSettings, setNetworkSettings] = useState<MultiplayerGameSettings>({
    ...DEFAULT_MULTIPLAYER_SETTINGS,
  });

  const activeSlot = loadoutSlots[activeSlotIdx] ?? loadoutSlots[0];
  const loadout = activeSlot.loadout;
  const equippedOperator = getOperatorById(equippedOperatorId);
  const inspectedOperator = getOperatorById(inspectedOperatorId);
  const rank = computeRankFromScore(bestScore);

  // Auto-detect room code from URL
  useEffect(() => {
    const fromUrl = parseRoomFromUrl();
    if (fromUrl) {
      setJoinCode(fromUrl);
      setActiveTab('play');
      setPlayMode('multiplayer');
      setMultiplayerTab('join');
    }
  }, []);

  // Sync active loadout changes to parent & localStorage
  const commitActiveLoadout = useCallback(
    (updater: (prev: SavedLoadoutSlot) => SavedLoadoutSlot) => {
      const next = loadoutSlots.map((slot, idx) => (idx === activeSlotIdx ? updater(slot) : slot));
      setLoadoutSlots(next);
      saveLoadoutSlots(next);
      const updated = next[activeSlotIdx];
      if (updated) {
        onLoadoutChange?.(updated.loadout);
      }
    },
    [activeSlotIdx, loadoutSlots, onLoadoutChange],
  );

  const handleSelectSlot = (index: number) => {
    setActiveSlotIdx(index);
    const chosen = loadoutSlots[index];
    if (chosen) {
      onLoadoutChange?.(chosen.loadout);
    }
  };

  const handleCreateLoadoutSlot = () => {
    if (loadoutSlots.length >= 8) return;
    const nextIndex = loadoutSlots.length;
    const nextSlot: SavedLoadoutSlot = {
      id: `slot-${Date.now()}`,
      name: `Loadout ${nextIndex + 1}`,
      loadout: normalizeLoadout(loadout),
      perks: [...activeSlot.perks] as [string, string, string],
    };
    const nextSlots = [...loadoutSlots, nextSlot];
    setLoadoutSlots(nextSlots);
    saveLoadoutSlots(nextSlots);
    setActiveSlotIdx(nextIndex);
    onLoadoutChange?.(nextSlot.loadout);
  };

  const handleSelectPrimary = (slotIndex: 0 | 1, weaponId: WeaponId) => {
    commitActiveLoadout((slot) => {
      const primary = [...slot.loadout.primary] as [WeaponId, WeaponId];
      const existingIdx = primary.indexOf(weaponId);
      if (existingIdx !== -1) {
        [primary[slotIndex], primary[existingIdx]] = [primary[existingIdx], primary[slotIndex]];
      } else {
        primary[slotIndex] = weaponId;
      }
      return { ...slot, loadout: normalizeLoadout({ ...slot.loadout, primary }) };
    });
    setArmoryPicker(null);
  };

  const handleSelectSidearm = (weaponId: WeaponId) => {
    commitActiveLoadout((slot) => ({
      ...slot,
      loadout: normalizeLoadout({ ...slot.loadout, sidearm: weaponId }),
    }));
    setArmoryPicker(null);
  };

  const handleSelectLauncher = (weaponId: WeaponId | null) => {
    commitActiveLoadout((slot) => ({
      ...slot,
      loadout: normalizeLoadout({ ...slot.loadout, launcher: weaponId }),
    }));
    setArmoryPicker(null);
  };

  const handleSelectGrenade = (grenadeId: GrenadeId) => {
    commitActiveLoadout((slot) => ({
      ...slot,
      loadout: normalizeLoadout({ ...slot.loadout, grenade: grenadeId }),
    }));
    setArmoryPicker(null);
  };

  const handleCyclePerk = (perkSlotIndex: 0 | 1 | 2) => {
    const options = PERK_CATALOG.filter((p) => p.slot === perkSlotIndex);
    if (options.length === 0) return;
    commitActiveLoadout((slot) => {
      const current = slot.perks[perkSlotIndex];
      const curIdx = options.findIndex((o) => o.id === current);
      const nextPerk = options[(curIdx + 1) % options.length].id;
      const nextPerks = [...slot.perks] as [string, string, string];
      nextPerks[perkSlotIndex] = nextPerk;
      return { ...slot, perks: nextPerks };
    });
  };

  const handleEquipOperator = () => {
    const op = inspectedOperator;
    setEquippedOperatorId(op.id);
    saveOperatorId(op.id);
    setCallsign(op.callsign);
    setColor(op.color);
    if (typeof window !== 'undefined') {
      localStorage.setItem('opz_player_name', op.callsign);
      localStorage.setItem('opz_player_color', op.color);
    }
    commitActiveLoadout((slot) => ({
      ...slot,
      loadout: normalizeLoadout(op.presetLoadout),
      perks: [...op.defaultPerks] as [string, string, string],
    }));
    setOperatorNotice(`${op.name} deployed with signature loadout`);
    setTimeout(() => setOperatorNotice(null), 2600);
  };

  const handleDeploySolo = useCallback(() => {
    onStartMission({
      difficulty,
      mapId,
      loadout,
      endless: endlessMode,
    });
  }, [difficulty, mapId, loadout, endlessMode, onStartMission]);

  const saveProfileLocally = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('opz_player_name', callsign);
      localStorage.setItem('opz_player_color', color);
    }
  };

  const handleHost = () => {
    saveProfileLocally();
    if (onHostRoom) {
      onHostRoom({ name: callsign, color, loadout }, networkSettings);
    } else {
      onOpenMultiplayer?.();
    }
  };

  const handleJoin = () => {
    saveProfileLocally();
    const clean = joinCode.trim();
    if (clean) {
      if (onJoinRoom) {
        onJoinRoom(clean, { name: callsign, color, loadout });
      } else {
        onOpenMultiplayer?.();
      }
    }
  };

  const handleRandomizeCallsign = () => {
    const next = DEFAULT_PLAYER_CALLSIGNS[Math.floor(Math.random() * DEFAULT_PLAYER_CALLSIGNS.length)];
    setCallsign(next);
  };

  const handleRestoreDefaults = () => {
    onSettingsChange({
      ...DEFAULT_GAME_SETTINGS,
      controls: { ...DEFAULT_GAME_SETTINGS.controls },
    });
  };

  // Global keyboard shortcuts (F1 Help, Escape Back)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.code === 'F1') {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      if (e.code === 'Escape') {
        if (showHelp) {
          e.preventDefault();
          setShowHelp(false);
        } else if (armoryPicker) {
          e.preventDefault();
          setArmoryPicker(null);
        } else if (activeTab !== 'home') {
          e.preventDefault();
          setActiveTab('home');
        }
        return;
      }

      if (inInput || tag === 'BUTTON' || showHelp || armoryPicker) return;
      if ((e.code === 'Enter' || e.code === 'Space') && (activeTab === 'home' || (activeTab === 'play' && playMode === 'solo'))) {
        e.preventDefault();
        handleDeploySolo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, playMode, showHelp, armoryPicker, handleDeploySolo]);

  const navItems: Array<{ id: NavTab; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'play', label: 'Play' },
    { id: 'operators', label: 'Operators' },
    { id: 'armory', label: 'Armory' },
    { id: 'settings', label: 'Settings' },
  ];

  // Secondary equipment preview for Armory (complementary tactical item)
  const secondaryGrenadePreview: GrenadeId = loadout.grenade === 'flashbang' ? 'frag' : 'flashbang';

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col text-slate-100 select-none overflow-hidden bg-[#090d13]"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 75% 60% at 55% 18%, rgba(30, 42, 60, 0.45) 0%, rgba(12, 17, 25, 0.85) 55%, #070a0f 100%)',
      }}
    >
      {/* Subtle architectural vignette & micro-grid (clean backdrop with zero 3D map bleed-through) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 22% 88%, rgba(245, 179, 1, 0.05) 0%, transparent 42%), linear-gradient(180deg, rgba(7, 10, 15, 0.5) 0%, transparent 25%, rgba(7, 10, 15, 0.72) 100%)',
        }}
        aria-hidden="true"
      />

      {/* =====================================================================
          TOP NAVIGATION BAR (3-ZONE CONTRACT MATCHING REFERENCES)
          ===================================================================== */}
      <header className="relative z-30 shrink-0 h-16 border-b border-white/10 bg-[#0b0f16]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Emblem & Wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2.5 shrink-0 cursor-pointer group"
        >
          <BrandEmblem className="w-8 h-8 shrink-0" />
          <span className="font-display font-extrabold text-base sm:text-lg tracking-[0.12em] text-white whitespace-nowrap">
            OUTPOST <span className="text-[#F5B301]">ZERO</span>
          </span>
        </button>

        {/* Zone 2: Clean Center Navigation Tabs */}
        <nav className="flex items-center h-full gap-0.5 sm:gap-1.5 overflow-x-auto no-scrollbar min-w-0" aria-label="Main Navigation">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setArmoryPicker(null);
                }}
                className={`relative h-full px-2.5 sm:px-4 md:px-5 flex items-center text-xs sm:text-sm font-display font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-[#f5b301] bg-gradient-to-b from-transparent via-[#f5b301]/8 to-[#f5b301]/18'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>{item.label}</span>
                {active && (
                  <span className="absolute bottom-0 inset-x-0 h-[2.5px] bg-[#f5b301]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Operator Shortcut, Best Score & Audio Mute */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('operators')}
            aria-label="Operator profile"
            title={`Active Operator: ${equippedOperator.name}`}
            className="hidden sm:flex w-8 h-8 rounded-md hover:bg-white/10 items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <User className="w-4 h-4" />
          </button>

          <div className="hidden md:flex items-center gap-3 pl-3 border-l border-white/12">
            <span className="font-mono-num text-xs font-semibold text-[#f5b301] whitespace-nowrap">
              Best: {bestScore.toLocaleString()}
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={settings.muted ? 'Unmute audio' : 'Mute audio'}
            className="w-8 h-8 rounded-md bg-white/[0.04] hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {settings.muted ? (
              <VolumeX className="w-4 h-4 text-slate-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-slate-100" />
            )}
          </button>
        </div>
      </header>

      {/* =====================================================================
          MAIN VIEWPORT CONTENT
          ===================================================================== */}
      <div className="relative z-20 flex-1 overflow-y-auto">
        {/* -------------------------------------------------------------------
            TAB 1: HOME (MATCHES REFERENCE IMAGE 1)
            ------------------------------------------------------------------- */}
        {activeTab === 'home' && (
          <div className="min-h-full max-w-[1440px] mx-auto px-5 sm:px-10 py-8 sm:py-12 flex flex-col lg:flex-row items-start justify-between gap-8">
            {/* Left Command Stack */}
            <div className="w-full max-w-[330px] pt-2 sm:pt-6">
              <div className="mb-8">
                <h1 className="font-display italic font-extrabold text-3xl sm:text-[38px] tracking-tight text-white uppercase leading-none inline-flex items-center gap-2.5 whitespace-nowrap">
                  <span>OUTPOST ZERO</span>
                  <span className="text-[#a3ad4a] not-italic font-black">/</span>
                </h1>
                <p className="mt-2 font-mono text-xs tracking-[0.32em] text-slate-300/90 uppercase">
                  TACTICAL FPS
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  data-start="true"
                  onClick={handleDeploySolo}
                  className="w-full h-12 px-4 rounded-sm bg-[#626833]/88 hover:bg-[#747b3d] border border-[#b5bf62]/75 text-white font-display font-bold text-sm tracking-[0.12em] uppercase flex items-center justify-between transition-all cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                >
                  <span className="flex items-center gap-3.5">
                    <Play className="w-4 h-4 fill-current text-white" />
                    <span>QUICK PLAY</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-white/80" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMapId('island');
                    onStartMission({
                      difficulty,
                      mapId: 'island',
                      loadout,
                    });
                  }}
                  className="w-full h-12 px-4 rounded-sm bg-[#101c28]/90 hover:bg-[#172838] border border-sky-400/45 hover:border-sky-400/80 text-sky-100 hover:text-white font-display font-bold text-sm tracking-[0.12em] uppercase flex items-center justify-between transition-all cursor-pointer backdrop-blur-sm"
                >
                  <span className="flex items-center gap-3.5">
                    <Zap className="w-4 h-4 text-sky-400" />
                    <span>BATTLE ROYALE · 25 KM²</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-sky-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPlayMode('multiplayer');
                    setActiveTab('play');
                  }}
                  className="w-full h-12 px-4 rounded-sm bg-[#10161f]/82 hover:bg-[#192230]/92 border border-white/12 hover:border-white/25 text-slate-200 hover:text-white font-display font-bold text-sm tracking-[0.12em] uppercase flex items-center justify-between transition-all cursor-pointer backdrop-blur-sm"
                >
                  <span className="flex items-center gap-3.5">
                    <Globe className="w-4 h-4 text-slate-300" />
                    <span>MULTIPLAYER</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPlayMode('solo');
                    setActiveTab('play');
                  }}
                  className="w-full h-12 px-4 rounded-sm bg-[#10161f]/82 hover:bg-[#192230]/92 border border-white/12 hover:border-white/25 text-slate-200 hover:text-white font-display font-bold text-sm tracking-[0.12em] uppercase flex items-center justify-between transition-all cursor-pointer backdrop-blur-sm"
                >
                  <span className="flex items-center gap-3.5">
                    <Crosshair className="w-4 h-4 text-slate-300" />
                    <span>SOLO MISSION</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('armory')}
                  className="w-full h-12 px-4 rounded-sm bg-[#10161f]/82 hover:bg-[#192230]/92 border border-white/12 hover:border-white/25 text-slate-200 hover:text-white font-display font-bold text-sm tracking-[0.12em] uppercase flex items-center justify-between transition-all cursor-pointer backdrop-blur-sm"
                >
                  <span className="flex items-center gap-3.5">
                    <Layers className="w-4 h-4 text-slate-300" />
                    <span>ARMORY</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Right Tactical Party & Active Deployment Panel */}
            <aside className="w-full lg:w-[272px] bg-[#0e141d]/84 backdrop-blur-md border border-white/12 rounded-md p-4 space-y-4 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-xs tracking-[0.16em] text-slate-200 uppercase">
                  PARTY
                </span>
                <span className="font-mono-num text-xs text-slate-400">1 / 4</span>
              </div>

              <div className="space-y-2">
                {/* Active Local Player */}
                <button
                  type="button"
                  onClick={() => setActiveTab('operators')}
                  className="w-full px-3 py-2.5 rounded bg-[#151d28]/90 hover:bg-[#1b2534] border border-[#a3ad4a]/60 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded bg-[#222c38] flex items-center justify-center text-slate-200 shrink-0">
                      <User className="w-4 h-4" />
                    </span>
                    <span className="text-sm font-semibold text-white truncate">{callsign}</span>
                  </span>
                  <Crown className="w-4 h-4 text-[#a3ad4a] shrink-0" />
                </button>

                {/* 3 Functional Invite Slots -> Opens Multiplayer Squad Host */}
                {[0, 1, 2].map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      setPlayMode('multiplayer');
                      setMultiplayerTab('host');
                      setActiveTab('play');
                    }}
                    className="w-full px-3 py-2.5 rounded bg-[#111822]/70 hover:bg-[#192330] border border-white/8 hover:border-white/20 flex items-center gap-3 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-500" />
                    <span>Invite Player</span>
                  </button>
                ))}
              </div>

              {/* Active Loadout Quick View */}
              <div className="pt-3.5 border-t border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-[11px] tracking-[0.16em] text-slate-400 uppercase">
                    READY LOADOUT
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('armory')}
                    className="text-[11px] font-mono text-[#f5b301] hover:text-[#ffc11a] cursor-pointer"
                  >
                    Edit
                  </button>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#141c27]/75 border border-white/6">
                    <span className="text-slate-400">Primary</span>
                    <span className="font-medium text-slate-100">{WEAPON_SPECS[loadout.primary[0]].shortLabel}</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#141c27]/75 border border-white/6">
                    <span className="text-slate-400">Secondary</span>
                    <span className="font-medium text-slate-100">{WEAPON_SPECS[loadout.sidearm].shortLabel}</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#141c27]/75 border border-white/6">
                    <span className="text-slate-400">Sector</span>
                    <span className="font-medium text-[#f5b301]">
                      {MAP_SPECS[mapId].name} · {DIFFICULTY_SPECS[difficulty].label}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 2: PLAY (SOLO MISSION & MULTIPLAYER SQUAD HUB)
            ------------------------------------------------------------------- */}
        {activeTab === 'play' && (
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono tracking-[0.22em] text-slate-400 uppercase mb-1.5">
                  <span className="text-[#f5b301] font-bold">/</span>
                  <span>DEPLOYMENT</span>
                </div>
                <h2 className="font-display font-bold text-3xl text-white tracking-tight">
                  Operation Briefing
                </h2>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center gap-1 bg-[#121822] p-1 rounded-lg border border-white/10 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setPlayMode('solo')}
                  className={`px-4 py-2 rounded-md text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    playMode === 'solo'
                      ? 'bg-[#f5b301] text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Solo Mission
                </button>
                <button
                  type="button"
                  onClick={() => setPlayMode('multiplayer')}
                  className={`px-4 py-2 rounded-md text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    playMode === 'multiplayer'
                      ? 'bg-[#f5b301] text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Multiplayer Squad
                </button>
              </div>
            </div>

            {playMode === 'solo' ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-6 items-stretch">
                {/* Left: Mission Parameters */}
                <div className="bg-[#111720] border border-white/10 rounded-xl p-6 space-y-6">
                  <div>
                    <span className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2.5">
                      Deployment Theater
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(['island', 'west'] as MapId[]).map((id) => {
                        const selected = mapId === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setMapId(id)}
                            className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                              selected
                                ? 'bg-[#f5b301]/14 border-[#f5b301] text-white shadow-[0_4px_18px_rgba(245,179,1,0.18)]'
                                : 'bg-[#161e2a] border-white/10 text-slate-300 hover:border-white/25'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-display font-bold text-sm text-white uppercase">
                                {MAP_SPECS[id].name} — {MAP_SPECS[id].subtitle}
                              </span>
                              {selected && (
                                <span className="text-[10px] font-mono font-bold text-[#f5b301]">ACTIVE</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{MAP_SPECS[id].details}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2.5">
                      Difficulty
                    </span>
                    <div className="grid grid-cols-3 gap-2.5">
                      {DIFFICULTY_ORDER.map((id) => {
                        const selected = difficulty === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setDifficulty(id)}
                            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                              selected
                                ? 'bg-[#f5b301] border-[#f5b301] text-slate-950 shadow-[0_4px_18px_rgba(245,179,1,0.25)]'
                                : 'bg-[#161e2a] border-white/10 text-slate-200 hover:border-white/25'
                            }`}
                          >
                            <span className="block font-display font-bold text-sm uppercase">
                              {DIFFICULTY_SPECS[id].label}
                            </span>
                            <span
                              className={`block text-[11px] font-mono-num mt-0.5 ${
                                selected ? 'text-slate-900 font-semibold' : 'text-slate-400'
                              }`}
                            >
                              {DIFFICULTY_SPECS[id].scoreMultiplier.toFixed(1)}x Score
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{DIFFICULTY_SPECS[difficulty].summary}</p>
                  </div>

                  <div>
                    <span className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2.5">
                      Combat Protocol
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setEndlessMode(false)}
                        className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                          !endlessMode
                            ? 'bg-[#f5b301]/14 border-[#f5b301] text-white'
                            : 'bg-[#161e2a] border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="block font-display font-bold text-sm">Standard Defense</span>
                        <span className="block text-xs text-slate-400 mt-0.5">Clear 5 escalating hostile waves</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEndlessMode(true)}
                        className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                          endlessMode
                            ? 'bg-[#f5b301]/14 border-[#f5b301] text-white'
                            : 'bg-[#161e2a] border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="block font-display font-bold text-sm">Endless Survival</span>
                        <span className="block text-xs text-slate-400 mt-0.5">Infinite waves for high-score runs</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Operator & Loadout Deployment Card */}
                <div className="bg-[#111720] border border-white/10 rounded-xl p-6 flex flex-col justify-between gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div>
                        <span className="block text-[11px] font-mono uppercase text-slate-400">
                          Assigned Operator
                        </span>
                        <span className="font-display font-bold text-lg text-white">
                          {equippedOperator.name} · {equippedOperator.shortRole}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('operators')}
                        className="text-xs font-mono text-[#f5b301] hover:text-[#ffc11a] cursor-pointer"
                      >
                        Switch
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono uppercase text-slate-400">
                          {activeSlot.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('armory')}
                          className="text-xs font-mono text-[#f5b301] hover:text-[#ffc11a] cursor-pointer"
                        >
                          Edit in Armory
                        </button>
                      </div>

                      {[
                        { label: 'Primary 1', id: loadout.primary[0], name: WEAPON_SPECS[loadout.primary[0]].name },
                        { label: 'Primary 2', id: loadout.primary[1], name: WEAPON_SPECS[loadout.primary[1]].name },
                        { label: 'Sidearm', id: loadout.sidearm, name: WEAPON_SPECS[loadout.sidearm].name },
                        { label: 'Ordnance', id: loadout.grenade, name: GRENADES[loadout.grenade].name },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="flex items-center gap-3.5 px-3 py-2 rounded-lg bg-[#161e2a] border border-white/8"
                        >
                          <div className="w-20 h-11 rounded-md bg-gradient-to-b from-[#f4f6f9] to-[#e2e7ee] border border-white/15 px-1.5 py-1 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                            <WeaponCardVisual
                              weaponId={row.id}
                              alt={row.name}
                              imageUrl={toAssetUrl(`weapons/${row.id}.png`)}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-sm font-semibold text-white truncate">{row.name}</span>
                            <span className="block text-xs text-slate-400">{row.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    data-start="true"
                    onClick={handleDeploySolo}
                    className="w-full h-12 bg-[#f5b301] hover:bg-[#ffc11a] text-slate-950 font-display font-extrabold text-sm tracking-[0.14em] uppercase rounded-lg shadow-[0_4px_22px_rgba(245,179,1,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2.5"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>DEPLOY TO SECTOR</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Multiplayer Squad Hub */
              <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
                <div className="bg-[#111720] border border-white/10 rounded-xl p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-1.5 bg-[#0b1017] p-1 rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => setMultiplayerTab('host')}
                      className={`py-2 rounded-md text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        multiplayerTab === 'host'
                          ? 'bg-[#f5b301] text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Host Squad
                    </button>
                    <button
                      type="button"
                      onClick={() => setMultiplayerTab('join')}
                      className={`py-2 rounded-md text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        multiplayerTab === 'join'
                          ? 'bg-[#f5b301] text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Join Room
                    </button>
                  </div>

                  {multiplayerTab === 'host' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-mono uppercase text-slate-400 mb-2">
                          Match Mode
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setNetworkSettings({ ...networkSettings, mode: 'coop' })}
                            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                              networkSettings.mode === 'coop'
                                ? 'bg-[#f5b301]/14 border-[#f5b301] text-white'
                                : 'bg-[#161e2a] border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span className="block font-display font-bold text-sm">Co-op Survival</span>
                            <span className="block text-xs text-slate-400 mt-0.5">Up to 4 operators vs waves</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNetworkSettings({ ...networkSettings, mode: 'deathmatch' })}
                            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                              networkSettings.mode === 'deathmatch'
                                ? 'bg-[#f5b301]/14 border-[#f5b301] text-white'
                                : 'bg-[#161e2a] border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span className="block font-display font-bold text-sm">PvP Deathmatch</span>
                            <span className="block text-xs text-slate-400 mt-0.5">Free-for-all elimination</span>
                          </button>
                        </div>
                      </div>

                      {networkSettings.mode === 'coop' ? (
                        <div>
                          <label className="block text-xs font-mono uppercase text-slate-400 mb-2">
                            Difficulty
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {DIFFICULTY_ORDER.map((id) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setNetworkSettings({ ...networkSettings, difficulty: id })}
                                className={`py-2.5 rounded-lg border text-xs font-display font-bold uppercase transition-all cursor-pointer ${
                                  networkSettings.difficulty === id
                                    ? 'bg-[#f5b301] border-[#f5b301] text-slate-950'
                                    : 'bg-[#161e2a] border-white/10 text-slate-300 hover:text-white'
                                }`}
                              >
                                {DIFFICULTY_SPECS[id].label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-mono uppercase text-slate-400 mb-2">
                            Elimination Limit
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {[10, 15, 25].map((kills) => (
                              <button
                                key={kills}
                                type="button"
                                onClick={() => setNetworkSettings({ ...networkSettings, killLimit: kills })}
                                className={`py-2.5 rounded-lg border text-xs font-mono-num font-bold transition-all cursor-pointer ${
                                  networkSettings.killLimit === kills
                                    ? 'bg-[#f5b301] border-[#f5b301] text-slate-950'
                                    : 'bg-[#161e2a] border-white/10 text-slate-300 hover:text-white'
                                }`}
                              >
                                {kills} Kills
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleHost}
                        className="w-full h-12 bg-[#f5b301] hover:bg-[#ffc11a] text-slate-950 font-display font-extrabold text-sm tracking-wider uppercase rounded-lg shadow-[0_4px_20px_rgba(245,179,1,0.28)] transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Users className="w-4 h-4" />
                        <span>CREATE SQUAD LOBBY</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-mono uppercase text-slate-400 mb-2">
                          Squad Room Code
                        </label>
                        <input
                          type="text"
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                          placeholder="OPZ-7K2X"
                          className="w-full bg-[#161e2a] border border-white/15 focus:border-[#f5b301] rounded-lg px-4 py-3 text-lg font-mono tracking-[0.25em] text-white uppercase focus:outline-none text-center"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={!joinCode.trim()}
                        onClick={handleJoin}
                        className={`w-full h-12 font-display font-extrabold text-sm tracking-wider uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${
                          joinCode.trim()
                            ? 'bg-[#f5b301] hover:bg-[#ffc11a] text-slate-950 shadow-[0_4px_20px_rgba(245,179,1,0.28)] cursor-pointer'
                            : 'bg-white/10 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>CONNECT TO SQUAD</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Right: Squad Identity Card */}
                <div className="bg-[#111720] border border-white/10 rounded-xl p-6 space-y-5">
                  <div>
                    <span className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                      Squad Profile
                    </span>
                    <h3 className="font-display font-bold text-lg text-white">Operator Identity</h3>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Callsign</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={14}
                        value={callsign}
                        onChange={(e) => setCallsign(e.target.value)}
                        className="flex-1 bg-[#161e2a] border border-white/12 focus:border-[#f5b301] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleRandomizeCallsign}
                        title="Randomize Callsign"
                        className="px-3 py-2 bg-[#161e2a] hover:bg-[#1e2938] border border-white/12 rounded-lg text-slate-300 hover:text-white cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">IFF Signal Color</label>
                    <div className="flex gap-3 items-center p-2.5 bg-[#161e2a] border border-white/10 rounded-lg">
                      {COLOR_KEYS.map((k) => {
                        const spec = PLAYER_COLORS[k];
                        const selected = color === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setColor(k)}
                            aria-label={`Select ${k} signal color`}
                            className={`w-7 h-7 rounded-full transition-all cursor-pointer ${
                              selected ? 'ring-2 ring-white scale-110' : 'opacity-65 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: spec.css }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed pt-2 border-t border-white/10">
                    Peer-to-peer WebRTC squad rooms support up to 4 players in Co-op Wave Defense or PvP Deathmatch with zero server setup.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 3: OPERATORS (MATCHES REFERENCE IMAGES 3 & 4)
            ------------------------------------------------------------------- */}
        {activeTab === 'operators' && (
          <div className="min-h-full max-w-[1380px] mx-auto px-5 sm:px-10 py-6 sm:py-8 flex flex-col justify-between gap-6">
            {/* Upper 3-Column Showcase Stage */}
            <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr_300px] items-center gap-6 lg:gap-4 flex-1">
              {/* Left: Operator Identity & Stat Bars */}
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2.5 text-xs font-mono tracking-[0.22em] text-slate-400 uppercase mb-3">
                    <span className="text-[#f5b301] font-bold">/</span>
                    <span>OPERATORS</span>
                    <span className="w-6 h-[1.5px] bg-[#f5b301]/70" />
                  </div>
                  <h2 className="font-display font-extrabold text-5xl sm:text-[56px] text-white tracking-tight leading-none">
                    {inspectedOperator.name}
                  </h2>
                  <p className="mt-2 text-lg text-slate-400 font-medium">
                    {inspectedOperator.roleTitle}
                  </p>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed max-w-[270px]">
                  {inspectedOperator.bio}
                </p>

                {/* 3 Tactical Attribute Bars */}
                <div className="space-y-3 pt-2 max-w-[280px]">
                  {[
                    { label: 'Focus', value: inspectedOperator.stats.focus, icon: Crosshair },
                    { label: 'Survivability', value: inspectedOperator.stats.survivability, icon: Shield },
                    { label: 'Mobility', value: inspectedOperator.stats.mobility, icon: Footprints },
                  ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="grid grid-cols-[120px_1fr] items-center gap-3">
                        <span className="flex items-center gap-2.5 text-xs text-slate-200 font-medium">
                          <Icon className="w-4 h-4 text-slate-300" />
                          <span>{stat.label}</span>
                        </span>
                        <div className="h-2 rounded-full bg-white/12 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#f5b301] transition-all duration-300"
                            style={{ width: `${stat.value}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Center: Hero Operator Portrait */}
              <div className="relative flex items-center justify-center min-h-[280px] sm:min-h-[370px]">
                <OperatorPortrait
                  operatorId={inspectedOperator.id}
                  active
                  size="hero"
                  className="w-full max-w-[360px] h-[300px] sm:h-[390px] drop-shadow-[0_18px_36px_rgba(0,0,0,0.75)]"
                />
              </div>

              {/* Right: Loadout Preset Card & Select CTA */}
              <div className="space-y-3.5">
                <div className="bg-[#111720]/95 border border-white/12 rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-mono tracking-[0.2em] text-slate-300 uppercase pb-3 border-b border-white/10">
                    LOADOUT PRESET
                  </h3>

                  <div className="divide-y divide-white/8">
                    {[
                      {
                        weaponId: inspectedOperator.presetLoadout.primary[0],
                        title: WEAPON_SPECS[inspectedOperator.presetLoadout.primary[0]].name,
                        slot: 'Primary',
                      },
                      {
                        weaponId: inspectedOperator.presetLoadout.sidearm,
                        title: WEAPON_SPECS[inspectedOperator.presetLoadout.sidearm].name,
                        slot: 'Secondary',
                      },
                      {
                        weaponId: inspectedOperator.presetLoadout.grenade,
                        title: `${GRENADES[inspectedOperator.presetLoadout.grenade].name} Grenade`,
                        slot: 'Equipment',
                      },
                    ].map((item) => (
                      <div key={item.slot} className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0">
                        <div className="w-20 h-11 rounded-md bg-gradient-to-b from-[#f4f6f9] to-[#e2e7ee] border border-white/15 px-1.5 py-1 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                          <WeaponCardVisual
                            weaponId={item.weaponId}
                            alt={item.title}
                            imageUrl={toAssetUrl(`weapons/${item.weaponId}.png`)}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-white truncate">
                            {item.title}
                          </span>
                          <span className="block text-xs text-slate-400">{item.slot}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleEquipOperator}
                  className="w-full h-12 rounded-lg bg-[#f5b301] hover:bg-[#ffc11a] text-slate-950 font-display font-extrabold text-sm tracking-[0.12em] uppercase flex items-center justify-center gap-2 shadow-[0_6px_24px_rgba(245,179,1,0.3)] transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[2.8]" />
                  <span>
                    {equippedOperatorId === inspectedOperator.id ? 'OPERATOR EQUIPPED' : 'SELECT OPERATOR'}
                  </span>
                </button>

                {operatorNotice && (
                  <p className="text-center text-xs font-mono text-[#f5b301]">{operatorNotice}</p>
                )}
              </div>
            </div>

            {/* Bottom 4-Card Operator Selector Rail */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
              {OPERATORS.map((op) => {
                const isInspected = inspectedOperatorId === op.id;
                const isEquipped = equippedOperatorId === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setInspectedOperatorId(op.id)}
                    className={`relative h-24 rounded-lg border overflow-hidden flex items-center text-left transition-all cursor-pointer ${
                      isInspected
                        ? 'bg-[#171e28] border-[#f5b301] shadow-[0_0_24px_rgba(245,179,1,0.16)]'
                        : 'bg-[#11161f]/90 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="w-24 sm:w-28 h-full shrink-0 overflow-hidden bg-[#0c1118]">
                      <OperatorPortrait
                        operatorId={op.id}
                        active={isInspected}
                        size="card"
                        className="w-full h-full object-cover scale-125 translate-y-2"
                      />
                    </div>
                    <div className="px-3.5 py-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-base text-white truncate">
                          {op.name}
                        </span>
                        {isEquipped && (
                          <Check className="w-3.5 h-3.5 text-[#f5b301] shrink-0" />
                        )}
                      </div>
                      <span className="block text-xs text-slate-400 mt-0.5">{op.shortRole}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 4: ARMORY (MATCHES REFERENCE IMAGE 2)
            ------------------------------------------------------------------- */}
        {activeTab === 'armory' && (
          <div className="max-w-[1380px] mx-auto px-5 sm:px-10 py-7 space-y-6">
            {/* Heading */}
            <div>
              <div className="flex items-center gap-2 text-xs font-mono tracking-[0.22em] text-slate-400 uppercase mb-1.5">
                <span className="text-[#f5b301] font-bold">/</span>
                <span>LOADOUT</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
                  Custom Loadout
                </h2>
                <button
                  type="button"
                  onClick={handleDeploySolo}
                  className="px-5 py-2.5 bg-[#f5b301] hover:bg-[#ffc11a] text-slate-950 font-display font-extrabold text-xs tracking-wider uppercase rounded-lg cursor-pointer inline-flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Deploy With Loadout</span>
                </button>
              </div>
            </div>

            {/* Left Preset Rail + Right 2x2 Tactical Loadout Grid */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Left Saved Loadout Presets */}
              <aside className="w-full lg:w-52 shrink-0 space-y-2">
                {loadoutSlots.map((slot, index) => {
                  const active = index === activeSlotIdx;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleSelectSlot(index)}
                      className={`w-full px-4 py-3 rounded-md border text-left text-sm font-medium transition-all cursor-pointer flex items-center justify-between ${
                        active
                          ? 'bg-[#5a5e34]/75 border-[#b8bf68]/70 text-white font-semibold shadow-sm'
                          : 'bg-[#121821]/90 border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{slot.name}</span>
                      {active && <span className="w-1.5 h-4 rounded-full bg-[#f5b301]" />}
                    </button>
                  );
                })}

                {loadoutSlots.length < 8 && (
                  <button
                    type="button"
                    onClick={handleCreateLoadoutSlot}
                    className="w-full mt-2 px-4 py-3 rounded-md border border-white/12 bg-[#10151e] hover:bg-[#17202d] text-slate-300 hover:text-white text-sm font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-slate-400" />
                    <span>New Loadout</span>
                  </button>
                )}
              </aside>

              {/* Right 2x2 Tactical Equipment Grid */}
              <div className="flex-1 w-full grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-4">
                {/* PRIMARY WEAPON CARD */}
                <div className="bg-[#121821]/92 border border-white/12 rounded-xl p-5 flex flex-col justify-between gap-4 min-h-[250px]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="block text-xs text-slate-400 mb-0.5">Primary</span>
                      <h3 className="font-display font-bold text-xl text-white">
                        {WEAPON_SPECS[loadout.primary[0]].name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setArmoryPicker('primary1')}
                      aria-label="Edit primary weapon"
                      className="w-8 h-8 rounded-md bg-white/[0.04] hover:bg-white/12 border border-white/10 flex items-center justify-center text-slate-300 hover:text-[#f5b301] transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Hero Weapon Visual */}
                  <button
                    type="button"
                    onClick={() => setArmoryPicker('primary1')}
                    className="h-32 w-full flex items-center justify-center rounded-lg bg-gradient-to-b from-[#f4f6f9] to-[#e4e8ef] border border-white/15 hover:border-[#f5b301]/70 transition-colors p-3 cursor-pointer shadow-inner"
                  >
                    <WeaponCardVisual
                      weaponId={loadout.primary[0]}
                      alt={WEAPON_SPECS[loadout.primary[0]].name}
                      imageUrl={toAssetUrl(`weapons/${loadout.primary[0]}.png`)}
                      className="max-h-full max-w-[90%] object-contain"
                    />
                  </button>

                  {/* 4 Bottom Loadout Slot Tiles (Primary 1, Primary 2, Heavy Launcher, Ballistics) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setArmoryPicker('primary1')}
                      className="px-2.5 py-2 rounded-md bg-[#18202c] hover:bg-[#1f2a3a] border border-[#f5b301]/50 text-left transition-colors cursor-pointer"
                    >
                      <span className="block text-[10px] font-mono text-[#f5b301] uppercase">Slot 1</span>
                      <span className="block text-xs font-semibold text-white truncate">
                        {WEAPON_SPECS[loadout.primary[0]].shortLabel}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setArmoryPicker('primary2')}
                      className="px-2.5 py-2 rounded-md bg-[#18202c] hover:bg-[#1f2a3a] border border-white/10 hover:border-white/25 text-left transition-colors cursor-pointer"
                    >
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Slot 2</span>
                      <span className="block text-xs font-semibold text-slate-100 truncate">
                        {WEAPON_SPECS[loadout.primary[1]].shortLabel}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setArmoryPicker('launcher')}
                      className="px-2.5 py-2 rounded-md bg-[#18202c] hover:bg-[#1f2a3a] border border-white/10 hover:border-white/25 text-left transition-colors cursor-pointer"
                    >
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Launcher</span>
                      <span className="block text-xs font-semibold text-slate-100 truncate">
                        {loadout.launcher ? WEAPON_SPECS[loadout.launcher].shortLabel : 'None'}
                      </span>
                    </button>

                    <div className="px-2.5 py-2 rounded-md bg-[#0e141d] border border-white/8 text-left">
                      <span className="block text-[10px] font-mono text-slate-400 uppercase">Ballistics</span>
                      <span className="block text-xs font-mono-num text-slate-200 truncate">
                        DMG {WEAPON_SPECS[loadout.primary[0]].damage} · {WEAPON_SPECS[loadout.primary[0]].magSize}R
                      </span>
                    </div>
                  </div>
                </div>

                {/* EQUIPMENT CARD */}
                <div className="bg-[#121821]/92 border border-white/12 rounded-xl p-5 flex flex-col justify-between gap-4 min-h-[250px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Equipment</span>
                    <button
                      type="button"
                      onClick={() => setArmoryPicker('grenade')}
                      className="text-xs font-mono text-[#f5b301] hover:text-[#ffc11a] cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 flex-1">
                    {/* Equipped Ordnance Tile */}
                    <button
                      type="button"
                      onClick={() => setArmoryPicker('grenade')}
                      className="rounded-lg bg-[#171f2b] hover:bg-[#1d2736] border border-[#f5b301]/55 p-3.5 flex flex-col items-center justify-between gap-2.5 transition-all cursor-pointer"
                    >
                      <div className="h-24 w-full rounded-md bg-gradient-to-b from-[#f4f6f9] to-[#e4e8ef] border border-white/15 p-2 flex items-center justify-center shadow-inner">
                        <WeaponCardVisual
                          weaponId={loadout.grenade}
                          alt={GRENADES[loadout.grenade].name}
                          imageUrl={toAssetUrl(`weapons/${loadout.grenade}.png`)}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="text-center">
                        <span className="block text-sm font-medium text-white">
                          {GRENADES[loadout.grenade].name}
                        </span>
                        <span className="block text-[10px] font-mono uppercase text-[#f5b301]">
                          Equipped
                        </span>
                      </div>
                    </button>

                    {/* Quick-Swap Tactical Alternative Tile */}
                    <button
                      type="button"
                      onClick={() => handleSelectGrenade(secondaryGrenadePreview)}
                      className="rounded-lg bg-[#151c26] hover:bg-[#1d2736] border border-white/10 hover:border-white/25 p-3.5 flex flex-col items-center justify-between gap-2.5 transition-all cursor-pointer"
                    >
                      <div className="h-24 w-full rounded-md bg-gradient-to-b from-[#f4f6f9] to-[#e4e8ef] border border-white/15 p-2 flex items-center justify-center opacity-90 shadow-inner">
                        <WeaponCardVisual
                          weaponId={secondaryGrenadePreview}
                          alt={GRENADES[secondaryGrenadePreview].name}
                          imageUrl={toAssetUrl(`weapons/${secondaryGrenadePreview}.png`)}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="text-center">
                        <span className="block text-sm font-medium text-slate-200">
                          {GRENADES[secondaryGrenadePreview].name}
                        </span>
                        <span className="block text-[10px] font-mono uppercase text-slate-400">
                          Quick Equip
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* SECONDARY WEAPON CARD */}
                <div className="bg-[#121821]/92 border border-white/12 rounded-xl p-5 flex flex-col justify-between gap-4 min-h-[210px]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="block text-xs text-slate-400 mb-0.5">Secondary</span>
                      <h3 className="font-display font-bold text-xl text-white">
                        {WEAPON_SPECS[loadout.sidearm].name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setArmoryPicker('sidearm')}
                      aria-label="Edit secondary weapon"
                      className="w-8 h-8 rounded-md bg-white/[0.04] hover:bg-white/12 border border-white/10 flex items-center justify-center text-slate-300 hover:text-[#f5b301] transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Quick 3-Sidearm Switcher Pills */}
                    <div className="flex items-center gap-2 self-stretch sm:self-end">
                      {SIDEARMS.map((id) => {
                        const selected = loadout.sidearm === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleSelectSidearm(id)}
                            className={`px-3 py-2 rounded-md border text-xs font-mono font-semibold transition-all cursor-pointer ${
                              selected
                                ? 'bg-[#1c2533] border-[#f5b301] text-[#f5b301]'
                                : 'bg-[#161e2a] border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            {WEAPON_SPECS[id].shortLabel.split(' ')[0]}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setArmoryPicker('sidearm')}
                      className="h-28 flex-1 rounded-lg bg-gradient-to-b from-[#f4f6f9] to-[#e4e8ef] border border-white/15 hover:border-[#f5b301]/70 p-2.5 flex items-center justify-center cursor-pointer shadow-inner transition-colors"
                    >
                      <WeaponCardVisual
                        weaponId={loadout.sidearm}
                        alt={WEAPON_SPECS[loadout.sidearm].name}
                        imageUrl={toAssetUrl(`weapons/${loadout.sidearm}.png`)}
                        className="max-h-full max-w-[200px] object-contain"
                      />
                    </button>
                  </div>
                </div>

                {/* PERKS CARD */}
                <div className="bg-[#121821]/92 border border-white/12 rounded-xl p-5 flex flex-col justify-between gap-4 min-h-[210px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Perks</span>
                    <span className="text-[11px] font-mono text-slate-500">Click to cycle</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 flex-1">
                    {activeSlot.perks.map((perkName, idx) => {
                      const slotIdx = idx as 0 | 1 | 2;
                      const perkInfo = PERK_CATALOG.find((p) => p.id === perkName);
                      const Icon = slotIdx === 0 ? Zap : slotIdx === 1 ? Shield : Crosshair;
                      return (
                        <button
                          key={slotIdx}
                          type="button"
                          onClick={() => handleCyclePerk(slotIdx)}
                          title={perkInfo?.summary}
                          className="rounded-lg bg-[#161e2a] hover:bg-[#1d2736] border border-white/10 hover:border-[#f5b301]/50 p-3 flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer"
                        >
                          <Icon className="w-7 h-7 text-slate-100 stroke-[1.75]" />
                          <span className="text-xs sm:text-sm font-medium text-slate-200 text-center leading-tight">
                            {perkName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 5: SETTINGS (MATCHES SETTINGS REFERENCE)
            ------------------------------------------------------------------- */}
        {activeTab === 'settings' && (
          <div className="max-w-[1200px] mx-auto px-5 sm:px-10 py-8 flex flex-col md:flex-row gap-8 min-h-full">
            {/* Left Sidebar Navigation */}
            <aside className="w-full md:w-56 shrink-0 md:border-r md:border-white/10 md:pr-6 flex flex-col justify-between gap-6">
              <div className="space-y-2">
                <span className="block px-3 text-xs font-mono tracking-[0.22em] text-slate-400 uppercase mb-3">
                  SETTINGS
                </span>

                {(
                  [
                    { id: 'graphics', label: 'Graphics', icon: Monitor },
                    { id: 'audio', label: 'Audio & Aim', icon: Volume2 },
                    { id: 'controls', label: 'Controls', icon: Sliders },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = settingsTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSettingsTab(item.id)}
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-sm font-medium flex items-center gap-3 transition-all cursor-pointer ${
                        active
                          ? 'bg-[#f5b301]/14 border-[#f5b301]/65 text-[#f5b301] font-semibold'
                          : 'bg-transparent border-transparent text-slate-300 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleRestoreDefaults}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#121821] hover:bg-[#192230] text-xs font-medium text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Defaults</span>
                </button>
              </div>
            </aside>

            {/* Right Detail Panel */}
            <section className="flex-1 max-w-3xl space-y-5">
              <div>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
                  {settingsTab === 'graphics'
                    ? 'Graphics'
                    : settingsTab === 'audio'
                    ? 'Audio & Aim'
                    : 'Controls'}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {settingsTab === 'graphics'
                    ? 'Adjust visual quality, resolution scaling, and rendering performance.'
                    : settingsTab === 'audio'
                    ? 'Calibrate mouse sensitivity, master output, and tactical dynamic range.'
                    : 'Customize keyboard bindings for movement, combat, and weapon slots.'}
                </p>
              </div>

              {settingsTab === 'graphics' && (
                <GraphicsSettings settings={settings} onChange={onSettingsChange} />
              )}

              {settingsTab === 'audio' && (
                <div className="space-y-2.5">
                  {/* Mouse Sensitivity Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 bg-[#131922] border border-white/10 rounded-lg">
                    <div>
                      <span className="text-sm text-slate-200 font-medium block">Mouse Sensitivity</span>
                      <span className="text-xs text-slate-400">Look and ADS rotational response multiplier</span>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-64">
                      <input
                        type="range"
                        min={0.3}
                        max={2.2}
                        step={0.05}
                        value={settings.sensitivity}
                        onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
                        aria-label="Mouse Sensitivity"
                        className="flex-1 accent-[#f5b301] cursor-pointer h-1.5 bg-[#232d3b] rounded-lg"
                      />
                      <span className="w-12 text-right font-mono-num text-xs text-[#f5b301] font-bold">
                        {settings.sensitivity.toFixed(2)}x
                      </span>
                    </div>
                  </div>

                  {/* Sound Effects Mute Switch Row */}
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-[#131922] border border-white/10 rounded-lg">
                    <div>
                      <span className="text-sm text-slate-200 font-medium block">Sound Effects</span>
                      <span className="text-xs text-slate-400">Toggle synthesized combat audio & spatial cues</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!settings.muted}
                      onClick={onToggleMute}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                        !settings.muted
                          ? 'bg-[#f5b301] border-[#f5b301]'
                          : 'bg-[#1f2937] border-white/15'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          !settings.muted ? 'translate-x-5.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Dynamic Range Compression Row */}
                  {(() => {
                    const activeDrc = getAudioDynamicRangeSpec(settings.audioDynamicRange);
                    const footstepPct = Math.round((activeDrc.subtleCueGain - 1) * 100);
                    return (
                      <div className="px-4 py-4 bg-[#131922] border border-white/10 rounded-lg space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <span className="text-sm text-slate-200 font-medium block">
                              Dynamic Range Compression
                            </span>
                            <span className="text-xs text-slate-400">{activeDrc.description}</span>
                          </div>
                          <div
                            className="grid grid-cols-3 bg-[#0b1017] p-1 rounded-lg border border-white/10 shrink-0"
                            role="radiogroup"
                            aria-label="Dynamic Range Compression"
                          >
                            {AUDIO_DYNAMIC_RANGE_ORDER.map((presetId) => {
                              const spec = AUDIO_DYNAMIC_RANGE_PRESETS[presetId];
                              const active = activeDrc.id === presetId;
                              return (
                                <button
                                  key={presetId}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  onClick={() => onSettingsChange({ audioDynamicRange: presetId })}
                                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                                    active
                                      ? 'bg-[#f5b301] text-slate-950 font-bold shadow'
                                      : 'text-slate-300 hover:text-white'
                                  }`}
                                >
                                  {spec.shortLabel}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2.5 border-t border-white/8 text-xs font-mono text-slate-400">
                          <span>
                            Threshold {activeDrc.thresholdDb} dB · Ratio {activeDrc.ratio}:1
                          </span>
                          <span className="text-[#f5b301]">
                            Footsteps {footstepPct > 0 ? `+${footstepPct}%` : 'Natural'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {settingsTab === 'controls' && (
                <ControlsSettings settings={settings} onChange={onSettingsChange} />
              )}
            </section>
          </div>
        )}
      </div>

      {/* =====================================================================
          PERSISTENT BOTTOM FOOTER BAR (OPERATOR RANK + KEY HINTS)
          ===================================================================== */}
      <footer className="relative z-30 shrink-0 h-14 border-t border-white/10 bg-[#090d13]/92 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4">
        {/* Left: Operator Badge & Progression */}
        <button
          type="button"
          onClick={() => setActiveTab('operators')}
          className="flex items-center gap-3 group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-md overflow-hidden bg-[#161e2a] border border-white/15 shrink-0">
            <OperatorPortrait
              operatorId={equippedOperator.id}
              active
              size="avatar"
              className="w-full h-full scale-125 translate-y-1"
            />
          </div>
          <div className="text-left">
            <span className="block text-xs sm:text-sm font-semibold text-white leading-tight group-hover:text-[#f5b301] transition-colors">
              {callsign}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono-num text-[11px] text-slate-400">Lv. {rank.level}</span>
              <span className="w-20 sm:w-28 h-1.5 rounded-full bg-white/12 overflow-hidden block">
                <span
                  className="block h-full rounded-full bg-[#a3ad4a]"
                  style={{ width: `${rank.progressPct}%` }}
                />
              </span>
            </div>
          </div>
        </button>

        {/* Right: Real Functional Key Hint Buttons */}
        <div className="flex items-center gap-4 text-xs text-slate-300">
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="inline-flex items-center gap-2 hover:text-white transition-colors cursor-pointer"
          >
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/20 font-mono text-[11px] text-slate-200">
              F1
            </kbd>
            <span className="hidden sm:inline">Help</span>
            <HelpCircle className="w-3.5 h-3.5 sm:hidden" />
          </button>

          {activeTab !== 'home' && (
            <>
              <span className="w-px h-4 bg-white/15" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="inline-flex items-center gap-2 hover:text-white transition-colors cursor-pointer"
              >
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/20 font-mono text-[11px] text-slate-200">
                  ESC
                </kbd>
                <span>Back</span>
              </button>
            </>
          )}

          {nativeBridge.isNativeWinUI && (
            <>
              <span className="w-px h-4 bg-white/15" aria-hidden="true" />
              <button
                type="button"
                onClick={() => nativeBridge.exitApplication()}
                className="inline-flex items-center gap-1.5 text-rose-300 hover:text-rose-200 transition-colors cursor-pointer font-mono uppercase tracking-wider"
              >
                <span>Exit Desktop</span>
              </button>
            </>
          )}
        </div>
      </footer>

      {/* =====================================================================
          ARMORY WEAPON & ORDNANCE PICKER MODAL
          ===================================================================== */}
      {armoryPicker && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setArmoryPicker(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Select Equipment"
        >
          <div
            className="w-full max-w-3xl bg-[#0e131b] border border-white/12 rounded-xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.85)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-white/10 bg-[#121822] flex items-center justify-between">
              <div>
                <span className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[#f5b301]">
                  ARMORY SELECTION
                </span>
                <h3 className="font-display font-bold text-xl text-white uppercase">
                  {armoryPicker === 'primary1'
                    ? 'Primary Weapon — Slot 1'
                    : armoryPicker === 'primary2'
                    ? 'Primary Weapon — Slot 2'
                    : armoryPicker === 'sidearm'
                    ? 'Secondary Sidearm'
                    : armoryPicker === 'launcher'
                    ? 'Heavy Launcher'
                    : 'Tactical Ordnance'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setArmoryPicker(null)}
                aria-label="Close selector"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[72dvh] overflow-y-auto space-y-4">
              {(armoryPicker === 'primary1' || armoryPicker === 'primary2') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {PRIMARY_WEAPONS.map((id) => {
                    const spec = WEAPON_SPECS[id];
                    const slotIdx = armoryPicker === 'primary1' ? 0 : 1;
                    const isCurrent = loadout.primary[slotIdx] === id;
                    const inOtherSlot = loadout.primary[slotIdx === 0 ? 1 : 0] === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleSelectPrimary(slotIdx, id)}
                        className={`p-4 rounded-lg border text-left transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[#f5b301]/14 border-[#f5b301]'
                            : 'bg-[#141b25] border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className="h-20 flex items-center justify-center mb-3 bg-gradient-to-b from-[#f4f6f9] to-[#e4e8ef] border border-white/15 rounded-md p-2 shadow-inner">
                          <WeaponCardVisual
                            weaponId={id}
                            alt={spec.name}
                            imageUrl={toAssetUrl(`weapons/${id}.png`)}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-bold text-sm text-white truncate">
                            {spec.shortLabel}
                          </span>
                          {isCurrent && <Check className="w-4 h-4 text-[#f5b301] shrink-0" />}
                        </div>
                        <span className="block text-[11px] font-mono-num text-slate-400 mt-1">
                          DMG {spec.damage} · {spec.fireRate.toFixed(1)}/s · MAG {spec.magSize}
                        </span>
                        {inOtherSlot && (
                          <span className="block text-[10px] font-mono text-slate-400 mt-1">
                            Equipped in other slot (click to swap)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {armoryPicker === 'sidearm' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SIDEARMS.map((id) => {
                    const spec = WEAPON_SPECS[id];
                    const isCurrent = loadout.sidearm === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleSelectSidearm(id)}
                        className={`p-4 rounded-lg border text-left transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[#f5b301]/14 border-[#f5b301]'
                            : 'bg-[#141b25] border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className="h-24 flex items-center justify-center mb-3 bg-gradient-to-b from-[#f4f6f9] to-[#e4e8ef] border border-white/15 rounded-md p-2 shadow-inner">
                          <WeaponCardVisual
                            weaponId={id}
                            alt={spec.name}
                            imageUrl={toAssetUrl(`weapons/${id}.png`)}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-bold text-sm text-white">
                            {spec.name}
                          </span>
                          {isCurrent && <Check className="w-4 h-4 text-[#f5b301] shrink-0" />}
                        </div>
                        <span className="block text-[11px] font-mono-num text-slate-400 mt-1">
                          DMG {spec.damage} · MAG {spec.magSize}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {armoryPicker === 'launcher' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {LAUNCHERS.map((id) => {
                      const spec = WEAPON_SPECS[id];
                      const isCurrent = loadout.launcher === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleSelectLauncher(id)}
                          className={`p-4 rounded-lg border text-left transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-[#f5b301]/14 border-[#f5b301]'
                              : 'bg-[#141b25] border-white/10 hover:border-white/30'
                          }`}
                        >
                          <div className="h-24 flex items-center justify-center mb-3 bg-gradient-to-b from-[#f4f6f9] to-[#e4e8ef] border border-white/15 rounded-md p-2 shadow-inner">
                            <WeaponCardVisual
                              weaponId={id}
                              alt={spec.name}
                              imageUrl={toAssetUrl(`weapons/${id}.png`)}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display font-bold text-sm text-white">
                              {spec.name}
                            </span>
                            {isCurrent && <Check className="w-4 h-4 text-[#f5b301] shrink-0" />}
                          </div>
                          <span className="block text-[11px] font-mono-num text-slate-400 mt-1">
                            DMG {spec.damage} · BLAST {spec.blastRadius ?? 5}M
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectLauncher(null)}
                    className={`w-full py-3 px-4 rounded-lg border text-xs font-mono uppercase tracking-wider cursor-pointer transition-colors ${
                      loadout.launcher === null
                        ? 'bg-[#f5b301]/14 border-[#f5b301] text-[#f5b301] font-bold'
                        : 'bg-[#141b25] border-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    No Heavy Launcher (Faster Sprint)
                  </button>
                </div>
              )}

              {armoryPicker === 'grenade' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(Object.keys(GRENADES) as GrenadeId[]).map((id) => {
                    const spec = GRENADES[id];
                    const isCurrent = loadout.grenade === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleSelectGrenade(id)}
                        className={`p-4 rounded-lg border text-center transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[#f5b301]/14 border-[#f5b301]'
                            : 'bg-[#141b25] border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className="h-24 flex items-center justify-center mb-3 bg-gradient-to-b from-[#f4f6f9] to-[#e4e8ef] border border-white/15 rounded-md p-2 shadow-inner">
                          <WeaponCardVisual
                            weaponId={id}
                            alt={spec.name}
                            imageUrl={toAssetUrl(`weapons/${id}.png`)}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <span className="block font-display font-bold text-sm text-white">
                          {spec.name}
                        </span>
                        <span className="block text-[11px] text-slate-400 mt-1 leading-snug">
                          {spec.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          F1 HELP & KEYBINDINGS OVERLAY
          ===================================================================== */}
      {showHelp && (
        <HelpOverlayModal controls={settings.controls} onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
};
