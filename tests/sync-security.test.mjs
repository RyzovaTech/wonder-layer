import {test} from "node:test";
import assert from "node:assert/strict";
import {validateSyncEndpoint,validateSyncResponse} from "../src/sync-security.js";

const origin="https://app.example.test";
test("local endpoint resolves inside current origin",()=>{
  assert.equal(validateSyncEndpoint("/api/sync",{origin}),"/api/sync");
  assert.equal(validateSyncEndpoint("https://app.example.test/api/sync",{origin}),"/api/sync");
  assert.equal(validateSyncEndpoint("./api/sync",{origin}),"/api/sync");
});
test("cross-origin, protocol-relative, unsafe and credential-bearing URLs fail closed",()=>{
  for(const endpoint of [
    "https://attacker.example/collect","//attacker.example/collect",
    "http://app.example.test/api/sync","javascript:alert(1)","data:text/plain,abc",
    "https://u:p@app.example.test/api/sync","/api/sync#token", " /api/sync"
  ])assert.throws(()=>validateSyncEndpoint(endpoint,{origin}),undefined,endpoint);
});
test("Node originless policy only permits rooted paths",()=>{
  assert.equal(validateSyncEndpoint("/api/sync",{origin:undefined}),"/api/sync");
  for(const endpoint of ["api/sync","https://attacker.example","//evil/path","#fragment"])
    assert.throws(()=>validateSyncEndpoint(endpoint,{origin:undefined}));
});
const ops=[{record_id:"draft",op_id:"one"},{record_id:"other",op_id:"two"}];
test("accepts acknowledgements for exactly submitted mutation operations",()=>{
  assert.deepEqual(validateSyncResponse({
    applied:[{record_id:"draft",op_id:"one",revision:2}],
    conflicts:[{record_id:"other",reason:"revision mismatch"}]
  },ops).applied.length,1);
});
test("rejects unsolicited, stale, duplicated or overlapping acknowledgements",()=>{
  const bad=[
    {applied:[{record_id:"unrelated",op_id:"x",revision:9}],conflicts:[]},
    {applied:[{record_id:"draft",op_id:"stale",revision:1}],conflicts:[]},
    {applied:[{record_id:"draft",op_id:"one",revision:1},{record_id:"draft",op_id:"one",revision:2}],conflicts:[]},
    {applied:[{record_id:"draft",op_id:"one",revision:1}],conflicts:[{record_id:"draft"}]},
    {applied:[],conflicts:[{record_id:"not-requested"}]},
    {applied:[],conflicts:[{record_id:"other"},{record_id:"other"}]},
    {applied:[{record_id:"draft",op_id:"one",revision:-1}],conflicts:[]},
    {applied:[{record_id:"draft",op_id:"one",revision:NaN}],conflicts:[]},
    {applied:[],conflicts:"not-an-array"}
  ];
  for(const response of bad)
    assert.throws(()=>validateSyncResponse(response,ops),undefined,JSON.stringify(response));
});
