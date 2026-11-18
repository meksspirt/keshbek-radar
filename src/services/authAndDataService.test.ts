import { describe, expect, it } from 'vitest';
import { createAuthAndDataService, type StorageLike } from './authAndDataService';

function createInMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

describe('Multi-tenant ізоляція даних учасників та пропозиції змін', () => {
  it('ізолює картки, правила кешбеку та пропозиції змін між двома зареєстрованими учасниками', async () => {
    const service = createAuthAndDataService({
      storage: createInMemoryStorage(),
      useCloud: false,
    });

    // Реєструємо учасника A і додаємо йому картку та пропозицію змін
    const userA = await service.registerParticipant(
      'olena@example.ua',
      'Secret123!',
      'Олена',
    );
    const cardA = await service.addUserCard(userA.id, {
      bankId: 'monobank',
      cardName: 'Чорна картка Олени',
      taxPercent: 23,
    });
    await service.upsertCashbackRule(userA.id, {
      cardId: cardA.id,
      monthYear: '2026-11',
      ruleType: 'CATEGORY',
      categoryId: 'groceries',
      rateOwnFunds: 2,
      rateCreditFunds: 0.75,
    });
    await service.submitChangeSuggestion(userA.id, {
      suggestionType: 'NEW_MERCHANT',
      targetName: 'Лоток',
      proposedCategoryId: 'groceries',
      proposedMcc: 5411,
      details: 'Додайте мережу магазинів Лоток у категорію Продукти.',
    });

    // Спроба незареєстрованого чи іншого доступу заборонена
    await service.logoutParticipant();
    await expect(service.loadUserWallet(userA.id)).rejects.toThrow(/авторизація/i);

    // Реєструємо учасника B
    const userB = await service.registerParticipant(
      'taras@example.ua',
      'TarasPass99!',
      'Тарас',
    );

    // Учасник B має порожній гаманець та не може читати або змінювати дані учасника A
    const walletB = await service.loadUserWallet(userB.id);
    expect(walletB.cards).toHaveLength(0);
    expect(walletB.rules).toHaveLength(0);
    expect(await service.listUserSuggestions(userB.id)).toHaveLength(0);

    await expect(service.loadUserWallet(userA.id)).rejects.toThrow(/Доступ заборонено/i);
    await expect(service.deleteUserCard(userA.id, cardA.id)).rejects.toThrow(/Доступ заборонено/i);
    await expect(service.listUserSuggestions(userA.id)).rejects.toThrow(/Доступ заборонено/i);

    // Учасник B додає власну картку
    await service.addUserCard(userB.id, {
      bankId: 'pumb',
      cardName: 'ВсеМожу Тараса',
      taxPercent: 23,
    });

    // Коли Олена знову входить у свій кабінет, вона бачить лише власні дані
    const loggedInA = await service.loginParticipant('olena@example.ua', 'Secret123!');
    expect(loggedInA.id).toBe(userA.id);

    const walletA = await service.loadUserWallet(userA.id);
    expect(walletA.cards).toHaveLength(1);
    expect(walletA.cards[0].cardName).toBe('Чорна картка Олени');
    expect(walletA.rules).toHaveLength(1);

    const suggestionsA = await service.listUserSuggestions(userA.id);
    expect(suggestionsA).toHaveLength(1);
    expect(suggestionsA[0].targetName).toBe('Лоток');
    expect(suggestionsA[0].status).toBe('PENDING');
  });

  it('скидає відсотки на новий місяць, зберігаючи картки учасника', async () => {
    const service = createAuthAndDataService({
      storage: createInMemoryStorage(),
      useCloud: false,
    });

    const user = await service.registerParticipant('ivan@example.ua', 'Pass1234', 'Іван');
    const card = await service.addUserCard(user.id, {
      bankId: 'unex',
      cardName: 'Unex Smart',
      taxPercent: 23,
    });
    await service.upsertCashbackRule(user.id, {
      cardId: card.id,
      monthYear: '2026-11',
      ruleType: 'CATEGORY',
      categoryId: 'multimarkets',
      rateOwnFunds: 3,
      rateCreditFunds: 5,
    });

    await service.resetMonthRates(user.id, '2026-11');
    const wallet = await service.loadUserWallet(user.id);
    expect(wallet.cards).toHaveLength(1);
    expect(wallet.rules).toHaveLength(1);
    expect(wallet.rules[0].rateOwnFunds).toBe(0);
    expect(wallet.rules[0].rateCreditFunds).toBe(0);
  });
});
