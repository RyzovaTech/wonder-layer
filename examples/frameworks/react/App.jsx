import * as React from "react";
import {createReactWonderBindings} from "@ryzova/wonder-layer/react";

const {WonderProvider,useWonderLayer}=createReactWonderBindings(React);

function NotePanel(){
  const {status,layer,error}=useWonderLayer();
  const [value,setValue]=React.useState("");
  React.useEffect(()=>{
    if(!layer)return;
    let active=true;
    layer.store.listRecords().then(rows=>{
      if(active)setValue(rows.find(row=>row.id==="react-draft")?.content??"");
    });
    return ()=>{active=false;};
  },[layer]);
  return <section>
    <h2>Offline draft</h2>
    <textarea value={value} onChange={event=>setValue(event.target.value)}/>
    <button disabled={status!=="ready"} onClick={()=>layer?.store.save("react-draft",value)}>Save locally</button>
    <p role="status">{error?String(error.message??error):status}</p>
  </section>;
}
export default function App(){
  return <WonderProvider options={{dbName:"wonder-react-demo"}}>
    <NotePanel/>
  </WonderProvider>;
}

