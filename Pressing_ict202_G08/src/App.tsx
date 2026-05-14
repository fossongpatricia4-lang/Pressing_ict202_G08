import { ChangeEvent, FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteGarment,
  getBusinesses,
  getGarments,
  getSettings,
  replaceGarments,
  saveBusiness,
  saveGarment,
  saveSettings,
} from './db';
import { copy } from './i18n';
import type { AppSettings, Business, Garment, GarmentStatus, Language, PaymentMethod, PaymentStatus } from './types';

const blankBusiness = {
  name: '',
  email: '',
  password: '',
  phone: '',
  address: '',
};

const blankGarment = {
  name: '',
  category: 'Chemise',
  color: '',
  size: '',
  clientName: '',
  clientPhone: '',
  price: 0,
  rentalPrice: 0,
  paymentStatus: 'unpaid' as PaymentStatus,
  paymentMethod: 'cash' as PaymentMethod,
  availableForRent: true,
  status: 'dirty' as GarmentStatus,
  image: '',
  notes: '',
  dueDate: '',
};

const statusKeys: GarmentStatus[] = ['clean', 'dirty', 'washing', 'rented', 'repair'];
const categories = ['Chemise', 'Robe', 'Costume', 'Pantalon', 'Boubou', 'Veste', 'Drap', 'Autre'];
const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'King'];
const paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'cash' },
  { value: 'card', label: 'card' },
  { value: 'mobile', label: 'mobile' },
];

function getSuggestedPrice(size: string): number | null {
  const normalized = size.trim().toLowerCase();
  const map: Record<string, number> = {
    xs: 1800,
    s: 2200,
    m: 2600,
    l: 3000,
    xl: 3400,
    xxl: 3800,
    king: 4200,
  };
  return map[normalized] ?? null;
}
type DemoSample = [string, string, string, string, string, string, number, number, boolean, GarmentStatus, string];

const VISUAL_ASSETS = {
  backgroundImage: new URL('../image3.avif', import.meta.url).href,
  headerImage: new URL('../image3.avif', import.meta.url).href,
};

const DEMO_IMAGE_LINKS = {
  dress: 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=900&q=80',
  suit: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=900&q=80',
  boubou: 'https://images.unsplash.com/photo-1612423284934-2850a4ea6b0f?auto=format&fit=crop&w=900&q=80',
  jacket: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80',
  sheet: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
  shirt: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=900&q=80',
};

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function todayIso() {
  return new Date().toISOString();
}

function formatDuration(fromIso: string, now: Date) {
  const diff = Math.max(0, now.getTime() - new Date(fromIso).getTime());
  return formatSpan(diff);
}

