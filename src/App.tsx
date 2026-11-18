import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  CreditCard,
  LogOut,
  MessageSquarePlus,
  Radar,
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
  const [activeTab, setActiveTab] = useState<AppTab>('radar');
  const [monthYear] = useState(() => getCurrentMonthYear());

  const [cards, setCards] = useState<UserCard[]>([]);
  const [rules, setRules] = useState<CashbackRule[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(false);

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

  async function handleAuthenticated(authenticatedUser: ParticipantUser) {
    setUser(authenticatedUser);
    setActiveTab('radar');
    await loadWalletForUser(authenticatedUser.id);
  }

  async function handleLogout() {
    await authAndDataService.logoutParticipant();
    setUser(null);
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
    const wallet = await authAndDataService.populateStarterCards(user.id, monthYear);
    setCards(wallet.cards);
    setRules(wallet.rules);
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

  if (!user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  const cloudEnabled = authAndDataService.isCloudEnabled();

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Верхній хедер */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-white/[0.07]">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center shrink-0">
              <Radar className="h-4.5 w-4.5 text-emerald-400" strokeWidth={1.75} />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-50 leading-tight">КешбекРадар</div>
              <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-1.5">
                <span>{monthYear}</span>
                <span>·</span>
                <span className={cloudEnabled ? 'text-emerald-400' : 'text-zinc-500'}>
                  {cloudEnabled ? 'Cloud' : 'Local'}
                </span>
              </div>
            </div>
          </div>

          {/* Навігація для десктопу */}
          <nav className="hidden md:flex items-center gap-1 rounded-xl bg-zinc-900 p-1 border border-zinc-800/90">
            <button
              type="button"
              onClick={() => setActiveTab('radar')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'radar'
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <Radar className="h-3.5 w-3.5" strokeWidth={1.75} />
              Радар вигоди
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('wallet')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'wallet'
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" strokeWidth={1.75} />
              Мої картки ({cards.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
              Довідник України
            </button>
          </nav>

          {/* Кнопка «Запропонувати зміни» та профіль */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSuggestionModal({ isOpen: true })}
              className="min-h-[38px] px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium inline-flex items-center gap-1.5 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 text-emerald-400 shrink-0" strokeWidth={1.75} />
              <span className="hidden sm:inline">Запропонувати зміни</span>
              <span className="sm:hidden">Зміни</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-1.5">
              <UserIcon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.75} />
              <span className="text-xs font-medium text-zinc-200 max-w-[120px] truncate">
                {user.displayName}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Вийти з кабінету"
              aria-label="Вийти з кабінету"
              className="min-h-[38px] min-w-[38px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>

      {/* Основний контент */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 pt-6 pb-24 md:pb-12">
        {loadingWallet ? (
          <RadarSkeleton />
        ) : activeTab === 'radar' ? (
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
      </main>

      {/* Нижня мобільна навігація в Thumb Zone */}
      <nav
        aria-label="Мобільна навігація"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-white/[0.08] pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="grid grid-cols-3 h-16">
          <button
            type="button"
            onClick={() => setActiveTab('radar')}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
              activeTab === 'radar' ? 'text-emerald-400' : 'text-zinc-400'
            }`}
          >
            <Radar className="h-5 w-5" strokeWidth={1.75} />
            <span>Радар</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wallet')}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
              activeTab === 'wallet' ? 'text-emerald-400' : 'text-zinc-400'
            }`}
          >
            <CreditCard className="h-5 w-5" strokeWidth={1.75} />
            <span>Картки ({cards.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
              activeTab === 'catalog' ? 'text-emerald-400' : 'text-zinc-400'
            }`}
          >
            <BookOpen className="h-5 w-5" strokeWidth={1.75} />
            <span>Довідник</span>
          </button>
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
