import {createWonderClient} from "./client.js";

/**
 * Tiny React adapter with no runtime React dependency in the SDK package.
 * Supply React's hooks and createElement from your own React installation.
 * Example: const {WonderProvider,useWonderLayer}=createReactWonderBindings(React).
 */
export function createReactWonderBindings(React){
  for(const name of ["createContext","createElement","useContext","useEffect","useMemo","useState"])
    if(typeof React?.[name]!=="function")throw new TypeError("Missing React API: "+name);
  const Context=React.createContext(null);
  function WonderProvider({children,options,client:providedClient}){
    const client=React.useMemo(()=>providedClient??createWonderClient(options??{}),[providedClient]);
    const [snapshot,setSnapshot]=React.useState(()=>client.snapshot());
    React.useEffect(()=>{
      const unsubscribe=client.subscribe(setSnapshot);
      void client.start().catch(()=>{}); // snapshot contains the actionable error
      return ()=>{
        unsubscribe();
        // External client lifetimes belong to their creator.
        if(!providedClient)client.stop();
      };
    },[client,providedClient]);
    return React.createElement(Context.Provider,{value:{...snapshot,client}},children);
  }
  function useWonderLayer(){
    const value=React.useContext(Context);
    if(!value)throw new Error("useWonderLayer must be called within WonderProvider");
    return value;
  }
  return Object.freeze({WonderProvider,useWonderLayer,Context});
}

