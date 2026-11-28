import { router, json, error, requireAuth, requireAdminEmailAllowlist, notifications } from '@appdeploy/sdk';
import { db, storage } from '@appdeploy/sdk';

const ADMIN_EMAILS = ['fibrahem865@gmail.com'];
const admin = requireAdminEmailAllowlist(ADMIN_EMAILS);
const obj = (v: unknown): Record<string, any> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, any>)
    : {};
const categories = ['men', 'women', 'unisex'];
const statuses = [
  'new',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
];

async function catalog() {
  const page = await db.list<any>('products', {
    limit: 100,
    appdeploy_system_id: true,
  });
  const active = page.items.filter((p: any) => p.active !== false && p.demo !== true);
  const paths = active.map((p: any) => p.imagePath).filter(Boolean);
  const urls = paths.length ? await storage.url(paths) : [];
  const byPath = new Map(urls.map((x: any) => [x.path, x.url]));
  return active.map((p: any) => ({
    ...p,
    imageUrl: p.imageUrl || (p.imagePath ? byPath.get(p.imagePath) || '' : ''),
  }));
}
async function createNotification(userId: string, title: string, body: string, orderId?: string) {
  try {
    await db.add('notifications', [{
      userId, title, body, type: 'order', orderId: orderId || '',
      createdAt: new Date().toISOString(), readAt: null,
    }]);
  } catch {
    console.warn('Could not save in-app notification');
  }
  try {
    await notifications.send({
      userIds: [userId],
      notification: { title, body, url: '/#orders' },
      data: { kind: 'order-update', orderId: orderId || '' },
      ttlSeconds: 60 * 60 * 24 * 7,
    });
  } catch {
    console.warn('Could not send customer push notification');
  }
}
async function verifyRahafActivationCode(code: string) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized || normalized.length > 80) return { allowed: false, reason: 'invalid_code' };
  try {
    const response = await fetch(
      'https://perfumes-12f57-default-rtdb.europe-west1.firebasedatabase.app/control/rahaf.json',
      { method: 'GET', headers: { accept: 'application/json' }, cache: 'no-store' }
    );
    if (!response.ok) {
      console.error('RAHAF Firebase entitlement lookup returned HTTP', response.status);
      return { allowed: false, reason: 'verification_service_error' };
    }
    const control = await response.json() as Record<string, any> | null;
    if (!control || control.status === 'paused') return { allowed: false, reason: 'paused' };
    const entitlement = control.entitlements?.[normalized];
    if (!entitlement || entitlement.appId !== 'rahaf-perfumes') return { allowed: false, reason: 'invalid_code' };
    const startsText = String(entitlement.startsAt || '');
    const endsText = String(entitlement.endsAt || '');
    const starts = new Date(startsText.length === 10 ? startsText + 'T00:00:00.000Z' : startsText).getTime();
    const ends = new Date(endsText.length === 10 ? endsText + 'T23:59:59.999Z' : endsText).getTime();
    const current = Date.now();
    if (entitlement.status === 'paused') return { allowed: false, reason: 'paused' };
    if (!Number.isFinite(starts) || !Number.isFinite(ends) || current > ends) return { allowed: false, reason: 'expired' };
    if (current < starts) return { allowed: false, reason: 'not_started' };
    return { allowed: true, reason: 'active', expiresAt: entitlement.endsAt || null };
  } catch (e) {
    console.error('RAHAF Firebase entitlement lookup failed', e);
    return { allowed: false, reason: 'verification_service_error' };
  }
}
function product(body: Record<string, any>) {
  return {
    name: String(body.name || '')
      .trim()
      .slice(0, 100),
    description: String(body.description || '').slice(0, 1200),
    price: Number(body.price),
    category: String(body.category || 'unisex'),
    sizes: Array.isArray(body.sizes)
      ? body.sizes.map((x: any) => String(x).slice(0, 24)).slice(0, 10)
      : [],
    sizePrices: Object.fromEntries(Object.entries(obj(body.sizePrices)).filter(([key, value]) => Number.isFinite(Number(value)) && Number(value) > 0).map(([key, value]) => [String(key).slice(0, 24), Number(value)])),
    imagePath: String(body.imagePath || '').slice(0, 300),
    active: true,
  };
}
export const handler = router({
  'GET /api/products': [
    async () => {
      try {
        return json({ items: await catalog() });
      } catch {
        return error('تعذر تحميل المنتجات', 500);
      }
    },
  ],
  'POST /api/admin/products/demo': [
    requireAuth(),
    admin,
    async () => {
      const page = await db.list<any>('products', {
        limit: 100,
        appdeploy_system_id: true,
      });
      const samples = [
        { name: 'مسك الليل — تجريبي', description: 'عطر تجريبي بطابع دافئ من المسك والعنبر. للعرض واختبار تجربة الشراء فقط.', category: 'unisex', prices: [95, 125, 165, 245, 420], imageUrl: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=900&auto=format&fit=crop&q=85' },
        { name: 'روز فيلفت — تجريبي', description: 'تركيبة تجريبية ناعمة بلمسات الورد والفانيليا. للعرض فقط.', category: 'women', prices: [110, 145, 185, 275, 480], imageUrl: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=900&auto=format&fit=crop&q=85' },
        { name: 'عود إمبريال — تجريبي', description: 'تصور تجريبي شرقي يجمع العود والأخشاب الدافئة. للعرض فقط.', category: 'men', prices: [145, 185, 245, 365, 650], imageUrl: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=900&auto=format&fit=crop&q=85' },
        { name: 'بلانش بلوم — تجريبي', description: 'رائحة تجريبية منعشة مستوحاة من الزهور البيضاء. للعرض فقط.', category: 'women', prices: [85, 115, 155, 225, 390], imageUrl: 'https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?w=900&auto=format&fit=crop&q=85' },
        { name: 'أزور وود — تجريبي', description: 'مزيج تجريبي من الأخشاب والحمضيات بطابع رجالي. للعرض فقط.', category: 'men', prices: [115, 150, 195, 295, 520], imageUrl: 'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=900&auto=format&fit=crop&q=85' },
        { name: 'فانيلا كلاود — تجريبي', description: 'فانيليا كريمية ولمسة حلوة خفيفة. عينة عرض تجريبية فقط.', category: 'unisex', prices: [80, 105, 140, 205, 360], imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&auto=format&fit=crop&q=85' },
        { name: 'أمبر نايت — تجريبي', description: 'عنبر وتوابل دافئة في تركيبة تجريبية للعرض فقط.', category: 'men', prices: [125, 165, 215, 315, 560], imageUrl: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=900&auto=format&fit=crop&q=85' },
        { name: 'جاسمين دريم — تجريبي', description: 'ياسمين وزهور بيضاء بلمسة ناعمة. منتج تجريبي للعرض فقط.', category: 'women', prices: [100, 135, 175, 255, 445], imageUrl: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=900&auto=format&fit=crop&q=85' },
        { name: 'سيجنتشر — تجريبي', description: 'عطر يومي تجريبي متوازن يناسب الجميع. للعرض فقط.', category: 'unisex', prices: [115, 150, 195, 290, 500], imageUrl: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=900&auto=format&fit=crop&q=85' },
      ].map(item => {
        const sizeNames = ['16 مل', '22 مل', '30 مل', '50 مل', '100 مل'];
        const sizePrices = Object.fromEntries(sizeNames.map((size, index) => [size, item.prices[index]]));
        return { name: item.name, description: item.description, price: Math.min(...item.prices), category: item.category, sizes: sizeNames, sizePrices, imagePath: '', imageUrl: item.imageUrl, active: true, demo: true };
      });
      const existingDemos = page.items.filter((item: any) => item.demo === true);
      if (existingDemos.length) {
        await db.update('products', existingDemos.map((item: any, index: number) => {
          const sample = samples[index % samples.length];
          return { id: item.id, record: { ...item, ...sample } };
        }));
        return json({ created: false, updated: existingDemos.length });
      }
      const ids = await db.add('products', samples);
      return json({ created: true, count: ids.length });
    },
  ],
  'POST /api/admin/upload': [
    requireAuth(),
    admin,
    async ctx => {
      const b = obj(ctx.body),
        type = String(b.contentType || '');
      if (typeof b.base64 !== 'string' || b.base64.length > 5500000)
        return error('الصورة كبيرة أو غير صالحة', 400);
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(type))
        return error('صيغة الصورة غير مدعومة', 400);
      const ext =
          type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg',
        path = 'products/' + ctx.user!.userId + '/' + Date.now() + '.' + ext;
      const [ok] = await storage.write([
        { path, content: b.base64, contentType: type },
      ]);
      return ok ? json({ path }) : error('فشل رفع الصورة', 500);
    },
  ],
  'POST /api/admin/products': [
    requireAuth(),
    admin,
    async ctx => {
      const p = product(obj(ctx.body));
      if (
        !p.name ||
        !Number.isFinite(p.price) ||
        p.price <= 0 ||
        !categories.includes(p.category)
      )
        return error('بيانات العطر غير صحيحة', 400);
      const [id] = await db.add('products', [p]);
      return id ? json({ id }) : error('تعذر الحفظ', 500);
    },
  ],
  'PUT /api/admin/products/:id': [
    requireAuth(),
    admin,
    async ctx => {
      const p = product(obj(ctx.body));
      if (
        !p.name ||
        !Number.isFinite(p.price) ||
        p.price <= 0 ||
        !categories.includes(p.category)
      )
        return error('بيانات العطر غير صحيحة', 400);
      const [ok] = await db.update('products', [
        { id: ctx.params.id, record: p },
      ]);
      return ok ? json({ ok: true }) : error('العطر غير موجود', 404);
    },
  ],
  'DELETE /api/admin/products/:id': [
    requireAuth(),
    admin,