function formatSpan(milliseconds: number) {
  const diff = Math.max(0, milliseconds);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${days}j ${hours}h ${minutes}m ${seconds}s`;
}

function isDemoGarment(garment: Garment) {
  return garment.id.startsWith('demo-');
}

function readFile(file?: File): Promise<string> {
  if (!file) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>({ language: 'fr', theme: 'light' });
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [businessForm, setBusinessForm] = useState(blankBusiness);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [authMessage, setAuthMessage] = useState('');
  const [garmentForm, setGarmentForm] = useState(blankGarment);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GarmentStatus | 'all'>('all');
  const [historyWidth, setHistoryWidth] = useState(330);
  const [selectedGarment, setSelectedGarment] = useState<Garment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [now, setNow] = useState(new Date());
  const [washMinutes, setWashMinutes] = useState(20);
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const t = copy[settings.language];
  const activeBusiness = businesses.find((item) => item.id === settings.activeBusinessId);
  const hasDemoGarments = garments.some(
    (garment) => garment.businessId === settings.activeBusinessId && isDemoGarment(garment),
  );

  useEffect(() => {
    Promise.all([getSettings(), getBusinesses(), getGarments()]).then(([loadedSettings, loadedBusinesses, loadedGarments]) => {
      setSettings(loadedSettings);
      setBusinesses(loadedBusinesses);
      setGarments(loadedGarments);
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedGarment(null);
    setShowForm(false);
    resetGarmentForm();
  }, [settings.activeBusinessId]);

  const businessGarments = useMemo(
    () => settings.activeBusinessId ? garments.filter((garment) => garment.businessId === settings.activeBusinessId) : [],
    [garments, settings.activeBusinessId],
  );

  useEffect(() => {
    const limit = washMinutes * 60000;
    const finished = businessGarments.filter(
      (garment) => garment.status === 'washing' && now.getTime() - new Date(garment.updatedAt).getTime() >= limit,
    );
    if (finished.length === 0) return;

    const completedAt = todayIso();
    const completed = finished.map((garment) => ({
      ...garment,
      status: 'clean' as GarmentStatus,
      updatedAt: completedAt,
      history: [
        { id: uid(), date: completedAt, status: 'clean' as GarmentStatus, note: t.autoWashed },
        ...garment.history,
      ],
    }));

    Promise.all(completed.map((garment) => saveGarment(garment))).then(() => {
      setGarments((current) => current.map((garment) => completed.find((item) => item.id === garment.id) ?? garment));
      setSelectedGarment((current) => completed.find((item) => item.id === current?.id) ?? current);
    });
  }, [businessGarments, now, washMinutes, t.autoWashed]);

  const visibleGarments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return businessGarments
      .filter((garment) => filter === 'all' || garment.status === filter)
      .filter((garment) => {
        if (!needle) return true;
        return [garment.name, garment.category, garment.clientName, garment.clientPhone, garment.color]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [businessGarments, filter, query]);

  const stats = useMemo(() => {
    const late = businessGarments.filter((garment) => garment.dueDate && garment.dueDate < new Date().toISOString().slice(0, 10) && garment.status !== 'clean');
    return {
      total: businessGarments.length,
      washed: businessGarments.filter((garment) => garment.status === 'clean').length,
      notWashed: businessGarments.filter((garment) => garment.status === 'dirty' || garment.status === 'washing').length,
      rentReady: businessGarments.filter((garment) => garment.availableForRent && garment.status === 'clean').length,
      late: late.length,
      revenue: businessGarments.reduce((sum, garment) => sum + Number(garment.price || 0), 0),
    };
  }, [businessGarments]);

  const historyItems = useMemo(() => {
    return businessGarments
      .flatMap((garment) =>
        garment.history.map((item) => ({
          ...item,
          garmentName: garment.name,
          image: garment.image,
          clientName: garment.clientName,
          garment,
        })),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [businessGarments]);

  async function persistSettings(next: AppSettings) {
    setSettings(next);
    await saveSettings(next);
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    if (businesses.some((item) => item.email.toLowerCase() === businessForm.email.toLowerCase())) {
      setAuthMessage(t.accountExists);
      return;
    }
    const business: Business = { id: uid(), createdAt: todayIso(), ...businessForm };
    await saveBusiness(business);
    const nextBusinesses = [...businesses, business];
    setBusinesses(nextBusinesses);
    setBusinessForm(blankBusiness);
    await persistSettings({ ...settings, activeBusinessId: business.id });
    setAuthMessage(t.accountCreated);
    setMenuOpen(false);
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    const business = businesses.find(
      (item) => item.email.toLowerCase() === loginForm.email.toLowerCase() && item.password === loginForm.password,
    );
    if (business) {
      await persistSettings({ ...settings, activeBusinessId: business.id });
      setLoginForm({ email: '', password: '' });
      setAuthMessage('');
      setMenuOpen(false);
    } else {
      setAuthMessage(t.loginFailed);
    }
  }

  async function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const logo = await readFile(event.target.files?.[0]);
    if (logo) await persistSettings({ ...settings, logo });
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const image = await readFile(event.target.files?.[0]);
    if (image) setGarmentForm((current) => ({ ...current, image }));
  }

  async function handleGarmentSubmit(event: FormEvent) {
    event.preventDefault();
    if (!activeBusiness) return;

    const previous = garments.find((garment) => garment.id === editingId);
    const now = todayIso();
    const history = previous?.history ?? [];
    const statusChanged = previous && previous.status !== garmentForm.status;
    const garment: Garment = {
      id: previous?.id ?? uid(),
      businessId: activeBusiness.id,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      history: statusChanged || !previous
        ? [{ id: uid(), date: now, status: garmentForm.status, note: previous ? 'Statut modifie' : 'Creation' }, ...history]
        : history,
      ...garmentForm,
      price: Number(garmentForm.price),
      rentalPrice: Number(garmentForm.rentalPrice),
    };

    await saveGarment(garment);
    setGarments((current) => [garment, ...current.filter((item) => item.id !== garment.id)]);
    resetGarmentForm();
    setShowForm(false);
  }

  function editGarment(garment: Garment) {
    setShowForm(true);
    setEditingId(garment.id);
    setGarmentForm({
      name: garment.name,
      category: garment.category,
      color: garment.color,
      size: garment.size,
      clientName: garment.clientName,
      clientPhone: garment.clientPhone,
      price: garment.price,
      rentalPrice: garment.rentalPrice,
      paymentStatus: garment.paymentStatus ?? 'unpaid',
      paymentMethod: garment.paymentMethod ?? 'cash',
      availableForRent: garment.availableForRent,
      status: garment.status,
      image: garment.image ?? '',
      notes: garment.notes,
      dueDate: garment.dueDate,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function addFromPlus() {
    resetGarmentForm();
    setShowForm(true);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  function resetGarmentForm() {
    setEditingId(null);
    setGarmentForm(blankGarment);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function quickStatus(garment: Garment, status: GarmentStatus) {
    const next: Garment = {
      ...garment,
      status,
      updatedAt: todayIso(),
      history: [{ id: uid(), date: todayIso(), status, note: 'Action rapide' }, ...garment.history],
    };
    await saveGarment(next);
    setGarments((current) => current.map((item) => (item.id === garment.id ? next : item)));
  }

  async function removeGarment(id: string) {
    await deleteGarment(id);
    setGarments((current) => current.filter((item) => item.id !== id));
  }

  function exportData() {
    const payload = JSON.stringify({ settings, businesses, garments }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `pressing-groupe-8-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text) as { settings?: AppSettings; businesses?: Business[]; garments?: Garment[] };
    if (data.businesses?.length) {
      await Promise.all(data.businesses.map((business) => saveBusiness(business)));
      setBusinesses(await getBusinesses());
    }
    if (data.garments?.length) {
      await replaceGarments(data.garments);
      setGarments(await getGarments());
    }
    if (data.settings) await persistSettings(data.settings);
    setAuthMessage(t.importDone);
  }

  async function seedDemoData() {
    const existingDemo = businesses.find((business) => business.email === 'demo@pressing-g8.cm');
    const business: Business = activeBusiness ?? existingDemo ?? {
      id: uid(),
      name: 'Pressing Rose Groupe 8',
      email: 'demo@pressing-g8.cm',
      password: '123456',
      phone: '699 000 202',
      address: 'Campus UE 202',
      createdAt: todayIso(),
    };
    if (!activeBusiness && !existingDemo) {
      await saveBusiness(business);
      setBusinesses((current) => [...current, business]);
    }
    if (!activeBusiness) await persistSettings({ ...settings, activeBusinessId: business.id });

    const demoGarments = createDemoGarments(business.id);
    await replaceGarments(demoGarments);
    setGarments((current) => [
      ...demoGarments,
      ...current.filter((garment) => !(garment.businessId === business.id && isDemoGarment(garment))),
    ]);
    setAuthMessage(t.demoData);
  }

  async function removeDemoData() {
    const demoGarments = garments.filter(
      (garment) => garment.businessId === settings.activeBusinessId && isDemoGarment(garment),
    );
    await Promise.all(demoGarments.map((garment) => deleteGarment(garment.id)));
    setGarments((current) => current.filter((garment) => !demoGarments.some((demo) => demo.id === garment.id)));
    setSelectedGarment((current) => current && isDemoGarment(current) ? null : current);
    setAuthMessage(t.demoRemoved);
  }

  async function toggleDemoData() {
    if (hasDemoGarments) {
      await removeDemoData();
      return;
    }
    await seedDemoData();
  }

  function startResize(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resizeHistory(event: PointerEvent<HTMLDivElement>) {
    if (event.buttons !== 1) return;
    const next = event.clientX - 24;
    setHistoryWidth(Math.min(520, Math.max(240, next)));
  }

  return (
    <div
      className="app"
      style={{
        ['--app-bg-image' as string]: `url("${VISUAL_ASSETS.backgroundImage}")`,
        ['--header-bg-image' as string]: `url("${VISUAL_ASSETS.headerImage}")`,
      }}
    >
      <header className="topbar">
        <div className="brand">
          <button className="logoBox" onClick={() => logoInput.current?.click()} title={t.logo}>
            {settings.logo ? <img src={settings.logo} alt="Logo" /> : <DefaultLogo />}
          </button>
          <input ref={logoInput} hidden type="file" accept="image/*" onChange={handleLogo} />
          <div>
            <h1>{t.appName}</h1>
            <p>{activeBusiness ? activeBusiness.name : t.login}</p>
          </div>
        </div>
        <div className="toolbar">
          <span className="dbPill">index.db + {t.dbInfo}</span>
          <button onClick={toggleDemoData}>{hasDemoGarments ? t.removeDemo : t.seedDemo}</button>
          <button onClick={exportData}>{t.export}</button>
          <button onClick={() => importInput.current?.click()}>{t.import}</button>
          <input ref={importInput} hidden type="file" accept="application/json" onChange={importData} />
          <button className="menuButton" onClick={() => setMenuOpen((open) => !open)} aria-label={t.settings}>
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      {menuOpen && (
        <aside className="settingsPanel">
          <div className="panelHeader">
            <strong>{t.settings}</strong>
            <button onClick={() => setMenuOpen(false)}>x</button>
          </div>
          <div className="tabs">
            <button className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>{t.register}</button>
            <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>{t.login}</button>
          </div>
          {authMode === 'register' ? (
            <form className="stack" onSubmit={handleRegister}>
              <input required placeholder={t.businessName} value={businessForm.name} onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })} />
              <input required type="email" placeholder={t.email} value={businessForm.email} onChange={(e) => setBusinessForm({ ...businessForm, email: e.target.value })} />
              <input required type="password" placeholder={t.password} value={businessForm.password} onChange={(e) => setBusinessForm({ ...businessForm, password: e.target.value })} />
              <input placeholder={t.phone} value={businessForm.phone} onChange={(e) => setBusinessForm({ ...businessForm, phone: e.target.value })} />
              <input placeholder={t.address} value={businessForm.address} onChange={(e) => setBusinessForm({ ...businessForm, address: e.target.value })} />
              <button className="primary">{t.createAccount}</button>
            </form>
          ) : (
            <form className="stack" onSubmit={handleLogin}>
              <input required type="email" placeholder={t.email} value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
              <input required type="password" placeholder={t.password} value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
              <button className="primary">{t.signIn}</button>
            </form>
          )}
          {authMessage && <p className="notice">{authMessage}</p>}
          <label>{t.language}</label>
          <select value={settings.language} onChange={(e) => persistSettings({ ...settings, language: e.target.value as Language })}>
            <option value="fr">Francais</option>
            <option value="en">English</option>
          </select>
          <label>{t.theme}</label>
          <div className="themeChoices">
            <label className={settings.theme === 'light' ? 'themeChoice active' : 'themeChoice'}>
              <input
                type="checkbox"
                checked={settings.theme === 'light'}
                onChange={() => persistSettings({ ...settings, theme: 'light' })}
              />
              <span>{t.light}</span>
            </label>
            <label className={settings.theme === 'dark' ? 'themeChoice active' : 'themeChoice'}>
              <input
                type="checkbox"
                checked={settings.theme === 'dark'}
                onChange={() => persistSettings({ ...settings, theme: 'dark' })}
              />
              <span>{t.dark}</span>
            </label>
          </div>
          <section className="about">
            <strong>{t.about}</strong>
            <p>{t.aboutText}</p>
          </section>
          <button onClick={() => persistSettings({ ...settings, activeBusinessId: undefined })}>{t.logout}</button>
        </aside>
      )}

      <main style={{ ['--history-width' as string]: `${historyWidth}px` }}>
        {!activeBusiness && <div className="notice wide">{t.pleaseLogin}</div>}
        <section className="statsGrid">
          <article className="stat statTotal">
            <div>
              <span>{t.total}</span>
              <strong>{stats.total}</strong>
            </div>
            <button className="plusButton" onClick={addFromPlus} title={t.addGarment}>+</button>
          </article>
          <Stat label={t.washed} value={stats.washed} />
          <Stat label={t.notWashed} value={stats.notWashed} />
          <Stat label={t.rentReady} value={stats.rentReady} />
          <Stat label={t.late} value={stats.late} />
          <Stat label={t.revenue} value={`${stats.revenue.toLocaleString()} FCFA`} />
        </section>

        <section className="shell">
          <HistoryPanel
            title={t.history}
            empty={t.noHistory}
            selected={selectedGarment}
            items={historyItems}
            t={t}
            onSelect={setSelectedGarment}
            onClose={() => setSelectedGarment(null)}
            onEdit={editGarment}
            onDelete={removeGarment}
            onStatus={quickStatus}
          />
          <div className="splitter" title={t.resizeHint} onPointerDown={startResize} onPointerMove={resizeHistory} />
          <div className={`workspace ${showForm ? '' : 'workspaceFull'}`}>
            {showForm && (
              <form className="formPanel" ref={formRef} onSubmit={handleGarmentSubmit}>
                <div className="formGrid">
                  <input required placeholder={t.name} value={garmentForm.name} onChange={(e) => setGarmentForm({ ...garmentForm, name: e.target.value })} />
                  <select value={garmentForm.category} onChange={(e) => setGarmentForm({ ...garmentForm, category: e.target.value })}>
                    {categories.map((category) => <option key={category}>{category}</option>)}
                  </select>
                  <input placeholder={t.color} value={garmentForm.color} onChange={(e) => setGarmentForm({ ...garmentForm, color: e.target.value })} />
                  <select value={garmentForm.size} onChange={(e) => {
                    const nextSize = e.target.value;
                    const suggestion = getSuggestedPrice(nextSize);
                    setGarmentForm({
                      ...garmentForm,
                      size: nextSize,
                      price: suggestion ?? garmentForm.price,
                    });
                  }}>
                    <option value="">{t.size}</option>
                    {sizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                  {garmentForm.size && getSuggestedPrice(garmentForm.size) !== null && (
                    <small className="hint">
                      {t.suggestedPrice}: {getSuggestedPrice(garmentForm.size)?.toLocaleString()} FCFA
                    </small>
                  )}
                  <input placeholder={t.client} value={garmentForm.clientName} onChange={(e) => setGarmentForm({ ...garmentForm, clientName: e.target.value })} />
                  <input placeholder={t.phone} value={garmentForm.clientPhone} onChange={(e) => setGarmentForm({ ...garmentForm, clientPhone: e.target.value })} />
                  <input type="number" placeholder={t.price} value={garmentForm.price || ''} onChange={(e) => setGarmentForm({ ...garmentForm, price: Number(e.target.value) })} />
                  <input type="number" placeholder={t.rentalPrice} value={garmentForm.rentalPrice || ''} onChange={(e) => setGarmentForm({ ...garmentForm, rentalPrice: Number(e.target.value) })} />
                  <input type="date" value={garmentForm.dueDate} onChange={(e) => setGarmentForm({ ...garmentForm, dueDate: e.target.value })} />
                  <select value={garmentForm.status} onChange={(e) => setGarmentForm({ ...garmentForm, status: e.target.value as GarmentStatus })}>
                    {statusKeys.map((status) => <option value={status} key={status}>{t[status]}</option>)}
                  </select>
                  <select value={garmentForm.paymentStatus} onChange={(e) => setGarmentForm({ ...garmentForm, paymentStatus: e.target.value as PaymentStatus })}>
                    <option value="unpaid">{t.unpaid}</option>
                    <option value="paid">{t.paid}</option>
                  </select>
                  <select value={garmentForm.paymentMethod} onChange={(e) => setGarmentForm({ ...garmentForm, paymentMethod: e.target.value as PaymentMethod })}>
                    {paymentMethodOptions.map((method) => (
                      <option key={method.value} value={method.value}>{t[method.value]}</option>
                    ))}
                  </select>
                </div>
                <label className="checkLine">
                  <input type="checkbox" checked={garmentForm.availableForRent} onChange={(e) => setGarmentForm({ ...garmentForm, availableForRent: e.target.checked })} />
                  {t.available}
                </label>
                <textarea placeholder={t.notes} value={garmentForm.notes} onChange={(e) => setGarmentForm({ ...garmentForm, notes: e.target.value })} />
                <div className="imageRow">
                  <button type="button" onClick={() => fileInput.current?.click()}>{t.image}</button>
                  <input ref={fileInput} hidden type="file" accept="image/*" onChange={handleImage} />
                  {garmentForm.image && <img src={garmentForm.image} alt="" />}
                  <button type="button" onClick={() => { resetGarmentForm(); setShowForm(false); }}>{t.close}</button>
                  <button className="primary" disabled={!activeBusiness}>{editingId ? t.update : t.save}</button>
                </div>
              </form>
            )}

            <section className="listPanel">
              <div className="sectionTitle">
                <h2>{t.inventory}</h2>
                <input className="search" placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="filters">
                <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{t.all}</button>
                {statusKeys.map((status) => (
                  <button className={filter === status ? 'active' : ''} key={status} onClick={() => setFilter(status)}>{t[status]}</button>
                ))}
              </div>
              <div className="columns">
                <GarmentColumn title={t.washed} empty={t.noItems} items={visibleGarments.filter((item) => item.status === 'clean')} t={t} onEdit={editGarment} onDelete={removeGarment} onStatus={quickStatus} onSelect={setSelectedGarment} />
                <GarmentColumn title={t.notWashed} empty={t.noItems} items={visibleGarments.filter((item) => item.status !== 'clean')} t={t} onEdit={editGarment} onDelete={removeGarment} onStatus={quickStatus} onSelect={setSelectedGarment} />
              </div>
            </section>
          </div>
          <TimePanel
            title={t.clock}
            subtitle={t.liveTime}
            label={t.sinceUpdate}
            washLabel={t.washLimit}
            autoInLabel={t.autoIn}
            now={now}
            garments={businessGarments}
            washMinutes={washMinutes}
            onWashMinutesChange={setWashMinutes}
          />
        </section>
      </main>
    </div>
  );
}

