const base='http://localhost:37277', H={'content-type':'application/json',Origin:base,'x-requested-with':'quizz'}
const l=await fetch(base+'/api/auth/login',{method:'POST',headers:H,body:JSON.stringify({login:'elodie',password:'elodie-secret1'})})
const c=l.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')
const q=[1,2,3,4,5].map(i=>({text:`Question ${i} : combien font ${i} + ${i} ?`,answers:[String(2*i),String(2*i+1),String(2*i+2),String(2*i+3)],correct:0,timeLimit:20}))
const r=await fetch(base+'/api/quizzes',{method:'POST',headers:{...H,cookie:c},body:JSON.stringify({title:'Petit calcul',questions:q})})
console.log(r.status, (await r.text()).slice(0,200))
