import * as Vue from "vue";
import App from "./App.vue";
import {createVueWonderBindings} from "@ryzova/wonder-layer/vue";

export const {createWonderPlugin,useWonderLayer}=createVueWonderBindings(Vue);
const plugin=createWonderPlugin({dbName:"wonder-vue-demo"});
const app=Vue.createApp(App);
app.use(plugin);
app.mount("#app");
// Call plugin.dispose() on explicit SPA/app teardown.

