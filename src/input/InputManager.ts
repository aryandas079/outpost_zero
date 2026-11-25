/**
 * Centralized input manager for keyboard, mouse, pointer lock, focus/visibility recovery,
 * and optional standard gamepad input. Guarantees complete listener cleanup.
 */

import type { ControlAction, KeyBindings } from '../game/types';
import { nativeBridge } from '../utilities/NativeBridge';

export interface InputCallbacks {
  isPlaying: () => boolean;
  isPaused: () => boolean;
  isOverlayOpen: () => boolean;
  onKeyActionDown: (code: string, repeat: boolean) => void;
  onKeyActionUp: (code: string) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onMouseDown: (button: number) => void;
  onMouseUp: (button: number) => void;
  onWheel: (deltaY: number) => void;
  onPointerLockChange: (locked: boolean, wasLocked: boolean) => void;
  onFocusLost: () => void;
  onAudioUnlock: () => void;
  onToggleMap: () => void;
  onEscapeOrPause: (code: string) => void;
}

export class InputManager {
  public readonly heldKeys = new Set<string>();
  public pointerLocked = false;
  public draggingLook = false;
  public fireHeld = false;
  public fireJustPressed = false;
  public adsHeld = false;
  public touchMoveX = 0;
  public touchMoveY = 0;
  public touchSprintLock = false;
  public touchAdsActive = false;
  public touchFireHeld = false;

  private lastDragX = 0;
  private lastDragY = 0;
  private disposed = false;

  constructor(
    private readonly domElement: HTMLElement,
    private readonly callbacks: InputCallbacks,
  ) {
    this.bind();
  }

  public isControlHeld(bindings: KeyBindings, action: ControlAction): boolean {
    return this.heldKeys.has(bindings[action]);
  }

  public clearHeldInputs(): void {
    this.heldKeys.clear();
    this.fireHeld = false;
    this.fireJustPressed = false;
    this.adsHeld = false;
    this.draggingLook = false;
    this.touchFireHeld = false;
    this.touchAdsActive = false;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchSprintLock = false;
  }

  public requestPointerLock(): void {
    if (this.disposed) return;
    if (nativeBridge.isNativeWinUI) {
      nativeBridge.setPointerCapture(true);
    }
    try {
      if (document.pointerLockElement !== this.domElement && this.domElement.requestPointerLock) {
        const res = this.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
    } catch {
      // Fallback drag / keyboard look handles blocked pointer lock cleanly
    }
  }

  public exitPointerLock(): void {
    if (nativeBridge.isNativeWinUI) {
      nativeBridge.setPointerCapture(false);
    }
    try {
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch {
      // Ignore
    }
  }

  private readonly handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (
      e.code === 'Space' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight' ||
      e.code === 'Tab'
    ) {
      if (this.callbacks.isPlaying() || this.callbacks.isOverlayOpen()) e.preventDefault();
    }

    if (e.code === 'Tab' && !e.repeat && (this.callbacks.isPlaying() || this.callbacks.isOverlayOpen())) {
      this.callbacks.onKeyActionDown('Tab', e.repeat);
      return;
    }

    if (e.code === 'KeyM' && !e.repeat && (this.callbacks.isPlaying() || this.callbacks.isOverlayOpen())) {
      this.callbacks.onToggleMap();
      return;
    }

    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
      this.callbacks.onEscapeOrPause(e.code);
      return;
    }

    if (!this.callbacks.isPlaying() || this.callbacks.isOverlayOpen()) return;

    this.heldKeys.add(e.code);
    this.callbacks.onKeyActionDown(e.code, e.repeat);
  };

  private readonly handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
    this.callbacks.onKeyActionUp(e.code);
  };

  private readonly handleMouseMove = (e: MouseEvent) => {
    if (!this.callbacks.isPlaying() || this.callbacks.isOverlayOpen()) return;
    if (this.pointerLocked) {
      const dx = Math.max(-180, Math.min(180, e.movementX));
      const dy = Math.max(-180, Math.min(180, e.movementY));
      this.callbacks.onLookDelta(dx, dy);
    } else if (this.draggingLook) {
      const dx = (e.clientX - this.lastDragX) * 1.35;
      const dy = (e.clientY - this.lastDragY) * 1.35;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      this.callbacks.onLookDelta(dx, dy);
    }
  };

  private readonly handleMouseDown = (e: MouseEvent) => {
    if (!this.callbacks.isPlaying() || this.callbacks.isOverlayOpen()) return;
    if (!this.pointerLocked && e.target !== this.domElement) return;

    this.callbacks.onAudioUnlock();
    if (!this.pointerLocked) {
      this.requestPointerLock();
    }

    if (e.button === 0) {
      this.fireHeld = true;
      this.fireJustPressed = true;
      if (!this.pointerLocked) {
        this.draggingLook = true;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
      }
    } else if (e.button === 2) {
      this.adsHeld = true;
      if (!this.pointerLocked) {
        this.draggingLook = true;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
      }
    }
    this.callbacks.onMouseDown(e.button);
  };

  private readonly handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.fireHeld = false;
      this.draggingLook = false;
    } else if (e.button === 2) {
      this.adsHeld = false;
      this.draggingLook = false;
    }
    this.callbacks.onMouseUp(e.button);
  };

  private readonly handleWheel = (e: WheelEvent) => {
    if (!this.callbacks.isPlaying() || this.callbacks.isOverlayOpen()) return;
    if (Math.abs(e.deltaY) > 4) {
      this.callbacks.onWheel(e.deltaY);
    }
  };

  private readonly handleContextMenu = (e: MouseEvent) => {
    if (this.callbacks.isPlaying()) {
      e.preventDefault();
    }
  };

  private readonly handlePointerLockChange = () => {
    const locked = document.pointerLockElement === this.domElement;
    const wasLocked = this.pointerLocked;
    this.pointerLocked = locked;
    if (nativeBridge.isNativeWinUI) {
      nativeBridge.setPointerCapture(locked);
    }
    this.callbacks.onPointerLockChange(locked, wasLocked);
  };

  private readonly handleBlur = () => {
    this.clearHeldInputs();
    if (nativeBridge.isNativeWinUI) nativeBridge.setPointerCapture(false);
    this.callbacks.onFocusLost();
  };

  private readonly handleVisibilityChange = () => {
    if (document.hidden) {
      this.clearHeldInputs();
      if (nativeBridge.isNativeWinUI) nativeBridge.setPointerCapture(false);
      this.callbacks.onFocusLost();
    }
  };

  private bind(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('wheel', this.handleWheel, { passive: true });
    window.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  public dispose(): void {
    this.disposed = true;
    this.exitPointerLock();
    this.clearHeldInputs();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
