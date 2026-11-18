import { describe, expect, it } from 'vitest';
import { createAuthAndDataService, type StorageLike } from './authAndDataService';
import { isValidSupabaseClientConfig } from './supabaseClient';

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

  it('застосовує PBKDF2-HMAC-SHA256 для паролів і блокує підроблену локальну сесію', async () => {
    const storage = createInMemoryStorage();
    const service = createAuthAndDataService({ storage, useCloud: false });

    const user = await service.registerParticipant('sec@example.ua', 'StrongPass2026!', 'Безпека');

    const storedAccounts = JSON.parse(
      storage.getItem('cashback_radar_local_accounts_v1') ?? '[]',
    ) as Array<{ email: string; passwordHash: string }>;
    expect(storedAccounts).toHaveLength(1);
    expect(storedAccounts[0].passwordHash).toMatch(/^pbkdf2_sha256\$600000\$[0-9a-f]{64}$/);

    await expect(service.loginParticipant('sec@example.ua', 'WrongPass123!')).rejects.toThrow(
      /Невірна електронна пошта або пароль/i,
    );

    // Підміна ACTIVE_SESSION_KEY вигаданим id не проходить перевірку акаунтів
    storage.setItem(
      'cashback_radar_active_session_v1',
      JSON.stringify({ ...user, id: 'forged-user-id' }),
    );
    expect(await service.getCurrentSession()).toBeNull();
  });

  it('валідує межі вхідних даних та ізолює демо-режим', async () => {
    const storage = createInMemoryStorage();
    const service = createAuthAndDataService({ storage, useCloud: false });

    await expect(service.registerParticipant('short@example.ua', '1234567', 'Short')).rejects.toThrow(
      /щонайменше 8/i,
    );

    const user = await service.registerParticipant('valid@example.ua', 'ValidPass2026!', 'Валід');

    await expect(
      service.addUserCard(user.id, {
        bankId: 'unknown-bank' as never,
        cardName: 'Test',
        taxPercent: 23,
      }),
    ).rejects.toThrow(/невідомий банк/i);

    const card = await service.addUserCard(user.id, {
      bankId: 'monobank',
      cardName: 'Чорна картка',
      taxPercent: 23,
    });

    await expect(
      service.upsertCashbackRule(user.id, {
        cardId: card.id,
        monthYear: '2026-13',
        ruleType: 'CATEGORY',
        categoryId: 'groceries',
        rateOwnFunds: 2,
        rateCreditFunds: 1,
      }),
    ).rejects.toThrow(/формат місяця/i);

    await expect(
      service.submitChangeSuggestion(user.id, {
        suggestionType: 'NEW_MERCHANT',
        targetName: 'Магазин',
        proposedMcc: 12345,
        details: 'Опис',
      }),
    ).rejects.toThrow(/MCC-код/i);

    await service.logoutParticipant();
    const demoUser = await service.loginWithDemoAccount('2026-11');
    expect(demoUser.email).toBe('demo@cashbackradar.ua');
    const demoWallet = await service.loadUserWallet(demoUser.id);
    expect(demoWallet.cards.length).toBe(4);
  });

  it('стійка до пошкоджених JSON-даних у локальному сховищі', async () => {
    const storage = createInMemoryStorage();
    storage.setItem('cashback_radar_local_accounts_v1', '{"not":"array"}');
    storage.setItem('cashback_radar_active_session_v1', '{broken-json');

    const service = createAuthAndDataService({ storage, useCloud: false });
    expect(await service.getCurrentSession()).toBeNull();

    const user = await service.registerParticipant('clean@example.ua', 'CleanPass2026!', 'Clean');
    storage.setItem(`cashback_radar_wallet_v1_${user.id}`, '{"cards":null,"rules":"bad"}');
    const wallet = await service.loadUserWallet(user.id);
    expect(wallet.cards).toEqual([]);
    expect(wallet.rules).toEqual([]);
  });

  it('відхиляє небезпечну конфігурацію Supabase (HTTP або service_role/secret ключ)', () => {
    const toBase64Url = (obj: object) =>
      btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const anonPayload = toBase64Url({ role: 'anon' });
    const servicePayload = toBase64Url({ role: 'service_role' });
    const fakeHeader = toBase64Url({ alg: 'HS256' });

    expect(
      isValidSupabaseClientConfig('https://abc.supabase.co', `${fakeHeader}.${anonPayload}.sig`),
    ).toBe(true);
    expect(
      isValidSupabaseClientConfig('http://abc.supabase.co', `${fakeHeader}.${anonPayload}.sig`),
    ).toBe(false);
    expect(
      isValidSupabaseClientConfig('https://abc.supabase.co', `${fakeHeader}.${servicePayload}.sig`),
    ).toBe(false);
    expect(
      isValidSupabaseClientConfig('https://abc.supabase.co', 'sb_secret_example_not_for_client'),
    ).toBe(false);
  });

  it('дозволяє учаснику змінити пароль із перевіркою поточного пароля та блокує скидання в локальному режимі', async () => {
    const storage = createInMemoryStorage();
    const service = createAuthAndDataService({ storage, useCloud: false });

    await expect(
      service.changePassword({ currentPassword: 'OldPass123!', newPassword: 'NewPass456!' }),
    ).rejects.toThrow(/авторизація/i);

    await expect(service.requestPasswordReset('not-an-email')).rejects.toThrow(
      /електронну пошту/i,
    );
    await expect(service.requestPasswordReset('user@example.ua')).rejects.toThrow(
      /хмарному режимі/i,
    );

    const user = await service.registerParticipant(
      'pwchange@example.ua',
      'InitialPass1!',
      'Користувач',
    );
    expect(user.isDemo).toBeUndefined();

    await expect(
      service.changePassword({ currentPassword: 'WrongPassword!', newPassword: 'UpdatedPass2!' }),
    ).rejects.toThrow(/Поточний пароль невірний/i);

    await expect(
      service.changePassword({ currentPassword: 'InitialPass1!', newPassword: 'short' }),
    ).rejects.toThrow(/щонайменше 8/i);

    await expect(
      service.changePassword({ currentPassword: 'InitialPass1!', newPassword: 'InitialPass1!' }),
    ).rejects.toThrow(/відрізнятися/i);

    await service.changePassword({
      currentPassword: 'InitialPass1!',
      newPassword: 'UpdatedPass2!',
    });

    await service.logoutParticipant();
    await expect(
      service.loginParticipant('pwchange@example.ua', 'InitialPass1!'),
    ).rejects.toThrow(/Невірна електронна пошта або пароль/i);

    const relogged = await service.loginParticipant('pwchange@example.ua', 'UpdatedPass2!');
    expect(relogged.id).toBe(user.id);

    await service.logoutParticipant();
    const demoUser = await service.loginWithDemoAccount('2026-11');
    expect(demoUser.isDemo).toBe(true);
    await expect(
      service.changePassword({ currentPassword: 'anything', newPassword: 'UpdatedPass2!' }),
    ).rejects.toThrow(/демо-акаунта/i);
  });
});
