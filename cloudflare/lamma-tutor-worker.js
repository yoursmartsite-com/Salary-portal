export default {
 async fetch(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "https://yoursmartsite-com.github.io").split(",").map(x=>x.trim());
  const corsOrigin = allowed.includes(origin) ? origin : allowed[0];
  const headers = {"Access-Control-Allow-Origin":corsOrigin,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};
  if(request.method==="OPTIONS") return new Response(null,{headers});
  if(request.method!=="POST") return Response.json({error:"POST only"},{status:405,headers});
  try {
   const body=await request.json();
   const message=String(body.message||"").trim().slice(0,1200);
   if(!message) return Response.json({error:"اكتب سؤالك"},{status:400,headers});
   const section=String(body.section||"learning").slice(0,30);
   const lesson=body.lesson||{};
   const language=String(body.language||lesson.language||"en").slice(0,8);
   const level=String(body.level||lesson.level||"").slice(0,12);
   const isLanguage=section==="language";
   const languageName=language==="nl"?"الهولندية":"الإنجليزية";
   const history=Array.isArray(body.history)?body.history.slice(-8).map(x=>({role:x.role==="assistant"?"assistant":"user",content:String(x.content||"").slice(0,700)})):[];
   const baseRules=`أنت معلّم لَمّة، مساعد تعليمي آمن باللغة العربية المصرية البسيطة. القسم الحالي: ${section}.
قواعد إلزامية:
- كن لطيفًا وصبورًا، اشرح بمثال واضح ثم اسأل سؤالًا واحدًا للتأكد من الفهم.
- لا تطلب الاسم الكامل أو العنوان أو الهاتف أو المدرسة أو الصور أو كلمات المرور أو أي بيانات شخصية.
- إذا ذكر المتعلم خطرًا أو أذى أو لمسًا غير مريح أو تهديدًا، قل له بوضوح أن يبتعد لمكان آمن ويخبر فورًا شخصًا بالغًا موثوقًا، وأنه ليس مخطئًا. لا تطلب تفاصيل حساسة.
- لا تقدم تشخيصًا طبيًا أو نصائح خطرة. لا تدّع أنك إنسان.
- لا تخترع معلومة إذا لم تكن متأكدًا؛ وضح عدم اليقين ببساطة.`;
   const languageRules=isLanguage?`أنت الآن مدرس متخصص في ${languageName}. مستوى المتعلم ${level||"غير محدد"}، والدرس الحالي: ${String(lesson.title||"مراجعة عامة").slice(0,120)}.
- اشرح القواعد والمفردات بالعربية المصرية، واكتب الأمثلة باللغة ${languageName} ثم ترجمتها للعربية.
- صحح جمل المتعلم بدقة: اعرض الجملة الصحيحة، ثم اشرح سبب التصحيح باختصار، ولا تسخر من الأخطاء.
- عند طلب الترجمة، اذكر المعنى الطبيعي والسياق، ونبه إلى المعاني الأخرى المهمة.
- درّب المتعلم بالمحادثة: تحدث معه بجملة قصيرة باللغة المستهدفة تناسب مستواه، وانتظر رده، ثم صححه.
- لا تخلط الإنجليزية بالهولندية. استخدم اللغة التي اختارها فقط.
- ابدأ من أساسيات المستوى ولا تفترض معرفة قواعد لم يدرسها بعد. اجعل الإجابة مناسبة للمستوى، ولا تعطِ درسًا طويلًا إلا إذا طلب ذلك.`:"";
   const lessonContext=isLanguage?`سياق الدرس: ${String(lesson.title||"").slice(0,120)}. التصنيف: ${String(lesson.cat||"").slice(0,80)}. الشرح: ${String(lesson.body||lesson.desc||"").slice(0,1400)}.`:`الدرس الحالي: ${String(lesson.title||"").slice(0,100)}. شرح الدرس: ${String(lesson.body||lesson.desc||"").slice(0,1200)}.`;
   const messages=[{role:"system",content:baseRules+"\n"+languageRules+"\n"+lessonContext},...history,{role:"user",content:message}];
   const result=await env.AI.run(env.MODEL||"@cf/meta/llama-3.1-8b-instruct",{messages,max_tokens:600,temperature:0.45});
   const reply=result.response||result.output_text||result.result?.response||"معلش، جرب تسألني بطريقة تانية.";
   return Response.json({reply},{headers});
  } catch(e){return Response.json({error:"تعذر الرد الآن"},{status:500,headers});}
 }
};
