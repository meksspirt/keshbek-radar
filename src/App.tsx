import { useCallback, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  BookOpen,
  Compass,
  CreditCard,
  LogOut,
  MessageSquarePlus,
  Percent,
  Radar,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { CatalogView } from './components/CatalogView';
import { ChangeSuggestionModal } from './components/ChangeSuggestionModal';
import { RadarView } from './components/RadarView';
import { WalletView } from './components/WalletView';
import {
  authAndDataService,
  getCurrentMonthYear,
} from './services/authAndDataService';
import type {
  BankId,
  CashbackRule,
  CategoryId,
  ParticipantUser,
  RuleType,
  SuggestionType,
  TaxMode,
  UserCard,
} from './types/domain';

type AppTab = 'radar' | 'wallet' | 'catalog';

const MONTH_NAMES_UK = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];

function formatMonthLabel(monthYear: string): string {
  const [y, m] = monthYear.split('-');
  const idx = Number(m) - 1;
  return `${MONTH_NAMES_UK[idx] ?? monthYear} ${y}`;
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2).replace(/\.?0+$/, '')}%`;
}

function RadarSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
      <div className="lg:col-span-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-5">
        <div className="h-12 rounded-xl bg-zinc-800/70" />
        <div className="flex flex-wrap gap-2">
          <div className="h-8 w-28 rounded-lg bg-zinc-800/60" />
          <div className="h-8 w-24 rounded-lg bg-zinc-800/60" />
          <div className="h-8 w-32 rounded-lg bg-zinc-800/60" />
        </div>
        <div className="h-12 rounded-xl bg-zinc-800/70" />
      </div>
      <div className="lg:col-span-7 space-y-4">
        <div className="h-44 rounded-2xl border border-zinc-800 bg-zinc-900/60" />
        <div className="h-32 rounded-2xl border border-zinc-800 bg-zinc-900/40" />
      </div>
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<ParticipantUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showLanding, setShowLanding] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('radar');
  const [monthYear] = useState(() => getCurrentMonthYear());

  const [cards, setCards] = useState<UserCard[]>([]);
  const [rules, setRules] = useState<CashbackRule[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [loadingDemoWallet, setLoadingDemoWallet] = useState(false);

  const [externalCatSelection, setExternalCatSelection] = useState<{
    id: CategoryId;
    nonce: number;
  } | null>(null);

  const [suggestionModal, setSuggestionModal] = useState<{
    isOpen: boolean;
    targetName?: string;
    type?: SuggestionType;
    categoryId?: CategoryId;
  }>({ isOpen: false });

  const loadWalletForUser = useCallback(async (userId: string) => {
    setLoadingWallet(true);
    try {
      const wallet = await authAndDataService.loadUserWallet(userId);
      setCards(wallet.cards);
      setRules(wallet.rules);
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    authAndDataService
      .getCurrentSession()
      .then((sessionUser) => {
        if (!mounted) return;
        setUser(sessionUser);
        if (sessionUser) {
          return loadWalletForUser(sessionUser.id);
        }
      })
      .finally(() => {
        if (mounted) setCheckingSession(false);
      });

    return () => {
      mounted = false;
    };
  }, [loadWalletForUser]);

  const walletSummary = useMemo(() => {
    const activeCardsCount = cards.filter((c) => c.isActive).length;
    const monthRules = rules.filter((r) => r.monthYear === monthYear);
    const activeRulesCount = monthRules.filter(
      (r) => r.rateOwnFunds > 0 || r.rateCreditFunds > 0,
    ).length;
    const maxRatePercent = monthRules.reduce(
      (max, r) => Math.max(max, r.rateOwnFunds, r.rateCreditFunds),
      0,
    );
    return {
      activeCardsCount,
      totalCardsCount: cards.length,
      activeRulesCount,
      maxRatePercent,
    };
  }, [cards, rules, monthYear]);

  async function handleAuthenticated(authenticatedUser: ParticipantUser) {
    setUser(authenticatedUser);
    setShowLanding(false);
    setActiveTab('radar');
    await loadWalletForUser(authenticatedUser.id);
  }

  async function handleLogout() {
    await authAndDataService.logoutParticipant();
    setUser(null);
    setShowLanding(false);
    setCards([]);
    setRules([]);
    setSuggestionModal({ isOpen: false });
  }

  async function handleChangeTaxMode(mode: TaxMode) {
    if (!user) return;
    const updated = await authAndDataService.updateTaxModePreference(user.id, mode);
    setUser(updated);
  }

  async function handleAddCard(input: {
    bankId: BankId;
    cardName: string;
    taxPercent: number;
  }) {
    if (!user) return;
    const created = await authAndDataService.addUserCard(user.id, input);
    setCards((prev) => [...prev, created]);
  }

  async function handleToggleCardActive(cardId: string, isActive: boolean) {
    if (!user) return;
    const updated = await authAndDataService.updateUserCard(user.id, cardId, { isActive });
    setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
  }

  async function handleDeleteCard(cardId: string) {
    if (!user) return;
    await authAndDataService.deleteUserCard(user.id, cardId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    setRules((prev) => prev.filter((r) => r.cardId !== cardId));
  }

  async function handleUpsertRule(input: {
    id?: string;
    cardId: string;
    monthYear: string;
    ruleType: RuleType;
    categoryId?: CategoryId;
    merchantId?: string;
    customPartnerName?: string;
    rateOwnFunds: number;
    rateCreditFunds: number;
  }) {
    if (!user) return;
    const saved = await authAndDataService.upsertCashbackRule(user.id, input);
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        return prev.map((r) => (r.id === saved.id ? saved : r));
      }
      return [...prev, saved];
    });
  }

  async function handleDeleteRule(ruleId: string) {
    if (!user) return;
    await authAndDataService.deleteCashbackRule(user.id, ruleId);
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  }

  async function handleResetMonthRates(targetMonth: string) {
    if (!user) return;
    await authAndDataService.resetMonthRates(user.id, targetMonth);
    setRules((prev) =>
      prev.map((r) =>
        r.monthYear === targetMonth ? { ...r, rateOwnFunds: 0, rateCreditFunds: 0 } : r,
      ),
    );
  }

  async function handlePopulateDemoWallet() {
    if (!user) return;
    setLoadingDemoWallet(true);
    try {
      const wallet = await authAndDataService.populateStarterCards(user.id, monthYear);
      setCards(wallet.cards);
      setRules(wallet.rules);
    } finally {
      setLoadingDemoWallet(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-zinc-200 px-4 py-10">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-10 w-44 rounded-xl bg-zinc-900" />
          <RadarSkeleton />
        </div>
      </div>
    );
  }

  if (!user || showLanding) {
    return (
      <AuthScreen
        onAuthenticated={handleAuthenticated}
        currentUser={user}
        onContinueToApp={() => setShowLanding(false)}
      />
    );
  }

  const cloudEnabled = authAndDataService.isCloudEnabled();

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col">
      <a
        href="#app-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-zinc-100 focus:px-4 focus:py-2.5 focus:text-xs focus:font-medium focus:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        Перейти до основного вмісту
      </a>

      {/* Флагманський верхній хедер кабінету */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-white/[0.07] pt-[var(--sat)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 min-h-16 py-2 flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] gap-3">
          <div className="flex items-center gap-2.5 shrink-0 md:justify-self-start">
            <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] flex items-center justify-center shrink-0">
              <Radar className="h-5 w-5 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div>
              <div className="text-base font-semibold text-zinc-50 leading-tight">КешбекРадар</div>
              <div className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                <span>{monthYear}</span>
                <span aria-hidden="true">·</span>
                <span className={cloudEnabled ? 'text-emerald-400' : 'text-zinc-400'}>
                  {cloudEnabled ? 'Cloud' : 'Local'}
                </span>
              </div>
            </div>
          </div>

          {/* Навігація для десктопу (строго по центру) */}
          <nav
            aria-label="Навігація кабінету"
            className="hidden md:flex items-center gap-1 rounded-full bg-zinc-900/90 p-1 border border-white/[0.08] md:justify-self-center whitespace-nowrap"
          >
            <button
              type="button"
              onClick={() => setActiveTab('radar')}
              aria-current={activeTab === 'radar' ? 'page' : undefined}
              className={`px-4 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                activeTab === 'radar'
                  ? 'bg-zinc-800 text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {activeTab === 'radar' && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              )}
              <Radar className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              <span>Радар вигоди</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('wallet')}
              aria-current={activeTab === 'wallet' ? 'page' : undefined}
              className={`px-4 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                activeTab === 'wallet'
                  ? 'bg-zinc-800 text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {activeTab === 'wallet' && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              )}
              <CreditCard className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              <span>Мої картки ({cards.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              aria-current={activeTab === 'catalog' ? 'page' : undefined}
              className={`px-4 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                activeTab === 'catalog'
                  ? 'bg-zinc-800 text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {activeTab === 'catalog' && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              )}
              <BookOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              <span>Довідник України</span>
            </button>
          </nav>

          {/* Швидкі дії та профіль */}
          <div className="flex items-center gap-2 shrink-0 md:justify-self-end">
            <button
              type="button"
              onClick={() => setShowLanding(true)}
              title="Про проєкт"
              className="hidden md:inline-flex min-h-[42px] px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-zinc-50 text-sm font-medium items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Compass className="h-4 w-4 text-zinc-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden lg:inline">Про проєкт</span>
            </button>

            <button
              type="button"
              onClick={() => setSuggestionModal({ isOpen: true })}
              title="Запропонувати зміни"
              className="min-h-[44px] sm:min-h-[42px] px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-200 text-sm font-medium inline-flex items-center gap-1.5 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer whitespace-nowrap"
            >
              <MessageSquarePlus className="h-4 w-4 text-emerald-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden xl:inline">Запропонувати зміни</span>
              <span className="xl:hidden">Зміни</span>
            </button>

            <div className="hidden lg:flex items-center gap-2 min-h-[42px] rounded-xl bg-zinc-900 border border-white/[0.08] px-3.5">
              <UserIcon className="h-4 w-4 text-zinc-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-sm font-medium text-zinc-200 max-w-[110px] truncate">
                {user.displayName}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Вийти з кабінету"
              aria-label="Вийти з кабінету"
              className="min-h-[44px] min-w-[44px] sm:min-h-[42px] sm:min-w-[42px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-400 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Основний контент */}
      <main id="app-main-content" className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 pt-5 pb-28 md:pb-12 space-y-5">
        {loadingWallet ? (
          <RadarSkeleton />
        ) : (
          <>
            {/* Панель зведення гаманця на поточний місяць показується у розділі гаманця, щоб Радар залишався максимально сфокусованим */}
            {activeTab === 'wallet' && (
              <section aria-label="Зведення гаманця на місяць" className="bezel-shell-sm">
                <div className="bezel-core-sm px-4 py-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-center">
                  <div className="rounded-xl px-2.5 py-1.5">
                    <div className="text-xs text-zinc-400">Картки користувача</div>
                    <div className="mt-1 flex items-baseline gap-1.5 font-mono tabular-nums">
                      <span className="text-base font-semibold text-zinc-50">
                        {walletSummary.activeCardsCount} активних
                      </span>
                      <span className="text-sm text-zinc-400">із {walletSummary.totalCardsCount}</span>
                    </div>
                  </div>

                  <div className="rounded-xl px-2.5 py-1.5">
                    <div className="text-xs text-zinc-400">
                      Правила · {formatMonthLabel(monthYear)}
                    </div>
                    <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
                      <span className="text-base font-semibold text-zinc-50">
                        {walletSummary.activeRulesCount} правил
                      </span>
                      {walletSummary.maxRatePercent > 0 && (
                        <span className="text-sm text-emerald-400">
                          до {formatPercent(walletSummary.maxRatePercent)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleChangeTaxMode(user.preferredTaxMode === 'NET' ? 'GROSS' : 'NET')
                    }
                    className="text-left rounded-xl px-2.5 py-2 hover:bg-white/[0.03] transition-colors cursor-pointer min-h-[44px]"
                  >
                    <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                      <Percent className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
                      <span>Режим кешбеку</span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-zinc-100 font-mono">
                      {user.preferredTaxMode === 'NET'
                        ? 'Чистий кешбек (-23%)'
                        : 'Брудний кешбек (100%)'}
                    </div>
                  </button>

                  <div className="flex items-center justify-start lg:justify-end gap-2">
                    {cards.length === 0 ? (
                      <button
                        type="button"
                        disabled={loadingDemoWallet}
                        onClick={handlePopulateDemoWallet}
                        className="w-full sm:w-auto min-h-[44px] px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        <span>{loadingDemoWallet ? 'Завантажуємо...' : 'Заповнити 4 картки'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab('radar')}
                        className="w-full sm:w-auto min-h-[44px] px-4 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Radar className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        <span>До Радару вигоди</span>
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'radar' ? (
              <RadarView
                cards={cards}
                rules={rules}
                monthYear={monthYear}
                taxMode={user.preferredTaxMode}
                externalCategorySelection={externalCatSelection}
                onChangeTaxMode={handleChangeTaxMode}
                onGoToWallet={() => setActiveTab('wallet')}
                onPopulateDemoWallet={handlePopulateDemoWallet}
                onOpenSuggestion={(params) =>
                  setSuggestionModal({
                    isOpen: true,
                    ...params,
                  })
                }
              />
            ) : activeTab === 'wallet' ? (
              <WalletView
                cards={cards}
                rules={rules}
                monthYear={monthYear}
                onAddCard={handleAddCard}
                onToggleCardActive={handleToggleCardActive}
                onDeleteCard={handleDeleteCard}
                onUpsertRule={handleUpsertRule}
                onDeleteRule={handleDeleteRule}
                onResetMonthRates={handleResetMonthRates}
                onPopulateDemoWallet={handlePopulateDemoWallet}
              />
            ) : (
              <CatalogView
                onSelectCategoryForRadar={(categoryId) => {
                  setExternalCatSelection({ id: categoryId, nonce: Date.now() });
                  setActiveTab('radar');
                }}
                onOpenSuggestion={(params) =>
                  setSuggestionModal({
                    isOpen: true,
                    ...params,
                  })
                }
              />
            )}
          </>
        )}
      </main>

      {/* Нижня мобільна навігація в Thumb Zone */}
      <nav
        aria-label="Мобільна навігація"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-white/[0.08] pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))]"
      >
        <div className={`grid min-h-14 ${Capacitor.isNativePlatform() ? 'grid-cols-3' : 'grid-cols-4'}`}>
          <button
            type="button"
            onClick={() => setActiveTab('radar')}
            aria-current={activeTab === 'radar' ? 'page' : undefined}
            className={`relative min-h-[52px] flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'radar' ? 'text-emerald-400' : 'text-zinc-400'
            }`}
          >
            {activeTab === 'radar' && (
              <span className="absolute top-0 h-0.5 w-7 rounded-full bg-emerald-400" aria-hidden="true" />
            )}
            <Radar className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            <span>Радар</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wallet')}
            aria-current={activeTab === 'wallet' ? 'page' : undefined}
            className={`relative min-h-[52px] flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'wallet' ? 'text-emerald-400' : 'text-zinc-400'
            }`}
          >
            {activeTab === 'wallet' && (
              <span className="absolute top-0 h-0.5 w-7 rounded-full bg-emerald-400" aria-hidden="true" />
            )}
            <CreditCard className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            <span>Картки ({cards.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            aria-current={activeTab === 'catalog' ? 'page' : undefined}
            className={`relative min-h-[52px] flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'catalog' ? 'text-emerald-400' : 'text-zinc-400'
            }`}
          >
            {activeTab === 'catalog' && (
              <span className="absolute top-0 h-0.5 w-7 rounded-full bg-emerald-400" aria-hidden="true" />
            )}
            <BookOpen className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            <span>Довідник</span>
          </button>
          {!Capacitor.isNativePlatform() && (
            <button
              type="button"
              onClick={() => setShowLanding(true)}
              className="relative min-h-[52px] flex flex-col items-center justify-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <Compass className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              <span>Проєкт</span>
            </button>
          )}
        </div>
      </nav>

      {/* Модальне вікно кнопки «Запропонувати зміни» */}
      <ChangeSuggestionModal
        isOpen={suggestionModal.isOpen}
        userId={user.id}
        initialTargetName={suggestionModal.targetName}
        initialType={suggestionModal.type}
        initialCategoryId={suggestionModal.categoryId}
        onClose={() => setSuggestionModal({ isOpen: false })}
      />
    </div>
  );
}

export default App;
