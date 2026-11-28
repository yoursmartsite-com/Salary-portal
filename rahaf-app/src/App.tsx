import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, api, notifications as pushNotifications } from './services';
import {
  Search, ShoppingBag, Heart, UserRound, Package, Menu, X, ArrowLeft,
  Sparkles, Plus, Minus, Trash2, LogOut, ShieldCheck, Truck, Check, Bell, CheckCheck,
  LayoutDashboard, Pencil, Camera, Instagram, ArrowUpLeft
} from 'lucide-react';

type Product = { id: string; name: string; description: string; price: number; category: string; sizes: string[]; sizePrices?: Record<string, number>; imageUrl?: string; imagePath?: string; demo?: boolean };
type Order = { id: string; customerName: string; phone: string; address: string; items: { productId?: string; name: string; size: string; qty: number; price?: number }[]; total: number; status: string; createdAt: string; paymentMethod?: string; estimatedDeliveryAt?: string };
type CartItem = { id: string; name: string; size: string; qty: number; price: number };
type StoreNotification = { id: string; title: string; body: string; type: string; orderId?: string; createdAt: string; readAt?: string | null };
const fmt = (n: number) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(n);
const labels: Record<string, string> = { new: 'طلب جديد', confirmed: 'تم التأكيد', preparing: 'جاري التجهيز', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };
const categoryName = (c: string) => c === 'men' ? 'رجالي' : c === 'women' ? 'حريمي' : 'للجميع';
const priceForSize = (product: Product, selectedSize: string) => Number(product.sizePrices?.[selectedSize] ?? product.price);
const startingPrice = (product: Product) => Math.min(product.price, ...Object.values(product.sizePrices || {}).map(Number).filter(value => Number.isFinite(value) && value > 0));

