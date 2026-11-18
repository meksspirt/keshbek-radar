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

  return (
    <div className="space-y-5 pb-10">
      {/* Верхня панель керування гаманцем */}
      <section className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Період налаштування: {formatMonthLabel(monthYear)}
          </div>
          <h2 className="text-xl font-bold text-white mt-0.5">Мої банківські картки</h2>
          <p className="text-xs text-slate-400 mt-1">
            Оберіть ваші банки з пулу 21 банку України та вкажіть активні `%` за власні та кредитні
            кошти.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cards.length > 0 && (
            confirmReset ? (
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-1">
                <button
                  type="button"
                  onClick={async () => {
                    await onResetMonthRates(monthYear);
                    setConfirmReset(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Підтвердити обнулення
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2 py-1.5 text-xs text-slate-300 cursor-pointer"
                >
                  Скасувати
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="min-h-[44px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Новий місяць (обнулити %)
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => setShowAddCardForm((prev) => !prev)}
            className="min-h-[44px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            {showAddCardForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            Додати картку
          </button>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Форма додавання картки з пулу 21 українського банку */}
      {showAddCardForm && (
        <form
          onSubmit={handleCreateCard}
          className="rounded-3xl bg-slate-900 border border-emerald-500/40 p-5 space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Нова картка з пулу України (21 банк)</h3>
            <button
              type="button"
              onClick={() => setShowAddCardForm(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">Оберіть банк</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
              {UA_BANKS.map((bank) => {
                const selected = bank.id === selectedBankId;
                return (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => handleBankSelect(bank.id)}
                    className={`min-h-[44px] rounded-xl px-3 py-2 text-left border flex items-center gap-2 transition cursor-pointer ${
                      selected
                        ? 'bg-emerald-500/15 border-emerald-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: bank.brandColor }}
                    />
                    <span className="text-xs font-medium truncate">{bank.nameUk}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="card-name-input">
                Назва картки
              </label>
              <input
                id="card-name-input"
                type="text"
                required
                value={cardNameInput}
                onChange={(e) => setCardNameInput(e.target.value)}
                placeholder="Наприклад: Чорна картка"
                className="w-full min-h-[44px] rounded-xl bg-slate-950 border border-slate-800 px-3.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              {selectedBank.cardPresets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedBank.cardPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCardNameInput(preset)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="card-tax-input">
                Податок на кешбек (%)
              </label>
              <input
                id="card-tax-input"
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={taxPercentInput}
                onChange={(e) => setTaxPercentInput(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-slate-950 border border-slate-800 px-3.5 text-sm text-white tabular-nums focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-500">Стандарт в Україні: 23% (18% ПДФО + 5% ВЗ)</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={addingCard}
              className="min-h-[46px] px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm inline-flex items-center gap-2 transition cursor-pointer"
            >
              <Check className="h-4 w-4" />
              {addingCard ? 'Збереження...' : 'Додати картку в гаманець'}
            </button>
          </div>
        </form>
      )}

      {/* Порожній стан */}
      {cards.length === 0 ? (
        <div className="rounded-3xl bg-slate-900/60 border border-dashed border-slate-800 p-8 text-center space-y-3">
          <p className="text-sm text-slate-300">
            Ваш гаманець порожній. Натисніть <b>«Додати картку»</b> вище або завантажте готовий
            приклад.
          </p>
          <button
            type="button"
            onClick={onPopulateDemoWallet}
            className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 inline-flex items-center gap-2 border border-slate-700 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
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
                className={`rounded-3xl border p-4 sm:p-5 space-y-4 transition ${
                  card.isActive
                    ? 'bg-slate-900/90 border-slate-800'
                    : 'bg-slate-900/40 border-slate-800/60 opacity-70'
                }`}
              >
                {/* Шапка картки */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: bank?.brandColor ?? '#334155' }}
                    >
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">
                          {bank?.nameUk ?? card.bankId}
                        </h3>
                        <span className="text-xs text-slate-400">• {card.cardName}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Податок: {card.taxPercent}% • Правил на місяць: {cardRules.length}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleCardActive(card.id, !card.isActive)}
                      className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        card.isActive
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
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
                      className="min-h-[38px] px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Додати категорію / %
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteCard(card.id)}
                      aria-label={`Видалити картку ${card.cardName}`}
                      className="min-h-[38px] min-w-[38px] rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 flex items-center justify-center transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Форма додавання/оновлення правила кешбеку на місяць */}
                {isEditing && (
                  <form
                    onSubmit={(e) => handleSaveRule(e, card.id)}
                    className="rounded-2xl bg-slate-950 border border-slate-800 p-4 space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-900 p-1 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setRuleMode('CATEGORY')}
                        className={`min-h-[38px] rounded-lg text-xs font-semibold transition cursor-pointer ${
                          ruleMode === 'CATEGORY'
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Категорія (з 25)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRuleMode('MERCHANT')}
                        className={`min-h-[38px] rounded-lg text-xs font-semibold transition cursor-pointer ${
                          ruleMode === 'MERCHANT'
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Партнерський магазин
                      </button>
                    </div>

                    {ruleMode === 'CATEGORY' ? (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-300">
                          Категорія кешбеку на {formatMonthLabel(monthYear)}
                        </label>
                        <select
                          value={ruleCategoryId}
                          onChange={(e) => setRuleCategoryId(e.target.value as CategoryId)}
                          className="w-full min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                        >
                          {UA_CATEGORIES.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.nameUk}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-slate-300">
                            Магазин зі списку України
                          </label>
                          <select
                            value={ruleMerchantId}
                            onChange={(e) => {
                              setRuleMerchantId(e.target.value);
                              setCustomPartnerInput('');
                            }}
                            className="w-full min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                          >
                            {UA_MERCHANTS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.nameUk}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-slate-300">
                            Або впишіть назву партнера вручну
                          </label>
                          <input
                            type="text"
                            value={customPartnerInput}
                            onChange={(e) => setCustomPartnerInput(e.target.value)}
                            placeholder="Напр. Сільпо або Аврора"
                            className="w-full min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-emerald-400">
                          % за ВЛАСНІ кошти
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={ownRateInput}
                          onChange={(e) => setOwnRateInput(e.target.value)}
                          className="w-full min-h-[44px] rounded-xl bg-slate-900 border border-emerald-500/40 px-3.5 text-sm font-bold tabular-nums text-white focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-sky-400">
                          % за КРЕДИТНІ кошти
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={creditRateInput}
                          onChange={(e) => setCreditRateInput(e.target.value)}
                          className="w-full min-h-[44px] rounded-xl bg-slate-900 border border-sky-500/40 px-3.5 text-sm font-bold tabular-nums text-white focus:outline-none focus:border-sky-400"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCardId(null)}
                        className="min-h-[40px] px-4 rounded-xl text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
                      >
                        Скасувати
                      </button>
                      <button
                        type="submit"
                        disabled={savingRule}
                        className="min-h-[40px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
                      >
                        {savingRule ? 'Збереження...' : 'Зберегти відсотки'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Активні правила картки на поточний місяць */}
                {cardRules.length === 0 ? (
                  <div className="rounded-2xl bg-slate-950/60 border border-slate-800/70 px-4 py-3 text-xs text-slate-500">
                    Для цієї картки ще не обрано категорій кешбеку на поточний місяць.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/70 rounded-2xl bg-slate-950/70 border border-slate-800/80 overflow-hidden">
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
                          className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {cat ? (
                              <CategoryIcon
                                iconName={cat.iconName}
                                className="h-4 w-4 text-emerald-400 shrink-0"
                              />
                            ) : (
                              <Store className="h-4 w-4 text-amber-400 shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-slate-200 truncate">
                              {label}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <label className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-300">
                              <span>Власні:</span>
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                max="100"
                                value={rule.rateOwnFunds}
                                onChange={(e) =>
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
                                  })
                                }
                                className="w-14 bg-transparent font-bold tabular-nums text-white text-right focus:outline-none"
                              />
                              <span>%</span>
                            </label>

                            <label className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 border border-sky-500/30 px-2 py-1 text-[11px] text-sky-300">
                              <span>Кред.:</span>
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                max="100"
                                value={rule.rateCreditFunds}
                                onChange={(e) =>
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
                                  })
                                }
                                className="w-14 bg-transparent font-bold tabular-nums text-white text-right focus:outline-none"
                              />
                              <span>%</span>
                            </label>

                            <button
                              type="button"
                              onClick={() => onDeleteRule(rule.id)}
                              aria-label={`Видалити правило ${label}`}
                              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
