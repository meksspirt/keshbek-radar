import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Info,
  MessageSquarePlus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { UA_CATEGORIES } from '../data/ukrainianCatalog';
import { evaluatePurchase } from '../engine/cashbackEngine';
import type {
  CashbackRule,
  CategoryId,
  FundFilter,
  PaymentRecommendation,
  SuggestionType,
  TaxMode,
  UserCard,
} from '../types/domain';
import { CategoryIcon } from './CategoryIcon';

interface RadarViewProps {
  cards: UserCard[];
  rules: CashbackRule[];
  monthYear: string;
  taxMode: TaxMode;
  externalCategorySelection?: { id: CategoryId; nonce: number } | null;
  onChangeTaxMode: (mode: TaxMode) => void;
  onGoToWallet: () => void;
  onPopulateDemoWallet: () => Promise<void>;
  onOpenSuggestion: (params: {
    targetName?: string;
    type?: SuggestionType;
    categoryId?: CategoryId;
  }) => void;
}

const AMOUNT_PRESETS = [100, 500, 1000, 2500, 5000];
const TOP_CATEGORY_IDS: CategoryId[] = [
  'groceries',
  'cafes',
  'auto_fuel',
  'pharmacy',
  'appliances',
  'multimarkets',
  'marketplaces',
  'ai',
];

