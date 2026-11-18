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
    label: 'Додати новий магазин або сервіс',
    hint: 'Мережі ще немає в довіднику України',
  },
  {
    value: 'FIX_MCC_CATEGORY',
    label: 'Виправити категорію або MCC-код',
    hint: 'Термінал магазину пройшов під іншим MCC',
  },
  {
    value: 'BANK_UPDATE',
    label: 'Оновити умови банку чи картку',
    hint: 'Змінилися умови одного з 21 банку або з’явився новий банк',
  },
  {
    value: 'OTHER',
    label: 'Інша пропозиція для сервісу',
    hint: 'Побажання щодо розрахунків чи інтерфейсу',
  },
];

function StatusBadge({ status }: { status: SuggestionStatus }) {
  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
        <CheckCircle2 className="h-3 w-3" strokeWidth={1.75} />
        Схвалено
      </span>
    );
  }
  if (status === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[11px] font-medium text-rose-300">
        <XCircle className="h-3 w-3" strokeWidth={1.75} />
        Відхилено
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
      <Clock className="h-3 w-3 text-zinc-400" strokeWidth={1.75} />
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
      setSuccessMessage('Пропозицію змін збережено та передано на розгляд');
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suggestion-modal-title"
    >
      <div className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-zinc-900 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-zinc-800 border border-white/[0.08] flex items-center justify-center shrink-0">
              <MessageSquarePlus className="h-5 w-5 text-emerald-400" strokeWidth={1.75} />
            </div>
            <div>
              <h2 id="suggestion-modal-title" className="text-base font-semibold text-zinc-50">
                Запропонувати зміни
              </h2>
              <p className="text-xs text-zinc-400">
                Оновлення бази магазинів України, MCC-кодів та умов банків
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити вікно"
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-950 p-1 border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`min-h-[38px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'form'
                ? 'bg-zinc-800 text-zinc-50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Нова пропозиція
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`min-h-[38px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-zinc-800 text-zinc-50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Мої пропозиції ({history.length})
          </button>
        </div>

        {activeTab === 'form' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-300">Тип звернення</label>
              <div className="grid grid-cols-1 gap-1.5">
                {SUGGESTION_TYPES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSuggestionType(item.value)}
                    className={`text-left rounded-xl border px-3.5 py-2.5 transition-[background-color,border-color] duration-150 cursor-pointer ${
                      suggestionType === item.value
                        ? 'bg-emerald-500/[0.08] border-emerald-500/40 text-zinc-50'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-xs font-medium">{item.label}</div>
                    <div className="text-[11px] text-zinc-400">{item.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300" htmlFor="sug-target">
                Назва магазину, банку або теми
              </label>
              <input
                id="sug-target"
                type="text"
                required
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="Наприклад: Лоток, ПУМБ або Аврора"
                className="w-full min-h-[44px] rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {(suggestionType === 'NEW_MERCHANT' || suggestionType === 'FIX_MCC_CATEGORY') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300" htmlFor="sug-cat">
                    Категорія витрат
                  </label>
                  <select
                    id="sug-cat"
                    value={proposedCategoryId}
                    onChange={(e) => setProposedCategoryId(e.target.value as CategoryId | '')}
                    className="w-full min-h-[44px] rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Оберіть категорію</option>
                    {UA_CATEGORIES.filter((c) => !c.isUniversal).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nameUk}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300" htmlFor="sug-mcc">
                    MCC-код (опціонально)
                  </label>
                  <input
                    id="sug-mcc"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={proposedMcc}
                    onChange={(e) => setProposedMcc(e.target.value.replace(/\D/g, ''))}
                    placeholder="5411"
                    className="w-full min-h-[44px] rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300" htmlFor="sug-details">
                Деталі пропозиції
              </label>
              <textarea
                id="sug-details"
                required
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Опишіть, що варто додати або виправити"
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 resize-none"
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
              className="w-full min-h-[46px] rounded-xl bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-medium text-sm flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer"
            >
              <Send className="h-4 w-4" strokeWidth={1.75} />
              {submitting ? 'Надсилаємо...' : 'Надіслати пропозицію змін'}
            </button>
          </form>
        ) : (
          <div className="space-y-2.5 max-h-[55dvh] overflow-y-auto pr-1">
            {history.length === 0 ? (
              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-6 text-center text-xs text-zinc-400">
                Ви ще не надсилали пропозицій змін. Тут відображаються лише ваші особисті заявки.
              </div>
            ) : (
              history.map((item) => {
                const catName = item.proposedCategoryId
                  ? UA_CATEGORIES.find((c) => c.id === item.proposedCategoryId)?.nameUk
                  : null;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl bg-zinc-950 border border-zinc-800 p-3.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-zinc-100">{item.targetName}</div>
                      <StatusBadge status={item.status} />
                    </div>
                    {(catName || item.proposedMcc) && (
                      <div className="text-[11px] text-zinc-400 font-mono">
                        {catName && <span className="font-sans">{catName}</span>}
                        {catName && item.proposedMcc && <span> · </span>}
                        {item.proposedMcc && <span>MCC {item.proposedMcc}</span>}
                      </div>
                    )}
                    <p className="text-xs text-zinc-300 leading-relaxed">{item.details}</p>
                    <div className="text-[11px] font-mono text-zinc-500">
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
