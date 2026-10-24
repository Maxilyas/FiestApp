const fs=require('fs');
const root=process.argv[2];
let all=[];for(const f of fs.readdirSync(root+'/server/content/campagne'))all=all.concat(JSON.parse(fs.readFileSync(root+'/server/content/campagne/'+f)));
all=all.filter(q=>!(q.aRelire||[]).length&&q.anecdote&&q.anecdote.length<220);
let s=42;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
const pick=(a,n)=>{a=a.slice();const o=[];while(o.length<n&&a.length)o.push(a.splice(Math.floor(r()*a.length),1)[0]);return o};
const norm=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const donne=q=>norm(q.texte).includes(norm(q.reponses[q.bonne]).replace(/^(le |la |les |l'|un |une )/,''));
const okQ=q=>q.reponses.length===4&&q.texte.length<130&&q.reponses.every(x=>x.length<34)&&!donne(q);
const qc=q=>({id:q.id,t:q.texte,r:q.reponses,b:q.bonne,a:q.anecdote,c:q.categorie,d:q.difficulte});
const qcm=pick(all.filter(q=>q.difficulte<=3&&okQ(q)),300).map(qc);
const dur=pick(all.filter(q=>q.difficulte>=4&&okQ(q)),150).map(qc);
const majn=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
const sansArt=w=>w.replace(/^(Le |La |Les |L'|L’|Un |Une )/,'');
const mots=pick(all.filter(q=>{const n=majn(sansArt(q.reponses[q.bonne]));return /^[A-Z]{5,7}$/.test(n)&&q.difficulte<=2&&q.texte.length<120&&!/\d/.test(q.texte)&&!donne(q)}),80)
 .map(q=>({id:q.id,t:q.texte,m:majn(sansArt(q.reponses[q.bonne])),aff:sansArt(q.reponses[q.bonne]),a:q.anecdote,c:q.categorie}));
const MOTS=['zero','un','une','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize','vingt','trente','quarante','cinquante','soixante','cent','mille'];
const nombreDit=v=>{const m={0:'zero',1:'un',2:'deux',3:'trois',4:'quatre',5:'cinq',6:'six',7:'sept',8:'huit',9:'neuf',10:'dix',11:'onze',12:'douze',13:'treize',14:'quatorze',15:'quinze',16:'seize',20:'vingt',30:'trente',40:'quarante',50:'cinquante',60:'soixante',100:'cent',1000:'mille'};return m[v]};
const revele=(q,v)=>{const t=norm(q.texte);if(t.includes(String(v)))return true;const w=nombreDit(v);return w&&new RegExp('\\b'+w+'\\b').test(t)};
const annees=pick(all.filter(q=>/^En quelle année/.test(q.texte)&&q.date&&q.date.precision==='annee'&&/^\d{4}$/.test(q.date.valeur)&&+q.date.valeur>1000),70)
 .map(q=>({id:q.id,t:q.texte,v:+q.date.valeur,u:'',annee:true,a:q.anecdote,c:q.categorie}));
const nombres=pick(all.filter(q=>q.valeur&&typeof q.valeur.nombre==='number'&&q.valeur.nombre>=10&&q.texte.length<130&&!/année/.test(q.texte)&&!revele(q,q.valeur.nombre)&&!/^Combien vaut/.test(q.texte)),70)
 .map(q=>({id:q.id,t:q.texte,v:q.valeur.nombre,u:q.valeur.unite||'',a:q.anecdote,c:q.categorie}));
fs.writeFileSync(process.argv[3],JSON.stringify({qcm,dur,mots,filet:annees.concat(nombres)}));
console.log(qcm.length,dur.length,mots.length,annees.length,nombres.length);
console.log(dur.slice(0,5).map(q=>q.t+' → '+q.r[q.b]).join('\n'));
