/** Ryzova Wonder Layer — pure-PWA capability SDK, experimental engineering release. */
export type ComputeBackend = "gpu" | "wasm" | "worker" | "js";
export type ComputePolicy = "throughput" | "responsive";
export interface ComputeOptions {
  prefer?: "auto" | ComputeBackend;
  policy?: ComputePolicy;
  gain?: number;
  bias?: number;
  signal?: AbortSignal;
  capabilities?: Record<string, boolean>;
}
export interface ComputeFailure { backend: ComputeBackend; error: string }
export interface ComputeResult {
  backend: ComputeBackend;
  data: Float32Array;
  failures: ComputeFailure[];
  attempted: ComputeBackend[];
  durationMs: number;
}
export interface ComputeStats {
  attempts: number;
  successes: number;
  failures: number;
  lastMs: number | null;
  emaMs: number | null;
}
export interface CalibrationResult {
  size: number;
  samples: number;
  results: Array<{backend: ComputeBackend; successfulSamples: number; medianMs: number}>;
  failures: ComputeFailure[];
}
export interface CapabilityReport {
  available: Record<string, boolean>;
  checks: Record<string, {state: string; reason?: string; [key: string]: unknown}>;
  policy: {nativeWrapperRequired: boolean; permissionBypass: boolean; guaranteedBackgroundTasks: boolean};
  checkedAt: string;
}
export interface AdaptiveEngine {
  readonly runtime: "pure-pwa";
  inspect(options?: {refresh?: boolean}): Promise<CapabilityReport>;
  plan(length: number, options?: {prefer?: ComputeOptions["prefer"]; policy?: ComputePolicy; capabilities?: Record<string, boolean>}): ComputeBackend[];
  run(input: Float32Array, options?: ComputeOptions): Promise<ComputeResult>;
  calibrate(input: Float32Array, options?: ComputeOptions & {samples?: number}): Promise<CalibrationResult>;
  stats(): Record<string, ComputeStats>;
  health(): Record<string, {state: string; cooldownUntil: number}>;
  reset(): void;
}
export interface HardwareAvailability {
  camera: boolean; microphone: boolean; geolocation: boolean;
  bluetooth: boolean; usb: boolean; hid: boolean; serial: boolean; nfc: boolean;
  "clipboard-read": boolean; "clipboard-write": boolean; share: boolean;
  "wake-lock": boolean; "file-open": boolean; secureContext: boolean;
}
export type HardwareKind = Exclude<keyof HardwareAvailability, "secureContext">;
export class WonderHardwareError extends Error {
  readonly code: string;
  readonly device: string;
  constructor(code: string, device: string, message: string, cause?: unknown);
}
export interface HardwareBridge {
  readonly runtime: "pure-pwa";
  capabilities(): HardwareAvailability;
  /** Calls must originate from explicit user interaction, with permission. */
  request(kind: HardwareKind, options?: Record<string, unknown>): Promise<unknown>;
}
export interface LocalRecord {
  id: string; content: string; revision: number; dirty: boolean; updatedAt: string;
}
export interface OutboxOperation {
  record_id: string; content: string; expected_revision: number; op_id: string;
}
export interface SyncConflict {
  record_id?: string; [key: string]: unknown;
}
export interface SyncResult {
  applied: Array<{record_id: string; op_id: string; revision: number}>;
  conflicts: SyncConflict[];
  pending: number;
}
export interface WonderStore {
  listRecords(): Promise<LocalRecord[]>;
  pending(): Promise<OutboxOperation[]>;
  save(id: string, content: string): Promise<LocalRecord>;
  importRecords(rows: Array<{id: string; content: string}>, options?: {overwrite?: boolean}): Promise<{imported: number; skipped: number}>;
  resolveConflict(id: string, mode: "remote" | "local", remote: {content: string; revision: number}): Promise<void>;
  applyAcknowledgements(rows: SyncResult["applied"]): Promise<void>;
  sync(endpoint?: string): Promise<SyncResult>;
  close(): void;
}
export type RecoveryIntegrity = "sha256" | "legacy-unverified";
export interface RecoverySnapshot {
  version: number; integrity: RecoveryIntegrity;
  records: Array<{id: string; content: string}>;
}
export interface StorageHealth {
  quota: number | null; usage: number | null; ratio: number | null;
  persisted: boolean | null; warning: string | null; evictionPossible: boolean;
}
export interface RecoveryManager {
  export(): Promise<string>;
  validate(raw: string): Promise<RecoverySnapshot>;
  restore(raw: string, options?: {overwrite?: boolean; allowLegacy?: boolean}): Promise<{
    imported: number; skipped: number; version: number; integrity: RecoveryIntegrity
  }>;
  storageStatus(): Promise<StorageHealth>;
  requestPersistence(): Promise<{supported: boolean; granted: boolean}>;
}
export interface ForegroundSync {
  start(): void; stop(): void; attempt(): Promise<unknown>;
  readonly active: boolean;
}
export interface ReconnectState {
  state: string; failures: number; active: boolean;
  delayMs?: number; error?: string; pending?: number | null; conflicts?: SyncConflict[];
}
export interface ReconnectController {
  start(): void; stop(): void; attempt(): Promise<unknown>;
  readonly state: string; readonly active: boolean; readonly retries: number;
}
export interface PWALifecycle {
  register(url: string, options?: {scope?: string}): Promise<ServiceWorkerRegistration>;
  inspect(): {serviceWorker: boolean; controlled: boolean; waiting: boolean;
    standalone: boolean; installPromptAvailable: boolean; installed: boolean};
  checkForUpdate(): Promise<ReturnType<PWALifecycle["inspect"]>>;
  activateWaiting(): boolean;
  requestInstall(): Promise<{available: boolean; outcome?: string}>;
  close(): void;
  readonly registration: ServiceWorkerRegistration | null;
}
export interface WonderOptions {
  dbName?: string;
  /** Only use authorized same-origin / trusted server endpoints. No sync starts automatically. */
  endpoint?: string;
}
export interface WonderLayer {
  readonly runtime: "pure-pwa";
  capabilities(): Record<string, boolean>;
  inspect(): Promise<CapabilityReport>;
  compute(input: Float32Array, options?: ComputeOptions): Promise<ComputeResult>;
  scheduler: AdaptiveEngine;
  hardware: HardwareBridge;
  store: WonderStore;
  sync(): Promise<SyncResult>;
  reconnect(options?: {onStatus?: (event: ReconnectState) => void; baseDelayMs?: number; maxDelayMs?: number}): ReconnectController;
  foregroundSync(options?: {intervalMs?: number; onStatus?: (event: unknown) => void}): ForegroundSync;
  files: {
    read(name: string): Promise<ArrayBuffer>;
    write(name: string, content: BlobPart): Promise<void>;
    estimate(): Promise<StorageEstimate | null>;
  };
  pwa: PWALifecycle;
  recovery: RecoveryManager;
  backup(): Promise<string>;
  restore(raw: string, options?: {overwrite?: boolean; allowLegacy?: boolean}): Promise<{imported: number; skipped: number}>;
  requestPersistentStorage(): Promise<boolean>;
  close(): void;
}
export function createWonderLayer(options?: WonderOptions): Promise<WonderLayer>;
export function createAdaptiveEngine(options?: {
  maxElements?: number; failureCooldownMs?: number;
  thresholds?: {wasm: number; worker: number; gpu: number};
}): AdaptiveEngine;
export function createHardwareBridge(): HardwareBridge;
export function detectCapabilities(): Record<string, boolean>;
export function inspectCapabilities(): Promise<CapabilityReport>;
export function adaptiveCompute(input: Float32Array, options?: ComputeOptions): Promise<ComputeResult>;
export function jsTransform(input: Float32Array, options?: Pick<ComputeOptions, "gain" | "bias">): Float32Array;
export function wasmTransform(input: Float32Array, options?: Pick<ComputeOptions, "gain" | "bias">): Promise<Float32Array>;
export function gpuTransform(input: Float32Array, options?: Pick<ComputeOptions, "gain" | "bias">): Promise<Float32Array>;
export function workerTransform(input: Float32Array, options?: Pick<ComputeOptions, "gain" | "bias" | "signal">): Promise<Float32Array>;
export function selectComputeOrder(length: number, capabilities: Record<string, boolean>, prefer?: ComputeOptions["prefer"]): ComputeBackend[];
export function parseBackup(raw: string): Array<{id: string; content: string}>;
export function exportBackup(rows: Array<{id: string; content: string}>): string;
export function exportRecovery(rows: Array<{id: string; content: string}>): Promise<string>;
export function parseRecovery(raw: string, options?: {allowLegacy?: boolean}): Promise<RecoverySnapshot>;
export function createRecoveryManager(store: WonderStore): RecoveryManager;
export function createReconnectController(sync: () => Promise<unknown>, options?: {
  onStatus?: (event: ReconnectState) => void; baseDelayMs?: number; maxDelayMs?: number
}): ReconnectController;
export function createPWALifecycle(options?: {onState?: (state: {state: string; [key: string]: unknown}) => void}): PWALifecycle;

