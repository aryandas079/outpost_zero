/**
 * Explicit Battle Royale & Combat Match Lifecycle State Machine.
 * Prevents invalid transitions, duplicate end-of-match triggers, and orphaned states.
 */

import type { BattleRoyaleDeployStage, GamePhase } from '../game/types';

export type MatchLifecycleState =
  | 'main_menu'
  | 'match_loading'
  | 'pre_match_lobby'
  | 'aircraft_deployment'
  | 'freefall'
  | 'parachuting'
  | 'active_match'
  | 'paused'
  | 'eliminated'
  | 'spectating'
  | 'match_completed'
  | 'results';

const ALLOWED_TRANSITIONS: Record<MatchLifecycleState, readonly MatchLifecycleState[]> = {
  main_menu: ['match_loading', 'pre_match_lobby', 'aircraft_deployment', 'active_match'],
  match_loading: ['pre_match_lobby', 'aircraft_deployment', 'active_match', 'main_menu'],
  pre_match_lobby: ['aircraft_deployment', 'active_match', 'main_menu'],
  aircraft_deployment: ['freefall', 'paused', 'eliminated', 'main_menu', 'match_loading'],
  freefall: ['parachuting', 'active_match', 'paused', 'eliminated', 'main_menu', 'match_loading'],
  parachuting: ['active_match', 'paused', 'eliminated', 'main_menu', 'match_loading'],
  active_match: ['paused', 'eliminated', 'spectating', 'match_completed', 'results', 'main_menu', 'match_loading'],
  paused: ['aircraft_deployment', 'freefall', 'parachuting', 'active_match', 'spectating', 'main_menu', 'match_loading'],
  eliminated: ['spectating', 'results', 'match_completed', 'main_menu', 'match_loading'],
  spectating: ['paused', 'match_completed', 'results', 'main_menu', 'match_loading'],
  match_completed: ['results', 'main_menu', 'match_loading'],
  results: ['main_menu', 'match_loading'],
};

export class MatchStateMachine {
  private _state: MatchLifecycleState = 'main_menu';
  private _resumeTarget: MatchLifecycleState = 'active_match';
  private _matchId = 0;

  get state(): MatchLifecycleState {
    return this._state;
  }

  get matchId(): number {
    return this._matchId;
  }

  beginNewMatch(): number {
    this._matchId += 1;
    this._state = 'match_loading';
    this._resumeTarget = 'active_match';
    return this._matchId;
  }

  canTransition(next: MatchLifecycleState): boolean {
    if (next === this._state) return false;
    return ALLOWED_TRANSITIONS[this._state].includes(next);
  }

  transition(next: MatchLifecycleState): boolean {
    if (!this.canTransition(next)) return false;
    if (next === 'paused') {
      this._resumeTarget = this._state;
    }
    this._state = next;
    return true;
  }

  pause(): boolean {
    if (
      this._state === 'aircraft_deployment' ||
      this._state === 'freefall' ||
      this._state === 'parachuting' ||
      this._state === 'active_match' ||
      this._state === 'spectating'
    ) {
      return this.transition('paused');
    }
    return false;
  }

  resume(): boolean {
    if (this._state !== 'paused') return false;
    const target = this._resumeTarget;
    this._state = target;
    return true;
  }

  forceResetToMenu(): void {
    this._state = 'main_menu';
    this._resumeTarget = 'active_match';
  }

  /** Maps lifecycle state to the legacy GamePhase used by React overlays & tests. */
  toGamePhase(): GamePhase {
    switch (this._state) {
      case 'main_menu':
        return 'title';
      case 'paused':
        return 'paused';
      case 'eliminated':
      case 'results':
        return this._lastOutcome === 'victory' ? 'victory' : 'gameover';
      case 'match_completed':
        return 'victory';
      default:
        return 'playing';
    }
  }

  private _lastOutcome: 'victory' | 'gameover' = 'gameover';

  completeMatch(outcome: 'victory' | 'gameover'): boolean {
    if (this._state === 'match_completed' || this._state === 'results' || this._state === 'main_menu') {
      return false;
    }
    this._lastOutcome = outcome;
    this._state = outcome === 'victory' ? 'match_completed' : 'eliminated';
    return true;
  }

  toDeployStage(): BattleRoyaleDeployStage {
    switch (this._state) {
      case 'aircraft_deployment':
        return 'airdrop_plane';
      case 'freefall':
        return 'freefall';
      case 'parachuting':
        return 'parachute';
      default:
        return 'grounded';
    }
  }

  isCombatAllowed(): boolean {
    return this._state === 'active_match';
  }

  isDeploying(): boolean {
    return (
      this._state === 'aircraft_deployment' ||
      this._state === 'freefall' ||
      this._state === 'parachuting' ||
      this._state === 'pre_match_lobby' ||
      this._state === 'match_loading'
    );
  }
}
