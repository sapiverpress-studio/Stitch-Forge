// Local syntax/referenced-file gate. No network, deploy, environment or secrets.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function files(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
 const file=path.join(directory,entry.name);return entry.isDirectory()?files(file):[file];
});}
const scripts=[...files(path.join(root,'site')),...files(path.join(root,'netlify/functions'))]
 .filter(file=>/\.(?:js|mjs)$/.test(file));
for(const file of scripts){
 const run=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 if(run.status!==0)throw Error('Syntax failed: '+path.relative(root,file)+'\n'+run.stderr);
}
const html=fs.readFileSync(path.join(root,'site/index.html'),'utf8');let inline=0;
for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){new Function(match[1]);inline++;}
for(const match of html.matchAll(/<script src="\/([^"/]+)"/g))
 if(!fs.existsSync(path.join(root,'site',match[1])))throw Error('Missing app script: '+match[1]);
console.log(scripts.length+' source files + '+inline+' inline scripts pass syntax; app script references exist.');
