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
      if (
        categoryFilter !== 'ALL' &&
        m.categoryId !== categoryFilter &&
        m.secondaryCategoryId !== categoryFilter
      ) {
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
    <div className="space-y-6 pb-10 animate-radar-enter">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-50 tracking-tight">
            Довідник України
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mt-1 font-mono">
            {UA_BANKS.length} банків · {UA_CATEGORIES.length} категорій · {UA_MERCHANTS.length} мереж із MCC
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
          className="w-full sm:w-auto min-h-[44px] px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-sm font-medium inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer sm:self-center"
        >
          <MessageSquarePlus className="h-4 w-4 text-emerald-400" strokeWidth={1.75} />
          Запропонувати зміни
        </button>
      </section>

      {/* Перемикач вкладок довідника */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-900 p-1 border border-zinc-800 w-full sm:max-w-xl">
        <button
          type="button"
          onClick={() => setTab('merchants')}
          className={`min-h-[44px] px-2 rounded-lg text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            tab === 'merchants' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <Store className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="truncate">Магазини ({UA_MERCHANTS.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('categories')}
          className={`min-h-[44px] px-2 rounded-lg text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            tab === 'categories' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <Tag className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="truncate">Категорії ({UA_CATEGORIES.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('banks')}
          className={`min-h-[44px] px-2 rounded-lg text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            tab === 'banks' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <Building2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="truncate">Банки ({UA_BANKS.length})</span>
        </button>
      </div>

      {tab === 'merchants' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500" strokeWidth={1.75} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Пошук магазину або MCC"
                className="w-full min-h-[48px] rounded-xl bg-zinc-900 border border-zinc-800 pl-10 pr-4 text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryId | 'ALL')}
              className="w-full min-h-[48px] rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 text-base sm:text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Усі категорії</option>
              {UA_CATEGORIES.filter((c) => !c.isUniversal).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nameUk}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px rounded-2xl border border-zinc-800 bg-zinc-800/70 overflow-hidden">
            {filteredMerchants.map((m) => {
              const cat = CATEGORY_BY_ID.get(m.categoryId);
              return (
                <article
                  key={m.id}
                  className="bg-zinc-950/95 p-4 sm:p-5 flex flex-col justify-between gap-3 hover:bg-zinc-900/90 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-medium text-zinc-100">{m.nameUk}</h3>
                      <span className="rounded-md bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 text-xs font-mono text-zinc-300 shrink-0">
                        MCC {m.defaultMcc}
                      </span>
                    </div>
                    {cat && (
                      <div className="inline-flex items-center gap-1.5 text-sm text-zinc-300">
                        <CategoryIcon iconName={cat.iconName} className="h-4 w-4 text-emerald-400" strokeWidth={1.75} />
                        <span>{cat.nameUk}</span>
                      </div>
                    )}
                    {m.notesUk && (
                      <p className="text-xs sm:text-sm text-zinc-400 flex items-start gap-1.5 leading-relaxed">
                        <Info className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" strokeWidth={1.75} />
                        <span>{m.notesUk}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-900">
                    <button
                      type="button"
                      onClick={() => onSelectCategoryForRadar(m.categoryId)}
                      className="min-h-[40px] text-sm font-medium text-emerald-400 hover:text-emerald-300 cursor-pointer"
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
                      className="min-h-[40px] text-xs sm:text-sm text-zinc-400 hover:text-zinc-200 cursor-pointer"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px rounded-2xl border border-zinc-800 bg-zinc-800/70 overflow-hidden">
          {UA_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategoryForRadar(cat.id)}
              className="bg-zinc-950/95 hover:bg-zinc-900 p-4 sm:p-5 text-left flex items-start gap-3.5 transition-colors cursor-pointer"
            >
              <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 shrink-0">
                <CategoryIcon iconName={cat.iconName} className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="text-base font-medium text-zinc-100">{cat.nameUk}</div>
                <div className="text-xs sm:text-sm font-mono text-zinc-400 mt-0.5">
                  {cat.mccCodes.length > 0
                    ? `MCC: ${cat.mccCodes.join(', ')}`
                    : 'Базовий відсоток для всіх оплат'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === 'banks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px rounded-2xl border border-zinc-800 bg-zinc-800/70 overflow-hidden">
          {UA_BANKS.map((bank) => (
            <article key={bank.id} className="bg-zinc-950/95 p-4 sm:p-5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: bank.brandColor }}
                  />
                  <h3 className="text-base font-medium text-zinc-100">{bank.nameUk}</h3>
                </div>
                <span className="text-xs sm:text-sm font-mono text-zinc-400">
                  Податок {bank.defaultTaxPercent}%
                </span>
              </div>
              <div className="text-sm text-zinc-400 pl-6">
                {bank.cardPresets.join(', ')}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
