import type {WonderClient,WonderClientSnapshot} from "./client.js";
import type {WonderOptions} from "./index.js";
/** Supply the Vue runtime yourself; adapter is client-only unless manually started. */
export function createVueWonderBindings(Vue: any): {
  createWonderPlugin(options?: WonderOptions, dependencies?: {client?: WonderClient}): {
    install(app: {provide(key: symbol,value: unknown): void}): void;
    start(): Promise<import("./index.js").WonderLayer>;
    stop(): void;
    dispose(): void;
    readonly client: WonderClient;
    readonly state: WonderClientSnapshot;
  };
  useWonderLayer(): {client: WonderClient; state: WonderClientSnapshot};
  key: symbol;
};

