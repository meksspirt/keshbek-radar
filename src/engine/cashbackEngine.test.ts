import { describe, expect, it } from 'vitest';
import { UA_BANKS, UA_CATEGORIES } from '../data/ukrainianCatalog';
import { evaluatePurchase, resolvePurchaseQuery } from './cashbackEngine';
import type { CashbackRule, UserCard } from '../types/domain';

const TEST_USER_ID = 'user-test-1';
const MONTH = '2026-11';

const sampleCards: UserCard[] = [
  {
    id: 'card-mono',
    userId: TEST_USER_ID,
    bankId: 'monobank',
    cardName: 'Чорна картка',
    taxPercent: 23,
    isActive: true,
    createdAt: '2026-11-01T10:00:00Z',
  },
  {
    id: 'card-pumb',
    userId: TEST_USER_ID,
    bankId: 'pumb',
    cardName: 'ВсеМожу Online',
    taxPercent: 23,
    isActive: true,
    createdAt: '2026-11-01T10:00:00Z',
  },
  {
    id: 'card-globus',
    userId: TEST_USER_ID,
    bankId: 'globus',
    cardName: 'GlobusPlus',
    taxPercent: 23,
    isActive: true,
    createdAt: '2026-11-01T10:00:00Z',
  },
];

const sampleRules: CashbackRule[] = [
  // Monobank: Продукти 2% власні, 0.75% кредитні; Аврора (партнер) 3% власні, 1% кредитні
  {
    id: 'r1',
    cardId: 'card-mono',
    userId: TEST_USER_ID,
    monthYear: MONTH,
    ruleType: 'CATEGORY',
    categoryId: 'groceries',
    rateOwnFunds: 2,
    rateCreditFunds: 0.75,
    updatedAt: '2026-11-01T10:00:00Z',
  },
  {
    id: 'r2',
    cardId: 'card-mono',
    userId: TEST_USER_ID,
    monthYear: MONTH,
    ruleType: 'MERCHANT',
    merchantId: 'm-avrora',
    rateOwnFunds: 3,
    rateCreditFunds: 1,
    updatedAt: '2026-11-01T10:00:00Z',
  },
  // ПУМБ: Продукти 1.5% власні, 3% кредитні; Штучний інтелект 5% кредитні, 2% власні
  {
    id: 'r3',
    cardId: 'card-pumb',
    userId: TEST_USER_ID,
    monthYear: MONTH,
    ruleType: 'CATEGORY',
    categoryId: 'groceries',
    rateOwnFunds: 1.5,
    rateCreditFunds: 3,
    updatedAt: '2026-11-01T10:00:00Z',
  },
  {
    id: 'r4',
    cardId: 'card-pumb',
    userId: TEST_USER_ID,
    monthYear: MONTH,
    ruleType: 'CATEGORY',
    categoryId: 'ai',
    rateOwnFunds: 2,
    rateCreditFunds: 5,
    updatedAt: '2026-11-01T10:00:00Z',
  },
  // Глобус: Кешбек на усі покупки 1% власні, 1.5% кредитні
  {
    id: 'r5',
    cardId: 'card-globus',
    userId: TEST_USER_ID,
    monthYear: MONTH,
    ruleType: 'CATEGORY',
    categoryId: 'all_purchases',
    rateOwnFunds: 1,
    rateCreditFunds: 1.5,
    updatedAt: '2026-11-01T10:00:00Z',
  },
];

describe('Український каталог банків та категорій', () => {
  it('містить рівно 21 банк та 25 категорій станом на листопад 2026', () => {
    expect(UA_BANKS).toHaveLength(21);
    expect(UA_CATEGORIES).toHaveLength(25);
  });
});

describe('resolvePurchaseQuery', () => {
  it('знаходить український магазин з урахуванням суржику / російської розкладки', () => {
    const silpoRes = resolvePurchaseQuery('сильпо');
    expect(silpoRes.matchedMerchant?.slug).toBe('silpo');
    expect(silpoRes.matchedCategory?.id).toBe('groceries');
    expect(silpoRes.matchedMcc).toBe(5411);

    const avroraRes = resolvePurchaseQuery('Аврора');
    expect(avroraRes.matchedMerchant?.slug).toBe('avrora');
    expect(avroraRes.matchedCategory?.id).toBe('multimarkets');
    expect(avroraRes.matchedMcc).toBe(5331);
  });

  it('визначає категорію за суттю покупки та MCC-кодом', () => {
    const aiRes = resolvePurchaseQuery('ChatGPT');
    expect(aiRes.matchedMerchant?.slug).toBe('chatgpt');
    expect(aiRes.matchedCategory?.id).toBe('ai');

    const essenceRes = resolvePurchaseQuery('електроніка');
    expect(essenceRes.matchedMerchant).toBeNull();
    expect(essenceRes.matchedCategory?.id).toBe('appliances');

    const mccRes = resolvePurchaseQuery('5912');
    expect(mccRes.matchedCategory?.id).toBe('pharmacy');
    expect(mccRes.matchedMcc).toBe(5912);
  });
});

