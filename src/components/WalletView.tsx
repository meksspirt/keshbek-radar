import { useState, type FormEvent } from 'react';
import {
  Check,
  CreditCard,
  Plus,
  RotateCcw,
  Sparkles,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import {
  BANK_BY_ID,
  CATEGORY_BY_ID,
  MERCHANT_BY_ID,
  UA_BANKS,
  UA_CATEGORIES,
  UA_MERCHANTS,
} from '../data/ukrainianCatalog';
import type {
  BankId,
  CashbackRule,
  CategoryId,
  RuleType,
  UserCard,
} from '../types/domain';
import { CategoryIcon } from './CategoryIcon';

interface WalletViewProps {
  cards: UserCard[];
  rules: CashbackRule[];
  monthYear: string;
  onAddCard: (input: { bankId: BankId; cardName: string; taxPercent: number }) => Promise<void>;
  onToggleCardActive: (cardId: string, isActive: boolean) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onUpsertRule: (input: {
    id?: string;
    cardId: string;
    monthYear: string;
    ruleType: RuleType;
    categoryId?: CategoryId;
    merchantId?: string;
    customPartnerName?: string;
    rateOwnFunds: number;
    rateCreditFunds: number;
  }) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<void>;
  onResetMonthRates: (monthYear: string) => Promise<void>;
  onPopulateDemoWallet: () => Promise<void>;
}

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

export function WalletView({
  cards,
  rules,
  monthYear,
  onAddCard,
  onToggleCardActive,
  onDeleteCard,
  onUpsertRule,
  onDeleteRule,
  onResetMonthRates,
  onPopulateDemoWallet,
}: WalletViewProps) {
  const [showAddCardForm, setShowAddCardForm] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<BankId>('monobank');
  const [cardNameInput, setCardNameInput] = useState(UA_BANKS[0].cardPresets[0] ?? 'Основна картка');
  const [taxPercentInput, setTaxPercentInput] = useState('23');
  const [addingCard, setAddingCard] = useState(false);

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [ruleMode, setRuleMode] = useState<'CATEGORY' | 'MERCHANT'>('CATEGORY');
  const [ruleCategoryId, setRuleCategoryId] = useState<CategoryId>('groceries');
  const [ruleMerchantId, setRuleMerchantId] = useState<string>('m-avrora');
  const [customPartnerInput, setCustomPartnerInput] = useState('');
  const [ownRateInput, setOwnRateInput] = useState('2');
  const [creditRateInput, setCreditRateInput] = useState('1');
  const [savingRule, setSavingRule] = useState(false);

  const [confirmReset, setConfirmReset] = useState(false);
  const [resettingMonth, setResettingMonth] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedBank = BANK_BY_ID.get(selectedBankId) ?? UA_BANKS[0];

  function handleBankSelect(bankId: BankId) {
    setSelectedBankId(bankId);
    const bank = BANK_BY_ID.get(bankId);
    if (bank) {
      setCardNameInput(bank.cardPresets[0] ?? 'Основна картка');
      setTaxPercentInput(String(bank.defaultTaxPercent));
    }
  }

  async function handleCreateCard(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setAddingCard(true);
    try {
      await onAddCard({
        bankId: selectedBankId,
        cardName: cardNameInput,
        taxPercent: Number(taxPercentInput) || 0,
      });
      setShowAddCardForm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не вдалося додати картку.');
    } finally {
      setAddingCard(false);
    }
  }

  async function handleSaveRule(e: FormEvent, cardId: string) {
    e.preventDefault();
    setErrorMsg(null);
    setSavingRule(true);
    try {
      const own = Number(ownRateInput.replace(',', '.')) || 0;
      const credit = Number(creditRateInput.replace(',', '.')) || 0;

      if (ruleMode === 'CATEGORY') {
        await onUpsertRule({
          cardId,
          monthYear,
          ruleType: 'CATEGORY',
          categoryId: ruleCategoryId,
          rateOwnFunds: own,
          rateCreditFunds: credit,
        });
      } else {
        const useCustom = customPartnerInput.trim().length > 0;
        await onUpsertRule({
          cardId,
          monthYear,
          ruleType: 'MERCHANT',
          merchantId: useCustom ? undefined : ruleMerchantId,
          customPartnerName: useCustom ? customPartnerInput.trim() : undefined,
          rateOwnFunds: own,
          rateCreditFunds: credit,
        });
      }
      setEditingCardId(null);
      setCustomPartnerInput('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не вдалося зберегти правило.');
    } finally {
      setSavingRule(false);
    }
  }

  async function runSafeAction(action: () => Promise<void>, fallbackMessage: string) {
    setErrorMsg(null);
    try {
      await action();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : fallbackMessage);
    }
  }

  return (
    <div className="space-y-6 pb-10 animate-radar-enter">
      {/* Верхня панель керування гаманцем */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="text-xs sm:text-sm font-mono text-emerald-400">
            {formatMonthLabel(monthYear)}
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-50 tracking-tight mt-0.5">
            Мої банківські картки
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mt-1">
            Оберіть банки з пулу 21 банку України та задайте `%` за власні та кредитні кошти
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
          {cards.length > 0 && (
            confirmReset ? (
              <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-1.5">
                <button
                  type="button"
                  disabled={resettingMonth}
                  onClick={() =>
                    void runSafeAction(async () => {
                      setResettingMonth(true);
                      setResetSuccessMsg(null);
                      try {
                        await onResetMonthRates(monthYear);
                        setConfirmReset(false);
                        setResetSuccessMsg(
                          `Усі ставки на ${formatMonthLabel(monthYear)} обнулено (0%).`,
                        );
                      } finally {
                        setResettingMonth(false);
                      }
                    }, 'Не вдалося обнулити ставки.')
                  }
                  className="min-h-[40px] px-3.5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-60 text-white text-sm font-medium cursor-pointer transition-colors"
                >
                  {resettingMonth ? 'Обнуляємо...' : 'Підтвердити обнулення'}
                </button>
                <button
                  type="button"
                  disabled={resettingMonth}
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[40px] px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100 disabled:opacity-50 cursor-pointer"
                >
                  Скасувати
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setResetSuccessMsg(null);
                  setConfirmReset(true);
                }}
                className="min-h-[44px] px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm font-medium text-zinc-200 inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
                Новий місяць (обнулити %)
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => setShowAddCardForm((prev) => !prev)}
            className="min-h-[44px] px-4 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-sm sm:text-base inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer"
          >
            {showAddCardForm ? <X className="h-4 w-4" strokeWidth={1.75} /> : <Plus className="h-4 w-4" strokeWidth={1.75} />}
            Додати картку
          </button>
        </div>
      </section>

      {resetSuccessMsg && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-300 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span>{resetSuccessMsg}</span>
          </span>
          <button
            type="button"
            onClick={() => setResetSuccessMsg(null)}
            aria-label="Закрити сповіщення"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-emerald-300/80 hover:text-emerald-200 cursor-pointer"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Форма додавання картки з пулу 21 українського банку */}
      {showAddCardForm && (
        <form
          onSubmit={handleCreateCard}
          className="rounded-2xl bg-zinc-900 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-zinc-50">
              Нова картка з пулу України (21 банк)
            </h3>
            <button
              type="button"
              onClick={() => setShowAddCardForm(false)}
              aria-label="Закрити форму додавання картки"
              className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">Оберіть банк</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
              {UA_BANKS.map((bank) => {
                const selected = bank.id === selectedBankId;
                return (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => handleBankSelect(bank.id)}
                    className={`min-h-[46px] rounded-xl px-3.5 py-2 text-left border flex items-center gap-2.5 transition-colors cursor-pointer ${
                      selected
                        ? 'bg-emerald-500/15 border-emerald-500/60 text-zinc-50'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: bank.brandColor }}
                    />
                    <span className="text-sm font-medium truncate">{bank.nameUk}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-sm font-medium text-zinc-300" htmlFor="card-name-input">
                Назва картки
              </label>
              <input
                id="card-name-input"
                type="text"
                required
                maxLength={120}
                value={cardNameInput}
                onChange={(e) => setCardNameInput(e.target.value)}
                placeholder="Наприклад: Чорна картка"
                className="w-full min-h-[46px] rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 text-base text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
              {selectedBank.cardPresets.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedBank.cardPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCardNameInput(preset)}
                      className="min-h-[36px] text-xs sm:text-sm px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-300" htmlFor="card-tax-input">
                Податок (%)
              </label>
              <input
                id="card-tax-input"
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={taxPercentInput}
                onChange={(e) => setTaxPercentInput(e.target.value)}
                className="w-full min-h-[46px] rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 text-base font-mono text-zinc-100 tabular-nums focus:outline-none focus:border-emerald-500"
              />
              <p className="text-xs text-zinc-400">Стандарт: 23% (18% ПДФО + 5% ВЗ)</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={addingCard}
              className="w-full sm:w-auto min-h-[46px] px-5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-sm sm:text-base inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer"
            >
              <Check className="h-4 w-4" strokeWidth={1.75} />
              {addingCard ? 'Збереження...' : 'Додати картку в гаманець'}
            </button>
          </div>
        </form>
      )}

      {/* Порожній стан */}
      {cards.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/50 border border-dashed border-zinc-800 p-6 sm:p-8 text-center space-y-3.5">
          <p className="text-base text-zinc-200">
            Ваш гаманець порожній. Натисніть «Додати картку» вище або завантажте готовий приклад.
          </p>
          <button
            type="button"
            onClick={onPopulateDemoWallet}
            className="w-full sm:w-auto min-h-[44px] px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-sm font-medium text-emerald-400 inline-flex items-center justify-center gap-2 border border-zinc-800 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            Заповнити прикладом 4 українських карток
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {cards.map((card) => {
            const bank = BANK_BY_ID.get(card.bankId);
            const cardRules = rules.filter(
              (r) => r.cardId === card.id && r.monthYear === monthYear,
            );
            const isEditing = editingCardId === card.id;

            return (
              <article
                key={card.id}
                className={`rounded-2xl border overflow-hidden transition-opacity ${
                  card.isActive
                    ? 'bg-zinc-900/80 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                    : 'bg-zinc-900/35 border-zinc-800/60 opacity-65'
                }`}
              >
                <div
                  className="h-1 w-full"
                  style={{ backgroundColor: bank?.brandColor ?? '#3f3f46' }}
                />

                <div className="p-4 sm:p-5 space-y-4">
                  {/* Шапка картки */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-200 shrink-0">
                        <CreditCard className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-zinc-50">
                            {bank?.nameUk ?? card.bankId}
                          </h3>
                          <span className="text-sm text-zinc-400 truncate">{card.cardName}</span>
                        </div>
                        <div className="text-xs sm:text-sm font-mono text-zinc-400 mt-0.5">
                          Податок {card.taxPercent}% · Правил: {cardRules.length}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void runSafeAction(
                            () => onToggleCardActive(card.id, !card.isActive),
                            'Не вдалося змінити статус картки.',
                          )
                        }
                        className={`min-h-[42px] px-3.5 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                          card.isActive
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {card.isActive ? 'Активна' : 'Вимкнена'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingCardId(isEditing ? null : card.id);
                          setErrorMsg(null);
                        }}
                        className="min-h-[42px] px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-sm font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="h-4 w-4" strokeWidth={1.75} />
                        Додати %
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void runSafeAction(
                            () => onDeleteCard(card.id),
                            'Не вдалося видалити картку.',
                          )
                        }
                        aria-label={`Видалити картку ${card.cardName}`}
                        className="min-h-[42px] min-w-[42px] rounded-xl bg-zinc-950 hover:bg-rose-500/15 border border-zinc-800 text-zinc-500 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>

                  {/* Форма додавання правила кешбеку */}
                  {isEditing && (
                    <form
                      onSubmit={(e) => handleSaveRule(e, card.id)}
                      className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3.5"
                    >
                      <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-900 p-1 border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setRuleMode('CATEGORY')}
                          className={`min-h-[42px] rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                            ruleMode === 'CATEGORY'
                              ? 'bg-zinc-800 text-zinc-50'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Категорія (з 25)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRuleMode('MERCHANT')}
                          className={`min-h-[42px] rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                            ruleMode === 'MERCHANT'
                              ? 'bg-zinc-800 text-zinc-50'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Партнерський магазин
                        </button>
                      </div>

                      {ruleMode === 'CATEGORY' ? (
                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-zinc-300">
                            Категорія кешбеку
                          </label>
                          <select
                            value={ruleCategoryId}
                            onChange={(e) => setRuleCategoryId(e.target.value as CategoryId)}
                            className="w-full min-h-[46px] rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 text-base text-zinc-100 focus:outline-none focus:border-emerald-500"
                          >
                            {UA_CATEGORIES.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.nameUk}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-zinc-300">
                              Магазин України
                            </label>
                            <select
                              value={ruleMerchantId}
                              onChange={(e) => {
                                setRuleMerchantId(e.target.value);
                                setCustomPartnerInput('');
                              }}
                              className="w-full min-h-[46px] rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 text-base text-zinc-100 focus:outline-none focus:border-emerald-500"
                            >
                              {UA_MERCHANTS.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nameUk}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-zinc-300">
                              Або впишіть назву партнера
                            </label>
                            <input
                              type="text"
                              maxLength={120}
                              value={customPartnerInput}
                              onChange={(e) => setCustomPartnerInput(e.target.value)}
                              placeholder="Напр. Сільпо або Аврора"
                              className="w-full min-h-[46px] rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-zinc-300">
                            % за власні кошти
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={ownRateInput}
                            onChange={(e) => setOwnRateInput(e.target.value)}
                            className="w-full min-h-[46px] rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 text-base font-mono font-medium tabular-nums text-zinc-100 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-zinc-300">
                            % за кредитні кошти
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={creditRateInput}
                            onChange={(e) => setCreditRateInput(e.target.value)}
                            className="w-full min-h-[46px] rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 text-base font-mono font-medium tabular-nums text-zinc-100 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingCardId(null)}
                          className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-100 cursor-pointer"
                        >
                          Скасувати
                        </button>
                        <button
                          type="submit"
                          disabled={savingRule}
                          className="min-h-[44px] px-5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-medium cursor-pointer"
                        >
                          {savingRule ? 'Збереження...' : 'Зберегти відсотки'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Активні правила картки */}
                  {cardRules.length === 0 ? (
                    <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/70 px-4 py-3 text-sm text-zinc-400">
                      Категорії кешбеку на поточний місяць ще не задано
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800/80 rounded-xl bg-zinc-950/70 border border-zinc-800/80 overflow-hidden">
                      {cardRules.map((rule) => {
                        const cat = rule.categoryId ? CATEGORY_BY_ID.get(rule.categoryId) : undefined;
                        const merchant = rule.merchantId
                          ? MERCHANT_BY_ID.get(rule.merchantId)
                          : undefined;
                        const label =
                          rule.ruleType === 'MERCHANT'
                            ? `Партнер: ${rule.customPartnerName ?? merchant?.nameUk ?? 'Магазин'}`
                            : cat?.nameUk ?? 'Кешбек на усі покупки';

                        return (
                          <div
                            key={rule.id}
                            className="px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {cat ? (
                                <CategoryIcon
                                  iconName={cat.iconName}
                                  className="h-4.5 w-4.5 text-zinc-400 shrink-0"
                                  strokeWidth={1.75}
                                />
                              ) : (
                                <Store className="h-4.5 w-4.5 text-emerald-400 shrink-0" strokeWidth={1.75} />
                              )}
                              <span className="text-sm font-medium text-zinc-100 truncate">
                                {label}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-center justify-between sm:justify-end">
                              <label className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs sm:text-sm text-zinc-400 min-h-[42px]">
                                <span>Власні</span>
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  max="100"
                                  value={rule.rateOwnFunds}
                                  onChange={(e) =>
                                    void runSafeAction(
                                      () =>
                                        onUpsertRule({
                                          id: rule.id,
                                          cardId: rule.cardId,
                                          monthYear: rule.monthYear,
                                          ruleType: rule.ruleType,
                                          categoryId: rule.categoryId,
                                          merchantId: rule.merchantId,
                                          customPartnerName: rule.customPartnerName,
                                          rateOwnFunds: Number(e.target.value) || 0,
                                          rateCreditFunds: rule.rateCreditFunds,
                                        }),
                                      'Не вдалося оновити відсоток.',
                                    )
                                  }
                                  className="w-14 bg-transparent font-mono text-base font-medium tabular-nums text-zinc-100 text-right focus:outline-none"
                                />
                                <span className="font-mono">%</span>
                              </label>

                              <label className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs sm:text-sm text-zinc-400 min-h-[42px]">
                                <span>Кред.</span>
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  max="100"
                                  value={rule.rateCreditFunds}
                                  onChange={(e) =>
                                    void runSafeAction(
                                      () =>
                                        onUpsertRule({
                                          id: rule.id,
                                          cardId: rule.cardId,
                                          monthYear: rule.monthYear,
                                          ruleType: rule.ruleType,
                                          categoryId: rule.categoryId,
                                          merchantId: rule.merchantId,
                                          customPartnerName: rule.customPartnerName,
                                          rateOwnFunds: rule.rateOwnFunds,
                                          rateCreditFunds: Number(e.target.value) || 0,
                                        }),
                                      'Не вдалося оновити відсоток.',
                                    )
                                  }
                                  className="w-14 bg-transparent font-mono text-base font-medium tabular-nums text-zinc-100 text-right focus:outline-none"
                                />
                                <span className="font-mono">%</span>
                              </label>

                              <button
                                type="button"
                                onClick={() =>
                                  void runSafeAction(
                                    () => onDeleteRule(rule.id),
                                    'Не вдалося видалити правило.',
                                  )
                                }
                                aria-label={`Видалити правило ${label}`}
                                className="min-h-[42px] min-w-[42px] rounded-xl flex items-center justify-center text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
