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
    async ctx => {
      const [ok] = await db.delete('products', [ctx.params.id]);
      return json({ ok });
    },
  ],
  'POST /api/app-access': [
    async ctx => {
      const access = await verifyRahafActivationCode(String(obj(ctx.body).code || ''));
      return json(access);
    },
  ],
  'POST /api/orders': [
    requireAuth(),
    async ctx => {
      const access = await verifyRahafActivationCode(String(obj(ctx.body).activationCode || ''));
      if (!access.allowed) return error('كود التشغيل غير صالح أو انتهت مدة اشتراك رهف.', 403);
      const b = obj(ctx.body);
      if (!Array.isArray(b.items) || !b.items.length || b.items.length > 30)
        return error('السلة غير صالحة', 400);
      const ids = [
        ...new Set(b.items.map((x: any) => String(obj(x).productId || ''))),
      ];
      const records = await db.get<any>('products', ids);
      const lookup = new Map(ids.map((id, i) => [id, records[i]]));
      const lines: any[] = [];
      let total = 0;
      for (const raw of b.items) {
        const x = obj(raw),
          p = lookup.get(String(x.productId)),
          qty = Number(x.qty);
        if (
          !p ||
          p.active === false ||
          !Number.isInteger(qty) ||
          qty < 1 ||
          qty > 20
        )
          return error('منتج غير متاح أو كمية غير صحيحة', 400);
        const selectedSize = String(x.size || '50 مل').slice(0, 24);
        const unitPrice = Number(obj(p.sizePrices)[selectedSize] ?? p.price);
        if (!Number.isFinite(unitPrice) || unitPrice <= 0 || (Array.isArray(p.sizes) && p.sizes.length && !p.sizes.includes(selectedSize))) return error('الحجم أو سعره غير متاح', 400);
        total += unitPrice * qty;
        lines.push({
          productId: String(x.productId),
          name: p.name,
          size: selectedSize,
          qty,
          price: unitPrice,
          demo: p.demo === true,
        });
      }
      const customerName = String(b.customerName || '')
          .trim()
          .slice(0, 100),
        phone = String(b.phone || '')
          .trim()
          .slice(0, 30),
        address = String(b.address || '')
          .trim()
          .slice(0, 500);
      if (!customerName || !phone || !address)
        return error('أكمل بيانات التوصيل', 400);
      const [id] = await db.add('orders', [
        {
          userId: ctx.user!.userId,
          customerName,
          phone,
          address,
          items: lines,
          total,
          status: 'new',
          createdAt: new Date().toISOString(),
          paymentMethod: 'cash_on_delivery',
        },
      ]);
      if (id) {
        const message = 'طلب جديد رقم ' + String(id).slice(-6) + ' من ' + customerName;
        await createNotification(ctx.user!.userId, 'استلمنا طلبك بنجاح', 'طلبك رقم ' + String(id).slice(-6) + ' اتسجل، وهنبدأ نتابع تجهيزه معاك.', String(id));
        try {
          await notifications.sendToTopic({
            topic: 'rahaf-store-admin',
            notification: { title: 'طلب جديد في رهف', body: message, url: '/#admin' },
            data: { kind: 'new-order', orderId: String(id) },
            ttlSeconds: 60 * 60 * 24,
          });
        } catch {
          console.warn('Could not send new-order push to store admins');
        }
      }
      return id
        ? json({ id, total, status: 'new' })
        : error('تعذر حفظ الطلب', 500);
    },
  ],
  'POST /api/push/admin/subscribe': [
    requireAuth(),
    admin,
    async ctx => {
      await notifications.subscribeTopic({
        userIds: [ctx.user!.userId],
        topic: 'rahaf-store-admin',
      });
      return json({ ok: true });
    },
  ],
  'GET /api/profile': [
    requireAuth(),
    async ctx => {
      const userId = ctx.user!.userId;
      const [saved] = await db.get<any>('customer_profiles', [userId], { consistent: true });
      let avatarUrl = '';
      if (saved?.avatarPath) {
        const [asset] = await storage.url([saved.avatarPath]);
        avatarUrl = asset?.url || '';
      }
      return json({ profile: { name: saved?.name || ctx.user!.name || '', phone: saved?.phone || ctx.user!.phoneNumber || '', avatarUrl } });
    },
  ],
  'PUT /api/profile': [
    requireAuth(),
    async ctx => {
      const body = obj(ctx.body);
      const name = String(body.name || '').trim().slice(0, 80);
      const phone = String(body.phone || '').trim().slice(0, 20);
      if (!name) return error('الاسم مطلوب', 400);
      if (phone && !/^[0-9+()\\s-]{7,20}$/.test(phone)) return error('رقم الموبايل غير صحيح', 400);
      const userId = ctx.user!.userId;
      const [old] = await db.get<any>('customer_profiles', [userId], { consistent: true });
      let avatarPath = old?.avatarPath || '';
      if (body.avatarBase64) {
        const contentType = String(body.avatarContentType || '');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType) || typeof body.avatarBase64 !== 'string' || body.avatarBase64.length > 4200000) return error('الصورة غير صالحة أو حجمها كبير', 400);
        const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
        avatarPath = 'customer-avatars/' + userId + '/profile.' + extension;
        const [uploaded] = await storage.write([{ path: avatarPath, content: body.avatarBase64, contentType }]);
        if (!uploaded) return error('تعذر رفع الصورة الشخصية', 500);
      }
      const record = { name, phone, avatarPath, updatedAt: new Date().toISOString() };
      const [saved] = await db.update('customer_profiles', [{ id: userId, record }]);
      if (!saved) return error('تعذر حفظ بيانات الملف الشخصي', 500);
      let avatarUrl = '';
      if (avatarPath) {
        const [asset] = await storage.url([avatarPath]);
        avatarUrl = asset?.url || '';
      }
      return json({ ok: true, profile: { name, phone, avatarUrl } });
    },
  ],
  'GET /api/notifications': [
    requireAuth(),
    async ctx => {
      const p = await db.list<any>('notifications', { limit: 100, appdeploy_system_id: true });
      return json({ items: p.items.filter((n: any) => n.userId === ctx.user!.userId).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)) });
    },
  ],
  'PUT /api/notifications/:id/read': [
    requireAuth(),
    async ctx => {
      const [old] = await db.get<any>('notifications', [ctx.params.id], { consistent: true });
      if (!old || old.userId !== ctx.user!.userId) return error('الإشعار غير موجود', 404);
      const [ok] = await db.update('notifications', [{ id: ctx.params.id, record: { ...old, readAt: old.readAt || new Date().toISOString() } }]);
      return ok ? json({ ok: true }) : error('تعذر تحديث الإشعار', 500);
    },
  ],
  'POST /api/notifications/read-all': [
    requireAuth(),
    async ctx => {
      const p = await db.list<any>('notifications', { limit: 100, appdeploy_system_id: true });
      const unread = p.items.filter((n: any) => n.userId === ctx.user!.userId && !n.readAt);
      if (unread.length) await db.update('notifications', unread.map((n: any) => ({ id: n.id, record: { userId: n.userId, title: n.title, body: n.body, type: n.type, orderId: n.orderId || '', createdAt: n.createdAt, readAt: new Date().toISOString() } })));
      return json({ ok: true, count: unread.length });
    },
  ],
  'GET /api/orders': [
    requireAuth(),
    async ctx => {
      const p = await db.list<any>('orders', {
        limit: 100,
        appdeploy_system_id: true,
      });
      return json({
        items: p.items
          .filter((o: any) => o.userId === ctx.user!.userId)
          .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)),
      });
    },
  ],
  'PUT /api/orders/:id/cancel': [
    requireAuth(),
    async ctx => {
      const [old] = await db.get<any>('orders', [ctx.params.id], { consistent: true });
      if (!old || old.userId !== ctx.user!.userId) return error('الطلب غير موجود', 404);
      if (!['new', 'confirmed'].includes(old.status)) return error('لا يمكن إلغاء الطلب بعد بدء التجهيز', 409);
      const [ok] = await db.update('orders', [
        { id: ctx.params.id, record: { ...old, status: 'cancelled' } },
      ]);
      return ok ? json({ ok: true, status: 'cancelled' }) : error('تعذر إلغاء الطلب', 500);
    },
  ],
  'GET /api/admin/orders': [
    requireAuth(),
    admin,
    async () => {
      const p = await db.list<any>('orders', {
        limit: 100,
        appdeploy_system_id: true,
      });
      return json({
        items: p.items.sort((a: any, b: any) =>
          b.createdAt.localeCompare(a.createdAt)
        ),
      });
    },
  ],
  'PUT /api/admin/orders/:id': [
    requireAuth(),
    admin,
    async ctx => {
      const status = String(obj(ctx.body).status || '');
      if (!statuses.includes(status)) return error('حالة غير صحيحة', 400);
      const [old] = await db.get<any>('orders', [ctx.params.id], {
        consistent: true,
      });
      if (!old) return error('الطلب غير موجود', 404);
      const [ok] = await db.update('orders', [
        { id: ctx.params.id, record: { ...old, status } },
      ]);
      if (ok && old.userId) await createNotification(old.userId, 'حالة طلبك اتحدّثت', 'طلبك رقم ' + String(ctx.params.id).slice(-6) + ': ' + ({ new: 'طلب جديد', confirmed: 'تم تأكيد الطلب', preparing: 'جاري تجهيز طلبك', shipped: 'طلبك في الطريق', delivered: 'تم تسليم الطلب', cancelled: 'تم إلغاء الطلب' } as Record<string,string>)[status], ctx.params.id);
      return ok ? json({ ok: true }) : error('تعذر تحديث الطلب', 500);
    },
  ],
  'GET /api/customer-state': [
    requireAuth(),
    async ctx => {
      const [saved] = await db.get<any>('customer_state', [ctx.user!.userId], { consistent: true });
      return json({ cart: Array.isArray(saved?.cart) ? saved.cart : [], favorites: Array.isArray(saved?.favorites) ? saved.favorites : [] });
    },
  ],
  'PUT /api/customer-state': [
    requireAuth(),
    async ctx => {
      const body = obj(ctx.body);
      const cart = Array.isArray(body.cart) ? body.cart.slice(0, 100) : [];
      const favorites = Array.isArray(body.favorites) ? [...new Set(body.favorites.map((x: any) => String(x).slice(0, 100)))].slice(0, 200) : [];
      if (cart.some((x: any) => !x || typeof x.name !== 'string' || !Number.isInteger(Number(x.qty)) || Number(x.qty) < 1 || !Number.isFinite(Number(x.price)))) return error('بيانات الشنطة غير صالحة', 400);
      const record = { cart: cart.map((x: any) => ({ id: String(x.id).slice(0, 100), name: String(x.name).slice(0, 100), size: String(x.size || '50 مل').slice(0, 24), qty: Number(x.qty), price: Number(x.price) })), favorites, updatedAt: new Date().toISOString() };
      const [saved] = await db.update('customer_state', [{ id: ctx.user!.userId, record }]);
      return saved ? json({ ok: true }) : error('تعذر حفظ الشنطة والمفضلة', 500);
    },
  ],
  'GET /api/products/:id/reviews': [
    async ctx => {
      const page = await db.list<any>('product_reviews', { limit: 100, appdeploy_system_id: true });
      const items = page.items.filter((r: any) => r.productId === ctx.params.id).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
      const average = items.length ? items.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / items.length : 0;
      return json({ items, average: Math.round(average * 10) / 10, count: items.length });
    },
  ],
  'POST /api/products/:id/reviews': [
    requireAuth(),
    async ctx => {
      const body = obj(ctx.body);
      const rating = Number(body.rating);
      const text = String(body.text || '').trim().slice(0, 700);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return error('اختار تقييم من نجمة إلى خمس نجوم', 400);
      const ordersPage = await db.list<any>('orders', { limit: 100, appdeploy_system_id: true });
      const eligible = ordersPage.items.some((o: any) => o.userId === ctx.user!.userId && o.status === 'delivered' && Array.isArray(o.items) && o.items.some((i: any) => i.productId === ctx.params.id));
      if (!eligible) return error('التقييم متاح بعد استلام العطر فقط', 403);
      const reviewsPage = await db.list<any>('product_reviews', { limit: 100, appdeploy_system_id: true });
      const previous = reviewsPage.items.find((r: any) => r.productId === ctx.params.id && r.userId === ctx.user!.userId);
      const record = { productId: ctx.params.id, userId: ctx.user!.userId, customerName: String(ctx.user!.name || 'عميل رهف').slice(0, 80), rating, text, createdAt: new Date().toISOString() };
      if (previous?.__appdeploy_ddb_id) {
        const [ok] = await db.update('product_reviews', [{ id: previous.__appdeploy_ddb_id, record }]);
        return ok ? json({ ok: true, updated: true }) : error('تعذر تحديث التقييم', 500);
      }
      const [id] = await db.add('product_reviews', [record]);
      return id ? json({ ok: true }) : error('تعذر حفظ التقييم', 500);
    },
  ],
  'GET /api/admin/customers': [
    requireAuth(),
    admin,
    async () => {
      const [ordersPage, profilesPage] = await Promise.all([
        db.list<any>('orders', { limit: 100, appdeploy_system_id: true }),
        db.list<any>('customer_profiles', { limit: 100, appdeploy_system_id: true }),
      ]);
      const customers = new Map<string, any>();
      for (const p of profilesPage.items) customers.set(String(p.__appdeploy_ddb_id || p.id), { userId: String(p.__appdeploy_ddb_id || p.id), name: p.name || 'عميل رهف', phone: p.phone || '', ordersCount: 0, totalSpent: 0, lastOrderAt: '' });
      for (const o of ordersPage.items) {
        if (!o.userId) continue;
        const c = customers.get(o.userId) || { userId: o.userId, name: o.customerName || 'عميل رهف', phone: o.phone || '', ordersCount: 0, totalSpent: 0, lastOrderAt: '' };
        c.ordersCount += 1;
        c.totalSpent += Number(o.total || 0);
        if (!c.lastOrderAt || o.createdAt > c.lastOrderAt) c.lastOrderAt = o.createdAt;
        if (!c.phone && o.phone) c.phone = o.phone;
        if (!c.name && o.customerName) c.name = o.customerName;
        customers.set(o.userId, c);
      }
      return json({ items: [...customers.values()].sort((a, b) => (b.lastOrderAt || '').localeCompare(a.lastOrderAt || '')) });
    },
  ],
  'PUT /api/admin/orders/:id/eta': [
    requireAuth(),
    admin,
    async ctx => {
      const value = String(obj(ctx.body).estimatedDeliveryAt || '');
      if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value + 'T12:00:00')))) return error('تاريخ التوصيل غير صحيح', 400);
      const [old] = await db.get<any>('orders', [ctx.params.id], { consistent: true });
      if (!old) return error('الطلب غير موجود', 404);
      const [ok] = await db.update('orders', [{ id: ctx.params.id, record: { ...old, estimatedDeliveryAt: value } }]);
      if (ok && old.userId && value) await createNotification(old.userId, 'موعد توصيل طلبك', 'الموعد المتوقع لتوصيل طلبك هو ' + value, ctx.params.id);
      return ok ? json({ ok: true, estimatedDeliveryAt: value }) : error('تعذر حفظ موعد التوصيل', 500);
    },
  ],
});
