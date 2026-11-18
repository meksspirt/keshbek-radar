import { BANK_BY_ID, CATEGORY_BY_ID, UA_BANKS, UA_CATEGORIES, UA_MERCHANTS } from '../data/ukrainianCatalog';
import type {
  Bank,
  CashbackRule,
  Category,
  CategoryId,
  FundOptionResult,
  Merchant,
  PaymentRecommendation,
  PurchaseQuery,
  QueryResolutionResult,
  RuleType,
  TaxMode,
  UserCard,
} from '../types/domain';

export const DEFAULT_REFERENCE_AMOUNT_UAH = 1000;

/**
 * Нормалізує український, російський або англійський пошуковий рядок
 * для толерантного пошуку незалежно від мови та розкладки.
 */
export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['’`"\-.,/\\()]+/g, ' ')
    .replace(/і/g, 'и')
    .replace(/ї/g, 'и')
    .replace(/є/g, 'е')
    .replace(/ґ/g, 'г')
    .replace(/ё/g, 'е')
    .replace(/э/g, 'е')
    .replace(/ы/g, 'и')
    .replace(/[ьъ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function scoreTermMatch(normalizedQuery: string, candidateRaw: string): number {
  const candidate = normalizeSearchText(candidateRaw);
  if (!candidate || !normalizedQuery) return 0;
  if (candidate === normalizedQuery) return 100;
  if (candidate.startsWith(normalizedQuery)) return 85;
  if (candidate.includes(normalizedQuery)) return 70;
  if (normalizedQuery.includes(candidate) && candidate.length >= 3) return 60;

  const queryWords = normalizedQuery.split(' ');
  const candidateWords = candidate.split(' ');
  let bestWordScore = 0;

  for (const qw of queryWords) {
    if (qw.length < 3) continue;
    for (const cw of candidateWords) {
      if (cw.startsWith(qw)) {
        bestWordScore = Math.max(bestWordScore, 65);
      } else if (qw.length >= 4 && cw.length >= 4) {
        const dist = levenshteinDistance(qw, cw);
        const maxAllowed = qw.length >= 6 ? 2 : 1;
        if (dist <= maxAllowed) {
          bestWordScore = Math.max(bestWordScore, 55 - dist * 10);
        }
      }
    }
  }

  return bestWordScore;
}

function scoreMerchant(normalizedQuery: string, merchant: Merchant): number {
  let best = scoreTermMatch(normalizedQuery, merchant.nameUk);
  best = Math.max(best, scoreTermMatch(normalizedQuery, merchant.slug));
  for (const alias of merchant.searchAliases) {
    best = Math.max(best, scoreTermMatch(normalizedQuery, alias));
  }
  return best;
}

function scoreCategory(normalizedQuery: string, category: Category): number {
  let best = scoreTermMatch(normalizedQuery, category.nameUk);
  for (const kw of category.keywords) {
    best = Math.max(best, scoreTermMatch(normalizedQuery, kw));
  }
  return best;
}

export function resolvePurchaseQuery(
  query: string,
  categories: Category[] = UA_CATEGORIES,
  merchants: Merchant[] = UA_MERCHANTS,
  selectedCategoryId?: CategoryId,
  selectedMerchantId?: string,
): QueryResolutionResult {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const merchantMap = new Map(merchants.map((m) => [m.id, m]));

  if (selectedMerchantId) {
    const merchant = merchantMap.get(selectedMerchantId) ?? null;
    if (merchant) {
      return {
        matchedMerchant: merchant,
        matchedCategory: catMap.get(merchant.categoryId) ?? null,
        secondaryCategory: merchant.secondaryCategoryId
          ? (catMap.get(merchant.secondaryCategoryId) ?? null)
          : null,
        matchedMcc: merchant.defaultMcc,
        suggestions: [],
      };
    }
  }

  if (selectedCategoryId) {
    const category = catMap.get(selectedCategoryId) ?? null;
    if (category) {
      return {
        matchedMerchant: null,
        matchedCategory: category,
        secondaryCategory: null,
        matchedMcc: category.mccCodes[0] ?? null,
        suggestions: [],
      };
    }
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return {
      matchedMerchant: null,
      matchedCategory: null,
      secondaryCategory: null,
      matchedMcc: null,
      suggestions: [],
    };
  }

  // Перевірка прямого пошуку за 4-значним MCC-кодом (наприклад "5411" або "MCC 5331")
  const mccMatch = trimmed.match(/^(?:mcc\s*)?(\d{4})$/i);
  if (mccMatch) {
    const mcc = Number(mccMatch[1]);
    const matchedCategory = categories.find((c) => c.mccCodes.includes(mcc)) ?? null;
    const matchingMerchants = merchants.filter((m) => m.defaultMcc === mcc);
    return {
      matchedMerchant: null,
      matchedCategory,
      secondaryCategory: null,
      matchedMcc: mcc,
      suggestions: matchingMerchants.slice(0, 6).map((m) => ({
        type: 'MERCHANT',
        id: m.id,
        label: m.nameUk,
        sublabel: `MCC ${m.defaultMcc} • ${catMap.get(m.categoryId)?.nameUk ?? ''}`,
        categoryId: m.categoryId,
        mcc: m.defaultMcc,
      })),
    };
  }

  const normalized = normalizeSearchText(trimmed);

  const scoredMerchants = merchants
    .map((m) => ({ merchant: m, score: scoreMerchant(normalized, m) }))
    .filter((entry) => entry.score >= 45)
    .sort((a, b) => b.score - a.score);

  const scoredCategories = categories
    .filter((c) => !c.isUniversal)
    .map((c) => ({ category: c, score: scoreCategory(normalized, c) }))
    .filter((entry) => entry.score >= 45)
    .sort((a, b) => b.score - a.score);

  const topMerchant = scoredMerchants[0] ?? null;
  const topCategory = scoredCategories[0] ?? null;

  let matchedMerchant: Merchant | null = null;
  let matchedCategory: Category | null = null;
  let secondaryCategory: Category | null = null;
  let matchedMcc: number | null = null;

  if (topMerchant && (!topCategory || topMerchant.score >= topCategory.score)) {
    matchedMerchant = topMerchant.merchant;
    matchedCategory = catMap.get(matchedMerchant.categoryId) ?? null;
    secondaryCategory = matchedMerchant.secondaryCategoryId
      ? (catMap.get(matchedMerchant.secondaryCategoryId) ?? null)
      : null;
    matchedMcc = matchedMerchant.defaultMcc;
  } else if (topCategory) {
    matchedCategory = topCategory.category;
    matchedMcc = matchedCategory.mccCodes[0] ?? null;
  }

  const suggestions: QueryResolutionResult['suggestions'] = [];

  for (const item of scoredMerchants.slice(0, 5)) {
    suggestions.push({
      type: 'MERCHANT',
      id: item.merchant.id,
      label: item.merchant.nameUk,
      sublabel: `${catMap.get(item.merchant.categoryId)?.nameUk ?? ''} • MCC ${item.merchant.defaultMcc}`,
      categoryId: item.merchant.categoryId,
      mcc: item.merchant.defaultMcc,
    });
  }

  for (const item of scoredCategories.slice(0, 3)) {
    suggestions.push({
      type: 'CATEGORY',
      id: item.category.id,
      label: item.category.nameUk,
      sublabel: `Категорія${item.category.mccCodes[0] ? ` • MCC ${item.category.mccCodes.slice(0, 3).join(', ')}` : ''}`,
      categoryId: item.category.id,
      mcc: item.category.mccCodes[0],
    });
  }

  return {
    matchedMerchant,
    matchedCategory,
    secondaryCategory,
    matchedMcc,
    suggestions: suggestions.slice(0, 8),
  };
}

interface CandidateRuleMatch {
  rule: CashbackRule;
  priority: number; // 3 = MERCHANT, 2 = PRIMARY CATEGORY, 1 = SECONDARY CATEGORY, 0 = ALL
  matchedBy: PaymentRecommendation['matchedBy'];
  title: string;
}

function findCandidateRuleMatches(
  cardRules: CashbackRule[],
  resolution: QueryResolutionResult,
  categoriesMap: Map<CategoryId, Category>,
  merchants: Merchant[],
): CandidateRuleMatch[] {
  const matches: CandidateRuleMatch[] = [];
  const primaryCatId = resolution.matchedCategory?.id;
  const secondaryCatId = resolution.secondaryCategory?.id;
  const merchant = resolution.matchedMerchant;

  for (const rule of cardRules) {
    if (rule.ruleType === 'MERCHANT') {
      if (merchant && rule.merchantId === merchant.id) {
        matches.push({
          rule,
          priority: 3,
          matchedBy: 'MERCHANT_PARTNER',
          title: `Партнер: ${merchant.nameUk}`,
        });
        continue;
      }

      if (rule.customPartnerName && merchant) {
        const partnerNorm = normalizeSearchText(rule.customPartnerName);
        const merchantNorm = normalizeSearchText(merchant.nameUk);
        if (
          partnerNorm === merchantNorm ||
          merchant.searchAliases.some((a) => normalizeSearchText(a) === partnerNorm)
        ) {
          matches.push({
            rule,
            priority: 3,
            matchedBy: 'MERCHANT_PARTNER',
            title: `Партнер: ${rule.customPartnerName}`,
          });
          continue;
        }
      }

      // Якщо користувач ввів назву партнера напряму без наявності у статичному каталозі
      if (!merchant && rule.merchantId) {
        const refMerchant = merchants.find((m) => m.id === rule.merchantId);
        if (refMerchant && primaryCatId && refMerchant.categoryId === primaryCatId) {
          // Не застосовуємо партнерське правило до всієї категорії — воно тільки для конкретного магазину
        }
      }
    }

    if (rule.ruleType === 'CATEGORY' && rule.categoryId) {
      if (rule.categoryId === 'all_purchases') {
        matches.push({
          rule,
          priority: 0,
          matchedBy: 'ALL_PURCHASES_BASE',
          title: 'Кешбек на усі покупки',
        });
        continue;
      }

      if (primaryCatId && rule.categoryId === primaryCatId) {
        const catName = categoriesMap.get(primaryCatId)?.nameUk ?? primaryCatId;
        matches.push({
          rule,
          priority: 2,
          matchedBy: 'CATEGORY_MCC',
          title: `Категорія: ${catName}`,
        });
        continue;
      }

      if (secondaryCatId && rule.categoryId === secondaryCatId) {
        const catName = categoriesMap.get(secondaryCatId)?.nameUk ?? secondaryCatId;
        matches.push({
          rule,
          priority: 1,
          matchedBy: 'CATEGORY_MCC',
          title: `Додаткова категорія: ${catName}`,
        });
        continue;
      }
    }

    if (rule.ruleType === 'ALL') {
      matches.push({
        rule,
        priority: 0,
        matchedBy: 'ALL_PURCHASES_BASE',
        title: 'Кешбек на усі покупки',
      });
    }
  }

  return matches;
}

function buildFundOption(
  amountUah: number,
  taxPercent: number,
  taxMode: TaxMode,
  candidates: CandidateRuleMatch[],
  fundKind: 'OWN' | 'CREDIT',
): { option: FundOptionResult; match: CandidateRuleMatch | null } {
  let bestMatch: CandidateRuleMatch | null = null;
  let bestRate = 0;

  for (const candidate of candidates) {
    const rate =
      fundKind === 'OWN' ? candidate.rule.rateOwnFunds : candidate.rule.rateCreditFunds;
    if (rate <= 0) continue;

    if (
      rate > bestRate ||
      (rate === bestRate && bestMatch !== null && candidate.priority > bestMatch.priority)
    ) {
      bestRate = rate;
      bestMatch = candidate;
    }
  }

  const grossCashbackUah = roundMoney((amountUah * bestRate) / 100);
  const netMultiplier = Math.max(0, 1 - taxPercent / 100);
  const netCashbackUah = roundMoney(grossCashbackUah * netMultiplier);
  const displayedCashbackUah = taxMode === 'NET' ? netCashbackUah : grossCashbackUah;

  const matchedRuleType: RuleType | null = bestMatch ? bestMatch.rule.ruleType : null;

  return {
    match: bestMatch,
    option: {
      ratePercent: bestRate,
      grossCashbackUah,
      netCashbackUah,
      displayedCashbackUah,
      matchedRuleTitle: bestMatch ? bestMatch.title : null,
      matchedRuleType,
    },
  };
}

export interface EvaluatePurchaseInput {
  query: PurchaseQuery;
  cards: UserCard[];
  rules: CashbackRule[];
  monthYear?: string;
  banks?: Bank[];
  categories?: Category[];
  merchants?: Merchant[];
}

export interface EvaluatePurchaseOutput {
  effectiveAmountUah: number;
  isDefaultAmount: boolean;
  resolution: QueryResolutionResult;
  recommendations: PaymentRecommendation[];
}

export function evaluatePurchase({
  query,
  cards,
  rules,
  monthYear,
  banks = UA_BANKS,
  categories = UA_CATEGORIES,
  merchants = UA_MERCHANTS,
}: EvaluatePurchaseInput): EvaluatePurchaseOutput {
  const banksMap = banks === UA_BANKS ? BANK_BY_ID : new Map(banks.map((b) => [b.id, b]));
  const categoriesMap =
    categories === UA_CATEGORIES ? CATEGORY_BY_ID : new Map(categories.map((c) => [c.id, c]));

  const hasValidAmount = typeof query.amountUah === 'number' && Number.isFinite(query.amountUah) && query.amountUah > 0;
  const effectiveAmountUah = hasValidAmount ? roundMoney(query.amountUah as number) : DEFAULT_REFERENCE_AMOUNT_UAH;

  const resolution = resolvePurchaseQuery(
    query.query,
    categories,
    merchants,
    query.selectedCategoryId,
    query.selectedMerchantId,
  );

  // Також перевіряємо, чи не збігається запит напряму з кастомним партнером у правилах користувача
  const normalizedQuery = normalizeSearchText(query.query);
  const activeCards = cards.filter((c) => c.isActive);

  const recommendations: PaymentRecommendation[] = [];

  for (const card of activeCards) {
    const bank = banksMap.get(card.bankId);
    if (!bank) continue;

    const cardRules = rules.filter(
      (r) => r.cardId === card.id && (!monthYear || r.monthYear === monthYear),
    );

    const candidates = findCandidateRuleMatches(cardRules, resolution, categoriesMap, merchants);

    // Перевірка на випадок, якщо користувач додав власного партнера (customPartnerName), якого немає у базовому каталозі
    if (normalizedQuery) {
      for (const rule of cardRules) {
        if (
          rule.ruleType === 'MERCHANT' &&
          rule.customPartnerName &&
          !candidates.some((c) => c.rule.id === rule.id)
        ) {
          const score = scoreTermMatch(normalizedQuery, rule.customPartnerName);
          if (score >= 70) {
            candidates.push({
              rule,
              priority: 3,
              matchedBy: 'MERCHANT_PARTNER',
              title: `Партнер: ${rule.customPartnerName}`,
            });
          }
        }
      }
    }

    const ownRes = buildFundOption(
      effectiveAmountUah,
      card.taxPercent,
      query.taxMode,
      candidates,
      'OWN',
    );
    const creditRes = buildFundOption(
      effectiveAmountUah,
      card.taxPercent,
      query.taxMode,
      candidates,
      'CREDIT',
    );

    const ownRate = ownRes.option.ratePercent;
    const creditRate = creditRes.option.ratePercent;

    let bestFundType: PaymentRecommendation['bestFundType'] = 'NONE';
    let bestOption = ownRes.option;
    let bestMatch = ownRes.match;

    if (ownRate === 0 && creditRate === 0) {
      bestFundType = 'NONE';
    } else if (ownRate > creditRate) {
      bestFundType = 'OWN';
      bestOption = ownRes.option;
      bestMatch = ownRes.match;
    } else if (creditRate > ownRate) {
      bestFundType = 'CREDIT';
      bestOption = creditRes.option;
      bestMatch = creditRes.match;
    } else {
      bestFundType = 'EQUAL';
      bestOption = ownRes.option;
      bestMatch = ownRes.match ?? creditRes.match;
    }

    const matchedBy: PaymentRecommendation['matchedBy'] = bestMatch
      ? bestMatch.matchedBy
      : 'NONE';

    const matchedTitle = bestMatch
      ? bestMatch.title
      : resolution.matchedCategory
        ? `Немає кешбеку для «${resolution.matchedCategory.nameUk}»`
        : 'Не налаштовано активних категорій';

    recommendations.push({
      card,
      bank,
      matchedBy,
      matchedTitle,
      ownFunds: ownRes.option,
      creditFunds: creditRes.option,
      bestFundType,
      bestRatePercent: bestOption.ratePercent,
      bestGrossCashbackUah: bestOption.grossCashbackUah,
      bestNetCashbackUah: bestOption.netCashbackUah,
      bestDisplayedCashbackUah: bestOption.displayedCashbackUah,
    });
  }

  recommendations.sort((a, b) => {
    if (b.bestDisplayedCashbackUah !== a.bestDisplayedCashbackUah) {
      return b.bestDisplayedCashbackUah - a.bestDisplayedCashbackUah;
    }
    if (b.bestRatePercent !== a.bestRatePercent) {
      return b.bestRatePercent - a.bestRatePercent;
    }
    const sumA = a.ownFunds.ratePercent + a.creditFunds.ratePercent;
    const sumB = b.ownFunds.ratePercent + b.creditFunds.ratePercent;
    if (sumB !== sumA) {
      return sumB - sumA;
    }
    return a.bank.sortOrder - b.bank.sortOrder;
  });

  return {
    effectiveAmountUah,
    isDefaultAmount: !hasValidAmount,
    resolution,
    recommendations,
  };
}
