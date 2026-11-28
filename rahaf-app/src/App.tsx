import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, api, notifications as pushNotifications } from '@appdeploy/client';
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
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
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
      const result = await api.post('/api/app-access', { code });
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