describe('evaluatePurchase', () => {
  it('точно рахує чистий кешбек (-23% податок) для власних і кредитних коштів та правильно ранжує картки', () => {
    const result = evaluatePurchase({
      query: {
        query: 'АТБ',
        amountUah: 1000,
        taxMode: 'NET',
      },
      cards: sampleCards,
      rules: sampleRules,
      monthYear: MONTH,
    });

    expect(result.effectiveAmountUah).toBe(1000);
    expect(result.isDefaultAmount).toBe(false);
    expect(result.recommendations).toHaveLength(3);

    // Топ-1: ПУМБ кредитними 3% = 30 грн брудно, 23.10 грн чистими (-23%)
    const first = result.recommendations[0];
    expect(first.card.id).toBe('card-pumb');
    expect(first.bestFundType).toBe('CREDIT');
    expect(first.creditFunds.ratePercent).toBe(3);
    expect(first.creditFunds.grossCashbackUah).toBe(30);
    expect(first.creditFunds.netCashbackUah).toBe(23.1);
    expect(first.ownFunds.ratePercent).toBe(1.5);
    expect(first.ownFunds.netCashbackUah).toBe(11.55);

    // Топ-2: monobank власними 2% = 20 грн брудно, 15.40 грн чистими
    const second = result.recommendations[1];
    expect(second.card.id).toBe('card-mono');
    expect(second.bestFundType).toBe('OWN');
    expect(second.ownFunds.netCashbackUah).toBe(15.4);
    expect(second.creditFunds.ratePercent).toBe(0.75);

    // Топ-3: Глобус з категорією "Кешбек на усі покупки" 1.5% кредитні
    const third = result.recommendations[2];
    expect(third.card.id).toBe('card-globus');
    expect(third.matchedBy).toBe('ALL_PURCHASES_BASE');
    expect(third.creditFunds.netCashbackUah).toBe(11.55);
  });

  it('повертає номінальний кешбек у режимі GROSS та використовує 1000 ₴ за замовчуванням якщо суму не вказано', () => {
    const result = evaluatePurchase({
      query: {
        query: 'ChatGPT',
        taxMode: 'GROSS',
      },
      cards: sampleCards,
      rules: sampleRules,
      monthYear: MONTH,
    });

    expect(result.isDefaultAmount).toBe(true);
    expect(result.effectiveAmountUah).toBe(1000);

    const winner = result.recommendations[0];
    expect(winner.card.id).toBe('card-pumb');
    expect(winner.bestFundType).toBe('CREDIT');
    expect(winner.bestDisplayedCashbackUah).toBe(50);
    expect(winner.bestGrossCashbackUah).toBe(50);
    expect(winner.bestNetCashbackUah).toBe(38.5);
  });

  it('враховує партнерське правило на конкретний магазин (Аврора) вище за базове правило', () => {
    const result = evaluatePurchase({
      query: {
        query: 'Аврора',
        amountUah: 500,
        taxMode: 'GROSS',
      },
      cards: sampleCards,
      rules: sampleRules,
      monthYear: MONTH,
    });

    const winner = result.recommendations[0];
    expect(winner.card.id).toBe('card-mono');
    expect(winner.matchedBy).toBe('MERCHANT_PARTNER');
    expect(winner.bestFundType).toBe('OWN');
    expect(winner.ownFunds.ratePercent).toBe(3);
    expect(winner.ownFunds.grossCashbackUah).toBe(15);
  });

  it('обмежує надмірні суми та довгі пошукові запити без збоїв', () => {
    const longQuery = 'а'.repeat(5000);
    const result = evaluatePurchase({
      query: {
        query: longQuery,
        amountUah: Number.MAX_SAFE_INTEGER,
        taxMode: 'NET',
      },
      cards: sampleCards,
      rules: sampleRules,
      monthYear: MONTH,
    });

    expect(result.isDefaultAmount).toBe(true);
    expect(result.effectiveAmountUah).toBe(1000);
  });
});