function createDemoGarments(businessId: string): Garment[] {
  const now = todayIso();
  const samples: DemoSample[] = [
    ['Robe ceremonie', 'Robe', 'Rose poudree', 'M', 'Amina', '677 120 300', 2500, 9000, true, 'clean', DEMO_IMAGE_LINKS.dress],
    ['Costume homme', 'Costume', 'Noir', 'L', 'M. Njoya', '696 332 100', 3500, 12000, true, 'washing', DEMO_IMAGE_LINKS.suit],
    ['Boubou brode', 'Boubou', 'Blanc', 'XL', 'Clarisse', '650 404 909', 3000, 8000, false, 'dirty', DEMO_IMAGE_LINKS.boubou],
    ['Veste tailleur', 'Veste', 'Fuchsia', 'S', 'Diane', '699 222 111', 2000, 7000, true, 'rented', DEMO_IMAGE_LINKS.jacket],
    ['Drap premium', 'Drap', 'Beige', 'King', 'Hotel UE', '233 000 202', 4500, 0, false, 'repair', DEMO_IMAGE_LINKS.sheet],
    ['Chemise bureau', 'Chemise', 'Bleu ciel', 'M', 'Kevin', '678 333 555', 1200, 3000, true, 'clean', DEMO_IMAGE_LINKS.shirt],
  ];

  return samples.map(([name, category, color, size, clientName, clientPhone, price, rentalPrice, availableForRent, status, image], index) => ({
    id: `demo-${businessId}-${index}`,
    businessId,
    name,
    category,
    color,
    size,
    clientName,
    clientPhone,
    price,
    rentalPrice,
    paymentStatus: index % 3 === 0 ? 'paid' : 'unpaid',
    paymentMethod: index % 3 === 0 ? 'card' : index % 2 === 0 ? 'mobile' : 'cash',
    availableForRent,
    status,
    image,
    notes: index % 2 === 0 ? 'Controle qualite effectue.' : 'Traitement prioritaire.',
    dueDate: new Date(Date.now() + (index - 2) * 86400000).toISOString().slice(0, 10),
    createdAt: now,
    updatedAt: new Date(Date.now() - index * 3600000).toISOString(),
    history: [
      { id: uid(), date: new Date(Date.now() - index * 3600000).toISOString(), status, note: 'Donnee test' },
      { id: uid(), date: new Date(Date.now() - (index + 8) * 3600000).toISOString(), status: 'dirty', note: 'Depot client' },
    ],
  }));
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function DefaultLogo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="logoMark">
      <defs>
        <linearGradient id="logoGrad" x1="10" x2="54" y1="8" y2="58">
          <stop stopColor="#ff8bc8" />
          <stop offset="1" stopColor="#e6007e" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#logoGrad)" />
      <path d="M21 24c0-7 5-12 11-12s11 5 11 12" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path d="M17 25h30l-4 25H21z" fill="#fff" opacity=".92" />
      <path d="M24 34h16M24 41h13" stroke="#e6007e" strokeWidth="4" strokeLinecap="round" />
      <text x="32" y="56" textAnchor="middle" fontSize="12" fontFamily="Arial" fontWeight="900" fill="#fff">G8</text>
    </svg>
  );
}

