import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { ScreenTimeManager } = NativeModules;

// ── Storage keys ──
const KEYS = {
  SETTINGS: '@blocking_settings',
  BLOCK_STATE: '@blocking_state',
  SCHEDULE: '@blocking_schedule',
};

// ── Types ──

/**
 * The 3 user-facing blocking modes:
 * - gentle:        Block only when over budget. Long override pipeline.
 * - moderate:      Block only when over budget. Shorter override pipeline.
 * - precautionary: Block even when under budget. Quick friction.
 *
 * Super-strict is a toggle on gentle that increases cooldown dramatically.
 */
export type BlockMode = 'gentle' | 'moderate' | 'precautionary';

/**
 * Runtime block status:
 * - none:   No block active
 * - budget: Over-budget block (gentle / moderate / super-strict)
 * - precau: Precautionary block (under budget)
 */
export type BlockType = 'none' | 'budget' | 'precau';

export type PerModeCooldown = {
  gentle: number;       // minutes (default 30)
  moderate: number;     // minutes (default 10)
  precautionary: number; // minutes (default 0 — instant unlock)
};

export type ScheduleConfig = {
  enabled: boolean;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

export type BlockingSettings = {
  /** User has selected apps and enabled blocking */
  enabled: boolean;
  /** Active blocking mode */
  mode: BlockMode;
  /** Super-strict toggle (only applies to gentle mode — much higher cooldown) */
  superStrict: boolean;
  /** Per-mode cooldown durations in minutes */
  cooldowns: PerModeCooldown;
  /** Penalty enabled (honor-system guilt jar) */
  penaltyEnabled: boolean;
  /** Penalty amount per override */
  penaltyAmount: number;
  /** Number of apps/categories selected */
  selectedAppCount: number;
  /** Scheduled blocking config */
  schedule: ScheduleConfig;
};

export type BlockState = {
  /** Current block type active */
  activeBlockType: BlockType;
  /** Whether native shield is currently applied */
  isShieldActive: boolean;
  /** Timestamp when block was triggered */
  blockTriggeredAt: number | null;
  /** Total overrides used this week */
  overridesThisWeek: number;
  /** Total penalty accumulated (guilt jar) */
  penaltyAccumulated: number;
  /** Whether mode was auto-shifted from precau to gentle due to over-budget */
  autoShiftedFromPrecau: boolean;
};

const DEFAULT_COOLDOWNS: PerModeCooldown = {
  gentle: 30,
  moderate: 10,
  precautionary: 0,
};

const DEFAULT_SCHEDULE: ScheduleConfig = {
  enabled: false,
  startHour: 11,
  startMinute: 0,
  endHour: 14,
  endMinute: 0,
};

const DEFAULT_SETTINGS: BlockingSettings = {
  enabled: false,
  mode: 'moderate',
  superStrict: false,
  cooldowns: { ...DEFAULT_COOLDOWNS },
  penaltyEnabled: false,
  penaltyAmount: 5,
  selectedAppCount: 0,
  schedule: { ...DEFAULT_SCHEDULE },
};

const DEFAULT_STATE: BlockState = {
  activeBlockType: 'none',
  isShieldActive: false,
  blockTriggeredAt: null,
  overridesThisWeek: 0,
  penaltyAccumulated: 0,
  autoShiftedFromPrecau: false,
};

// ── BlockingService ──
class BlockingService {
  private settings: BlockingSettings = { ...DEFAULT_SETTINGS };
  private state: BlockState = { ...DEFAULT_STATE };
  private initialized = false;

  // ── Initialization ──

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.loadSettings();
    await this.loadState();
    await this.syncNativeStatus();
    this.initialized = true;
  }

  // ── Getters ──

  getSettings(): BlockingSettings {
    return { ...this.settings };
  }

  getState(): BlockState {
    return { ...this.state };
  }

  // ── Settings management ──

  async updateSettings(partial: Partial<BlockingSettings>): Promise<void> {
    if (partial.cooldowns) {
      partial.cooldowns = {
        ...this.settings.cooldowns,
        ...partial.cooldowns,
      };
    }
    this.settings = { ...this.settings, ...partial };
    this.settings.enabled = this.settings.selectedAppCount > 0;
    await this.saveSettings();
  }

  /** Get the effective cooldown for the current mode */
  getEffectiveCooldown(): number {
    const mode = this.settings.mode;
    if (mode === 'gentle' && this.settings.superStrict) {
      return Math.max(this.settings.cooldowns.gentle * 3, 60); // super-strict = 3x gentle, min 60
    }
    return this.settings.cooldowns[mode];
  }

  // ── App selection ──

  async selectApps(): Promise<{ count: number; cancelled: boolean }> {
    try {
      const result = await ScreenTimeManager.selectApps();
      if (result?.cancelled) {
        return { count: this.settings.selectedAppCount, cancelled: true };
      }
      const count = result?.count ?? 0;
      await this.updateSettings({ selectedAppCount: count, enabled: count > 0 });
      return { count, cancelled: false };
    } catch (error) {
      throw error;
    }
  }

  // ── Core blocking logic ──

  /**
   * Evaluate whether blocks should be applied based on spend vs budget and mode.
   *
   * Mode behavior:
   * - gentle / moderate: Block only when over budget.
   * - precautionary:     Block always (even under budget).
   *   When precau user goes over budget → auto-shift to gentle.
   */
  async evaluateBlock(totalSpend: number, weeklyBudget: number): Promise<BlockType> {
    if (this.settings.selectedAppCount === 0) {
      this.settings.enabled = false;
      if (this.state.isShieldActive) {
        await this.removeBlock();
      }
      this.state.autoShiftedFromPrecau = false;
      return 'none';
    }

    const overBudget = totalSpend >= weeklyBudget;
    const mode = this.settings.mode;

    if (overBudget) {
      // If on precautionary and user goes over budget → auto-shift to gentle
      if (mode === 'precautionary') {
        this.settings.mode = 'gentle';
        this.state.autoShiftedFromPrecau = true;
        await this.saveSettings();
      } else {
        this.state.autoShiftedFromPrecau = false;
      }
      await this.applyBlock('budget');
      return 'budget';
    }

    // Under budget
    this.state.autoShiftedFromPrecau = false;

    if (mode === 'precautionary') {
      // Precautionary blocks even under budget
      await this.applyBlock('precau');
      return 'precau';
    }

    // Gentle / moderate under budget — no block
    if (this.state.isShieldActive) {
      await this.removeBlock();
    }
    return 'none';
  }

  // ── Block / Unblock ──

  async applyBlock(type: BlockType): Promise<void> {
    try {
      await ScreenTimeManager.blockApps();
      this.state.isShieldActive = true;
      this.state.activeBlockType = type;
      if (!this.state.blockTriggeredAt) {
        this.state.blockTriggeredAt = Date.now();
      }
      await this.saveState();
    } catch (error) {
      console.warn('BlockingService: failed to apply block', error);
    }
  }

  async removeBlock(): Promise<void> {
    try {
      await ScreenTimeManager.unblockApps();
      this.state.isShieldActive = false;
      this.state.activeBlockType = 'none';
      this.state.blockTriggeredAt = null;
      await this.saveState();
    } catch (error) {
      console.warn('BlockingService: failed to remove block', error);
    }
  }

  // ── Override flow ──

  /**
   * Returns override requirements based on current block type and mode.
   * The UI uses this to build the appropriate friction pipeline.
   */
  async requestOverride(): Promise<{
    allowed: boolean;
    blockType: BlockType;
    mode: BlockMode;
    cooldownMinutes: number;
    penaltyAmount: number | null;
    superStrict: boolean;
  }> {
    const blockType = this.state.activeBlockType;
    const mode = this.settings.mode;

    if (blockType === 'none') {
      return { allowed: true, blockType, mode, cooldownMinutes: 0, penaltyAmount: null, superStrict: false };
    }

    const cooldownMinutes = this.getEffectiveCooldown();

    return {
      allowed: true,
      blockType,
      mode,
      cooldownMinutes,
      penaltyAmount: this.settings.penaltyEnabled ? this.settings.penaltyAmount : null,
      superStrict: this.settings.superStrict && mode === 'gentle',
    };
  }

  /**
   * Complete an override — unblock apps and record the override.
   */
  async completeOverride(): Promise<void> {
    this.state.overridesThisWeek += 1;
    if (this.settings.penaltyEnabled) {
      this.state.penaltyAccumulated += this.settings.penaltyAmount;
    }
    await this.removeBlock();
    await this.saveState();
  }

  // ── Schedule management ──

  async setSchedule(config: Partial<ScheduleConfig>): Promise<void> {
    const schedule = { ...this.settings.schedule, ...config };
    this.settings.schedule = schedule;
    await this.saveSettings();

    if (schedule.enabled && this.settings.selectedAppCount > 0) {
      try {
        await ScreenTimeManager.setSchedule(
          schedule.startHour,
          schedule.startMinute,
          schedule.endHour,
          schedule.endMinute,
        );
      } catch (error) {
        console.warn('BlockingService: failed to set schedule', error);
      }
    } else {
      try {
        await ScreenTimeManager.clearSchedule();
      } catch (error) {
        console.warn('BlockingService: failed to clear schedule', error);
      }
    }
  }

  async clearSchedule(): Promise<void> {
    this.settings.schedule.enabled = false;
    await this.saveSettings();
    try {
      await ScreenTimeManager.clearSchedule();
    } catch (error) {
      console.warn('BlockingService: failed to clear schedule', error);
    }
  }

  getSchedule(): ScheduleConfig {
    return { ...this.settings.schedule };
  }

  // ── Weekly reset ──

  async resetWeeklyState(): Promise<void> {
    this.state = { ...DEFAULT_STATE };
    await this.saveState();
  }

  // ── Sync with native module ──

  private async syncNativeStatus(): Promise<void> {
    try {
      const result = await ScreenTimeManager.getBlockStatus();
      this.state.isShieldActive = result?.isBlocking ?? false;
      if (result?.selectedCount !== undefined) {
        this.settings.selectedAppCount = result.selectedCount;
        this.settings.enabled = result.selectedCount > 0;
      }
    } catch (error) {
      console.warn('BlockingService: failed to sync native status', error);
    }
  }

  // ── Persistence ──

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.warn('BlockingService: failed to save settings', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
      if (raw) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (error) {
      console.warn('BlockingService: failed to load settings', error);
    }
  }

  private async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.BLOCK_STATE, JSON.stringify(this.state));
    } catch (error) {
      console.warn('BlockingService: failed to save state', error);
    }
  }

  private async loadState(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.BLOCK_STATE);
      if (raw) {
        this.state = { ...DEFAULT_STATE, ...JSON.parse(raw) };
      }
    } catch (error) {
      console.warn('BlockingService: failed to load state', error);
    }
  }
}

// Singleton export
export const blockingService = new BlockingService();
