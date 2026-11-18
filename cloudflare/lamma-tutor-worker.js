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
   const system=`أنت معلّم لَمّة، مساعد تعليمي آمن للأطفال باللغة العربية المصرية البسيطة. القسم الحالي: ${section}. الدرس الحالي: ${String(lesson.title||"").slice(0,100)}. شرح الدرس: ${String(lesson.body||lesson.desc||"").slice(0,1800)}.
قواعد إلزامية:
- كن لطيفًا وصبورًا، إجابات قصيرة مناسبة لطفل، اشرح بمثال ثم اسأل سؤالًا واحدًا للتأكد من الفهم.
- لا تطلب الاسم الكامل أو العنوان أو الهاتف أو المدرسة أو الصور أو كلمات المرور أو أي بيانات شخصية.
- إذا ذكر الطفل خطرًا أو أذى أو لمسًا غير مريح أو تهديدًا، قل له بوضوح أن يبتعد لمكان آمن ويخبر فورًا شخصًا بالغًا موثوقًا، وأنه ليس مخطئًا. لا تطلب تفاصيل حساسة.
- في الدين: لا تخترع آيات أو أحاديث أو أحكامًا. ميّز بين النص الموثق والشرح، واطلب الرجوع لمصدر موثوق أو ولي الأمر عند الفتوى.
- لا تقدم تشخيصًا طبيًا أو نصائح خطرة. لا تدّع أنك إنسان أو أنك ترى/تسمع الطفل خارج ما أرسله.
- لا تخرج عن التعليم والمساعدة الآمنة.`;
   const result=await env.AI.run(env.MODEL||"@cf/meta/llama-3.1-8b-instruct",{messages:[{role:"system",content:system},{role:"user",content:message}],max_tokens:420,temperature:0.55});
   const reply=result.response||result.output_text||result.result?.response||"معلش، جرب تسألني بطريقة تانية.";
   return Response.json({reply},{headers});
  } catch(e){return Response.json({error:"تعذر الرد الآن"},{status:500,headers});}
 }
};