function App() {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [accessReason, setAccessReason] = useState('');
  const [activationCode, setActivationCode] = useState(() => localStorage.getItem('rahaf-activation-code') || '');
  const [codeInput, setCodeInput] = useState(() => localStorage.getItem('rahaf-activation-code') || '');
  const [activationBusy, setActivationBusy] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState('all');
  const [notifications, setNotifications] = useState<StoreNotification[]>([]);
  const [notificationFilter, setNotificationFilter] = useState('all');
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [page, setPage] = useState('home');
  const pageRef = useRef(page);
  const navigationRef = useRef<string[]>(['home']);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => {
    const initialState = { rahafNavigation: true, stack: ['home'] };
    window.history.pushState(initialState, '', window.location.href);
    const handleBack = (event: PopStateEvent) => {
      const state = event.state;
      if (state?.rahafNavigation && Array.isArray(state.stack)) {
        const previousStack = state.stack as string[];
        navigationRef.current = previousStack.length ? previousStack : ['home'];
        const previousPage = navigationRef.current[navigationRef.current.length - 1] || 'home';
        setSelected(null);
        setMobileMenu(false);
        setPage(previousPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (previousPage === 'home') {
          window.history.pushState({ rahafNavigation: true, stack: ['home'] }, '', window.location.href);
        }
        return;
      }
      if (navigationRef.current.length > 1) {
        navigationRef.current = navigationRef.current.slice(0, -1);
        setPage(navigationRef.current[navigationRef.current.length - 1] || 'home');
      }
      window.history.pushState({ rahafNavigation: true, stack: navigationRef.current }, '', window.location.href);
    };
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, []);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [size, setSize] = useState('50 مل');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [sizePricesText, setSizePricesText] = useState('16 مل:95,22 مل:125,30 مل:165,50 مل:245,100 مل:420');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('unisex');
  const [sizes, setSizes] = useState('16 مل,22 مل,30 مل,50 مل,100 مل');
  const [image, setImage] = useState<File | null>(null);
  const [editing, setEditing] = useState('');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);
  const [savedAddressDraft, setSavedAddressDraft] = useState('');
  const [notifyOrders, setNotifyOrders] = useState(true);
  const [notifyOffers, setNotifyOffers] = useState(false);
  const [pushPermission, setPushPermission] = useState('unknown');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [customerStateOwner, setCustomerStateOwner] = useState('');
  const [reviews, setReviews] = useState<any>({ items: [], average: 0, count: 0 });
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [etaDrafts, setEtaDrafts] = useState<Record<string, string>>({});
  useEffect(() => { if (!user?.email) return; try { setSavedAddresses(JSON.parse(localStorage.getItem('rahaf-addresses-' + user.email) || '[]')); setNotifyOrders(localStorage.getItem('rahaf-notify-orders-' + user.email) !== 'false'); setNotifyOffers(localStorage.getItem('rahaf-notify-offers-' + user.email) === 'true'); } catch { setSavedAddresses([]); } }, [user?.email]);
  useEffect(() => {
    const captureInstallPrompt = (event: any) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const clearInstallPrompt = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    window.addEventListener('appinstalled', clearInstallPrompt);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(new URL(import.meta.env.BASE_URL + 'service-worker.js', window.location.origin).toString()).catch(() => undefined);
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
      window.removeEventListener('appinstalled', clearInstallPrompt);
    };
  }, []);
  useEffect(() => {
    if (!user) { setPushPermission('unknown'); return; }
    pushNotifications.getEnvironment()
      .then(env => setPushPermission(!env.isSupported ? 'unsupported' : env.permission))
      .catch(() => setPushPermission('unsupported'));
  }, [user?.userId]);
  const admin = user?.email?.toLowerCase() === 'fibrahem865@gmail.com';
  // Delivered orders leave the admin work queue, but remain in customer history and store totals.
  const visibleOrders = admin ? orders.filter(order => order.status !== 'delivered') : orders;

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3000); };
  async function activateRahaf() {
    const code = codeInput.trim().toUpperCase();
    if (!code) {
      flash('اكتب كود التشغيل الصادر من OMNIX');
      return;
    }
    setActivationBusy(true);
    try {
      const result = await api.post('/api/rahaf/validate', { code });
      if (result.data.allowed === true) {
        localStorage.setItem('rahaf-activation-code', code);
        setActivationCode(code);
        setAccessAllowed(true);
        setAccessReason('active');
        flash('تم تفعيل رهف بنجاح');
      } else {
        setAccessAllowed(false);
        setAccessReason(result.data.reason || 'invalid_code');
        flash(result.data.reason === 'expired' ? 'انتهت مدة الاشتراك' : result.data.reason === 'paused' ? 'الاشتراك أو التطبيق موقوف من OMNIX' : 'الكود غير صحيح أو غير صالح لرهف');
      }
    } catch {
      setAccessAllowed(false);
      setAccessReason('verification_service_error');
      flash('تعذر الاتصال بمركز OMNIX. حاول مرة أخرى');
    } finally {
      setActivationBusy(false);
    }
  }
  async function installRahafApp() {
    if (!installPrompt) {
      flash('لتثبيت رهف: افتح قائمة Chrome ⋮ ثم اختار تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية.');
      return;
    }
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } finally {
      setInstallPrompt(null);
    }
  }
  async function loadProducts() {
    try { const result = await api.get('/api/products'); setProducts(result.data.items || []); }
    catch { flash('تعذر تحميل العطور حالياً'); }
  }
  async function loadOrders() {
    if (!user) return;
    try { const result = await api.get(admin ? '/api/admin/orders' : '/api/orders'); setOrders(result.data.items || []); }
    catch { flash('تعذر تحميل الطلبات'); }
  }
  async function loadCustomerProfile() {
    if (!user) return;
    try {
      const result = await api.get('/api/profile');
      setProfileName(result.data.profile?.name || user.name || '');
      setProfilePhone(result.data.profile?.phone || user.phoneNumber || '');
      setProfileAvatar(result.data.profile?.avatarUrl || '');
    } catch {
      setProfileName(user.name || '');
      setProfilePhone(user.phoneNumber || '');
    }
  }
  async function saveCustomerProfile() {
    if (!profileName.trim()) { flash('اكتب اسمك الأول'); return; }
    if (profilePhone.trim() && !/^[0-9+()\\s-]{7,20}$/.test(profilePhone.trim())) { flash('راجع رقم الموبايل'); return; }
    setProfileLoading(true);
    try {
      let avatarBase64 = '';
      let avatarContentType = '';
      if (profileImage) {
        avatarBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(profileImage);
        });
        avatarContentType = profileImage.type;
      }
      const result = await api.put('/api/profile', { name: profileName.trim(), phone: profilePhone.trim(), avatarBase64, avatarContentType });
      setProfileAvatar(result.data.profile?.avatarUrl || profileAvatar);
      setProfileImage(null);
      setUser((current: any) => current ? { ...current, name: profileName.trim() } : current);
      flash('تم حفظ بيانات ملفك الشخصي');
    } catch (error: any) {
      flash(error?.response?.data?.message || 'تعذر حفظ الملف الشخصي');
    } finally {
      setProfileLoading(false);
    }
  }
  async function loadNotifications() {
    if (!user) return;
    setNotificationsBusy(true);
    try { const result = await api.get('/api/notifications'); setNotifications(result.data.items || []); }
    catch { flash('تعذر تحميل الإشعارات'); }
    finally { setNotificationsBusy(false); }
  }
  async function markNotificationRead(item: StoreNotification) {
    if (!item.readAt) {
      try { await api.put('/api/notifications/' + item.id + '/read', {}); await loadNotifications(); }
      catch { flash('تعذر تحديث الإشعار'); return; }
    }
    if (item.orderId) go('orders');
  }
  async function enablePushNotifications() {
    try {
      const env = await pushNotifications.getEnvironment();
      if (!env.isSupported) {
        setPushPermission('unsupported');
        flash('المتصفح الحالي لا يدعم إشعارات الموبايل. افتح رهف من Chrome.');
        return;
      }
      await pushNotifications.subscribe();
      if (admin) await api.post('/api/push/admin/subscribe', {});
      const updated = await pushNotifications.getEnvironment();
      setPushPermission(updated.permission);
      flash(admin ? 'تم تفعيل إشعارات الموبايل للمدير والطلبات الجديدة' : 'تم تفعيل إشعارات الطلبات على موبايلك');
    } catch (error: any) {
      flash(error?.message || 'تعذر تفعيل إشعارات الموبايل');
    }
  }
  async function markAllNotificationsRead() {
    try { await api.post('/api/notifications/read-all', {}); await loadNotifications(); flash('تم تحديد كل الإشعارات كمقروءة'); }
    catch { flash('تعذر تحديث الإشعارات'); }
  }
  useEffect(() => {
    (async () => { try { setUser(await auth.getUser()); } catch { /* session unavailable */ } finally { setReady(true); } })();
    loadProducts();
  }, []);
  useEffect(() => {
    let alive = true;
    const checkAccess = async () => {
      try {
        const result = await api.post('/api/app-access', { code: activationCode });
        if (alive) {
          setAccessAllowed(result.data.allowed === true);
          setAccessReason(result.data.reason || '');
        }
      } catch {
        if (alive) {
          setAccessAllowed(false);
          setAccessReason('verification_service_error');
        }
      } finally {
        if (alive) setAccessChecked(true);
      }
    };
    checkAccess();
    const timer = window.setInterval(checkAccess, 30000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [activationCode]);
  useEffect(() => { if (user) { loadOrders(); loadNotifications(); loadCustomerProfile(); setCustomerStateOwner(''); api.get('/api/customer-state').then(result => { setCart(Array.isArray(result.data.cart) ? result.data.cart : []); setFavorites(Array.isArray(result.data.favorites) ? result.data.favorites : []); setCustomerStateOwner(user.userId); }).catch(() => { setCustomerStateOwner(''); flash('تعذر تحميل الشنطة والمفضلة المحفوظة'); }); } else { setNotifications([]); setProfileName(''); setProfilePhone(''); setProfileAvatar(''); setCustomerStateOwner(''); setCart([]); setFavorites([]); } }, [user?.userId]);
  useEffect(() => { if (!user?.userId || customerStateOwner !== user.userId) return; api.put('/api/customer-state', { cart, favorites }).catch(() => flash('تعذر مزامنة الشنطة والمفضلة')); }, [cart, favorites, user?.userId, customerStateOwner]);
  useEffect(() => { if (page === 'customers' && admin) api.get('/api/admin/customers').then(result => setCustomers(result.data.items || [])).catch(() => flash('تعذر تحميل العملاء')); }, [page, admin]);
  useEffect(() => { if (!selected) { setReviews({ items: [], average: 0, count: 0 }); return; } api.get('/api/products/' + selected.id + '/reviews').then(result => setReviews(result.data)).catch(() => setReviews({ items: [], average: 0, count: 0 })); }, [selected?.id]);
  useEffect(() => { if (page === 'notifications' && user) loadNotifications(); }, [page, user]);
  const unreadNotifications = notifications.filter(item => !item.readAt).length;
  const visibleNotifications = notifications.filter(item => notificationFilter === 'all' || (notificationFilter === 'unread' ? !item.readAt : item.type === 'order'));
  const visible = useMemo(() => products.filter(p => (category === 'all' || p.category === category) && (!query || p.name.toLowerCase().includes(query.toLowerCase()))), [products, category, query]);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const go = (next: string) => {
    if (next !== pageRef.current) {
      const nextStack = [...navigationRef.current, next];
      navigationRef.current = nextStack;
      window.history.pushState({ rahafNavigation: true, stack: nextStack }, '', window.location.href);
    }
    setPage(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openProduct = (product: Product) => { setSelected(product); setSize(product.sizes?.[0] || '50 مل'); };
  async function signIn() { try { await auth.signInWithRedirect(); } catch (error: any) { flash(error.message || 'تعذر تسجيل الدخول'); } }
  async function signOut() { await auth.signOut(); setUser(null); go('home'); }
  function add(product: Product) {
    setCart(old => [...old, { id: product.id, name: product.name, size, qty: 1, price: priceForSize(product, size) }]);
    flash('اتضاف العطر لشنطتك — تقدر تختار عطر تاني');
  }
  async function saveProduct() {
    if (!name.trim() || !Number(price) || Number(price) <= 0) { flash('اكتب الاسم والسعر بشكل صحيح'); return; }
    setBusy(true);
    try {
      let imagePath = '';
      if (image) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(image);
        });
        const upload = await api.post('/api/admin/upload', { base64, contentType: image.type }); imagePath = upload.data.path;
      }
      const parsedSizePrices = Object.fromEntries(sizePricesText.split(',').map(part => part.split(':').map(value => value.trim())).filter(pair => pair.length === 2 && pair[0] && Number(pair[1]) > 0).map(([sizeName, amount]) => [sizeName, Number(amount)]));
      const body = { name, description, price: Number(price), category: kind, sizes: sizes.split(',').map(v => v.trim()).filter(Boolean), sizePrices: parsedSizePrices, imagePath };
      if (editing) await api.put('/api/admin/products/' + editing, body); else await api.post('/api/admin/products', body);
      setName(''); setPrice(''); setDescription(''); setImage(null); setEditing('');
      await loadProducts(); flash('اتحفظت بيانات العطر');
    } catch (error: any) { flash(error?.response?.data?.message || 'تعذر الحفظ'); }
    finally { setBusy(false); }
  }
  async function placeOrder() {
    if (!user) { flash('سجل الدخول لإتمام الطلب'); return; }
    if (!customer.trim() || !phone.trim() || !address.trim()) { flash('اكمل بيانات التوصيل'); return; }
    setBusy(true);
    try {
      await api.post('/api/orders', { items: cart.map(item => ({ productId: item.id, size: item.size, qty: item.qty })), customerName: customer, phone, address, activationCode });
      setCart([]); await loadOrders(); await loadNotifications(); go('orders'); flash('تم استلام طلبك — الدفع عند الاستلام');
    } catch (error: any) { flash(error?.response?.data?.message || 'تعذر إرسال الطلب'); }
    finally { setBusy(false); }
  }
    async function changeStatus(id: string, status: string) {
    try { await api.put('/api/admin/orders/' + id, { status }); await loadOrders(); flash('تم تحديث حالة الطلب'); }
    catch { flash('تعذر تحديث حالة الطلب'); }
  }
  async function cancelOrder(id: string) {
    if (!confirm('تأكيد إلغاء الطلب؟')) return;
    try { await api.put('/api/orders/' + id + '/cancel', {}); await loadOrders(); flash('تم إلغاء الطلب'); }
    catch (error: any) { flash(error?.response?.data?.message || 'تعذر إلغاء الطلب'); }
  }
  function reorder(order: Order) {
    const entries = order.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return product ? { id: product.id, name: product.name, size: item.size, qty: item.qty, price: priceForSize(product, item.size) } : null;
    });
    if (entries.some(item => !item)) { flash('بعض عطور الطلب لم تعد متاحة لإعادة الطلب'); return; }
    setCart(old => [...old, ...entries.filter(Boolean) as CartItem[]]);
    go('cart');
    flash('تمت إضافة منتجات الطلب إلى الشنطة');
  }
  async function removeProduct(id: string) {
    if (!confirm('متأكد إنك عايز تحذف العطر؟')) return;
    try { await api.delete('/api/admin/products/' + id); await loadProducts(); flash('تم حذف العطر'); }
    catch { flash('تعذر الحذف'); }
  }

  const nav = [
    { id: 'home', label: 'الرئيسية', icon: Sparkles },
    { id: 'favorites', label: 'المفضلة', icon: Heart },
    { id: 'cart', label: 'الشنطة', icon: ShoppingBag },
    { id: 'orders', label: 'طلباتي', icon: Package },
    { id: 'account', label: 'حسابي', icon: UserRound },
    ...(admin ? [{ id: 'admin', label: 'الإدارة', icon: LayoutDashboard }, { id: 'customers', label: 'العملاء', icon: UserRound }] : [])
  ];

  if (!ready || !accessChecked) return <div className="boot-screen"><span className="boot-monogram">R.</span><p>RAHAF</p><small>عطور بتسيب أثر</small></div>;

  const ProductCard = ({ product, index }: { product: Product; index: number }) => (
    <motion.article className="product-card group" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .45, delay: (index % 4) * .06 }}>
      <div className="product-media">
        <span className="product-index">R / {String(index + 1).padStart(2, '0')}</span>
        <button className={'favorite-button ' + (favorites.includes(product.id) ? 'favorite-on' : '')} onClick={() => setFavorites(old => old.includes(product.id) ? old.filter(id => id !== product.id) : [...old, product.id])} aria-label="المفضلة"><Heart size={17} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /></button>
        <button className="product-open" onClick={() => openProduct(product)}>
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <div className="bottle-placeholder"><span>R</span><small>EAU DE PARFUM</small></div>}
          <span className="product-hover">التفاصيل <ArrowUpLeft size={15} /></span>
        </button>
      </div>
      <div className="product-meta"><span>{categoryName(product.category)} · {product.demo ? 'منتج تجريبي' : 'RAHAF'}</span><button onClick={() => openProduct(product)}>{product.name}</button><div><b>{product.demo ? 'من ' : ''}{fmt(startingPrice(product))}</b><button className="round-arrow" onClick={() => openProduct(product)} aria-label="عرض التفاصيل"><ArrowLeft size={16} /></button></div></div>
    </motion.article>
  );

  return (
    <div className="rahaf-app" dir="rtl">
      {!accessAllowed && <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(10,9,8,.97)', display: 'grid', placeItems: 'center', padding: 24 }}><form onSubmit={event => { event.preventDefault(); activateRahaf(); }} style={{ width: 'min(100%, 430px)', border: '1px solid #b99754', borderRadius: 22, padding: 28, background: 'linear-gradient(145deg,#211b12,#0e0d0b)', color: '#f4e7c9', textAlign: 'center', boxShadow: '0 25px 90px #000' }}><div style={{ fontSize: 12, letterSpacing: 5, color: '#c7a86a' }}>RAHAF PERFUMES</div><h2 style={{ fontSize: 27, margin: '18px 0 8px' }}>تفعيل تطبيق رهف</h2><p style={{ color: '#c6b99e', lineHeight: 1.8 }}>أدخل كود التشغيل المخصص لرهف والصادر من OMNIX CENTRAL CONTROL.</p><input value={codeInput} onChange={event => setCodeInput(event.target.value.toUpperCase())} autoComplete="off" placeholder="RAH-XXXXXX-XXXXXX" aria-label="كود تشغيل رهف" style={{ boxSizing: 'border-box', width: '100%', padding: 15, margin: '10px 0', border: '1px solid #8d754d', borderRadius: 12, background: '#100e0b', color: '#f4e7c9', textAlign: 'center', direction: 'ltr', letterSpacing: 1, fontWeight: 700 }} /><button type="submit" disabled={activationBusy} style={{ width: '100%', padding: 15, border: 0, borderRadius: 12, background: '#c6a66a', color: '#17120a', fontWeight: 800, opacity: activationBusy ? .65 : 1 }}>{activationBusy ? 'جاري التحقق...' : 'تفعيل ومتابعة'}</button><p style={{ color: '#c6b99e', fontSize: 13, minHeight: 22 }}>{accessReason === 'expired' ? 'انتهت مدة الاشتراك. اطلب تجديده من OMNIX.' : accessReason === 'paused' ? 'الاشتراك أو التطبيق موقوف من OMNIX.' : accessReason === 'not_started' ? 'موعد بداية الاشتراك لم يحن بعد.' : accessReason === 'verification_service_error' ? 'تعذر الاتصال بمركز OMNIX. حاول مرة أخرى.' : accessReason === 'wrong_application' ? 'الكود مخصص لتطبيق آخر.' : accessReason === 'invalid_code' ? 'الكود غير صحيح. راجع الكود وحاول مرة أخرى.' : 'يتم التحقق من صلاحية الاشتراك مباشرة من OMNIX.'}</p><small style={{ display: 'block', color: '#9f927a', marginTop: 10 }}>RAHAF · OMNIX CENTRAL CONTROL</small></form></div>}
      <div className="top-ribbon"><span>توصيل لباب البيت</span><i /> <span>الدفع عند الاستلام</span><i /> <span>اختاري عطرك وخلي الأثر علينا</span></div>
      <header className="main-header">
        <button className="mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="القائمة">{mobileMenu ? <X /> : <Menu />}</button>
        <button className="wordmark" onClick={() => go('home')}><span className="wordmark-symbol">R.</span><span><b>RAHAF</b><small>PERFUME HOUSE</small></span></button>
        <label className="market-search"><Search size={18} /><input aria-label="ابحث عن عطر" placeholder="ابحث عن العطر اللي بتحبه..." value={query} onChange={event => { setQuery(event.target.value); if (page !== 'home') go('home'); }} /></label>
        <nav className={'main-nav ' + (mobileMenu ? 'nav-open' : '')}>{nav.map(item => <button key={item.id} className={page === item.id ? 'nav-current' : ''} onClick={() => go(item.id)}>{item.label}</button>)}</nav>
        <div className="header-actions">
          <button onClick={() => go('favorites')} aria-label="المفضلة"><Heart size={19} /><sup>{favorites.length || ''}</sup></button>
          <button onClick={() => go('cart')} aria-label="الشنطة"><ShoppingBag size={19} /><sup>{count || ''}</sup></button>
          <button className="notification-bell" onClick={() => go('notifications')} aria-label="الإشعارات" title="الإشعارات"><Bell size={19} /><sup>{unreadNotifications > 0 ? unreadNotifications : ''}</sup></button>
          <button className="header-login" onClick={() => go('account')}><UserRound size={17} /><span>{user ? 'حسابي' : 'دخول'}</span></button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.main key={page} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .28 }}>
          {page === 'home' && <>
            <section className="hero-section">
              <div className="hero-content">
                <div className="hero-label"><span /> THE SCENT OF YOU</div>
                <h1>مش مجرد<br /><em>ريحة حلوة.</em></h1>
                <p>في عطور بتعدّي… وفي عطور بتفضل في الذاكرة. اكتشف مجموعتنا واختار الرائحة اللي تحكي عنك.</p>
                <div className="hero-actions"><button className="button-dark" onClick={() => document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' })}>اكتشف المجموعة <ArrowLeft size={17} /></button><span>اختيارات بتشبهك، وتفاصيل بتفرق.</span></div>
                <div className="hero-footnote"><b>01</b><span /> <small>RAHAF SIGNATURE COLLECTION</small></div>
              </div>
              <div className="hero-image-wrap">
                <div className="hero-orbit orbit-a" /><div className="hero-orbit orbit-b" />
                <div className="hero-photo-frame"><img src="https://media.masonry.so/t/blog/ai-perfume-product-photography/seedream.png?w=800" alt="زجاجة عطر بتصوير فاخر" /></div>
                <div className="hero-side-note">EAU DE PARFUM <span>—</span> MADE TO BE REMEMBERED</div>
                <div className="hero-seal">R<br /><small>رهف</small></div>
              </div>
              <div className="hero-vertical">SCENT IS A LANGUAGE</div>
            </section>

            <section className="benefit-row">
              <div><ShieldCheck /><span><b>اختيارات موثوقة</b><small>جودة نهتم بتفاصيلها</small></span></div>
              <div><Truck /><span><b>توصيل لحد عندك</b><small>اطلب من مكانك</small></span></div>
              <div><ShoppingBag /><span><b>الدفع عند الاستلام</b><small>اطلب براحة واطمئنان</small></span></div>
              <div><Sparkles /><span><b>بصمتك الخاصة</b><small>عطر يليق بحضورك</small></span></div>
            </section>

            <section className="category-area">
              <div className="section-intro"><div><small>CHOOSE YOUR MOOD</small><h2>كل شخصية… <em>ولها عطرها.</em></h2></div><p>ابدأ من العالم الأقرب لذوقك.</p></div>
              <div className="category-cards">
                <button className="category-card cat-male" onClick={() => { setCategory('men'); document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' }); }}><small>01 / FOR HIM</small><b>رجالي</b><span>حضور واثق من أول رشة</span><i className="category-symbol male-symbol">♂</i></button>
                <button className="category-card cat-female" onClick={() => { setCategory('women'); document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' }); }}><small>02 / FOR HER</small><b>حريمي</b><span>نعومة تفضل في الذاكرة</span><i className="category-symbol female-symbol">♀</i></button>
                <button className="category-card cat-shared" onClick={() => { setCategory('unisex'); document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' }); }}><small>03 / SHARED</small><b>للجميع</b><span>ذوق ملوش حدود</span><i className="category-symbol shared-symbol">∞</i></button>
              </div>
            </section>

            <section className="collection-area" id="collection">
              <div className="section-intro collection-title"><div><small>THE RAHAF EDIT</small><h2>اختيارات <em>رهف</em></h2><p>مش بنختار عطور كتير… بنختار اللي يستاهل.</p></div><button className="plain-link" onClick={() => { setCategory('all'); setQuery(''); }}>كل العطور <ArrowLeft size={16} /></button></div>
              <div className="collection-toolbar"><div className="filter-tabs">{[['all', 'الكل'], ['men', 'رجالي'], ['women', 'نسائي'], ['unisex', 'مشترك']].map(([value, label]) => <button key={value} className={category === value ? 'tab-active' : ''} onClick={() => setCategory(value)}>{label}</button>)}</div><label className="search-control"><Search size={17} /><input placeholder="دور على عطرك..." value={query} onChange={event => setQuery(event.target.value)} /></label></div>
              {visible.length ? <div className="products-grid">{visible.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : <div className="empty-panel"><span>R.</span><b>{products.length ? 'مفيش نتائج مطابقة' : 'المجموعة بتتجهز'}</b><p>{products.length ? 'جرّب كلمة تانية أو تصنيف مختلف.' : 'قريباً هتلاقي هنا اختيارات رهف.'}</p></div>}
            </section>
            <section className="quote-section"><span className="quote-mark">“</span><small>MORE THAN A FRAGRANCE</small><h2>سيب انطباع…<br /><em>من غير ما تقول كلمة.</em></h2><p>RAHAF — MADE TO BE REMEMBERED</p></section>
          </>}

          {page === 'favorites' && <section className="content-page"><PageHeading eyebrow="YOUR SAVED SCENTS" title={<>حاجات <em>عجبتك.</em></>} subtitle="كل الروائح اللي حبيت ترجع لها، في مكان واحد." />{products.filter(product => favorites.includes(product.id)).length ? <div className="products-grid">{products.filter(product => favorites.includes(product.id)).map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : <Empty icon={<Heart />} title="لسه مفيش مفضلة" detail="لما يعجبك عطر، دوس على القلب واحفظه هنا." action={() => go('home')} actionText="اكتشف العطور" />}</section>}

          {page === 'cart' && <section className="content-page"><PageHeading eyebrow="YOUR BAG" title={<>شنطتك <em>المختارة.</em></>} subtitle="راجع اختياراتك قبل ما نوصّلها لحد عندك." />{!cart.length ? <Empty icon={<ShoppingBag />} title="الشنطة لسه فاضية" detail="اختار أول عطر وخلي الباقي علينا." action={() => go('home')} actionText="ابدأ التسوق" /> : <div className="checkout-layout"><div className="cart-list">{cart.map((item, index) => <article className="cart-item" key={index}><div className="cart-monogram">R.</div><div className="cart-item-info"><small>{item.size} · RAHAF</small><b>{item.name}</b><strong>{fmt(item.price)}</strong><div className="quantity-stepper"><button onClick={() => setCart(old => old.map((entry, i) => i === index ? { ...entry, qty: Math.max(1, entry.qty - 1) } : entry))}><Minus size={13} /></button><span>{item.qty}</span><button onClick={() => setCart(old => old.map((entry, i) => i === index ? { ...entry, qty: entry.qty + 1 } : entry))}><Plus size={13} /></button></div></div><button className="delete-item" onClick={() => setCart(old => old.filter((_, i) => i !== index))}><Trash2 size={17} /></button></article>)}</div><aside className="summary-panel"><small>ORDER SUMMARY</small><h3>ملخص حسابك</h3><div><span>عدد القطع</span><b>{count}</b></div><div><span>التوصيل</span><b>يحدد عند التأكيد</b></div><div className="summary-total"><span>الإجمالي</span><b>{fmt(total)}</b></div><p className="cod-note"><Truck size={17} /> الدفع عند الاستلام</p><div className="delivery-form"><h4>بيانات التوصيل</h4><input placeholder="الاسم بالكامل" value={customer} onChange={event => setCustomer(event.target.value)} /><input placeholder="رقم الهاتف" value={phone} onChange={event => setPhone(event.target.value)} /><textarea placeholder="العنوان بالتفصيل" value={address} onChange={event => setAddress(event.target.value)} /><button className="button-dark full-button" disabled={busy} onClick={placeOrder}>{busy ? 'جاري إرسال الطلب...' : 'تأكيد الطلب'} <ArrowLeft size={17} /></button>{!user && <small className="muted-hint">سجّل الدخول قبل إتمام الطلب.</small>}</div></aside></div>}</section>}

          {page === 'account' && <section className="content-page narrow-content"><PageHeading eyebrow="YOUR RAHAF ACCOUNT" title={<>أهلاً <em>{user?.name || 'بيك'}.</em></>} subtitle="كل تفاصيل حسابك وتجربتك مع رهف في مكان واحد." />{user ? <><div className="account-profile"><div className="account-avatar">{(user.name || user.email || 'R').slice(0, 1).toUpperCase()}</div><div><h2>{user.name || 'عميل رهف'}</h2><p>{user.email}</p><small>{orders.length} طلب · {favorites.length} عطر في المفضلة</small></div><button onClick={() => go('orders')}>طلباتي <ArrowLeft size={16}/></button></div><div className="account-groups"><section className="account-group"><small>حسابي</small><button className="account-link" onClick={() => go('profile')}> <UserRound/> الملف الشخصي <span>الاسم والبريد الإلكتروني</span><ArrowLeft/></button><button className="account-link" onClick={() => go('orders')}><Package/> طلباتي وتتبع الشحن <span>{orders.length} طلب مسجل</span><ArrowLeft/></button><button className="account-link" onClick={() => go('favorites')}><Heart/> المفضلة <span>{favorites.length} عطر محفوظ</span><ArrowLeft/></button><button className="account-link" onClick={() => go('notifications')}><Bell/> مركز الإشعارات <span>{unreadNotifications ? unreadNotifications + ' جديد' : 'كل التحديثات'}</span><ArrowLeft/></button>{admin && <><button className="account-link" onClick={() => go('admin')}><LayoutDashboard/> إدارة المتجر <ArrowLeft/></button><button className="account-link" onClick={() => go('customers')}><UserRound/> العملاء <span>سجل العملاء ومشترياتهم</span><ArrowLeft/></button></>}</section><section className="account-group"><small>التوصيل والتفضيلات</small><div className="account-address-box"><b>عناوين التوصيل المحفوظة</b><p>احفظ عنوانك لتستخدمه عند الطلب القادم. العناوين محفوظة على هذا الجهاز.</p><div className="address-entry"><input aria-label="عنوان جديد" placeholder="اكتب العنوان بالتفصيل" value={savedAddressDraft} onChange={e => setSavedAddressDraft(e.target.value)}/><button className="button-dark" onClick={() => { if (!savedAddressDraft.trim()) { flash('اكتب العنوان الأول'); return; } const next = [...savedAddresses, savedAddressDraft.trim()]; setSavedAddresses(next); localStorage.setItem('rahaf-addresses-' + user.email, JSON.stringify(next)); setSavedAddressDraft(''); flash('تم حفظ العنوان على جهازك'); }}>حفظ العنوان</button></div>{savedAddresses.length ? savedAddresses.map((item, index) => <div className="saved-address" key={index}><span>{item}</span><button onClick={() => { const next = savedAddresses.filter((_, i) => i !== index); setSavedAddresses(next); localStorage.setItem('rahaf-addresses-' + user.email, JSON.stringify(next)); }}>حذف</button></div>) : <small className="account-muted">لا توجد عناوين محفوظة حتى الآن.</small>}</div><div className="account-address-box"><b>إشعارات الموبايل</b><p>{pushPermission === 'granted' ? 'إذن الإشعارات متاح على هذا الجهاز.' : pushPermission === 'denied' ? 'الإشعارات محظورة من إعدادات المتصفح. اسمح بها من إعدادات الموقع.' : pushPermission === 'unsupported' ? 'افتح التطبيق من Chrome على الموبايل لتفعيل الإشعارات.' : 'فعّل الإشعارات عشان توصلك تحديثات الطلب حتى لو التطبيق مش مفتوح.'}</p><button className="button-dark full-button" onClick={enablePushNotifications} disabled={pushPermission === 'unsupported'}>{pushPermission === 'granted' ? 'تأكيد / ربط هذا الجهاز بالإشعارات' : 'تفعيل إشعارات الموبايل'} <Bell size={16}/></button></div><div className="account-address-box"><b>الإشعارات والتحديثات</b><p>تحكم في تفضيلات التذكير على هذا الجهاز.</p><label className="preference-row"><span>تذكير بمتابعة حالة الطلب</span><input type="checkbox" checked={notifyOrders} onChange={e => { setNotifyOrders(e.target.checked); localStorage.setItem('rahaf-notify-orders-' + user.email, String(e.target.checked)); }}/></label><label className="preference-row"><span>عروض وأخبار رهف</span><input type="checkbox" checked={notifyOffers} onChange={e => { setNotifyOffers(e.target.checked); localStorage.setItem('rahaf-notify-offers-' + user.email, String(e.target.checked)); }}/></label></div></section><section className="account-group"><small>الدعم والأمان</small><div className="account-help"><b>محتاج مساعدة؟</b><p>تقدر تراجع تفاصيل طلبك من صفحة «طلباتي». لو فيه مشكلة في طلب قائم، جهّز رقم الطلب وتواصل مع المتجر من قناة التواصل الرسمية.</p><button onClick={() => go('orders')}>عرض طلباتي <ArrowLeft size={15}/></button></div><button className="account-link" onClick={() => flash('بيانات الدخول وإدارة كلمة المرور تتم من مزود تسجيل الدخول.') }><ShieldCheck/> الخصوصية وأمان الحساب <span>إدارة الدخول من مزود الحساب</span><ArrowLeft/></button><button className="account-link signout-link" onClick={signOut}><LogOut/> تسجيل الخروج <ArrowLeft/></button></section></div></> : <div className="account-card"><div className="account-avatar"><UserRound/></div><h2>نورت رهف</h2><p>سجّل الدخول عشان تتابع طلباتك وتستخدم مميزات حسابك.</p><button className="button-dark full-button" onClick={signIn}>تسجيل الدخول <ArrowLeft/></button></div>}</section>}

          {page === 'profile' && user && <section className="content-page narrow-content"><PageHeading eyebrow="PERSONAL PROFILE" title={<>ملفك <em>الشخصي.</em></>} subtitle="حدّث اسمك ورقم موبايلك وصورتك، وبياناتك هتفضل محفوظة في حسابك." /><div className="account-card profile-editor"><div className="profile-photo-wrap"><div className="account-avatar profile-avatar">{profileAvatar ? <img src={profileAvatar} alt="صورتك الشخصية" /> : profileName.slice(0, 1).toUpperCase() || <UserRound />}</div><label className="profile-photo-button"><Camera size={16}/><span>{profileImage ? 'تم اختيار الصورة' : 'تغيير الصورة'}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0] || null; if (file && file.size > 3 * 1024 * 1024) { flash('الصورة لازم تكون أقل من 3 ميجا'); return; } setProfileImage(file); if (file) setProfileAvatar(URL.createObjectURL(file)); }} /></label></div><label className="profile-field"><span>الاسم بالكامل</span><input value={profileName} onChange={event => setProfileName(event.target.value)} placeholder="اكتب اسمك" maxLength={80}/></label><label className="profile-field"><span>رقم الموبايل</span><input value={profilePhone} onChange={event => setProfilePhone(event.target.value)} placeholder="01xxxxxxxxx" inputMode="tel" maxLength={20}/></label><label className="profile-field"><span>البريد الإلكتروني</span><input value={user.email || ''} readOnly/><small>البريد مرتبط بمزود تسجيل الدخول ولا يتغير من هنا.</small></label><button className="button-dark full-button" onClick={saveCustomerProfile} disabled={profileLoading}>{profileLoading ? 'جاري حفظ التعديلات...' : 'حفظ التعديلات'} <Check size={17}/></button><button className="profile-back" onClick={() => go('account')}>الرجوع إلى حسابي <ArrowLeft size={16}/></button></div></section>}

          {page === 'notifications' && <section className="content-page"><PageHeading eyebrow="RAHAF NOTIFICATIONS" title={<>كل جديد <em>يوصلك.</em></>} subtitle="تابع تأكيد طلبك وتغيّر حالته من مكان واحد." />{!user ? <Empty icon={<UserRound/>} title="سجّل الدخول الأول" detail="إشعارات طلباتك بتظهر هنا بعد تسجيل الدخول." action={signIn} actionText="تسجيل الدخول"/> : <><div className="notifications-toolbar"><div className="notification-tabs">{[['all','الكل'],['unread','غير مقروء'],['orders','تحديثات الطلبات']].map(([key,label])=><button key={key} className={notificationFilter===key?'active':''} onClick={()=>setNotificationFilter(key)}>{label}<b>{key==='all'?notifications.length:key==='unread'?unreadNotifications:notifications.filter(n=>n.type==='order').length}</b></button>)}</div><button className="mark-all-read" disabled={!unreadNotifications} onClick={markAllNotificationsRead}><CheckCheck size={15}/> تحديد الكل كمقروء</button></div>{notificationsBusy ? <div className="notification-empty"><Bell/><b>بنحمّل إشعاراتك...</b></div> : visibleNotifications.length ? <div className="notification-list">{visibleNotifications.map(item=><article key={item.id} className={'notification-card '+(!item.readAt?'notification-unread':'')}><button className="notification-open" onClick={()=>markNotificationRead(item)}><span className="notification-icon"><Package size={19}/></span><span className="notification-copy"><b>{item.title}</b><span>{item.body}</span><small>{new Date(item.createdAt).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'})}</small></span><span className="notification-indicator">{!item.readAt&&<i/>}<ArrowLeft size={16}/></span></button></article>)}</div> : <div className="notification-empty"><Bell/><b>{notificationFilter==='unread'?'مفيش إشعارات جديدة':'لسه مفيش إشعارات'}</b><p>{notificationFilter==='unread'?'كل تحديثاتك اتقرت.':'أي تحديث جديد على طلباتك هيظهر هنا.'}</p>{notificationFilter!=='all'&&<button className="button-dark" onClick={()=>setNotificationFilter('all')}>عرض كل الإشعارات</button>}</div>}</>}</section>}

          {page === 'orders' && <section className="content-page"><PageHeading eyebrow="ORDER JOURNAL" title={<>حكاية <em>طلباتك.</em></>} subtitle={admin ? 'تابع الطلبات وحدّث حالة كل طلب.' : 'كل طلباتك وتفاصيلها في مكان واحد.'} />{!user ? <Empty icon={<UserRound />} title="سجّل الدخول الأول" detail="عشان تقدر تشوف سجل طلباتك." action={signIn} actionText="تسجيل الدخول" /> : orders.length === 0 ? <Empty icon={<Package />} title="مفيش طلبات لسه" detail="أول عطر من رهف مستنيك." action={() => go('home')} actionText="اكتشف المجموعة" /> : <><div className="orders-toolbar"><div className="orders-filter-tabs">{[['all','كل الطلبات'],['active','الحالية'],['done','المكتملة'],['cancelled','الملغاة']].map(([key,label]) => <button key={key} className={orderFilter === key ? 'selected' : ''} onClick={() => setOrderFilter(key)}>{label}<b>{key === 'all' ? visibleOrders.length : visibleOrders.filter(o => key === 'cancelled' ? o.status === 'cancelled' : key === 'done' ? o.status === 'delivered' : !['delivered','cancelled'].includes(o.status)).length}</b></button>)}</div></div><div className="orders-grid">{visibleOrders.filter(order => orderFilter === 'all' || (orderFilter === 'cancelled' ? order.status === 'cancelled' : orderFilter === 'done' ? order.status === 'delivered' : !['delivered','cancelled'].includes(order.status))).map(order => <article className="order-panel" key={order.id}><div className="order-heading"><div><small>ORDER / {order.id.slice(-6)}</small><b>{order.customerName}</b></div><span className={'order-status status-' + order.status}>{labels[order.status] || order.status}</span></div><div className="order-meta"><span><Package size={14}/> {new Date(order.createdAt).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'})}</span><span><Truck size={14}/> {order.phone}</span></div><div className="order-address"><b>عنوان التوصيل</b><span>{order.address}</span>{order.estimatedDeliveryAt && <span className="order-eta">موعد التوصيل المتوقع: {new Date(order.estimatedDeliveryAt + 'T12:00:00').toLocaleDateString('ar-EG',{dateStyle:'long'})}</span>}</div><div className="order-lines"><b>تفاصيل المنتجات</b>{order.items?.map((item, index) => <div className="order-line-item" key={index}><span>{item.name}<small>{item.size} · كمية {item.qty}</small></span><b>{fmt((item.price || 0) * item.qty)}</b></div>)}</div><div className="order-payment"><span>طريقة الدفع</span><b>الدفع عند الاستلام</b><strong>الإجمالي: {fmt(order.total)}</strong></div><div className="order-tracking"><small>مراحل الطلب</small><div className="tracking-steps">{['new','confirmed','preparing','shipped','delivered'].map((step, index) => <span key={step} className={order.status === 'cancelled' ? '' : (['new','confirmed','preparing','shipped','delivered'].indexOf(order.status) >= index ? 'step-done' : '')}><i>{index + 1}</i><b>{labels[step]}</b></span>)}</div>{order.status === 'cancelled' && <b className="cancelled-note">تم إلغاء الطلب</b>}</div><div className="order-bottom"><b>{fmt(order.total)}</b>{admin && <select value={order.status} onChange={event => changeStatus(order.id, event.target.value)}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>}</div>{admin && <label className="eta-editor">موعد التوصيل المتوقع<input type="date" value={etaDrafts[order.id] ?? order.estimatedDeliveryAt ?? ''} onChange={event => setEtaDrafts(old => ({ ...old, [order.id]: event.target.value }))}/><button onClick={async () => { try { await api.put('/api/admin/orders/' + order.id + '/eta', { estimatedDeliveryAt: etaDrafts[order.id] ?? order.estimatedDeliveryAt ?? '' }); await loadOrders(); flash('تم حفظ موعد التوصيل'); } catch { flash('تعذر حفظ موعد التوصيل'); } }}>حفظ الموعد</button></label>}<div className="order-actions">{!admin && ['new','confirmed'].includes(order.status) && <button className="order-cancel" onClick={() => cancelOrder(order.id)}>إلغاء الطلب</button>}{!admin && order.items?.length > 0 && order.items.every(item => !!item.productId && products.some(p => p.id === item.productId)) && <button className="order-reorder" onClick={() => reorder(order)}>إعادة الطلب <ShoppingBag size={15}/></button>}</div></article>)}</div>{visibleOrders.filter(order => orderFilter === 'all' || (orderFilter === 'cancelled' ? order.status === 'cancelled' : orderFilter === 'done' ? order.status === 'delivered' : !['delivered','cancelled'].includes(order.status))).length === 0 && <Empty icon={<Package/>} title="مفيش طلبات في القسم ده" detail="اختار تصنيف تاني لمشاهدة طلباتك." action={() => setOrderFilter('all')} actionText="كل الطلبات"/>}</>}</section>}

          {page === 'customers' && admin && <section className="content-page"><PageHeading eyebrow="CUSTOMER DIRECTORY" title={<>عملاء <em>رهف.</em></>} subtitle="سجل العملاء وعدد طلباتهم وإجمالي مشترياتهم." />{customers.length ? <div className="customers-grid">{customers.map(customer => <article className="customer-panel" key={customer.userId}><div className="customer-panel-head"><b>{customer.name}</b><span>{customer.ordersCount} طلب</span></div><p>{customer.phone || 'رقم الموبايل غير مسجل'}</p><div><span>إجمالي المشتريات</span><b>{fmt(customer.totalSpent)}</b></div>{customer.lastOrderAt && <small>آخر طلب: {new Date(customer.lastOrderAt).toLocaleDateString('ar-EG')}</small>}</article>)}</div> : <Empty icon={<UserRound/>} title="لسه مفيش عملاء مسجلين" detail="العملاء هيظهروا هنا بعد تسجيل الطلبات." action={() => go('admin')} actionText="العودة للإدارة"/>}</section>}
          {page === 'admin' && admin && <section className="content-page"><PageHeading eyebrow="STORE MANAGEMENT" title={<>إدارة <em>رهف.</em></>} subtitle="إضافة العطور وتحديث المجموعة ومتابعة الطلبات." /><div className="admin-overview">
            <div className="admin-stat"><small>إجمالي العطور</small><b>{products.length}</b><span>منتج في المجموعة</span></div>
            <div className="admin-stat"><small>كل الطلبات</small><b>{orders.length}</b><span>طلب مسجل</span></div>
            <div className="admin-stat"><small>طلبات قيد المتابعة</small><b>{orders.filter(order => ['new','confirmed','preparing','shipped'].includes(order.status)).length}</b><span>تحتاج متابعة</span></div>
            <div className="admin-stat"><small>طلبات تم تسليمها</small><b>{orders.filter(order => order.status === 'delivered').length}</b><span>اكتملت بنجاح</span></div>
          </div>
          <div className="admin-shortcuts"><span>إدارة الطلبات وتحديث حالتها من صفحة الطلبات.</span><button className="button-dark" onClick={() => go('orders')}>فتح إدارة الطلبات <ArrowLeft size={16}/></button></div>
          <div className="admin-layout"><div className="admin-form"><small>{editing ? 'EDIT PRODUCT' : 'NEW PRODUCT'}</small><h3>{editing ? 'تعديل العطر' : 'عطر جديد للمجموعة'}</h3><input placeholder="اسم العطر" value={name} onChange={event => setName(event.target.value)} /><input placeholder="أقل سعر بالجنيه (افتراضي)" type="number" value={price} onChange={event => setPrice(event.target.value)} /><textarea placeholder="أسعار الأحجام: 16 مل:95,22 مل:125,30 مل:165,50 مل:245,100 مل:420" value={sizePricesText} onChange={event => setSizePricesText(event.target.value)} /><textarea placeholder="وصف العطر" value={description} onChange={event => setDescription(event.target.value)} /><select value={kind} onChange={event => setKind(event.target.value)}><option value="men">رجالي</option><option value="women">نسائي</option><option value="unisex">مشترك</option></select><input value={sizes} onChange={event => setSizes(event.target.value)} placeholder="الأحجام مفصولة بفاصلة" /><label className="image-upload"><Camera /><span>{image ? image.name : 'اختار صورة العطر'}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setImage(event.target.files?.[0] || null)} /></label><button className="button-dark full-button" disabled={busy} onClick={saveProduct}>{busy ? 'جاري الحفظ...' : 'حفظ العطر'} <Check /></button>{editing && <button className="cancel-edit" onClick={() => { setEditing(''); setName(''); setPrice(''); setDescription(''); setImage(null); }}>إلغاء التعديل</button>}</div><div className="admin-inventory"><div className="inventory-heading"><h3>المخزون الحالي</h3><span>{products.length} عطر</span></div>{products.map(product => <div className="inventory-item" key={product.id}><div className="inventory-thumb">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : 'R.'}</div><div><b>{product.name}</b><small>{fmt(product.price)} · {categoryName(product.category)}</small></div><button onClick={() => { setEditing(product.id); setName(product.name); setPrice(String(product.price)); setSizePricesText(Object.entries(product.sizePrices || {}).map(([sizeName, amount]) => sizeName + ':' + amount).join(',')); setDescription(product.description); setKind(product.category); setSizes(product.sizes.join(',')); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil size={16} /></button><button onClick={() => removeProduct(product.id)}><Trash2 size={16} /></button></div>)}</div></div></section>}
        </motion.main>
      </AnimatePresence>

      <footer className="site-footer"><div className="footer-upper"><div className="footer-brand"><span className="wordmark-symbol">R.</span><b>RAHAF</b><small>PERFUME HOUSE</small><p>مش مجرد ريحة حلوة… دي حكاية بتفضل.</p></div><div><small>DISCOVER</small><button onClick={() => go('home')}>المجموعة</button><button onClick={() => go('favorites')}>المفضلة</button><button onClick={() => go('orders')}>طلباتي</button></div><div><small>THE EXPERIENCE</small><p>الدفع عند الاستلام</p><p>توصيل لباب البيت</p><p>اختيارات بعناية</p></div><div className="footer-install"><small>RAHAF ON YOUR PHONE</small><b>خلي رهف دايمًا معاك</b><p>ثبّت التطبيق على موبايلك وارجع لعطورك بسهولة.</p><button className="footer-install-button" onClick={installRahafApp}><Package size={16} /> تثبيت تطبيق رهف</button></div><div className="footer-social"><small>FOLLOW THE SCENT</small><Instagram /></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} RAHAF PERFUME HOUSE</span><span>صُنع بذوق… ليليق بك</span></div></footer>
      <nav className="mobile-nav">{nav.filter(item => item.id !== 'admin' || admin).map(item => <button key={item.id} className={page === item.id ? 'mobile-active' : ''} onClick={() => go(item.id)}><item.icon size={19} /><small>{item.label}</small>{item.id === 'cart' && count > 0 && <i>{count}</i>}</button>)}</nav>

      <AnimatePresence>{selected && <motion.div className="product-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}><motion.div className="product-dialog" initial={{ y: 24, opacity: 0, scale: .98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0 }} onClick={event => event.stopPropagation()}><button className="dialog-close" onClick={() => setSelected(null)}><X /></button><div className="dialog-image">{selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} /> : <div className="bottle-placeholder"><span>R</span><small>EAU DE PARFUM</small></div>}</div><div className="dialog-info"><small>{categoryName(selected.category)} · RAHAF COLLECTION</small><h2>{selected.name}</h2><p>{selected.description || 'اختار عطرك المميز وسيب انطباعك يتكلم.'}</p><b className="dialog-price">{fmt(priceForSize(selected, size))}</b><label>اختار الحجم</label><div className="size-choices">{(selected.sizes || ['50 مل']).map(value => <button key={value} className={size === value ? 'size-selected' : ''} onClick={() => setSize(value)}>{value}</button>)}</div><>{selected.demo && <div className="demo-only-note">منتج تجريبي للاختبار — الطلبات عليه تجريبية وليست للبيع الفعلي.</div>}<button className="button-dark full-button" onClick={() => add(selected)}>ضيفه للشنطة <ShoppingBag size={17} /></button></><small className="dialog-cod"><ShieldCheck /> الدفع عند الاستلام متاح</small><section className="product-reviews"><div className="reviews-heading"><b>تقييمات العملاء</b><span>{reviews.count ? reviews.average + ' / 5 · ' + reviews.count + ' تقييم' : 'لسه مفيش تقييمات'}</span></div>{reviews.items?.map((review: any) => <article className="review-item" key={review.id || review.__appdeploy_ddb_id}><b>{review.customerName || 'عميل رهف'} · {'★'.repeat(review.rating || 0)}</b><p>{review.text || 'تقييم بدون تعليق'}</p></article>)}{user && <div className="review-form"><b>استلمت العطر؟ شاركنا رأيك</b><select value={reviewRating} onChange={event => setReviewRating(Number(event.target.value))}><option value={5}>5 نجوم</option><option value={4}>4 نجوم</option><option value={3}>3 نجوم</option><option value={2}>نجمتان</option><option value={1}>نجمة واحدة</option></select><textarea value={reviewText} onChange={event => setReviewText(event.target.value)} placeholder="اكتب تجربتك مع العطر..."/><button className="button-dark full-button" onClick={async () => { try { await api.post('/api/products/' + selected.id + '/reviews', { rating: reviewRating, text: reviewText }); const result = await api.get('/api/products/' + selected.id + '/reviews'); setReviews(result.data); setReviewText(''); flash('شكراً لتقييمك'); } catch (error: any) { flash(error?.response?.data?.message || 'التقييم متاح بعد استلام العطر'); } }}>إرسال التقييم</button></div>}</section></div></motion.div></motion.div>}</AnimatePresence>
      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: React.ReactNode; subtitle: string }) {
  return <div className="page-heading"><small>{eyebrow}</small><h1>{title}</h1><p>{subtitle}</p></div>;
}
function Empty({ icon, title, detail, action, actionText }: { icon: React.ReactNode; title: string; detail: string; action: () => void; actionText: string }) {
  return <div className="empty-state"><div>{icon}</div><b>{title}</b><p>{detail}</p><button className="button-dark" onClick={action}>{actionText} <ArrowLeft size={16} /></button></div>;
}
export default App;
