import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Clock,
  MessageSquarePlus,
  Send,
  X,
  XCircle,
} from 'lucide-react';
import { UA_CATEGORIES } from '../data/ukrainianCatalog';
import { authAndDataService } from '../services/authAndDataService';
import type {
  CategoryId,
  ChangeSuggestion,
  SuggestionStatus,
  SuggestionType,
} from '../types/domain';

interface ChangeSuggestionModalProps {
  isOpen: boolean;
  userId: string;
  initialTargetName?: string;
  initialType?: SuggestionType;
  initialCategoryId?: CategoryId;
  onClose: () => void;
}

const SUGGESTION_TYPES: Array<{ value: SuggestionType; label: string; hint: string }> = [
  {
    value: 'NEW_MERCHANT',
    label: 'Додати новий магазин / сервіс',
    hint: 'Магазину ще немає в довіднику України',
  },
  {
    value: 'FIX_MCC_CATEGORY',
    label: 'Виправити категорію або MCC-код',
    hint: 'Термінал магазину пройшов під іншим MCC',
  },
  {
    value: 'BANK_UPDATE',
    label: 'Оновити умови банку чи додати картку',
    hint: 'Змінилися умови одного з 21 банку або з’явився новий банк',
  },
  {
    value: 'OTHER',
    label: 'Інша пропозиція / Ідея для сервісу',
    hint: 'Побажання щодо інтерфейсу чи функцій',
  },
];

function StatusBadge({ status }: { status: SuggestionStatus }) {
  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Схвалено
      </span>
    );
  }
  if (status === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[11px] font-medium text-rose-300">
        <XCircle className="h-3 w-3" />
        Відхилено
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
      <Clock className="h-3 w-3" />
      На розгляді
    </span>
  );
}

export function ChangeSuggestionModal({
  isOpen,
  userId,
  initialTargetName = '',
  initialType = 'NEW_MERCHANT',
  initialCategoryId,
  onClose,
}: ChangeSuggestionModalProps) {
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [suggestionType, setSuggestionType] = useState<SuggestionType>(initialType);
  const [targetName, setTargetName] = useState(initialTargetName);
  const [proposedCategoryId, setProposedCategoryId] = useState<CategoryId | ''>(
    initialCategoryId ?? '',
  );
  const [proposedMcc, setProposedMcc] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<ChangeSuggestion[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setTargetName(initialTargetName);
    setSuggestionType(initialType);
    setProposedCategoryId(initialCategoryId ?? '');
    setError(null);
    setSuccessMessage(null);
    authAndDataService
      .listUserSuggestions(userId)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [isOpen, userId, initialTargetName, initialType, initialCategoryId]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      const parsedMcc =
        proposedMcc.trim() && /^\d{4}$/.test(proposedMcc.trim())
          ? Number(proposedMcc.trim())
          : undefined;

      const created = await authAndDataService.submitChangeSuggestion(userId, {
        suggestionType,
        targetName,
        proposedCategoryId: proposedCategoryId || undefined,
        proposedMcc: parsedMcc,
        details,
      });

      setHistory((prev) => [created, ...prev]);
      setSuccessMessage('Дякуємо! Вашу пропозицію змін збережено та передано на розгляд.');
      setTargetName('');
      setProposedMcc('');
      setDetails('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося надіслати пропозицію.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suggestion-modal-title"
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <MessageSquarePlus className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h2 id="suggestion-modal-title" className="text-lg font-bold text-white">
                Запропонувати зміни
              </h2>
              <p className="text-xs text-slate-400">
                Допоможіть покращити базу українських магазинів, MCC-кодів та банків
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити вікно"
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-950 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`min-h-[40px] rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'form'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Нова пропозиція
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`min-h-[40px] rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Мої пропозиції ({history.length})
          </button>
        </div>

        {activeTab === 'form' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Тип звернення</label>
              <div className="grid grid-cols-1 gap-2">
                {SUGGESTION_TYPES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSuggestionType(item.value)}
                    className={`text-left rounded-xl border px-3.5 py-2.5 transition cursor-pointer ${
                      suggestionType === item.value
                        ? 'bg-amber-500/10 border-amber-500/40 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold">{item.label}</div>
                    <div className="text-[11px] text-slate-400">{item.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="sug-target">
                Назва магазину, банку або теми *
              </label>
              <input
                id="sug-target"
                type="text"
                required
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="Наприклад: Лоток, ПУМБ або Аврора на Позняках"
                className="w-full min-h-[44px] rounded-xl bg-slate-950 border border-slate-800 px-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {(suggestionType === 'NEW_MERCHANT' || suggestionType === 'FIX_MCC_CATEGORY') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300" htmlFor="sug-cat">
                    Категорія витрат
                  </label>
                  <select
                    id="sug-cat"
                    value={proposedCategoryId}
                    onChange={(e) => setProposedCategoryId(e.target.value as CategoryId | '')}
                    className="w-full min-h-[44px] rounded-xl bg-slate-950 border border-slate-800 px-3 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Оберіть категорію...</option>
                    {UA_CATEGORIES.filter((c) => !c.isUniversal).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nameUk}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300" htmlFor="sug-mcc">
                    MCC-код (якщо відомий)
                  </label>
                  <input
                    id="sug-mcc"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={proposedMcc}
                    onChange={(e) => setProposedMcc(e.target.value.replace(/\D/g, ''))}
                    placeholder="Напр. 5411"
                    className="w-full min-h-[44px] rounded-xl bg-slate-950 border border-slate-800 px-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="sug-details">
                Деталі пропозиції *
              </label>
              <textarea
                id="sug-details"
                required
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Опишіть, що варто додати або виправити..."
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-300">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2.5 text-xs text-emerald-300">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Надсилаємо...' : 'Надіслати пропозицію змін'}
            </button>
          </form>
        ) : (
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {history.length === 0 ? (
              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-6 text-center text-xs text-slate-400">
                Ви ще не надсилали пропозицій змін. Тут відображатимуться лише ваші особисті заявки.
              </div>
            ) : (
              history.map((item) => {
                const catName = item.proposedCategoryId
                  ? UA_CATEGORIES.find((c) => c.id === item.proposedCategoryId)?.nameUk
                  : null;
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-slate-950 border border-slate-800 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-white">{item.targetName}</div>
                      <StatusBadge status={item.status} />
                    </div>
                    {(catName || item.proposedMcc) && (
                      <div className="text-[11px] text-slate-400">
                        {catName && <span>Категорія: {catName}</span>}
                        {catName && item.proposedMcc && <span> • </span>}
                        {item.proposedMcc && <span>MCC {item.proposedMcc}</span>}
                      </div>
                    )}
                    <p className="text-xs text-slate-300 leading-relaxed">{item.details}</p>
                    <div className="text-[10px] text-slate-500">
                      {new Date(item.createdAt).toLocaleString('uk-UA')}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
