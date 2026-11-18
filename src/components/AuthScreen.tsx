import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Building2,
  Calculator,
  Check,
  ChevronRight,
  CreditCard,
  Layers,
  Lock,
  Mail,
  Menu,
  Radar,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { UA_BANKS, UA_CATEGORIES, UA_MERCHANTS } from '../data/ukrainianCatalog';
import { evaluatePurchase } from '../engine/cashbackEngine';
import { authAndDataService, getCurrentMonthYear } from '../services/authAndDataService';
import type { CashbackRule, ParticipantUser, TaxMode, UserCard } from '../types/domain';
import { CategoryIcon } from './CategoryIcon';

interface AuthScreenProps {
  onAuthenticated: (user: ParticipantUser) => void;
  currentUser?: ParticipantUser | null;
  onContinueToApp?: () => void;
}

interface DemoScenario {
  id: string;
  label: string;
  merchantId: string;
  defaultAmount: number;
  hint: string;
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'silpo',
    label: 'Сільпо',
    merchantId: 'm-silpo',
    defaultAmount: 1250,
    hint: 'Продукти · MCC 5411',
  },
  {
    id: 'avrora',
    label: 'Аврора',
    merchantId: 'm-avrora',
    defaultAmount: 600,
    hint: 'Мультимаркети · MCC 5331',
  },
  {
    id: 'foxtrot',
    label: 'Фокстрот',
    merchantId: 'm-foxtrot',
    defaultAmount: 15000,
    hint: 'Побутова техніка · MCC 5722',
  },
  {
    id: 'okko',
    label: 'ОККО',
    merchantId: 'm-okko',
    defaultAmount: 2400,
    hint: 'Авто та АЗС · MCC 5541',
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    merchantId: 'm-chatgpt',
    defaultAmount: 850,
    hint: 'Штучний інтелект · MCC 5734',
  },
];

const SIMULATOR_AMOUNT_PRESETS = [500, 1250, 3000, 10000];

const DEMO_CARDS: UserCard[] = [
  {
    id: 'preview-mono',
    userId: 'preview',
    bankId: 'monobank',
    cardName: 'Чорна картка',
    taxPercent: 23,
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'preview-pumb',
    userId: 'preview',
    bankId: 'pumb',
    cardName: 'ВсеМожу Online',
    taxPercent: 23,
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'preview-privat',
    userId: 'preview',
    bankId: 'privatbank',
    cardName: 'Універсальна (Привіт)',
    taxPercent: 23,
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'preview-globus',
    userId: 'preview',
    bankId: 'globus',
    cardName: 'GlobusPlus',
    taxPercent: 23,
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  },
];

function buildPreviewRules(monthYear: string): CashbackRule[] {
  const ts = '2026-11-01T00:00:00.000Z';
  return [
    {
      id: 'pr-mono-groc',
      cardId: 'preview-mono',
      userId: 'preview',
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'groceries',
      rateOwnFunds: 2,
      rateCreditFunds: 0.75,
      updatedAt: ts,
    },
    {
      id: 'pr-mono-avrora',
      cardId: 'preview-mono',
      userId: 'preview',
      monthYear,
      ruleType: 'MERCHANT',
      merchantId: 'm-avrora',
      rateOwnFunds: 5,
      rateCreditFunds: 5,
      updatedAt: ts,
    },
    {
      id: 'pr-pumb-groc',
      cardId: 'preview-pumb',
      userId: 'preview',
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'groceries',
      rateOwnFunds: 1.5,
      rateCreditFunds: 3,
      updatedAt: ts,
    },
    {
      id: 'pr-pumb-appl',
      cardId: 'preview-pumb',
      userId: 'preview',
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'appliances',
      rateOwnFunds: 2,
      rateCreditFunds: 4,
      updatedAt: ts,
    },
    {
      id: 'pr-pumb-fuel',
      cardId: 'preview-pumb',
      userId: 'preview',
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'auto_fuel',
      rateOwnFunds: 2,
      rateCreditFunds: 5,
      updatedAt: ts,
    },
    {
      id: 'pr-privat-pharm',
      cardId: 'preview-privat',
      userId: 'preview',
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'pharmacy',
      rateOwnFunds: 3,
      rateCreditFunds: 3,
      updatedAt: ts,
    },
    {
      id: 'pr-globus-all',
      cardId: 'preview-globus',
      userId: 'preview',
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'all_purchases',
      rateOwnFunds: 1,
      rateCreditFunds: 1.5,
      updatedAt: ts,
    },
    {
      id: 'pr-globus-ai',
      cardId: 'preview-globus',
      userId: 'preview',
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'ai',
      rateOwnFunds: 5,
      rateCreditFunds: 5,
      updatedAt: ts,
    },
  ];
}