function formatUah(value: number): string {
  return value.toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2).replace(/\.?0+$/, '')}%`;
}

export function RadarView({
  cards,
  rules,
  monthYear,
  taxMode,
  externalCategorySelection,
  onChangeTaxMode,
  onGoToWallet,
  onPopulateDemoWallet,
  onOpenSuggestion,
}: RadarViewProps) {
  const [queryText, setQueryText] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategoryId | undefined>(undefined);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | undefined>(undefined);
  const [fundFilter, setFundFilter] = useState<FundFilter>('ALL');

  const [showParams, setShowParams] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  useEffect(() => {
    if (!externalCategorySelection) return;
    const cat = UA_CATEGORIES.find((c) => c.id === externalCategorySelection.id);
    setSelectedMerchantId(undefined);
    setSelectedCategoryId(externalCategorySelection.id);
    setQueryText(cat?.nameUk ?? '');
    setShowDropdown(false);
    setShowParams(false);
    setShowDetails(false);
  }, [externalCategorySelection]);

  const parsedAmount = useMemo(() => {
    const cleaned = amountInput.replace(',', '.').replace(/[^\d.]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) && num > 0 ? num : undefined;
  }, [amountInput]);

  const evaluation = useMemo(
    () =>
      evaluatePurchase({
        query: {
          query: queryText,
          amountUah: parsedAmount,
          taxMode,
          selectedCategoryId,
          selectedMerchantId,
        },
        cards,
        rules,
        monthYear,
      }),
    [queryText, parsedAmount, taxMode, selectedCategoryId, selectedMerchantId, cards, rules, monthYear],
  );

  const sortedRecommendations = useMemo(() => {
    const list = [...evaluation.recommendations];
    if (fundFilter === 'OWN') {
      list.sort((a, b) => b.ownFunds.displayedCashbackUah - a.ownFunds.displayedCashbackUah);
    } else if (fundFilter === 'CREDIT') {
      list.sort((a, b) => b.creditFunds.displayedCashbackUah - a.creditFunds.displayedCashbackUah);
    }
    return list;
  }, [evaluation.recommendations, fundFilter]);

  const displayedCategories = useMemo(() => {
    const selectable = UA_CATEGORIES.filter((c) => !c.isUniversal);
    if (showAllCategories) return selectable;
    return selectable.filter((c) => TOP_CATEGORY_IDS.includes(c.id));
  }, [showAllCategories]);

  const hasQuerySelection =
    Boolean(queryText.trim()) || Boolean(selectedCategoryId) || Boolean(selectedMerchantId);

  const bestRec: PaymentRecommendation | null =
    sortedRecommendations.length > 0 &&
    ((fundFilter === 'OWN' && sortedRecommendations[0].ownFunds.ratePercent > 0) ||
      (fundFilter === 'CREDIT' && sortedRecommendations[0].creditFunds.ratePercent > 0) ||
      (fundFilter === 'ALL' && sortedRecommendations[0].bestRatePercent > 0))
      ? sortedRecommendations[0]
      : null;

  const secondaryRecommendations = bestRec
    ? sortedRecommendations.slice(1)
    : sortedRecommendations;

  function handleSelectCategory(catId: CategoryId) {
    if (selectedCategoryId === catId && !selectedMerchantId) {
      setSelectedCategoryId(undefined);
      setQueryText('');
      setShowDetails(false);
      return;
    }
    const cat = UA_CATEGORIES.find((c) => c.id === catId);
    setSelectedMerchantId(undefined);
    setSelectedCategoryId(catId);
    setQueryText(cat?.nameUk ?? '');
    setShowDropdown(false);
    setShowParams(false);
    setShowDetails(false);
  }

  function handleSelectSuggestion(suggestion: (typeof evaluation.resolution.suggestions)[number]) {
    if (suggestion.type === 'MERCHANT') {
      setSelectedMerchantId(suggestion.id);
      setSelectedCategoryId(undefined);
    } else {
      setSelectedMerchantId(undefined);
      setSelectedCategoryId(suggestion.categoryId);
    }
    setQueryText(suggestion.label);
    setShowDropdown(false);
    setShowDetails(false);
  }

  function handleClearSearch() {
    setQueryText('');
    setSelectedCategoryId(undefined);
    setSelectedMerchantId(undefined);
    setShowDropdown(false);
    setShowDetails(false);
  }

  async function handleDemoSetup() {
    setLoadingDemo(true);
    try {
      await onPopulateDemoWallet();
    } finally {
      setLoadingDemo(false);
    }
  }

  const bestFundLabel =
    bestRec === null
      ? ''
      : fundFilter === 'OWN' || (fundFilter === 'ALL' && bestRec.bestFundType === 'OWN')
        ? 'Власні кошти'
        : fundFilter === 'CREDIT' || (fundFilter === 'ALL' && bestRec.bestFundType === 'CREDIT')
          ? 'Кредитні кошти'
          : 'Власні або кредитні';

  const bestGainValue =
    bestRec === null
      ? 0
      : fundFilter === 'OWN'
        ? bestRec.ownFunds.displayedCashbackUah
        : fundFilter === 'CREDIT'
          ? bestRec.creditFunds.displayedCashbackUah
          : bestRec.bestDisplayedCashbackUah;

  const bestRateValue =
    bestRec === null
      ? 0
      : fundFilter === 'OWN'
        ? bestRec.ownFunds.ratePercent
        : fundFilter === 'CREDIT'
          ? bestRec.creditFunds.ratePercent
          : bestRec.bestRatePercent;

  const activeParamsSummary = `${evaluation.effectiveAmountUah.toLocaleString('uk-UA')} ₴ · ${
    taxMode === 'NET' ? '-23%' : '100%'
  }${fundFilter !== 'ALL' ? (fundFilter === 'OWN' ? ' · Власні' : ' · Кредитні') : ''}`;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8 animate-radar-enter">
      {/* Поле введення магазину / покупки та кнопка прихованих параметрів */}
      <section className="bezel-shell-sm relative z-20">
        <div className="bezel-core-sm p-4 sm:p-5 space-y-3.5">
          <div className="relative">
            <label htmlFor="radar-search" className="sr-only">
              Магазин, суть покупки або MCC
            </label>
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <input
              id="radar-search"
              type="text"
              maxLength={120}
              value={queryText}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setQueryText(e.target.value);
                setSelectedCategoryId(undefined);
                setSelectedMerchantId(undefined);
                setShowDropdown(true);
                setShowDetails(false);
              }}
              placeholder="Магазин, категорія або MCC"
              className="w-full min-h-[54px] rounded-xl bg-zinc-950 border border-zinc-800 pl-11 pr-12 text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {hasQuerySelection && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Очистити пошук"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            )}

            {showDropdown &&
              queryText.trim().length > 0 &&
              !selectedMerchantId &&
              !selectedCategoryId &&
              evaluation.resolution.suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-[50dvh] overflow-y-auto rounded-xl bg-zinc-900 border border-zinc-700/80 shadow-2xl divide-y divide-zinc-800/80">
                  {evaluation.resolution.suggestions.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full min-h-[52px] px-4 py-3 text-left hover:bg-zinc-800/80 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-base font-medium text-zinc-100 truncate">
                          {item.label}
                        </div>
                        <div className="text-xs sm:text-sm text-zinc-400 truncate">
                          {item.sublabel}
                        </div>
                      </div>
                      <span className="text-xs font-mono text-zinc-400 shrink-0">
                        {item.type === 'MERCHANT' ? 'Магазин' : 'Категорія'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
          </div>

          {/* Кнопка розкриття додаткових параметрів */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => setShowParams((prev) => !prev)}
              aria-expanded={showParams}
              className="w-full sm:w-auto min-h-[44px] px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800/80 border border-white/[0.08] text-sm font-medium text-zinc-100 inline-flex items-center justify-center sm:justify-start gap-2 transition-colors cursor-pointer"
            >
              <SlidersHorizontal
                className="h-4 w-4 text-emerald-400"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>Категорії та параметри</span>
              {showParams ? (
                <ChevronUp className="h-4 w-4 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>

            <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
              {hasQuerySelection && evaluation.resolution.matchedCategory && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 border border-white/[0.07] px-2.5 py-1 text-xs text-zinc-200">
                  <CategoryIcon
                    iconName={evaluation.resolution.matchedCategory.iconName}
                    className="h-3.5 w-3.5 text-emerald-400"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span>{evaluation.resolution.matchedCategory.nameUk}</span>
                </span>
              )}
              <span className="font-mono text-xs sm:text-sm text-zinc-400 tabular-nums">
                {activeParamsSummary}
              </span>
            </div>
          </div>

          {/* Прихований блок: категорії, сума, податок, джерело оплати */}
          {showParams && (
            <div className="pt-3.5 border-t border-white/[0.07] space-y-4 animate-radar-enter">
              {/* Категорії витрат */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-300">Категорії витрат</span>
                  <button
                    type="button"
                    onClick={() => setShowAllCategories((prev) => !prev)}
                    className="min-h-[36px] px-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {showAllCategories ? (
                      <>
                        Згорнути <ChevronUp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        Усі 25 категорій{' '}
                        <ChevronDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {displayedCategories.map((cat) => {
                    const active =
                      evaluation.resolution.matchedCategory?.id === cat.id &&
                      !evaluation.resolution.matchedMerchant;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategory(cat.id)}
                        className={`min-h-[42px] px-3 py-1.5 rounded-xl text-sm font-medium inline-flex items-center gap-2 border transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] cursor-pointer ${
                          active
                            ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
                            : 'bg-zinc-950 border-zinc-800/90 text-zinc-200 hover:border-zinc-700 hover:text-zinc-50'
                        }`}
                      >
                        <CategoryIcon
                          iconName={cat.iconName}
                          className="h-4 w-4 shrink-0"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        <span>{cat.nameUk}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Сума покупки */}
              <div className="space-y-2">
                <label htmlFor="radar-amount" className="block text-sm font-medium text-zinc-300">
                  Сума покупки (опціонально)
                </label>
                <div className="relative">
                  <input
                    id="radar-amount"
                    type="text"
                    inputMode="decimal"
                    maxLength={16}
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="1000"
                    className="w-full min-h-[48px] rounded-xl bg-zinc-950 border border-zinc-800 pl-4 pr-10 text-lg font-mono font-medium tabular-nums text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-mono text-zinc-400">
                    ₴
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {AMOUNT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmountInput(String(preset))}
                      className={`min-h-[44px] rounded-xl text-sm font-mono tabular-nums border transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] cursor-pointer ${
                        parsedAmount === preset
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Податок та джерело коштів */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-zinc-300">Розрахунок податку</span>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-950 p-1 border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => onChangeTaxMode('NET')}
                      className={`min-h-[42px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        taxMode === 'NET'
                          ? 'bg-zinc-800 text-zinc-50'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Чистими (-23%)
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeTaxMode('GROSS')}
                      className={`min-h-[42px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        taxMode === 'GROSS'
                          ? 'bg-zinc-800 text-zinc-50'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Номінал (100%)
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="block text-sm font-medium text-zinc-300">Джерело оплати</span>
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-950 p-1 border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setFundFilter('ALL')}
                      className={`min-h-[42px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        fundFilter === 'ALL'
                          ? 'bg-zinc-800 text-zinc-50'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Обидва
                    </button>
                    <button
                      type="button"
                      onClick={() => setFundFilter('OWN')}
                      className={`min-h-[42px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        fundFilter === 'OWN'
                          ? 'bg-zinc-800 text-emerald-300'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Власні
                    </button>
                    <button
                      type="button"
                      onClick={() => setFundFilter('CREDIT')}
                      className={`min-h-[42px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        fundFilter === 'CREDIT'
                          ? 'bg-zinc-800 text-emerald-300'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Кредитні
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Нижній блок результату */}
      {cards.length === 0 ? (
        <section className="rounded-2xl bg-zinc-900/60 border border-dashed border-zinc-800 p-6 sm:p-8 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Wallet className="h-6 w-6 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-zinc-100">
              У вашому гаманці ще немає карток
            </h3>
            <p className="text-sm sm:text-base text-zinc-400">
              Додайте свої українські банки та виставте відсотки на поточний місяць, або завантажте
              тестовий набір із 4 карток.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={onGoToWallet}
              className="w-full sm:w-auto min-h-[46px] px-5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-sm sm:text-base inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer"
            >
              <span>Додати мої картки</span>
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={loadingDemo}
              onClick={handleDemoSetup}
              className="w-full sm:w-auto min-h-[46px] px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 font-medium text-sm sm:text-base inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
              <span>{loadingDemo ? 'Створюємо...' : 'Заповнити прикладом (4 картки)'}</span>
            </button>
          </div>
        </section>
      ) : !hasQuerySelection ? (
        /* Поки магазин або категорію не обрано — жодні картки не показуються */
        <section className="rounded-2xl border border-dashed border-white/[0.08] bg-zinc-900/30 px-5 py-8 text-center space-y-2">
          <p className="text-base font-medium text-zinc-200">
            Оберіть магазин або категорію витрат вище
          </p>
          <p className="text-sm text-zinc-400">
            Щойно вкажете покупку, тут з’явиться найкраща картка та точна сума кешбеку.
          </p>
        </section>
      ) : (
        <div className="space-y-3.5 animate-radar-enter">
          {/* Головна картка-переможець + сума кешбеку */}
          {bestRec ? (
            <article className="bezel-shell">
              <div className="bezel-core overflow-hidden">
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: bestRec.bank.brandColor }}
                />
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                        <Check className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                        <span>Найкраща картка · {bestFundLabel}</span>
                      </div>
                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-50 tracking-tight">
                          {bestRec.bank.nameUk}
                        </h2>
                        <span className="text-base text-zinc-400">{bestRec.card.cardName}</span>
                      </div>
                      <p className="text-sm text-zinc-400">{bestRec.matchedTitle}</p>
                    </div>

                    <div className="sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
                      <div className="text-cashback-fluid font-mono font-semibold text-emerald-400 tabular-nums tracking-tight">
                        +{formatUah(bestGainValue)} ₴
                      </div>
                      <div className="text-xs sm:text-sm font-mono text-zinc-400 tabular-nums mt-1">
                        Ставка {formatPercent(bestRateValue)} · на{' '}
                        {evaluation.effectiveAmountUah.toLocaleString('uk-UA')} ₴
                      </div>
                    </div>
                  </div>

                  {/* Кнопка показу додаткової інформації */}
                  <div className="pt-3.5 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDetails((prev) => !prev)}
                      aria-expanded={showDetails}
                      className="w-full sm:w-auto min-h-[44px] px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800/80 border border-white/[0.08] text-sm font-medium text-zinc-100 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>
                        {showDetails
                          ? 'Сховати додаткову інформацію'
                          : 'Детальніше та інші картки'}
                      </span>
                      {secondaryRecommendations.length > 0 && !showDetails && (
                        <span className="font-mono text-xs text-zinc-400">
                          (+{secondaryRecommendations.length})
                        </span>
                      )}
                      {showDetails ? (
                        <ChevronUp className="h-4 w-4 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
                      )}
                    </button>

                    <span className="text-xs text-zinc-400 font-mono text-center sm:text-right">
                      {taxMode === 'NET' ? 'Після податку -23%' : 'Номінал 100%'}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ) : (
            <section className="rounded-2xl bg-zinc-900/70 border border-white/[0.08] p-5 space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-base font-semibold text-zinc-100">
                    Немає активного кешбеку для цього запиту
                  </div>
                  <p className="text-sm text-zinc-400">
                    За обраним магазином або категорією у ваших активних картках ставка становить
                    0%.
                  </p>
                </div>
                <span className="font-mono text-xl font-semibold text-zinc-400 tabular-nums shrink-0">
                  +0,00 ₴
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDetails((prev) => !prev)}
                  aria-expanded={showDetails}
                  className="w-full sm:w-auto min-h-[44px] px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-white/[0.08] text-sm font-medium text-zinc-200 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>
                    {showDetails
                      ? 'Сховати деталі'
                      : `Показати всі картки (${sortedRecommendations.length})`}
                  </span>
                  {showDetails ? (
                    <ChevronUp className="h-4 w-4 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onGoToWallet}
                  className="w-full sm:w-auto min-h-[44px] px-4 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Налаштувати ставки</span>
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </section>
          )}

          {/* Прихована додаткова інформація за кнопкою */}
          {showDetails && (
            <div className="space-y-3.5 animate-radar-enter">
              {/* Порівняння Власні vs Кредитні для переможця */}
              {bestRec && (
                <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.08] p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-zinc-400">
                    <span>
                      Деталізація для {bestRec.bank.nameUk} · {bestRec.card.cardName}
                    </span>
                    <span className="font-mono">Податок картки: {bestRec.card.taxPercent}%</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      className={`rounded-xl p-3.5 border ${
                        fundFilter !== 'CREDIT' &&
                        bestRec.ownFunds.ratePercent > 0 &&
                        (bestRec.bestFundType === 'OWN' ||
                          bestRec.bestFundType === 'EQUAL' ||
                          fundFilter === 'OWN')
                          ? 'bg-emerald-500/[0.08] border-emerald-500/40'
                          : 'bg-zinc-950/70 border-zinc-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-sm text-zinc-300">
                        <span className="inline-flex items-center gap-1.5">
                          <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          Власні кошти
                        </span>
                        <span className="font-mono font-medium text-zinc-100 tabular-nums">
                          {formatPercent(bestRec.ownFunds.ratePercent)}
                        </span>
                      </div>
                      <div className="mt-1.5 font-mono text-lg font-semibold text-zinc-100 tabular-nums">
                        +{formatUah(bestRec.ownFunds.displayedCashbackUah)} ₴
                      </div>
                    </div>

                    <div
                      className={`rounded-xl p-3.5 border ${
                        fundFilter !== 'OWN' &&
                        bestRec.creditFunds.ratePercent > 0 &&
                        (bestRec.bestFundType === 'CREDIT' ||
                          bestRec.bestFundType === 'EQUAL' ||
                          fundFilter === 'CREDIT')
                          ? 'bg-emerald-500/[0.08] border-emerald-500/40'
                          : 'bg-zinc-950/70 border-zinc-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-sm text-zinc-300">
                        <span className="inline-flex items-center gap-1.5">
                          <CreditCard className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          Кредитні кошти
                        </span>
                        <span className="font-mono font-medium text-zinc-100 tabular-nums">
                          {formatPercent(bestRec.creditFunds.ratePercent)}
                        </span>
                      </div>
                      <div className="mt-1.5 font-mono text-lg font-semibold text-zinc-100 tabular-nums">
                        +{formatUah(bestRec.creditFunds.displayedCashbackUah)} ₴
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Розпізнаний магазин, MCC та примітки */}
              <section className="rounded-2xl bg-zinc-900/60 border border-white/[0.08] px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {evaluation.resolution.matchedCategory || evaluation.resolution.matchedMerchant ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {evaluation.resolution.matchedMerchant && (
                        <span className="text-base font-semibold text-zinc-50">
                          {evaluation.resolution.matchedMerchant.nameUk}
                        </span>
                      )}
                      {evaluation.resolution.matchedCategory && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1 text-xs sm:text-sm text-zinc-200">
                          <CategoryIcon
                            iconName={evaluation.resolution.matchedCategory.iconName}
                            className="h-4 w-4 text-emerald-400"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                          {evaluation.resolution.matchedCategory.nameUk}
                        </span>
                      )}
                      {evaluation.resolution.matchedMcc && (
                        <span className="rounded-md bg-zinc-950 border border-zinc-800 px-2.5 py-1 text-xs font-mono text-zinc-300">
                          MCC {evaluation.resolution.matchedMcc}
                        </span>
                      )}
                    </div>
                    {evaluation.resolution.matchedMerchant?.notesUk && (
                      <p className="text-sm text-zinc-400 flex items-start gap-2 pt-0.5">
                        <Info
                          className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        <span>{evaluation.resolution.matchedMerchant.notesUk}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-sm text-zinc-300">
                    <AlertCircle
                      className="h-4.5 w-4.5 text-zinc-400 shrink-0 mt-0.5"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span>
                      Магазин «{queryText}» не знайдено у довіднику. Порівняно базові правила або
                      оберіть категорію вручну.
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    onOpenSuggestion({
                      targetName:
                        evaluation.resolution.matchedMerchant?.nameUk ?? queryText.trim(),
                      type: evaluation.resolution.matchedMerchant
                        ? 'FIX_MCC_CATEGORY'
                        : 'NEW_MERCHANT',
                      categoryId: evaluation.resolution.matchedCategory?.id,
                    })
                  }
                  className="shrink-0 min-h-[40px] inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 hover:text-emerald-400 transition-colors cursor-pointer self-start sm:self-center"
                >
                  <MessageSquarePlus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  <span>Запропонувати зміни</span>
                </button>
              </section>

              {/* Інші картки гаманця */}
              {secondaryRecommendations.length > 0 && (
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 divide-y divide-zinc-800/80 overflow-hidden">
                  {secondaryRecommendations.map((rec) => (
                    <div
                      key={rec.card.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-900/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="h-9 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: rec.bank.brandColor }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-base font-medium text-zinc-100">
                              {rec.bank.nameUk}
                            </span>
                            <span className="text-sm text-zinc-400 truncate">
                              {rec.card.cardName}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm text-zinc-400 truncate mt-0.5">
                            {rec.matchedTitle}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 sm:gap-5 shrink-0 sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.05]">
                        <div className={fundFilter === 'CREDIT' ? 'opacity-45' : ''}>
                          <div className="text-xs text-zinc-400">
                            Власні ·{' '}
                            <span className="font-mono text-zinc-200">
                              {formatPercent(rec.ownFunds.ratePercent)}
                            </span>
                          </div>
                          <div className="font-mono text-base font-medium text-zinc-100 tabular-nums">
                            +{formatUah(rec.ownFunds.displayedCashbackUah)} ₴
                          </div>
                        </div>

                        <div className={fundFilter === 'OWN' ? 'opacity-45' : ''}>
                          <div className="text-xs text-zinc-400">
                            Кредитні ·{' '}
                            <span className="font-mono text-zinc-200">
                              {formatPercent(rec.creditFunds.ratePercent)}
                            </span>
                          </div>
                          <div className="font-mono text-base font-medium text-zinc-100 tabular-nums">
                            +{formatUah(rec.creditFunds.displayedCashbackUah)} ₴
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
