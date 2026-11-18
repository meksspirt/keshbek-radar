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
  Sparkles,
  Trophy,
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

  function handleSelectCategory(catId: CategoryId) {
    if (selectedCategoryId === catId && !selectedMerchantId) {
      setSelectedCategoryId(undefined);
      setQueryText('');
      return;
    }
    const cat = UA_CATEGORIES.find((c) => c.id === catId);
    setSelectedMerchantId(undefined);
    setSelectedCategoryId(catId);
    setQueryText(cat?.nameUk ?? '');
    setShowDropdown(false);
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
  }

  function handleClearSearch() {
    setQueryText('');
    setSelectedCategoryId(undefined);
    setSelectedMerchantId(undefined);
    setShowDropdown(false);
  }

  async function handleDemoSetup() {
    setLoadingDemo(true);
    try {
      await onPopulateDemoWallet();
    } finally {
      setLoadingDemo(false);
    }
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Головна форма пошуку та суми поточної покупки */}
      <section className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 sm:p-6 shadow-xl space-y-4">
        <div className="space-y-2 relative">
          <label htmlFor="radar-search" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Де або що плануєте оплатити?
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400" />
            <input
              id="radar-search"
              type="text"
              value={queryText}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setQueryText(e.target.value);
                setSelectedCategoryId(undefined);
                setSelectedMerchantId(undefined);
                setShowDropdown(true);
              }}
              placeholder="Назва магазину або суть: АТБ, Аврора, Фокстрот, ChatGPT, ліки, 5411..."
              className="w-full min-h-[54px] rounded-2xl bg-slate-950 border border-slate-700/80 pl-12 pr-12 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            {hasQuerySelection && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Очистити пошук"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Випадаючий список автопідказок */}
          {showDropdown &&
            queryText.trim().length > 0 &&
            !selectedMerchantId &&
            !selectedCategoryId &&
            evaluation.resolution.suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden divide-y divide-slate-800/80">
                {evaluation.resolution.suggestions.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-800/80 flex items-center justify-between gap-3 transition cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">{item.label}</div>
                      <div className="text-xs text-slate-400">{item.sublabel}</div>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300">
                      {item.type === 'MERCHANT' ? 'Магазин' : 'Категорія'}
                    </span>
                  </button>
                ))}
              </div>
            )}
        </div>

        {/* Швидкі чіпси категорій */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Або оберіть категорію в 1 дотик:</span>
            <button
              type="button"
              onClick={() => setShowAllCategories((prev) => !prev)}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
            >
              {showAllCategories ? (
                <>
                  Згорнути <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Усі 25 категорій <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {displayedCategories.map((cat) => {
              const active = evaluation.resolution.matchedCategory?.id === cat.id && !evaluation.resolution.matchedMerchant;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 border transition cursor-pointer ${
                    active
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <CategoryIcon iconName={cat.iconName} className="h-3.5 w-3.5 shrink-0" />
                  <span>{cat.nameUk}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Сума покупки та параметри розрахунку */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-2 border-t border-slate-800/80">
          <div className="lg:col-span-6 space-y-2">
            <label htmlFor="radar-amount" className="block text-xs font-medium text-slate-400">
              Сума поточної покупки (опціонально)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="radar-amount"
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="Наприклад: 1000"
                  className="w-full min-h-[46px] rounded-xl bg-slate-950 border border-slate-700/80 pl-4 pr-10 text-base font-semibold tabular-nums text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  ₴
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {AMOUNT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountInput(String(preset))}
                    className={`min-h-[46px] px-3 rounded-xl text-xs font-semibold tabular-nums border shrink-0 transition cursor-pointer ${
                      parsedAmount === preset
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {preset} ₴
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-400">Розрахунок кешбеку</span>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800 min-h-[46px]">
                <button
                  type="button"
                  onClick={() => onChangeTaxMode('NET')}
                  className={`rounded-lg text-xs font-semibold px-2 transition cursor-pointer ${
                    taxMode === 'NET'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Чистими (-23%)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTaxMode('GROSS')}
                  className={`rounded-lg text-xs font-semibold px-2 transition cursor-pointer ${
                    taxMode === 'GROSS'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Номінал (100%)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-400">Чим плануєте платити</span>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800 min-h-[46px]">
                <button
                  type="button"
                  onClick={() => setFundFilter('ALL')}
                  className={`rounded-lg text-xs font-semibold transition cursor-pointer ${
                    fundFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Обидва
                </button>
                <button
                  type="button"
                  onClick={() => setFundFilter('OWN')}
                  className={`rounded-lg text-xs font-semibold transition cursor-pointer ${
                    fundFilter === 'OWN'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Власні
                </button>
                <button
                  type="button"
                  onClick={() => setFundFilter('CREDIT')}
                  className={`rounded-lg text-xs font-semibold transition cursor-pointer ${
                    fundFilter === 'CREDIT'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Кредитні
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Блок розпізнаного магазину / категорії */}
      {hasQuerySelection && (
        <section className="rounded-2xl bg-slate-900/70 border border-slate-800 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {evaluation.resolution.matchedCategory || evaluation.resolution.matchedMerchant ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {evaluation.resolution.matchedMerchant && (
                  <span className="text-sm font-bold text-white">
                    {evaluation.resolution.matchedMerchant.nameUk}
                  </span>
                )}
                {evaluation.resolution.matchedCategory && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                    <CategoryIcon
                      iconName={evaluation.resolution.matchedCategory.iconName}
                      className="h-3.5 w-3.5"
                    />
                    {evaluation.resolution.matchedCategory.nameUk}
                  </span>
                )}
                {evaluation.resolution.matchedMcc && (
                  <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-300">
                    MCC {evaluation.resolution.matchedMcc}
                  </span>
                )}
              </div>
              {evaluation.resolution.matchedMerchant?.notesUk && (
                <p className="text-xs text-slate-400 flex items-start gap-1.5 pt-0.5">
                  <Info className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <span>{evaluation.resolution.matchedMerchant.notesUk}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2.5 text-xs text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Магазин «{queryText}» не знайдено у довіднику.</span>{' '}
                Зараз показані картки із «Кешбек на усі покупки», або оберіть категорію вище.
              </div>
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
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-medium text-amber-300 transition cursor-pointer self-start sm:self-center"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Неточна категорія? Запропонувати зміни
          </button>
        </section>
      )}

      {/* Порожній гаманець користувача */}
      {cards.length === 0 ? (
        <section className="rounded-3xl bg-slate-900/90 border border-dashed border-slate-700 p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Wallet className="h-7 w-7 text-emerald-400" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-white">У вашому гаманці ще немає карток</h3>
            <p className="text-sm text-slate-400">
              Додайте свої українські банки та виставте відсотки кешбеку на поточний місяць, або
              завантажте тестовий набір із 4 карток для швидкої перевірки.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onGoToWallet}
              className="min-h-[48px] px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm inline-flex items-center gap-2 transition cursor-pointer"
            >
              Додати мої картки
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={loadingDemo}
              onClick={handleDemoSetup}
              className="min-h-[48px] px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm inline-flex items-center gap-2 transition cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-amber-400" />
              {loadingDemo ? 'Створюємо картки...' : 'Заповнити прикладом (4 картки)'}
            </button>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="text-sm font-semibold text-slate-300">
              Рейтинг ваших карток на суму{' '}
              <span className="text-white tabular-nums">
                {evaluation.effectiveAmountUah.toLocaleString('uk-UA')} ₴
              </span>
              {evaluation.isDefaultAmount && (
                <span className="ml-1.5 text-xs font-normal text-slate-400">(приклад розрахунку)</span>
              )}
            </h2>
            <span className="text-xs text-slate-400">
              {taxMode === 'NET'
                ? 'Показано чистий кешбек (після -23% податку)'
                : 'Показано номінальний кешбек (до податків)'}
            </span>
          </div>

          {!hasQuerySelection && (
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
              <Info className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Введіть назву магазину (напр. <b>Сільпо</b>, <b>Аврора</b>, <b>Фокстрот</b>) або
                оберіть категорію вище. Зараз показано базовий «Кешбек на усі покупки».
              </span>
            </div>
          )}

          {/* Банер переможця */}
          {bestRec && (
            <div className="rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-slate-900 border border-emerald-500/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                    Найвигідніше платити зараз
                  </div>
                  <div className="text-base sm:text-lg font-bold text-white">
                    {bestRec.bank.nameUk} ({bestRec.card.cardName}) —{' '}
                    <span className="text-emerald-300">
                      {fundFilter === 'OWN' ||
                      (fundFilter === 'ALL' && bestRec.bestFundType === 'OWN')
                        ? 'Власними коштами'
                        : fundFilter === 'CREDIT' ||
                            (fundFilter === 'ALL' && bestRec.bestFundType === 'CREDIT')
                          ? 'Кредитними коштами'
                          : 'Власними або кредитними'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="sm:text-right">
                <div className="text-2xl font-extrabold text-emerald-300 tabular-nums">
                  +
                  {formatUah(
                    fundFilter === 'OWN'
                      ? bestRec.ownFunds.displayedCashbackUah
                      : fundFilter === 'CREDIT'
                        ? bestRec.creditFunds.displayedCashbackUah
                        : bestRec.bestDisplayedCashbackUah,
                  )}{' '}
                  ₴
                </div>
                <div className="text-xs text-slate-300">{bestRec.matchedTitle}</div>
              </div>
            </div>
          )}

          {/* Список усіх активних карток */}
          <div className="grid grid-cols-1 gap-3">
            {sortedRecommendations.map((rec, index) => {
              const isWinner = bestRec?.card.id === rec.card.id && index === 0;
              const ownActive =
                rec.ownFunds.ratePercent > 0 &&
                (fundFilter === 'ALL' || fundFilter === 'OWN');
              const creditActive =
                rec.creditFunds.ratePercent > 0 &&
                (fundFilter === 'ALL' || fundFilter === 'CREDIT');

              const ownIsBetter =
                rec.ownFunds.displayedCashbackUah > rec.creditFunds.displayedCashbackUah;
              const creditIsBetter =
                rec.creditFunds.displayedCashbackUah > rec.ownFunds.displayedCashbackUah;

              return (
                <article
                  key={rec.card.id}
                  className={`rounded-2xl border p-4 transition ${
                    isWinner
                      ? 'bg-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-950/30'
                      : 'bg-slate-900/70 border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-inner"
                        style={{ backgroundColor: rec.bank.brandColor }}
                      >
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{rec.bank.nameUk}</span>
                          <span className="text-xs text-slate-400">• {rec.card.cardName}</span>
                          {isWinner && (
                            <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                              №1 ТОП ВИГОДА
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{rec.matchedTitle}</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Податок: {rec.card.taxPercent}%
                    </div>
                  </div>

                  {/* Дві колонки: Власні vs Кредитні кошти */}
                  <div className="grid grid-cols-2 gap-3 pt-3">
                    {/* Власні кошти */}
                    <div
                      className={`rounded-xl p-3 border transition ${
                        !ownActive
                          ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                          : ownIsBetter || rec.bestFundType === 'EQUAL'
                            ? 'bg-emerald-500/10 border-emerald-500/40'
                            : 'bg-slate-950/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
                          Власні кошти
                        </span>
                        {ownActive && (ownIsBetter || rec.bestFundType === 'EQUAL') && (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between gap-2">
                        <span className="text-lg font-extrabold text-white tabular-nums">
                          +{formatUah(rec.ownFunds.displayedCashbackUah)} ₴
                        </span>
                        <span className="text-xs font-bold text-emerald-300 tabular-nums">
                          {formatPercent(rec.ownFunds.ratePercent)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 truncate">
                        {rec.ownFunds.ratePercent > 0
                          ? taxMode === 'NET'
                            ? `До податків: ${formatUah(rec.ownFunds.grossCashbackUah)} ₴`
                            : `На руки (-${rec.card.taxPercent}%): ${formatUah(rec.ownFunds.netCashbackUah)} ₴`
                          : 'Кешбек не нараховується'}
                      </div>
                    </div>

                    {/* Кредитні кошти */}
                    <div
                      className={`rounded-xl p-3 border transition ${
                        !creditActive
                          ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                          : creditIsBetter || rec.bestFundType === 'EQUAL'
                            ? 'bg-sky-500/10 border-sky-500/40'
                            : 'bg-slate-950/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-400">
                          Кредитні кошти
                        </span>
                        {creditActive && (creditIsBetter || rec.bestFundType === 'EQUAL') && (
                          <Check className="h-3.5 w-3.5 text-sky-400" />
                        )}
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between gap-2">
                        <span className="text-lg font-extrabold text-white tabular-nums">
                          +{formatUah(rec.creditFunds.displayedCashbackUah)} ₴
                        </span>
                        <span className="text-xs font-bold text-sky-300 tabular-nums">
                          {formatPercent(rec.creditFunds.ratePercent)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 truncate">
                        {rec.creditFunds.ratePercent > 0
                          ? taxMode === 'NET'
                            ? `До податків: ${formatUah(rec.creditFunds.grossCashbackUah)} ₴`
                            : `На руки (-${rec.card.taxPercent}%): ${formatUah(rec.creditFunds.netCashbackUah)} ₴`
                          : 'Кешбек не нараховується'}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