function TimePanel({
  title,
  subtitle,
  label,
  washLabel,
  autoInLabel,
  now,
  garments,
  washMinutes,
  onWashMinutesChange,
}: {
  title: string;
  subtitle: string;
  label: string;
  washLabel: string;
  autoInLabel: string;
  now: Date;
  garments: Garment[];
  washMinutes: number;
  onWashMinutesChange: (minutes: number) => void;
}) {
  return (
    <aside className="timePanel">
      <div className="clockBox">
        <div>
          <span>{title}</span>
          <strong>{now.toLocaleTimeString()}</strong>
          <p>{now.toLocaleDateString()}</p>
        </div>
        <button
          className="washerButton"
          title={washLabel}
          onClick={() => onWashMinutesChange(washMinutes === 20 ? 30 : washMinutes === 30 ? 45 : 20)}
        >
          <span />
        </button>
      </div>
      <div className="washControl">
        <label>{washLabel}</label>
        <input
          min="1"
          type="number"
          value={washMinutes}
          onChange={(event) => onWashMinutesChange(Math.max(1, Number(event.target.value) || 1))}
        />
        <span>min</span>
      </div>
      <h2>{subtitle}</h2>
      <div className="timeList">
        {garments.map((garment) => {
          const elapsed = now.getTime() - new Date(garment.updatedAt).getTime();
          const remaining = washMinutes * 60000 - elapsed;
          return (
            <article key={garment.id} className={garment.status === 'washing' ? 'timeItem washingItem' : 'timeItem'}>
              <img src={garment.image} alt="" />
              <div>
                <strong>{garment.name}</strong>
                <p>{label}</p>
                <time>{formatDuration(garment.updatedAt, now)}</time>
                {garment.status === 'washing' && <small>{autoInLabel}: {formatSpan(remaining)}</small>}
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function HistoryPanel({
  title,
  empty,
  selected,
  items,
  t,
  onSelect,
  onClose,
  onEdit,
  onDelete,
  onStatus,
}: {
  title: string;
  empty: string;
  selected: Garment | null;
  items: Array<{ id: string; date: string; status: GarmentStatus; note: string; garmentName: string; image?: string; clientName: string; garment: Garment }>;
  t: Record<string, string>;
  onSelect: (garment: Garment) => void;
  onClose: () => void;
  onEdit: (garment: Garment) => void;
  onDelete: (id: string) => void;
  onStatus: (garment: Garment, status: GarmentStatus) => void;
}) {
  return (
    <aside className="historyPanel">
      <h2>{title}</h2>
      {selected && (
        <article className="detailCard">
          <button className="detailClose" onClick={onClose}>{t.close}</button>
          <img src={selected.image} alt={selected.name} />
          <strong>{selected.name}</strong>
          <p>{selected.category} - {selected.color || '-'} - {selected.size || '-'}</p>
          <p>{selected.clientName || t.client} - {selected.clientPhone || t.phone}</p>
          <p>{t.price}: {selected.price.toLocaleString()} FCFA</p>
          <p>{t.rentalPrice}: {selected.rentalPrice.toLocaleString()} FCFA</p>
          <p>{t.paymentMethod}: {t[selected.paymentMethod]}</p>
          <span className={`payBadge ${selected.paymentStatus ?? 'unpaid'}`}>{t[selected.paymentStatus ?? 'unpaid']}</span>
          <div className="miniActions">
            <button onClick={() => onStatus(selected, 'clean')}>L</button>
            <button onClick={() => onStatus(selected, 'dirty')}>NL</button>
            <button onClick={() => onEdit(selected)}>Mod</button>
            <button onClick={() => onDelete(selected.id)}>Sup</button>
          </div>
        </article>
      )}
      {items.length === 0 && <p className="empty">{empty}</p>}
      <div className="timeline">
        {items.map((item) => (
          <article className="historyItem" key={`${item.id}-${item.garmentName}`} onClick={() => onSelect(item.garment)}>
            <div className="historyThumb">{item.image ? <img src={item.image} alt="" /> : item.garmentName.slice(0, 2)}</div>
            <div>
              <strong>{item.garmentName}</strong>
              <p>{t[item.status]} - {item.note}</p>
              <span className={`payBadge ${item.garment.paymentStatus ?? 'unpaid'}`}>{t[item.garment.paymentStatus ?? 'unpaid']}</span>
              <time>{new Date(item.date).toLocaleString()}</time>
              <div className="miniActions" onClick={(event) => event.stopPropagation()}>
                <button onClick={() => onStatus(item.garment, 'clean')}>L</button>
                <button onClick={() => onStatus(item.garment, 'dirty')}>NL</button>
                <button onClick={() => onEdit(item.garment)}>Mod</button>
                <button onClick={() => onDelete(item.garment.id)}>Sup</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function GarmentColumn({
  title,
  empty,
  items,
  t,
  onEdit,
  onDelete,
  onStatus,
  onSelect,
}: {
  title: string;
  empty: string;
  items: Garment[];
  t: Record<string, string>;
  onEdit: (garment: Garment) => void;
  onDelete: (id: string) => void;
  onStatus: (garment: Garment, status: GarmentStatus) => void;
  onSelect: (garment: Garment) => void;
}) {
  return (
    <div className="column">
      <h3>{title}</h3>
      {items.length === 0 && <p className="empty">{empty}</p>}
      {items.map((garment) => (
        <article className="garmentCard" key={garment.id} onClick={() => onSelect(garment)}>
          <div className="photo">{garment.image ? <img src={garment.image} alt={garment.name} /> : <span>{garment.category.slice(0, 2).toUpperCase()}</span>}</div>
          <div className="cardBody">
            <div className="cardTop">
              <strong>{garment.name}</strong>
              <span className={`badge ${garment.status}`}>{t[garment.status]}</span>
            </div>
            <p className="desc">{garment.category} - {garment.color || '-'} - {garment.size || '-'}</p>
            <p className="desc">{garment.clientName || t.client} - {garment.clientPhone || t.phone}</p>
            <div className="priceLine">
              <span>{garment.price.toLocaleString()} FCFA</span>
              <span>{garment.rentalPrice.toLocaleString()} FCFA loc.</span>
            </div>
            <p className="smallInfo">{t.paymentMethod}: {t[garment.paymentMethod]}</p>
            <div className="cardFlags">
              <span>{garment.availableForRent ? t.available : t.unavailable}</span>
              <span className={`payBadge ${garment.paymentStatus ?? 'unpaid'}`}>{t[garment.paymentStatus ?? 'unpaid']}</span>
            </div>
            {garment.dueDate && <p>{t.dueDate}: {garment.dueDate}</p>}
            <div className="miniActions" onClick={(event) => event.stopPropagation()}>
              <button title={t.markClean} onClick={() => onStatus(garment, 'clean')}>L</button>
              <button title={t.markDirty} onClick={() => onStatus(garment, 'dirty')}>NL</button>
              <button title={t.update} onClick={() => onEdit(garment)}>Mod</button>
              <button title={t.delete} onClick={() => onDelete(garment.id)}>Sup</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
