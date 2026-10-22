self.onmessage=e=>{
  const {values,gain,bias}=e.data;
  const input=new Float32Array(values);
  const result=Float32Array.from(input,x=>x*gain+bias);
  self.postMessage(result,[result.buffer]);
};

