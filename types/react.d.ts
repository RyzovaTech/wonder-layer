import type {WonderClient, WonderClientSnapshot} from "./client.js";
import type {WonderOptions} from "./index.js";
/** Supply the React runtime yourself; this package has zero framework dependencies. */
export function createReactWonderBindings(React: any): {
  WonderProvider: (props: {
    children?: any;
    options?: WonderOptions;
    client?: WonderClient;
  }) => any;
  useWonderLayer: () => WonderClientSnapshot & {client: WonderClient};
  Context: any;
};

