// Compile with decorator metadata before starting/restarting Nest.
const {spawn}=require('node:child_process');
const {watch}=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
let server,compiling=false,queued=false,timer;
function build(){if(compiling){queued=true;return;}compiling=true;const compiler=spawn(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.json'],{cwd:root,stdio:'inherit',windowsHide:true});compiler.on('exit',code=>{compiling=false;if(code===0){if(server)server.kill();server=spawn(process.execPath,['dist/src/main.js'],{cwd:root,stdio:'inherit',windowsHide:true});}if(queued){queued=false;build();}});}
watch(path.join(root,'src'),{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(build,300);});
process.on('SIGINT',()=>{server?.kill();process.exit();});process.on('SIGTERM',()=>{server?.kill();process.exit();});build();
