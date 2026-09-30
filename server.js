const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const sessions = new Map();
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const defaultData = {users:{}, comments:[]};
let data;
try { data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { data = defaultData; persist(); }

function persist(){fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));}
function hash(value){return crypto.createHash('sha256').update(value).digest('hex');}
function initials(name){return name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();}
function send(res, status, body, headers={}){res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', ...headers});res.end(JSON.stringify(body));}
function readBody(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>100000)req.destroy();});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(new Error('JSON inválido'))}});req.on('error',reject)});}
function userFrom(req){const token=(req.headers.cookie||'').match(/gitquest_session=([^;]+)/)?.[1];return token?sessions.get(token):null;}
function auth(req,res){const user=userFrom(req);if(!user){send(res,401,{error:'Faça login para continuar.'});return null}return user;}
function publicUser(user){return {name:user.name, initials:user.initials, progress:user.progress};}
function ranking(){return Object.values(data.users).sort((a,b)=>b.progress.points-a.progress.points).slice(0,20).map((u,i)=>({rank:i+1,name:u.name,initials:u.initials,points:u.progress.points}));}
function jsonRoute(req,res,url){
  if(req.method==='POST' && (url==='/api/register'||url==='/api/login')) return readBody(req).then(body=>{
    const name=String(body.name||'').trim().replace(/\s+/g,' '), password=String(body.password||'');
    if(name.length<2||name.length>30||password.length<4)return send(res,400,{error:'Informe um nome e uma senha de pelo menos 4 caracteres.'});
    const key=name.toLowerCase();
    if(url==='/api/register' && data.users[key])return send(res,409,{error:'Esse nome já está em uso.'});
    if(url==='/api/login' && (!data.users[key]||data.users[key].password!==hash(password)))return send(res,401,{error:'Nome ou senha incorretos.'});
    if(url==='/api/register')data.users[key]={name,initials:initials(name),password:hash(password),progress:{done:[],points:0,streak:0,errors:0,level:'easy'}};
    persist();const token=crypto.randomBytes(24).toString('hex');sessions.set(token,key);send(res,200,{user:publicUser(data.users[key])},{'Set-Cookie':`gitquest_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`});
  }).catch(()=>send(res,400,{error:'Requisição inválida.'}));
  if(req.method==='POST'&&url==='/api/logout'){const token=(req.headers.cookie||'').match(/gitquest_session=([^;]+)/)?.[1];if(token)sessions.delete(token);return send(res,200,{ok:true},{'Set-Cookie':'gitquest_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});}
  if(req.method==='GET'&&url==='/api/me'){const key=userFrom(req);return key&&data.users[key]?send(res,200,{user:publicUser(data.users[key])}):send(res,401,{error:'Não autenticado.'});}
  const key=auth(req,res);if(!key)return;
  if(req.method==='GET'&&url==='/api/bootstrap'){return send(res,200,{user:publicUser(data.users[key]),comments:data.comments.slice(0,40),ranking:ranking()});}
  if(req.method==='POST'&&url==='/api/progress')return readBody(req).then(body=>{const p=body.progress||{};data.users[key].progress={done:Array.isArray(p.done)?p.done.filter(Number.isInteger).slice(0,100):[],points:Math.max(0,Number(p.points)||0),streak:Math.max(0,Number(p.streak)||0),errors:Math.max(0,Number(p.errors)||0),level:['easy','medium','hard'].includes(p.level)?p.level:'easy'};persist();send(res,200,{progress:data.users[key].progress,ranking:ranking()})}).catch(()=>send(res,400,{error:'Progresso inválido.'}));
  if(req.method==='POST'&&url==='/api/comments')return readBody(req).then(body=>{const text=String(body.text||'').trim().slice(0,280);if(!text)return send(res,400,{error:'Comentário vazio.'});data.comments.unshift({name:data.users[key].name,initials:data.users[key].initials,time:'agora',text});persist();send(res,201,{comments:data.comments.slice(0,40)})}).catch(()=>send(res,400,{error:'Comentário inválido.'}));
  send(res,404,{error:'Rota não encontrada.'});
}
function serve(req,res){let file=decodeURIComponent(new URL(req.url,`http://${req.headers.host||'localhost'}`).pathname);if(file==='/')file='/index.html';if(file==='/data.json')return send(res,404,{error:'Arquivo não encontrado.'});const full=path.normalize(path.join(ROOT,file));if(!full.startsWith(ROOT)||!fs.existsSync(full)||fs.statSync(full).isDirectory())return send(res,404,{error:'Arquivo não encontrado.'});res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream'});fs.createReadStream(full).pipe(res);}
const server=http.createServer((req,res)=>{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`).pathname;if(url.startsWith('/api/'))jsonRoute(req,res,url);else serve(req,res)});
server.listen(PORT,()=>console.log(`GitQuest MVP: http://localhost:${PORT}`));
