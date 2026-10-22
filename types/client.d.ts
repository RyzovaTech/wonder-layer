import type {WonderLayer,WonderOptions} from "./index.js";
export type WonderClientStatus = "idle" | "loading" | "ready" | "error" | "disposed";
export interface WonderClientSnapshot {
  readonly status: WonderClientStatus;
  readonly layer: WonderLayer | null;
  readonly error: unknown;
}
export interface WonderClient {
  start(): Promise<WonderLayer>;
  stop(): void;
  dispose(): void;
  subscribe(listener: (value: WonderClientSnapshot) => void, options?: {emitCurrent?: boolean}): () => void;
  snapshot(): WonderClientSnapshot;
  readonly status: WonderClientStatus;
  readonly layer: WonderLayer | null;
}
export function createWonderClient(options?: WonderOptions, dependencies?: {
  factory?: (options: WonderOptions) => Promise<WonderLayer>;
}): WonderClient;

