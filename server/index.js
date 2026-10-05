const http=require('http');const fs=require('fs');const path=require('path');const crypto=require('crypto');const os=require('os');
const ROOT=path.join(__dirname,'..'), PUBLIC=path.join(ROOT,'public'), DATA=path.join(ROOT,'data','db.json'), BACKUPS=path.join(ROOT,'backups');
fs.mkdirSync(path.dirname(DATA),{recursive:true});fs.mkdirSync(BACKUPS,{recursive:true});
const defaultQuestions=[
['Which component is responsible for process scheduling?',['CPU','Operating System','Compiler','RAM'],1],['Which Linux command prints the current working directory?',['cd','pwd','ls','whoami'],1],['Which memory technique uses pages?',['Paging','Spooling','Polling','Batching'],0],['A process in execution is represented by a…',['PCB','DNS','BIOS','URI'],0],['Which scheduling algorithm uses a time quantum?',['FCFS','Round Robin','SJF','FIFO'],1],['Which command lists directory contents?',['ls','cat','pwd','grep'],0],['Virtual memory allows a system to…',['Use disk as memory extension','Disable RAM','Remove processes','Increase CPU cores'],0],['Which is a Linux file permission command?',['chmod','mkdir','ping','top'],0],['A thread is best described as…',['Smallest unit of CPU execution within a process','A disk partition','A file system','A compiler'],0],['Which command searches text patterns?',['grep','cd','date','clear'],0],['Deadlock requires mutual exclusion, hold-and-wait, no preemption and…',['Circular wait','Paging','Caching','Compilation'],0],['Which component translates virtual addresses?',['MMU','ALU','BIOS','NIC'],0],['Which command displays running processes?',['ps','mkdir','touch','mv'],0],['What does chmod 755 commonly grant to the owner?',['rwx','r--','rw-','---'],0],['Which architecture separates user and kernel privilege levels?',['Protected-mode OS architecture','Spreadsheet architecture','Markup architecture','CSS architecture'],0],['Which command can display file contents?',['cat','cd','pwd','whoami'],0],['CPU cache is primarily used to…',['Reduce memory access latency','Store passwords','Replace the OS','Format disks'],0],['What is context switching?',['Switching CPU from one process/thread to another','Changing a file extension','Restarting BIOS','Changing IP'],0],['Which Linux command identifies the current user?',['whoami','grep','find','head'],0],['What is a system call?',['Interface for a program to request OS services','A CPU instruction cache','A file extension','A network cable'],0]
].map((q,i)=>({id:i+1,text:q[0],options:q[1],correct:q[2],marks:1}));
const challenges=[
{id:1,title:'Ghost in the Directory',skill:'Hidden files',marks:5,files:{'/README.txt':'Look carefully at hidden entries.','/.ghost.txt':'SECRET-GHOST-42','/notes.txt':'Nothing useful here.'},answer:'SECRET-GHOST-42'},
{id:2,title:'Needle in the Logs',skill:'grep -r',marks:5,files:{'/logs/a.log':'INFO start\nINFO ready','/logs/b.log':'INFO idle\nSECRET=NEEDLE-731','/logs/c.log':'INFO end'},answer:'NEEDLE-731'},
{id:3,title:'Lost in the Tree',skill:'cd, ls, cat',marks:10,files:{'/README.txt':'Travel to the archive directory.','/archive/clue.txt':'The answer is TREE-908','/archive/old.txt':'ignore'},answer:'TREE-908'},
{id:4,title:'Pipe Dreams',skill:'grep | sort | uniq -c | sort -rn | head',marks:10,files:{'/data/events.txt':'red\nblue\nred\ngreen\nred\nblue\nyellow\nblue'},answer:'red'},
{id:5,title:'The Final Chain',skill:'grep, find, grep -c',marks:20,files:{'/final/a.txt':'noise','/final/b.txt':'TARGET=FINAL-2026','/final/c.txt':'TARGET=OTHER'},answer:'FINAL-2026'}
];
function fresh(){return {event:{name:'TERMINAL QUIZ',state:'WAITING',round:0,startAt:null,endAt:null,paused:false,remainingMs:null,leaderboardPublished:false},participants:{},answers:{},terminal:{},logs:[],questions:defaultQuestions,challenges};}
let db;try{db=JSON.parse(fs.readFileSync(DATA,'utf8'))}catch{db=fresh();save()}
function save(){fs.writeFileSync(DATA,JSON.stringify(db,null,2))}function log(type,detail){db.logs.push({time:new Date().toISOString(),type,detail});if(db.logs.length>2000)db.logs.shift();save()}
function token(){return crypto.randomBytes(24).toString('hex')}function json(res,status,obj){const b=Buffer.from(JSON.stringify(obj));res.writeHead(status,{'Content-Type':'application/json','Content-Length':b.length,'Cache-Control':'no-store'});res.end(b)}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6)req.destroy()});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch{reject()}})})}
function auth(req,role){const t=(req.headers.authorization||'').replace('Bearer ','');if(role==='admin')return t===process.env.ADMIN_TOKEN&&t;const p=Object.values(db.participants).find(x=>x.token===t);return p&&p.id}
function state(){const e=db.event;if(e.endAt&&!e.paused&&Date.now()>=e.endAt){if(e.state==='ROUND1_ACTIVE'){e.state='ROUND1_COMPLETED';e.round=1;log('ROUND_AUTO_END','Round 1 timer expired')}else if(e.state==='ROUND2_ACTIVE'){e.state='ROUND2_COMPLETED';e.round=2;log('ROUND_AUTO_END','Round 2 timer expired')}e.startAt=null;e.endAt=null;save()}let remaining=e.paused?e.remainingMs:(e.endAt?Math.max(0,e.endAt-Date.now()):null);return {...e,remainingMs:remaining,participantCount:Object.keys(db.participants).length,onlineCount:Object.values(db.participants).filter(p=>p.online).length}}
const routes={
'GET /api/state':(req,res)=>json(res,200,state()),
'GET /api/questions':(req,res)=>json(res,200,db.questions.map(({correct,...q})=>q)),
'POST /api/login':async(req,res)=>{const b=await body(req);if(!b.name||!b.registerNumber)return json(res,400,{error:'Name and register number required'});const id=String(b.registerNumber).trim().toUpperCase();let p=db.participants[id];if(!p){p={id,name:String(b.name).trim().slice(0,80),registerNumber:id,token:token(),online:true,round1Submitted:false,round1Score:0,round2Score:0,createdAt:new Date().toISOString(),lastSeen:Date.now()};db.participants[id]=p;db.terminal[id]={cwd:'/',files:{},challenge:1,attempts:{}};log('LOGIN',`${id} ${p.name}`)}else{p.online=true;p.lastSeen=Date.now()}save();json(res,200,{token:p.token,participant:{id:p.id,name:p.name,registerNumber:p.registerNumber}})},
'POST /api/logout':(req,res)=>{const id=auth(req);if(id){db.participants[id].online=false;save()}json(res,200,{ok:true})},
'GET /api/me':(req,res)=>{const id=auth(req);if(!id)return json(res,401,{error:'Unauthorized'});const p=db.participants[id];p.online=true;p.lastSeen=Date.now();save();json(res,200,{participant:{...p,token:undefined},state:state(),terminal:db.terminal[id]})},
'POST /api/heartbeat':(req,res)=>{const id=auth(req);if(!id)return json(res,401,{error:'Unauthorized'});const p=db.participants[id];p.online=true;p.lastSeen=Date.now();save();json(res,200,{ok:true,online:true,lastSeen:p.lastSeen})},
'POST /api/answer':async(req,res)=>{const id=auth(req);if(!id)return json(res,401,{error:'Unauthorized'});const s=state();if(s.state!=='ROUND1_ACTIVE')return json(res,409,{error:'Round 1 is not active'});const b=await body(req),qid=Number(b.questionId),ans=Number(b.answer);const q=db.questions.find(x=>x.id===qid);if(!q||ans<0||ans>=q.options.length)return json(res,400,{error:'Invalid answer'});db.answers[`${id}:${qid}`]={participantId:id,questionId:qid,answer:ans,at:new Date().toISOString()};db.participants[id].lastSeen=Date.now();save();json(res,200,{ok:true})},
'POST /api/submit-round1':(req,res)=>{const id=auth(req);if(!id)return json(res,401,{error:'Unauthorized'});const s=state();if(!['ROUND1_ACTIVE','ROUND1_COMPLETED'].includes(s.state))return json(res,409,{error:'Round 1 unavailable'});const p=db.participants[id];if(p.round1Submitted)return json(res,200,{score:p.round1Score});let score=0;for(const q of db.questions){const a=db.answers[`${id}:${q.id}`];if(a&&a.answer===q.correct)score+=q.marks}p.round1Score=score;p.round1Submitted=true;log('ROUND1_SUBMIT',id);save();json(res,200,{score})},
'POST /api/terminal':async(req,res)=>{const id=auth(req);if(!id)return json(res,401,{error:'Unauthorized'});const s=state();if(s.state!=='ROUND2_ACTIVE')return json(res,409,{error:'Round 2 is not active'});const b=await body(req);const participant=db.participants[id];if(participant.round2Submitted)return json(res,409,{error:'Round 2 already submitted'});const t=db.terminal[id]||{cwd:'/',files:{},challenge:1,attempts:{}};const c=db.challenges.find(x=>x.id===t.challenge);const cmd=String(b.command||'').trim();let out='';if(!cmd){out='';}else if(cmd==='pwd')out=t.cwd;else if(cmd==='clear')out='__CLEAR__';else if(cmd==='help')out='pwd ls cd cat head tail grep find sort uniq wc file echo whoami id uname hostname date env clear help';else if(cmd==='whoami')out='student';else if(cmd==='id')out='uid=1000(student) gid=1000(student) groups=1000(student)';else if(cmd==='uname')out='Linux terminal-quiz 6.6.0';else if(cmd==='hostname')out='terminal-quiz';else if(cmd==='date')out=new Date().toString();else if(cmd==='ls' || cmd==='ls -a'){let base=t.cwd;let set=new Set();for(const f of Object.keys(c.files)){if(f.startsWith(base)&&f!==base){let rest=f.slice(base.length).replace(/^\//,'');if(rest) set.add(rest.split('/')[0])}}out=[...set].filter(x=>cmd==='ls -a'||!x.startsWith('.')).sort().join('  ')}else if(cmd.startsWith('cd ')){let dest=cmd.slice(3).trim();let n=dest.startsWith('/')?dest:path.posix.join(t.cwd,dest);n=path.posix.normalize('/'+n.replace(/^\//,''));if(n!=='/'&&!Object.keys(c.files).some(f=>f.startsWith(n+'/')))out=`cd: no such directory: ${dest}`;else t.cwd=n}else if(cmd.startsWith('cat ')){let f=cmd.slice(4).trim();let n=f.startsWith('/')?f:path.posix.join(t.cwd,f);out=c.files[n]??`cat: ${f}: No such file` }else if(cmd.startsWith('echo '))out=cmd.slice(5);else if(cmd.includes('|')){let lines=Object.entries(c.files).flatMap(([f,v])=>String(v).split('\n').map(l=>`${f}:${l}`));for(const stage of cmd.split('|').map(x=>x.trim())){let z=stage.split(/\s+/);if(z[0]==='grep'){let pat=z[1]==='-r'?z[2]:z[1];lines=lines.filter(l=>l.includes(pat))}else if(z[0]==='sort'){lines.sort((a,b)=>z.includes('-r')?b.localeCompare(a):a.localeCompare(b))}else if(z[0]==='uniq'){const counts={};for(const l of lines){const k=l.replace(/^.*:/,'');counts[k]=(counts[k]||0)+1}lines=Object.entries(counts).map(([k,v])=>z.includes('-c')?`${v} ${k}`:k)}else if(z[0]==='head'){lines=lines.slice(0,Number(z[1])||10)}else if(z[0]==='wc'){lines=[String(lines.length)]}}out=lines.join('\n')}else if(cmd.startsWith('grep ')){let parts=cmd.split(/\s+/);let recursive=parts[1]==='-r';let pat=recursive?parts[2]:parts[1];let target=recursive?parts[3]:parts[2];let files=target?Object.keys(c.files).filter(f=>f===target||f.endsWith('/'+target)):Object.keys(c.files);out=files.flatMap(f=>String(c.files[f]).split('\n').filter(l=>l.includes(pat)).map(l=>`${f}:${l}`)).join('\n')||''}else if(cmd.startsWith('find ')){out=Object.keys(c.files).sort().join('\n')}else if(cmd==='ls -la'){out=Object.keys(c.files).sort().join('\n')}else out=`${cmd}: command not available in event terminal`;
t.attempts[c.id]=(t.attempts[c.id]||0)+1;let solved=String(b.answer||'').trim().toLowerCase()===c.answer.toLowerCase();if(b.submit===true){
if(solved&&!t.solved?.[c.id]){
t.solved=t.solved||{};
t.solved[c.id]=true;
participant.round2Score+=c.marks;
log('TERMINAL_SOLVE',`${id} challenge ${c.id}`);
}else if(!solved){
log('TERMINAL_ATTEMPT',`${id} challenge ${c.id}`);
}
if(c.id<db.challenges.length)t.challenge=c.id+1;
else {
  t.challenge=db.challenges.length+1;
  participant.round2Submitted=true;
  participant.online=true;
  participant.lastSeen=Date.now();
  log('ROUND2_SUBMIT',`${id} completed Round 2`);
}
}db.terminal[id]=t;save();json(res,200,{output:out,challenge:c.id,solved:!!t.solved?.[c.id],score:db.participants[id].round2Score})},
'POST /api/admin/login':async(req,res)=>{const b=await body(req);const password=process.env.ADMIN_PASSWORD||'admin123';if(b.password!==password)return json(res,401,{error:'Invalid password'});const t=token();if(!global.adminTokens)global.adminTokens=new Set();global.adminTokens.add(t);json(res,200,{token:t})},
'POST /api/admin/control':async(req,res)=>{const t=(req.headers.authorization||'').replace('Bearer ','');if(!global.adminTokens?.has(t))return json(res,401,{error:'Unauthorized'});const b=await body(req),action=b.action,e=db.event;const durations={1:20*60*1000,2:30*60*1000};if(action==='start1'&&e.state==='WAITING'){e.state='ROUND1_ACTIVE';e.round=1;e.startAt=Date.now();e.endAt=Date.now()+durations[1];log('ROUND_START','Round 1');}else if(action==='end1'&&e.state==='ROUND1_ACTIVE'){e.state='ROUND1_COMPLETED';e.round=1;e.startAt=null;e.endAt=null;log('ROUND_END','Round 1');}else if(action==='start2'&&['ROUND1_COMPLETED'].includes(e.state)){e.state='ROUND2_ACTIVE';e.round=2;e.startAt=Date.now();e.endAt=Date.now()+durations[2];log('ROUND_START','Round 2');}else if(action==='end2'&&e.state==='ROUND2_ACTIVE'){e.state='ROUND2_COMPLETED';e.round=2;e.startAt=null;e.endAt=null;log('ROUND_END','Round 2');}else if(action==='publish'&&e.state==='ROUND2_COMPLETED'){e.leaderboardPublished=true;log('LEADERBOARD','Published');}else if(action==='reset'){db=fresh();log('RESET','Event reset')}else return json(res,409,{error:'Invalid action for current state'});save();json(res,200,state())},
'GET /api/admin/participants':(req,res)=>{const t=(req.headers.authorization||'').replace('Bearer ','');if(!global.adminTokens?.has(t))return json(res,401,{error:'Unauthorized'});let a=Object.values(db.participants).map(p=>({id:p.id,name:p.name,registerNumber:p.registerNumber,online:p.online,round1Score:p.round1Score,round2Score:p.round2Score,total:p.round1Score+p.round2Score,round1Submitted:p.round1Submitted,lastSeen:p.lastSeen})).sort((a,b)=>b.total-a.total);json(res,200,a)},
'GET /api/admin/logs':(req,res)=>{const t=(req.headers.authorization||'').replace('Bearer ','');if(!global.adminTokens?.has(t))return json(res,401,{error:'Unauthorized'});json(res,200,db.logs.slice(-200).reverse())},
'GET /api/leaderboard':(req,res)=>{if(!db.event.leaderboardPublished)return json(res,403,{error:'Leaderboard not published'});const a=Object.values(db.participants).map(p=>({name:p.name,id:p.id,round1:p.round1Score,round2:p.round2Score,total:p.round1Score+p.round2Score})).sort((a,b)=>b.total-a.total||b.round2-a.round2);json(res,200,a.map((x,i)=>({...x,rank:i+1})))},
'GET /api/admin/export':(req,res)=>{const t=(req.headers.authorization||'').replace('Bearer ','');if(!global.adminTokens?.has(t))return json(res,401,{error:'Unauthorized'});const esc=v=>{let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};let csv='Rank,Participant ID,Name,Round 1,Round 2,Total\n';Object.values(db.participants).sort((a,b)=>(b.round1Score+b.round2Score)-(a.round1Score+a.round2Score)).forEach((p,i)=>csv+=`${i+1},${esc(p.id)},${esc(p.name)},${p.round1Score},${p.round2Score},${p.round1Score+p.round2Score}\n`);res.writeHead(200,{'Content-Type':'text/csv','Content-Disposition':'attachment; filename="terminal-quiz-results.csv"'});res.end(csv)}
};
const pageAliases={
  '/participant-login.html':'participant/participant-login.html',
  '/participant.html':'participant/participant.html',
  '/round1.html':'round_1/round1.html',
  '/round2.html':'round_2/round2.html',
  '/leaderboard.html':'leaderboard/leaderboard.html',
  '/admin-login.html':'admin/admin-login.html',
  '/admin.html':'admin/admin.html'
};
const assetAliases={
  '/assets/index.js':'index.js',
  '/assets/participant-login.js':'participant/participant-login.js',
  '/assets/participant.js':'participant/participant.js',
  '/assets/round1.js':'round_1/round1.js',
  '/assets/round2.js':'round_2/round2.js',
  '/assets/leaderboard.js':'leaderboard/leaderboard.js',
  '/assets/admin-login.js':'admin/admin-login.js',
  '/assets/admin.js':'admin/admin.js',
  '/assets/common.js':'assets/common.js',
  '/assets/style.css':'assets/style.css'
};
async function handler(req,res){
  let u=new URL(req.url,`http://${req.headers.host}`);
  if(req.method==='GET'){
    if(u.pathname==='/'||u.pathname==='/index.html')return serve('index.html',res);
    if(pageAliases[u.pathname])return serve(pageAliases[u.pathname],res);
    if(assetAliases[u.pathname])return serve(assetAliases[u.pathname],res);
    if(u.pathname.startsWith('/assets/'))return serve(u.pathname.slice(1),res);
    if(u.pathname.endsWith('.html'))return serve(u.pathname.slice(1),res);
  }
  const r=routes[req.method+' '+u.pathname];
  if(r){try{return await r(req,res)}catch(e){console.error(e);return json(res,500,{error:'Server error'})}}
  json(res,404,{error:'Not found'});
}
function serve(file,res){
  const root=path.resolve(PUBLIC),p=path.resolve(PUBLIC,file);
  if(!p.startsWith(root+path.sep)&&p!==root)return json(res,404,{error:'Not found'});
  if(!fs.existsSync(p)||!fs.statSync(p).isFile())return json(res,404,{error:'Not found'});
  const ext=path.extname(p).toLowerCase();
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
  res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(p).pipe(res);
}
setInterval(()=>{Object.values(db.participants).forEach(p=>{if(p.online&&Date.now()-p.lastSeen>30000)p.online=false});state();save()},5000);setInterval(()=>{try{fs.copyFileSync(DATA,path.join(BACKUPS,'db-'+new Date().toISOString().replaceAll(':','-')+'.json'))}catch{}},5*60*1000);
const server=http.createServer(handler);const PORT=Number(process.env.PORT||3000);server.listen(PORT,'0.0.0.0',()=>{const nets=os.networkInterfaces();let ips=[];for(const x of Object.values(nets))for(const n of x||[])if(n.family==='IPv4'&&!n.internal)ips.push(n.address);console.log('\n========================================');console.log(' TERMINAL QUIZ EVENT SERVER');console.log('========================================');console.log(` Local: http://localhost:${PORT}`);ips.forEach(ip=>console.log(` LAN:   http://${ip}:${PORT}`));console.log(` Admin: http://localhost:${PORT}/#admin`);console.log(' Default admin password: admin123');console.log('========================================\n')});
