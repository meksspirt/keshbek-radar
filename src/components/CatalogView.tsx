import { useMemo, useState } from 'react';
import { Building2, Info, MessageSquarePlus, Search, Store, Tag } from 'lucide-react';
import {
  CATEGORY_BY_ID,
  UA_BANKS,
  UA_CATEGORIES,
  UA_MERCHANTS,
} from '../data/ukrainianCatalog';
import { normalizeSearchText } from '../engine/cashbackEngine';
import type { CategoryId, SuggestionType } from '../types/domain';
import { CategoryIcon } from './CategoryIcon';

interface CatalogViewProps {
  onSelectCategoryForRadar: (categoryId: CategoryId) => void;
  onOpenSuggestion: (params: {
    targetName?: string;
    type?: SuggestionType;
    categoryId?: CategoryId;
  }) => void;
}

export function CatalogView({
  onSelectCategoryForRadar,
  onOpenSuggestion,
}: CatalogViewProps) {
  const [tab, setTab] = useState<'merchants' | 'categories' | 'banks'>('merchants');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'ALL'>('ALL');

  const filteredMerchants = useMemo(() => {
    const norm = normalizeSearchText(search);
    return UA_MERCHANTS.filter((m) => {
      if (categoryFilter !== 'ALL' && m.categoryId !== categoryFilter && m.secondaryCategoryId !== categoryFilter) {
        return false;
      }
      if (!norm) return true;
      return (
        normalizeSearchText(m.nameUk).includes(norm) ||
        String(m.defaultMcc).includes(norm) ||
        m.searchAliases.some((a) => normalizeSearchText(a).includes(norm))
      );
    });
  }, [search, categoryFilter]);

  return (
    <div className="space-y-5 pb-10">
      <section className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Довідник України</h2>
          <p className="text-xs text-slate-400 mt-1">
            {UA_BANKS.length} українських банків (листопад 2026) • {UA_CATEGORIES.length} категорій •{' '}
            {UA_MERCHANTS.length} мереж і сервісів із MCC-кодами
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onOpenSuggestion({
              type: 'NEW_MERCHANT',
              targetName: search.trim(),
            })
          }
          className="min-h-[44px] px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer self-start sm:self-center"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Запропонувати зміни
        </button>
      </section>

      {/* Вкладки довідника */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-900 p-1.5 border border-slate-800">
        <button
          type="button"
          onClick={() => setTab('merchants')}
          className={`min-h-[44px] rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
            tab === 'merchants' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Store className="h-4 w-4" />
          Магазини ({UA_MERCHANTS.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('categories')}
          className={`min-h-[44px] rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
            tab === 'categories' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Tag className="h-4 w-4" />
          Категорії ({UA_CATEGORIES.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('banks')}
          className={`min-h-[44px] rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
            tab === 'banks' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Банки ({UA_BANKS.length})
        </button>
      </div>

      {tab === 'merchants' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Пошук магазину або MCC-коду..."
                className="w-full min-h-[46px] rounded-xl bg-slate-900 border border-slate-800 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryId | 'ALL')}
              className="w-full min-h-[46px] rounded-xl bg-slate-900 border border-slate-800 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Усі категорії</option>
              {UA_CATEGORIES.filter((c) => !c.isUniversal).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nameUk}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredMerchants.map((m) => {
              const cat = CATEGORY_BY_ID.get(m.categoryId);
              return (
                <article
                  key={m.id}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-white">{m.nameUk}</h3>
                      <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-300 shrink-0">
                        MCC {m.defaultMcc}
                      </span>
                    </div>
                    {cat && (
                      <div className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                        <CategoryIcon iconName={cat.iconName} className="h-3.5 w-3.5" />
                        <span>{cat.nameUk}</span>
                      </div>
                    )}
                    {m.notesUk && (
                      <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                        <Info className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <span>{m.notesUk}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/70">
                    <button
                      type="button"
                      onClick={() => onSelectCategoryForRadar(m.categoryId)}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                    >
                      Порахувати кешбек →
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenSuggestion({
                          type: 'FIX_MCC_CATEGORY',
                          targetName: m.nameUk,
                          categoryId: m.categoryId,
                        })
                      }
                      className="text-[11px] text-slate-400 hover:text-amber-300 cursor-pointer"
                    >
                      Уточнити MCC
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {UA_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategoryForRadar(cat.id)}
              className="rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 p-4 text-left space-y-2 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <CategoryIcon iconName={cat.iconName} className="h-4 w-4" />
                </div>
                <div className="text-sm font-bold text-white">{cat.nameUk}</div>
              </div>
              <div className="text-[11px] text-slate-400">
                {cat.mccCodes.length > 0
                  ? `MCC: ${cat.mccCodes.join(', ')}`
                  : 'Працює як базовий відсоток для всіх покупок'}
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === 'banks' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {UA_BANKS.map((bank) => (
            <article
              key={bank.id}
              className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: bank.brandColor }}
                  />
                  <h3 className="text-sm font-bold text-white">{bank.nameUk}</h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  Податок {bank.defaultTaxPercent}%
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Картки: {bank.cardPresets.join(', ')}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