function formatUah(value: number): string {
  return value.toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2).replace(/\.?0+$/, '')}%`;
}

const LANDING_SECTIONS = [
  { id: 'simulator', label: 'Симулятор' },
  { id: 'features', label: 'Переваги' },
  { id: 'how-it-works', label: 'Як це працює' },
  { id: 'catalog-preview', label: 'Банки та MCC' },
] as const;

export function AuthScreen({
  onAuthenticated,
  currentUser = null,
  onContinueToApp,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNavSection, setActiveNavSection] = useState<string>('simulator');

  // Живий симулятор Поточної покупки на першому екрані
  const [scenarioId, setScenarioId] = useState<string>(DEMO_SCENARIOS[0].id);
  const [simAmount, setSimAmount] = useState<number>(DEMO_SCENARIOS[0].defaultAmount);
  const [simTaxMode, setSimTaxMode] = useState<TaxMode>('NET');

  // Вітрина каталогу (Банки / Категорії)
  const [catalogTab, setCatalogTab] = useState<'banks' | 'categories'>('banks');

  const authPanelRef = useRef<HTMLElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const cloudEnabled = authAndDataService.isCloudEnabled();
  const previewMonth = useMemo(() => getCurrentMonthYear(), []);
  const previewRules = useMemo(() => buildPreviewRules(previewMonth), [previewMonth]);

  const activeScenario = useMemo(
    () => DEMO_SCENARIOS.find((s) => s.id === scenarioId) ?? DEMO_SCENARIOS[0],
    [scenarioId],
  );

  const simEvaluation = useMemo(
    () =>
      evaluatePurchase({
        query: {
          query: activeScenario.label,
          amountUah: simAmount,
          taxMode: simTaxMode,
          selectedMerchantId: activeScenario.merchantId,
        },
        cards: DEMO_CARDS,
        rules: previewRules,
        monthYear: previewMonth,
      }),
    [activeScenario, simAmount, simTaxMode, previewRules, previewMonth],
  );

  const bestSimRec = simEvaluation.recommendations[0] ?? null;
  const secondarySimRecs = simEvaluation.recommendations.slice(1, 4);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  function scrollToAuth(targetMode: 'login' | 'register') {
    setMode(targetMode);
    setError(null);
    setMobileMenuOpen(false);
    authPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      if (targetMode === 'register') {
        nameInputRef.current?.focus();
      } else {
        emailInputRef.current?.focus();
      }
    }, 280);
  }

  function handleNavClick(sectionId: string) {
    setActiveNavSection(sectionId);
    setMobileMenuOpen(false);
  }

  function handleSelectScenario(scenario: DemoScenario) {
    setScenarioId(scenario.id);
    setSimAmount(scenario.defaultAmount);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user =
        mode === 'register'
          ? await authAndDataService.registerParticipant(email, password, displayName)
          : await authAndDataService.loginParticipant(email, password);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Виникла помилка авторизації.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError(null);
    setLoading(true);
    try {
      const user = await authAndDataService.loginWithDemoAccount();
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося увійти у демо-кабінет.');
    } finally {
      setLoading(false);
    }
  }

  const bestFundText =
    bestSimRec === null
      ? ''
      : bestSimRec.bestFundType === 'OWN'
        ? 'Власні кошти'
        : bestSimRec.bestFundType === 'CREDIT'
          ? 'Кредитні кошти'
          : 'Власні або кредитні';

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-zinc-100 focus:px-4 focus:py-2.5 focus:text-xs focus:font-medium focus:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        Перейти до основного вмісту
      </a>

      {/* Флагманська шапка навігації */}
      <header className="sticky top-0 z-40 bg-zinc-950/85 backdrop-blur-xl border-b border-white/[0.07]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a
            href="#simulator"
            onClick={() => handleNavClick('simulator')}
            className="flex items-center gap-2.5 shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <span className="h-9 w-9 rounded-xl bg-zinc-900 border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] flex items-center justify-center">
              <Radar className="h-4.5 w-4.5 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-50 tracking-tight leading-tight">
                КешбекРадар
              </span>
              <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5 leading-tight mt-0.5">
                <span>UA · {previewMonth}</span>
                <span aria-hidden="true">·</span>
                <span className={cloudEnabled ? 'text-emerald-400' : 'text-zinc-400'}>
                  {cloudEnabled ? 'Cloud' : 'Local'}
                </span>
              </span>
            </span>
          </a>

          {/* Основне навігаційне меню */}
          <nav aria-label="Головна навігація" className="hidden lg:flex items-center gap-1 rounded-full bg-zinc-900/90 border border-white/[0.08] p-1">
            {LANDING_SECTIONS.map((sec) => {
              const isCurrent = activeNavSection === sec.id;
              return (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  onClick={() => handleNavClick(sec.id)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`relative px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    isCurrent
                      ? 'bg-zinc-800 text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {isCurrent && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                    )}
                    {sec.label}
                  </span>
                </a>
              );
            })}
          </nav>

          {/* Праві дії входу / переходу в кабінет */}
          <div className="flex items-center gap-2 shrink-0">
            {currentUser && onContinueToApp ? (
              <button
                type="button"
                onClick={onContinueToApp}
                className="group min-h-[40px] pl-4 pr-1.5 rounded-full bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium inline-flex items-center gap-2.5 transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <span>Повернутися в Радар</span>
                <span className="h-7 w-7 rounded-full bg-zinc-950/10 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                </span>
              </button>
            ) : (
              <>
                {!cloudEnabled && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleDemoLogin}
                    className="hidden sm:inline-flex min-h-[40px] px-3.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-200 text-xs font-medium items-center gap-1.5 transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                    <span>Демо-вхід</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => scrollToAuth('login')}
                  className="hidden sm:inline-flex min-h-[40px] px-3.5 rounded-full text-xs font-medium text-zinc-300 hover:text-zinc-50 transition-colors cursor-pointer items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Увійти
                </button>

                <button
                  type="button"
                  onClick={() => scrollToAuth('register')}
                  className="group min-h-[40px] pl-4 pr-1.5 rounded-full bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium inline-flex items-center gap-2 transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <span>Реєстрація</span>
                  <span className="h-7 w-7 rounded-full bg-zinc-950/10 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                </button>
              </>
            )}

            {/* Кнопка мобільного меню */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="landing-mobile-nav"
              aria-label={mobileMenuOpen ? 'Закрити меню навігації' : 'Відкрити меню навігації'}
              className="lg:hidden min-h-[44px] min-w-[44px] rounded-xl bg-zinc-900 border border-white/[0.08] text-zinc-200 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {mobileMenuOpen ? (
                <X className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Menu className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Мобільна навігаційна панель */}
        {mobileMenuOpen && (
          <nav
            id="landing-mobile-nav"
            aria-label="Мобільна навігація"
            className="lg:hidden border-t border-white/[0.07] bg-zinc-950/95 px-4 py-4 space-y-2 animate-radar-enter"
          >
            <div className="grid grid-cols-2 gap-2">
              {LANDING_SECTIONS.map((sec) => {
                const isCurrent = activeNavSection === sec.id;
                return (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    onClick={() => handleNavClick(sec.id)}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-medium flex items-center justify-between transition-colors ${
                      isCurrent
                        ? 'bg-zinc-800/90 border-emerald-500/40 text-zinc-50'
                        : 'bg-zinc-900/70 border-white/[0.07] text-zinc-300 hover:text-zinc-50'
                    }`}
                  >
                    <span>{sec.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-500" strokeWidth={1.75} aria-hidden="true" />
                  </a>
                );
              })}
            </div>
            {!currentUser && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => scrollToAuth('login')}
                  className="min-h-[44px] rounded-xl bg-zinc-900 border border-white/[0.08] text-xs font-medium text-zinc-200 cursor-pointer"
                >
                  Увійти в кабінет
                </button>
                {!cloudEnabled ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleDemoLogin}
                    className="min-h-[44px] rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-medium text-emerald-300 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Демо-вхід
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => scrollToAuth('register')}
                    className="min-h-[44px] rounded-xl bg-zinc-100 text-xs font-medium text-zinc-950 cursor-pointer"
                  >
                    Реєстрація
                  </button>
                )}
              </div>
            )}
          </nav>
        )}
      </header>

      <main id="main-content" className="flex-1">
        {/* СЕКЦІЯ 1: Hero + Живий інтерактивний симулятор */}
        <section
          id="simulator"
          className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-16 sm:pt-14 sm:pb-24"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Ліва колонка: Продуктовий сенс */}
            <div className="lg:col-span-6 space-y-6 animate-radar-enter">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-zinc-900/90 px-3.5 py-1.5 text-xs text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                <span>Фінтех-радар України · {UA_BANKS.length} банків · {UA_CATEGORIES.length} категорій</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.08] text-zinc-50">
                  Точний вибір картки на касі за 2 секунди
                </h1>
                <p className="text-base text-zinc-400 leading-relaxed max-w-[56ch]">
                  Вкажіть українську мережу або категорію витрат та суму оплати. КешбекРадар миттєво
                  порівняє ваші картки окремо за власними та кредитними коштами з урахуванням податку
                  23%.
                </p>
              </div>

              {/* Група основних дій (Button-in-Button CTA) */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {currentUser && onContinueToApp ? (
                  <button
                    type="button"
                    onClick={onContinueToApp}
                    className="group min-h-[48px] pl-5 pr-2 rounded-full bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-medium inline-flex items-center gap-3 transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <span>Відкрити мій Радар вигоди</span>
                    <span className="h-8 w-8 rounded-full bg-zinc-950/10 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                      <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => scrollToAuth('register')}
                      className="group min-h-[48px] pl-5 pr-2 rounded-full bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-medium inline-flex items-center gap-3 transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      <span>Створити власний гаманець</span>
                      <span className="h-8 w-8 rounded-full bg-zinc-950/10 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                        <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                    </button>

                    {!cloudEnabled ? (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleDemoLogin}
                        className="min-h-[48px] px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-200 text-sm font-medium inline-flex items-center gap-2 transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        <Sparkles className="h-4 w-4 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                        <span>{loading ? 'Завантаження...' : 'Швидкий демо-вхід (4 картки)'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => scrollToAuth('login')}
                        className="min-h-[48px] px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-200 text-sm font-medium inline-flex items-center gap-2 transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        <span>Увійти в кабінет</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Фактологічні метрики каталогу */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/[0.07]">
                <div>
                  <div className="text-xl font-mono font-semibold text-zinc-50 tabular-nums">
                    {UA_BANKS.length}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">банків України</div>
                </div>
                <div>
                  <div className="text-xl font-mono font-semibold text-zinc-50 tabular-nums">
                    {UA_CATEGORIES.length}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">категорій витрат</div>
                </div>
                <div>
                  <div className="text-xl font-mono font-semibold text-zinc-50 tabular-nums">
                    {UA_MERCHANTS.length}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">мереж із MCC</div>
                </div>
                <div>
                  <div className="text-xl font-mono font-semibold text-emerald-400 tabular-nums">
                    ×0.77
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">після 23% податку</div>
                </div>
              </div>
            </div>

            {/* Права колонка: Живий інтерактивний симулятор (Double-Bezel) */}
            <div className="lg:col-span-6 w-full">
              <div className="bezel-shell">
                <div className="bezel-core p-4 sm:p-5 space-y-4">
                  {/* Заголовок симулятора */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
                    <div>
                      <div className="text-xs font-medium text-zinc-200">
                        Інтерактивний симулятор поточної покупки
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Реальний рушій розрахунку на прикладі 4 карток
                      </div>
                    </div>

                    <div className="inline-flex rounded-lg bg-zinc-950 p-0.5 border border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => setSimTaxMode('NET')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          simTaxMode === 'NET'
                            ? 'bg-zinc-800 text-zinc-50'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Чистими -23%
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimTaxMode('GROSS')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          simTaxMode === 'GROSS'
                            ? 'bg-zinc-800 text-zinc-50'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Номінал 100%
                      </button>
                    </div>
                  </div>

                  {/* Вибір мережі / сценарію */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>Оберіть магазин для перевірки</span>
                      <span className="font-mono">{activeScenario.hint}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DEMO_SCENARIOS.map((sc) => {
                        const selected = sc.id === scenarioId;
                        return (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => handleSelectScenario(sc)}
                            className={`min-h-[36px] px-3 rounded-xl text-xs font-medium border transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] cursor-pointer ${
                              selected
                                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                                : 'bg-zinc-950 border-white/[0.08] text-zinc-300 hover:border-white/[0.16] hover:text-zinc-100'
                            }`}
                          >
                            {sc.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Вибір суми оплати */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-950/70 border border-white/[0.06] rounded-xl px-3 py-2">
                    <span className="text-xs text-zinc-400">Сума оплати</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {SIMULATOR_AMOUNT_PRESETS.map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setSimAmount(amount)}
                          className={`min-h-[30px] px-2.5 rounded-lg text-xs font-mono tabular-nums border transition-colors cursor-pointer ${
                            simAmount === amount
                              ? 'bg-zinc-800 border-emerald-500/40 text-emerald-300'
                              : 'bg-zinc-900 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {amount.toLocaleString('uk-UA')} ₴
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Картка-переможець (#1 Рекомендація оплати) */}
                  {bestSimRec && (
                    <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.06] overflow-hidden">
                      <div
                        className="h-1 w-full"
                        style={{ backgroundColor: bestSimRec.bank.brandColor }}
                      />
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                              <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                              <span>Рекомендація #1 · {bestFundText}</span>
                            </div>
                            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                              <span className="text-base font-semibold text-zinc-50">
                                {bestSimRec.bank.nameUk}
                              </span>
                              <span className="text-xs text-zinc-400">{bestSimRec.card.cardName}</span>
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              {bestSimRec.matchedTitle}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-2xl font-mono font-semibold text-emerald-400 tabular-nums tracking-tight">
                              +{formatUah(bestSimRec.bestDisplayedCashbackUah)} ₴
                            </div>
                            <div className="text-[11px] font-mono text-zinc-400 tabular-nums">
                              Ставка {formatPercent(bestSimRec.bestRatePercent)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div
                            className={`rounded-xl px-3 py-2 border ${
                              bestSimRec.bestFundType === 'OWN' ||
                              bestSimRec.bestFundType === 'EQUAL'
                                ? 'bg-emerald-500/10 border-emerald-500/35'
                                : 'bg-zinc-950/60 border-white/[0.06]'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] text-zinc-400">
                              <span className="inline-flex items-center gap-1">
                                <Wallet className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                                Власні
                              </span>
                              <span className="font-mono text-zinc-200 tabular-nums">
                                {formatPercent(bestSimRec.ownFunds.ratePercent)}
                              </span>
                            </div>
                            <div className="font-mono text-xs font-semibold text-zinc-100 tabular-nums mt-1">
                              +{formatUah(bestSimRec.ownFunds.displayedCashbackUah)} ₴
                            </div>
                          </div>

                          <div
                            className={`rounded-xl px-3 py-2 border ${
                              bestSimRec.bestFundType === 'CREDIT' ||
                              bestSimRec.bestFundType === 'EQUAL'
                                ? 'bg-emerald-500/10 border-emerald-500/35'
                                : 'bg-zinc-950/60 border-white/[0.06]'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] text-zinc-400">
                              <span className="inline-flex items-center gap-1">
                                <CreditCard className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                                Кредитні
                              </span>
                              <span className="font-mono text-zinc-200 tabular-nums">
                                {formatPercent(bestSimRec.creditFunds.ratePercent)}
                              </span>
                            </div>
                            <div className="font-mono text-xs font-semibold text-zinc-100 tabular-nums mt-1">
                              +{formatUah(bestSimRec.creditFunds.displayedCashbackUah)} ₴
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Альтернативні картки у рейтингу */}
                  <div className="rounded-xl border border-white/[0.06] bg-zinc-950/65 divide-y divide-white/[0.05] overflow-hidden">
                    {secondarySimRecs.map((rec) => (
                      <div
                        key={rec.card.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="h-3 w-1 rounded-full shrink-0"
                            style={{ backgroundColor: rec.bank.brandColor }}
                          />
                          <span className="font-medium text-zinc-200 truncate">
                            {rec.bank.nameUk}
                          </span>
                          <span className="hidden sm:inline text-zinc-500 truncate">
                            {rec.card.cardName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono tabular-nums shrink-0 text-[11px]">
                          <span className="text-zinc-300">
                            Вл. {formatPercent(rec.ownFunds.ratePercent)}: +{formatUah(rec.ownFunds.displayedCashbackUah)} ₴
                          </span>
                          <span className="text-zinc-400">
                            Кр. {formatPercent(rec.creditFunds.ratePercent)}: +{formatUah(rec.creditFunds.displayedCashbackUah)} ₴
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* СЕКЦІЯ 2: Bento-сітка ключових можливостей */}
        <section
          id="features"
          className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 border-t border-white/[0.06]"
        >
          <div className="max-w-2xl space-y-3 mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-zinc-900 px-3 py-1 text-[11px] font-medium text-zinc-300">
              <span>Архітектура розрахунку</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-zinc-50">
              Спроєктовано під реалії українських банків
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
              Замість пам’ятати таблиці відсотків у голові перед кожною оплатою, сервіс зводить
              умови всіх ваших карток в одну чесну рекомендацію.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
            {/* Картка 1: Власні vs Кредитні (7 колонок) */}
            <article className="lg:col-span-7 bezel-shell">
              <div className="bezel-core h-full p-6 flex flex-col justify-between gap-6">
                <div className="space-y-2.5">
                  <div className="h-10 w-10 rounded-xl bg-zinc-950 border border-white/[0.08] flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-50 tracking-tight">
                    Власні та кредитні кошти рахуються окремо
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed max-w-[54ch]">
                    У різних банків вигода за кредитним лімітом і за дебетовим залишком може
                    відрізнятися удвічі. Радар порівнює обидва варіанти й прямо вказує, з якої
                    картки та якими коштами платити.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="rounded-xl bg-zinc-950/80 border border-white/[0.06] p-3.5">
                    <div className="text-[11px] text-zinc-400">Наприклад, monobank · Продукти</div>
                    <div className="mt-1.5 flex items-baseline justify-between font-mono tabular-nums">
                      <span className="text-xs text-zinc-300">Власні кошти</span>
                      <span className="text-sm font-semibold text-emerald-400">2%</span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                      <span className="text-xs text-zinc-500">Кредитні кошти</span>
                      <span className="text-xs text-zinc-400">0.75%</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-950/80 border border-white/[0.06] p-3.5">
                    <div className="text-[11px] text-zinc-400">Наприклад, ПУМБ · Продукти</div>
                    <div className="mt-1.5 flex items-baseline justify-between font-mono tabular-nums">
                      <span className="text-xs text-zinc-500">Власні кошти</span>
                      <span className="text-xs text-zinc-400">1.5%</span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                      <span className="text-xs text-zinc-300">Кредитні кошти</span>
                      <span className="text-sm font-semibold text-emerald-400">3%</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* Картка 2: Податок 23% (5 колонок) */}
            <article className="lg:col-span-5 bezel-shell">
              <div className="bezel-core h-full p-6 flex flex-col justify-between gap-6">
                <div className="space-y-2.5">
                  <div className="h-10 w-10 rounded-xl bg-zinc-950 border border-white/[0.08] flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-50 tracking-tight">
                    Чесний чистий кешбек на руки
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Автоматичне утримання 18% ПДФО та 5% військового збору (разом 23%) або швидке
                    перемикання на номінал для бальних програм.
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-950/80 border border-white/[0.06] p-3.5 font-mono text-xs space-y-1.5 tabular-nums">
                  <div className="flex justify-between text-zinc-400">
                    <span>Брудний кешбек (5% від 1 000 ₴)</span>
                    <span className="text-zinc-200">50.00 ₴</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Податки України (-23%)</span>
                    <span className="text-zinc-400">-11.50 ₴</span>
                  </div>
                  <div className="pt-1.5 border-t border-white/[0.07] flex justify-between font-semibold text-emerald-400">
                    <span>Чистий кешбек</span>
                    <span>+38.50 ₴</span>
                  </div>
                </div>
              </div>
            </article>

            {/* Картка 3: База MCC та мереж (5 колонок) */}
            <article className="lg:col-span-5 bezel-shell">
              <div className="bezel-core h-full p-6 flex flex-col justify-between gap-6">
                <div className="space-y-2.5">
                  <div className="h-10 w-10 rounded-xl bg-zinc-950 border border-white/[0.08] flex items-center justify-center">
                    <Layers className="h-5 w-5 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-50 tracking-tight">
                    Точний пошук за магазином або MCC
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Розпізнає АТБ, Сільпо, Аврору, Rozetka, Comfy, Епіцентр, ОККО, Єва, АНЦ,
                    ChatGPT та показує попередження про змішані термінали.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 font-mono text-[11px] tabular-nums">
                  <span className="rounded-lg bg-zinc-950 border border-white/[0.07] px-2.5 py-1 text-zinc-300">
                    MCC 5411 · Сільпо
                  </span>
                  <span className="rounded-lg bg-zinc-950 border border-white/[0.07] px-2.5 py-1 text-zinc-300">
                    MCC 5331 · Аврора
                  </span>
                  <span className="rounded-lg bg-zinc-950 border border-white/[0.07] px-2.5 py-1 text-zinc-300">
                    MCC 5912 · Аптеки
                  </span>
                </div>
              </div>
            </article>

            {/* Картка 4: Ізоляція та безпека (7 колонок) */}
            <article className="lg:col-span-7 bezel-shell">
              <div className="bezel-core h-full p-6 flex flex-col justify-between gap-6">
                <div className="space-y-2.5">
                  <div className="h-10 w-10 rounded-xl bg-zinc-950 border border-white/[0.08] flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-50 tracking-tight">
                    Повна ізоляція гаманця кожного учасника
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed max-w-[54ch]">
                    Сервіс не потребує доступу до банківських рахунків чи SMS. Учасник самостійно
                    фіксує свої ставки, а дані суворо ізольовані на рівні Row Level Security за
                    ідентифікатором користувача.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="rounded-xl bg-zinc-950/80 border border-white/[0.06] px-3.5 py-2.5 text-zinc-300">
                    Без підключення Open Banking або CVV
                  </div>
                  <div className="rounded-xl bg-zinc-950/80 border border-white/[0.06] px-3.5 py-2.5 text-zinc-300">
                    PBKDF2-HMAC-SHA256 та Supabase RLS
                  </div>
                  <div className="rounded-xl bg-zinc-950/80 border border-white/[0.06] px-3.5 py-2.5 text-zinc-300">
                    Подання пропозицій змін до каталогу
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* СЕКЦІЯ 3: Як це працює за 3 кроки */}
        <section
          id="how-it-works"
          className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 border-t border-white/[0.06]"
        >
          <div className="max-w-2xl space-y-3 mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-zinc-900 px-3 py-1 text-[11px] font-medium text-zinc-300">
              <span>Швидкий старт</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-zinc-50">
              Три кроки до максимальної вигоди
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bezel-shell-sm">
              <div className="bezel-core-sm h-full p-5 space-y-3">
                <div className="font-mono text-xs font-semibold text-emerald-400">01 · Гаманець</div>
                <h3 className="text-base font-semibold text-zinc-50">
                  Додайте картки з пулу 21 банку
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Оберіть потрібні банки України або завантажте стартовий набір із 4 популярних
                  карток за один клік.
                </p>
              </div>
            </div>

            <div className="bezel-shell-sm">
              <div className="bezel-core-sm h-full p-5 space-y-3">
                <div className="font-mono text-xs font-semibold text-emerald-400">02 · Ставки місяця</div>
                <h3 className="text-base font-semibold text-zinc-50">
                  Виставте правила кешбеку раз на місяць
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Вкажіть обрані категорії, партнерські пропозиції банків та базовий фолбек на усі
                  покупки окремо для власних і кредитних коштів.
                </p>
              </div>
            </div>

            <div className="bezel-shell-sm">
              <div className="bezel-core-sm h-full p-5 space-y-3">
                <div className="font-mono text-xs font-semibold text-emerald-400">03 · На касі</div>
                <h3 className="text-base font-semibold text-zinc-50">
                  Отримайте точну рекомендацію оплати
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Введіть назву магазину перед оплатою і одразу побачте переможця рейтингу та суму
                  чистого кешбеку в гривнях.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* СЕКЦІЯ 4: Вітрина пулу 21 банку України та 25 категорій */}
        <section
          id="catalog-preview"
          className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 border-t border-white/[0.06]"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div className="space-y-2 max-w-xl">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-50">
                Пул банків та категорій України
              </h2>
              <p className="text-sm text-zinc-400">
                Актуальні українські фінансові установи та канонічні категорії кешбеку станом на
                листопад 2026 року.
              </p>
            </div>

            <div className="inline-grid grid-cols-2 gap-1 rounded-xl bg-zinc-900 p-1 border border-white/[0.08] self-start">
              <button
                type="button"
                onClick={() => setCatalogTab('banks')}
                className={`min-h-[38px] px-3.5 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  catalogTab === 'banks'
                    ? 'bg-zinc-800 text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>Банки ({UA_BANKS.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setCatalogTab('categories')}
                className={`min-h-[38px] px-3.5 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  catalogTab === 'categories'
                    ? 'bg-zinc-800 text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Tag className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>Категорії ({UA_CATEGORIES.length})</span>
              </button>
            </div>
          </div>

          <div className="bezel-shell">
            <div className="bezel-core p-4 sm:p-5">
              {catalogTab === 'banks' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {UA_BANKS.map((bank) => (
                    <div
                      key={bank.id}
                      className="rounded-xl bg-zinc-950/75 border border-white/[0.06] px-3.5 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-3 w-3 rounded-full shrink-0 border border-white/15"
                          style={{ backgroundColor: bank.brandColor }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-zinc-100 truncate">
                            {bank.nameUk}
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate">
                            {bank.cardPresets[0] ?? 'Основна картка'}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400 tabular-nums shrink-0">
                        -{bank.defaultTaxPercent}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {UA_CATEGORIES.map((cat) => (
                    <div
                      key={cat.id}
                      className="rounded-xl bg-zinc-950/75 border border-white/[0.06] px-3.5 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryIcon
                          iconName={cat.iconName}
                          className="h-4 w-4 text-emerald-400 shrink-0"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        <span className="text-xs font-medium text-zinc-100 truncate">
                          {cat.nameUk}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-zinc-500 tabular-nums shrink-0">
                        {cat.mccCodes.length > 0
                          ? `MCC ${cat.mccCodes.slice(0, 2).join(', ')}`
                          : 'Базова'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* СЕКЦІЯ 5: Кабінет учасника (Вхід / Реєстрація / Демо) */}
        <section
          ref={authPanelRef}
          id="auth-panel"
          className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 border-t border-white/[0.06]"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-zinc-900 px-3 py-1 text-[11px] font-medium text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>Персональний кабінет учасника</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-zinc-50">
                Почніть керувати своїм гаманцем кешбеку
              </h2>
              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-[50ch]">
                Усі ваші картки користувача, щомісячні правила кешбеку та пропозиції змін
                зберігаються ізольовано виключно під вашим обліковим записом.
              </p>

              <ul className="space-y-2.5 pt-2 text-sm text-zinc-300">
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>Миттєвий підбір картки за назвою магазину або MCC-кодом</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>Окремі ставки за власні кошти, кредитні кошти та партнерів</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>Скидання ставок на новий місяць одним натисканням</span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-6 w-full">
              <div className="bezel-shell">
                <div className="bezel-core p-6 space-y-5">
                  {currentUser && onContinueToApp ? (
                    <div className="space-y-5">
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-zinc-50 tracking-tight">
                          Ви вже авторизовані
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Активна сесія учасника готова до роботи з Радаром вигоди
                        </p>
                      </div>

                      <div className="rounded-xl bg-zinc-950 border border-white/[0.07] p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-100 truncate">
                            {currentUser.displayName}
                          </div>
                          <div className="text-xs font-mono text-zinc-400 truncate">
                            {currentUser.email}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={onContinueToApp}
                        className="group w-full min-h-[48px] pl-5 pr-2 rounded-full bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-sm flex items-center justify-between transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer"
                      >
                        <span>Перейти до робочого кабінету</span>
                        <span className="h-8 w-8 rounded-full bg-zinc-950/10 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        </span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-zinc-50 tracking-tight">
                          {mode === 'login' ? 'Вхід у персональний кабінет' : 'Реєстрація учасника'}
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Ваші картки та щомісячні відсотки доступні лише вам
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-950 p-1 border border-zinc-800/90">
                        <button
                          type="button"
                          onClick={() => {
                            setMode('login');
                            setError(null);
                          }}
                          className={`min-h-[42px] rounded-lg text-xs font-medium transition-[background-color,color,transform] duration-200 active:scale-[0.98] cursor-pointer ${
                            mode === 'login'
                              ? 'bg-zinc-800 text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Вхід у кабінет
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMode('register');
                            setError(null);
                          }}
                          className={`min-h-[42px] rounded-lg text-xs font-medium transition-[background-color,color,transform] duration-200 active:scale-[0.98] cursor-pointer ${
                            mode === 'register'
                              ? 'bg-zinc-800 text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Реєстрація
                        </button>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'register' && (
                          <div className="space-y-1.5">
                            <label
                              className="block text-xs font-medium text-zinc-300"
                              htmlFor="auth-name"
                            >
                              Ім’я учасника
                            </label>
                            <div className="relative">
                              <User
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                              <input
                                ref={nameInputRef}
                                id="auth-name"
                                type="text"
                                maxLength={80}
                                autoComplete="name"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Олександр"
                                className="w-full min-h-[46px] rounded-xl bg-zinc-950 border border-zinc-800 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label
                            className="block text-xs font-medium text-zinc-300"
                            htmlFor="auth-email"
                          >
                            Електронна пошта
                          </label>
                          <div className="relative">
                            <Mail
                              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            <input
                              ref={emailInputRef}
                              id="auth-email"
                              type="email"
                              required
                              maxLength={254}
                              autoComplete="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="name@example.com"
                              className="w-full min-h-[46px] rounded-xl bg-zinc-950 border border-zinc-800 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label
                            className="block text-xs font-medium text-zinc-300"
                            htmlFor="auth-password"
                          >
                            Пароль (мін. 8 символів)
                          </label>
                          <div className="relative">
                            <Lock
                              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            <input
                              id="auth-password"
                              type="password"
                              required
                              minLength={8}
                              maxLength={128}
                              autoComplete={
                                mode === 'register' ? 'new-password' : 'current-password'
                              }
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full min-h-[46px] rounded-xl bg-zinc-950 border border-zinc-800 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                          </div>
                        </div>

                        {error && (
                          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-300 leading-relaxed">
                            {error}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={loading}
                          className="group w-full min-h-[48px] pl-5 pr-2 rounded-full bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-medium text-sm flex items-center justify-between transition-[background-color,transform,opacity] duration-200 active:scale-[0.98] cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-2">
                            {mode === 'register' ? (
                              <>
                                <UserPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                                <span>{loading ? 'Створюємо кабінет...' : 'Зареєструватися'}</span>
                              </>
                            ) : (
                              <span>{loading ? 'Виконується вхід...' : 'Увійти в кабінет'}</span>
                            )}
                          </span>
                          <span className="h-8 w-8 rounded-full bg-zinc-950/10 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </span>
                        </button>
                      </form>

                      {!cloudEnabled && (
                        <div className="pt-3 border-t border-zinc-800/80 space-y-2">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={handleDemoLogin}
                            className="w-full min-h-[44px] rounded-xl bg-zinc-950 hover:bg-zinc-800/80 text-zinc-200 border border-zinc-800 font-medium text-xs flex items-center justify-center gap-2 transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer"
                          >
                            <Sparkles className="h-4 w-4 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                            <span>Швидкий демо-вхід (4 українські картки)</span>
                          </button>
                          <p className="text-[11px] text-center text-zinc-500">
                            Локальний ізольований режим. Для хмарної синхронізації додайте ключі
                            Supabase у .env
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Лаконічний футер */}
      <footer className="border-t border-white/[0.07] bg-zinc-950 py-8 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2 text-zinc-300">
            <Radar className="h-4 w-4 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
            <span className="font-medium">КешбекРадар Україна</span>
            <span className="text-zinc-600">·</span>
            <span className="font-mono">{previewMonth}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>{UA_BANKS.length} банків України</span>
            <span>{UA_CATEGORIES.length} категорій витрат</span>
            <span>Податок кешбеку 23% (18% ПДФО + 5% ВЗ)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
