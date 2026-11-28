import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithRedirect as firebaseSignInWithRedirect, getRedirectResult, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';

const firebaseApp = initializeApp({
  apiKey: 'AIzaSyDDHhjq64f-fau6nkFJYiogiuYlRQFPDss',
  authDomain: 'perfumes-12f57.firebaseapp.com',
  databaseURL: 'https://perfumes-12f57-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'perfumes-12f57',
});
const firebaseAuth = getAuth(firebaseApp);
const API_BASE = 'https://omnix-api.fibrahem865.workers.dev';
const currentUser = () => firebaseAuth.currentUser;
const userShape = (u:any) => u ? ({ userId:u.uid, email:u.email||'', name:u.displayName||'', phoneNumber:u.phoneNumber||'' }) : null;

export const auth = {
  async getUser() {
    await getRedirectResult(firebaseAuth).catch(()=>null);
    if (firebaseAuth.currentUser) return userShape(firebaseAuth.currentUser);
    return await new Promise(resolve => {
      const stop=onAuthStateChanged(firebaseAuth,u=>{stop();resolve(userShape(u));});
    });
  },
  async signInWithRedirect() {
    const provider=new GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    await firebaseSignInWithRedirect(firebaseAuth,provider);
  },
  async signOut() { await firebaseSignOut(firebaseAuth); }
};
async function request(method:string,path:string,body?:any) {
  const token=await currentUser()?.getIdToken();
  const response=await fetch(API_BASE+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) { const error:any=new Error(data.error||data.message||'تعذر تنفيذ الطلب'); error.response={data:{message:data.error||data.message}}; throw error; }
  return {data};
}
export const api = {
  get:(path:string)=>request('GET',path),
  post:(path:string,body:any)=>request('POST',path,body),
  put:(path:string,body:any)=>request('PUT',path,body),
  delete:(path:string)=>request('DELETE',path)
};
export const notifications = {
  async getEnvironment(){ return {isSupported:false,permission:'unsupported'}; },
  async subscribe(){ throw new Error('إشعارات المتصفح ستُفعّل بعد ربط خدمة الإشعارات المستقلة'); }
};
