import { MERCHANT_BY_ID } from '../data/ukrainianCatalog';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import type {
  BankId,
  CashbackRule,
  CategoryId,
  ChangeSuggestion,
  ParticipantUser,
  RuleType,
  SuggestionType,
  TaxMode,
  UserCard,
} from '../types/domain';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredLocalAccount {
  id: string;
  email: string;
  displayName: string;
  preferredTaxMode: TaxMode;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

interface StoredWalletPayload {
  cards: UserCard[];
  rules: CashbackRule[];
}

const ACCOUNTS_KEY = 'cashback_radar_local_accounts_v1';
const ACTIVE_SESSION_KEY = 'cashback_radar_active_session_v1';
const WALLET_KEY_PREFIX = 'cashback_radar_wallet_v1_';
const SUGGESTIONS_KEY_PREFIX = 'cashback_radar_suggestions_v1_';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getCurrentMonthYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function getDefaultStorage(): StorageLike {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // Ігноруємо помилки доступу до localStorage у приватних режимах
  }
  return createMemoryStorage();
}

function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Фолбек формату UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const input = `${salt}:${password}`;
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const encoded = new TextEncoder().encode(input);
    const buffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Детермінований фолбек лише для середовищ без WebCrypto
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function toParticipantUser(acc: StoredLocalAccount): ParticipantUser {
  return {
    id: acc.id,
    email: acc.email,
    displayName: acc.displayName,
    preferredTaxMode: acc.preferredTaxMode,
    createdAt: acc.createdAt,
  };
}

function readJson<T>(storage: StorageLike, key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(storage: StorageLike, key: string, value: T): void {
  storage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertValidCredentials(email: string, password: string): string {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Вкажіть коректну електронну пошту.');
  }
  if (!password || password.length < 6) {
    throw new Error('Пароль має містити щонайменше 6 символів.');
  }
  return cleanEmail;
}

export interface AddUserCardInput {
  bankId: BankId;
  cardName: string;
  taxPercent: number;
}

export interface UpsertCashbackRuleInput {
  id?: string;
  cardId: string;
  monthYear: string;
  ruleType: RuleType;
  categoryId?: CategoryId;
  merchantId?: string;
  customPartnerName?: string;
  rateOwnFunds: number;
  rateCreditFunds: number;
}

export interface SubmitSuggestionInput {
  suggestionType: SuggestionType;
  targetName: string;
  proposedCategoryId?: CategoryId;
  proposedMcc?: number;
  details: string;
}

export interface AuthAndDataServiceOptions {
  storage?: StorageLike;
  useCloud?: boolean;
}

export function createAuthAndDataService(options: AuthAndDataServiceOptions = {}) {
  const storage = options.storage ?? getDefaultStorage();
  const useCloud = options.useCloud ?? isSupabaseConfigured;

  function getLocalAccounts(): StoredLocalAccount[] {
    return readJson<StoredLocalAccount[]>(storage, ACCOUNTS_KEY, []);
  }

  function saveLocalAccounts(accounts: StoredLocalAccount[]): void {
    writeJson(storage, ACCOUNTS_KEY, accounts);
  }

  function getLocalSessionUser(): ParticipantUser | null {
    return readJson<ParticipantUser | null>(storage, ACTIVE_SESSION_KEY, null);
  }

  function setLocalSessionUser(user: ParticipantUser | null): void {
    if (!user) {
      storage.removeItem(ACTIVE_SESSION_KEY);
      return;
    }
    writeJson(storage, ACTIVE_SESSION_KEY, user);
  }

  function getWalletKey(userId: string): string {
    return `${WALLET_KEY_PREFIX}${userId}`;
  }

  function getSuggestionsKey(userId: string): string {
    return `${SUGGESTIONS_KEY_PREFIX}${userId}`;
  }

  function readLocalWallet(userId: string): StoredWalletPayload {
    const raw = readJson<StoredWalletPayload>(storage, getWalletKey(userId), {
      cards: [],
      rules: [],
    });
    return {
      cards: raw.cards.filter((c) => c.userId === userId),
      rules: raw.rules.filter((r) => r.userId === userId),
    };
  }

  function writeLocalWallet(userId: string, payload: StoredWalletPayload): void {
    writeJson(storage, getWalletKey(userId), {
      cards: payload.cards.filter((c) => c.userId === userId),
      rules: payload.rules.filter((r) => r.userId === userId),
    });
  }

  function readLocalSuggestions(userId: string): ChangeSuggestion[] {
    return readJson<ChangeSuggestion[]>(storage, getSuggestionsKey(userId), []).filter(
      (s) => s.userId === userId,
    );
  }

  function writeLocalSuggestions(userId: string, items: ChangeSuggestion[]): void {
    writeJson(
      storage,
      getSuggestionsKey(userId),
      items.filter((s) => s.userId === userId),
    );
  }

  async function assertAuthorizedUser(requestedUserId: string): Promise<ParticipantUser> {
    const current = await getCurrentSession();
    if (!current) {
      throw new Error('Потрібна авторизація: увійдіть у свій кабінет учасника.');
    }
    if (current.id !== requestedUserId) {
      throw new Error('Доступ заборонено: кожен учасник має доступ лише до власних даних.');
    }
    return current;
  }

  async function getCurrentSession(): Promise<ParticipantUser | null> {
    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        setLocalSessionUser(null);
        return null;
      }
      const user = data.user;
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, preferred_tax_mode')
        .eq('id', user.id)
        .maybeSingle();

      const participant: ParticipantUser = {
        id: user.id,
        email: user.email ?? '',
        displayName:
          profile?.display_name ??
          (user.user_metadata?.display_name as string | undefined) ??
          (user.email?.split('@')[0] || 'Учасник'),
        preferredTaxMode: profile?.preferred_tax_mode === 'GROSS' ? 'GROSS' : 'NET',
        createdAt: user.created_at,
      };
      setLocalSessionUser(participant);
      return participant;
    }

    return getLocalSessionUser();
  }

  async function registerParticipant(
    email: string,
    password: string,
    displayName: string,
  ): Promise<ParticipantUser> {
    const cleanEmail = assertValidCredentials(email, password);
    const cleanName = displayName.trim() || cleanEmail.split('@')[0];

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            display_name: cleanName,
          },
        },
      });
      if (error) {
        throw new Error(error.message);
      }
      if (!data.user) {
        throw new Error('Не вдалося завершити реєстрацію. Спробуйте ще раз.');
      }
      if (!data.session) {
        throw new Error(
          'Акаунт створено! Перевірте вашу пошту та підтвердьте email, після чого увійдіть у кабінет.',
        );
      }

      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: cleanEmail,
        display_name: cleanName,
        preferred_tax_mode: 'NET',
      });

      const participant: ParticipantUser = {
        id: data.user.id,
        email: cleanEmail,
        displayName: cleanName,
        preferredTaxMode: 'NET',
        createdAt: data.user.created_at,
      };
      setLocalSessionUser(participant);
      return participant;
    }

    const accounts = getLocalAccounts();
    if (accounts.some((acc) => acc.email === cleanEmail)) {
      throw new Error('Учасник із такою електронною поштою вже зареєстрований.');
    }

    const salt = generateId();
    const passwordHash = await hashPassword(password, salt);
    const newAccount: StoredLocalAccount = {
      id: generateId(),
      email: cleanEmail,
      displayName: cleanName,
      preferredTaxMode: 'NET',
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    saveLocalAccounts([...accounts, newAccount]);
    const participant = toParticipantUser(newAccount);
    setLocalSessionUser(participant);
    return participant;
  }

  async function loginParticipant(email: string, password: string): Promise<ParticipantUser> {
    const cleanEmail = assertValidCredentials(email, password);

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error || !data.user) {
        throw new Error(error?.message || 'Невірна пошта або пароль.');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, preferred_tax_mode')
        .eq('id', data.user.id)
        .maybeSingle();

      const participant: ParticipantUser = {
        id: data.user.id,
        email: data.user.email ?? cleanEmail,
        displayName:
          profile?.display_name ??
          (data.user.user_metadata?.display_name as string | undefined) ??
          cleanEmail.split('@')[0],
        preferredTaxMode: profile?.preferred_tax_mode === 'GROSS' ? 'GROSS' : 'NET',
        createdAt: data.user.created_at,
      };
      setLocalSessionUser(participant);
      return participant;
    }

    const accounts = getLocalAccounts();
    const found = accounts.find((acc) => acc.email === cleanEmail);
    if (!found) {
      throw new Error('Невірна електронна пошта або пароль.');
    }

    const candidateHash = await hashPassword(password, found.salt);
    if (candidateHash !== found.passwordHash) {
      throw new Error('Невірна електронна пошта або пароль.');
    }

    const participant = toParticipantUser(found);
    setLocalSessionUser(participant);
    return participant;
  }

  async function loginWithDemoAccount(monthYear: string = getCurrentMonthYear()): Promise<ParticipantUser> {
    const demoEmail = 'demo@cashbackradar.ua';
    const demoPass = 'DemoRadar2026!';
    const accounts = getLocalAccounts();
    const existing = accounts.find((acc) => acc.email === demoEmail);

    let user: ParticipantUser;
    if (existing) {
      user = await loginParticipant(demoEmail, demoPass);
    } else {
      user = await registerParticipant(demoEmail, demoPass, 'Демо Учасник');
    }

    const wallet = await loadUserWallet(user.id);
    if (wallet.cards.length === 0) {
      await populateStarterCards(user.id, monthYear);
    }
    return user;
  }

  async function logoutParticipant(): Promise<void> {
    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      await supabase.auth.signOut();
    }
    setLocalSessionUser(null);
  }

  async function updateTaxModePreference(userId: string, taxMode: TaxMode): Promise<ParticipantUser> {
    const current = await assertAuthorizedUser(userId);
    const updated: ParticipantUser = { ...current, preferredTaxMode: taxMode };

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      await supabase
        .from('profiles')
        .update({ preferred_tax_mode: taxMode })
        .eq('id', userId);
    } else {
      const accounts = getLocalAccounts();
      saveLocalAccounts(
        accounts.map((acc) =>
          acc.id === userId ? { ...acc, preferredTaxMode: taxMode } : acc,
        ),
      );
    }

    setLocalSessionUser(updated);
    return updated;
  }

  async function loadUserWallet(userId: string): Promise<StoredWalletPayload> {
    await assertAuthorizedUser(userId);

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      try {
        const [{ data: cardRows, error: cardsErr }, { data: ruleRows, error: rulesErr }] =
          await Promise.all([
            supabase
              .from('user_cards')
              .select('id, user_id, bank_id, card_name, tax_percent, is_active, created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: true }),
            supabase
              .from('user_cashback_rules')
              .select(
                'id, card_id, user_id, month_year, rule_type, category_id, merchant_id, merchant_slug, custom_partner_name, rate_own_funds, rate_credit_funds, updated_at',
              )
              .eq('user_id', userId),
          ]);

        if (cardsErr || rulesErr) {
          throw new Error(cardsErr?.message || rulesErr?.message || 'Помилка завантаження');
        }

        const cards: UserCard[] = (cardRows ?? []).map((row) => ({
          id: row.id as string,
          userId: row.user_id as string,
          bankId: row.bank_id as BankId,
          cardName: row.card_name as string,
          taxPercent: Number(row.tax_percent),
          isActive: Boolean(row.is_active),
          createdAt: row.created_at as string,
        }));

        const rules: CashbackRule[] = (ruleRows ?? []).map((row) => ({
          id: row.id as string,
          cardId: row.card_id as string,
          userId: row.user_id as string,
          monthYear: row.month_year as string,
          ruleType: row.rule_type as RuleType,
          categoryId: (row.category_id as CategoryId | null) ?? undefined,
          merchantId:
            (row.merchant_slug as string | null) ??
            (row.merchant_id as string | null) ??
            undefined,
          customPartnerName: (row.custom_partner_name as string | null) ?? undefined,
          rateOwnFunds: Number(row.rate_own_funds),
          rateCreditFunds: Number(row.rate_credit_funds),
          updatedAt: row.updated_at as string,
        }));

        const payload = { cards, rules };
        writeLocalWallet(userId, payload);
        return payload;
      } catch {
        // Офлайн-фолбек на локальний ізольований кеш конкретного учасника
        return readLocalWallet(userId);
      }
    }

    return readLocalWallet(userId);
  }

  async function addUserCard(userId: string, input: AddUserCardInput): Promise<UserCard> {
    await assertAuthorizedUser(userId);
    const cleanName = input.cardName.trim();
    if (!cleanName) {
      throw new Error('Вкажіть назву картки.');
    }

    const card: UserCard = {
      id: generateId(),
      userId,
      bankId: input.bankId,
      cardName: cleanName,
      taxPercent: Math.min(100, Math.max(0, Number(input.taxPercent) || 0)),
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      const { data, error } = await supabase
        .from('user_cards')
        .insert({
          id: card.id,
          user_id: userId,
          bank_id: card.bankId,
          card_name: card.cardName,
          tax_percent: card.taxPercent,
          is_active: card.isActive,
        })
        .select('id, user_id, bank_id, card_name, tax_percent, is_active, created_at')
        .single();

      if (error) {
        throw new Error(error.message);
      }

      card.id = data.id as string;
      card.createdAt = data.created_at as string;
    }

    const current = readLocalWallet(userId);
    writeLocalWallet(userId, {
      cards: [...current.cards, card],
      rules: current.rules,
    });

    return card;
  }

  async function updateUserCard(
    userId: string,
    cardId: string,
    patch: Partial<Pick<UserCard, 'cardName' | 'taxPercent' | 'isActive'>>,
  ): Promise<UserCard> {
    await assertAuthorizedUser(userId);
    const current = readLocalWallet(userId);
    const existing = current.cards.find((c) => c.id === cardId && c.userId === userId);
    if (!existing) {
      throw new Error('Картку не знайдено або у вас немає прав доступу до неї.');
    }

    const updated: UserCard = {
      ...existing,
      ...(patch.cardName !== undefined ? { cardName: patch.cardName.trim() || existing.cardName } : {}),
      ...(patch.taxPercent !== undefined
        ? { taxPercent: Math.min(100, Math.max(0, Number(patch.taxPercent) || 0)) }
        : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    };

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      const { error } = await supabase
        .from('user_cards')
        .update({
          card_name: updated.cardName,
          tax_percent: updated.taxPercent,
          is_active: updated.isActive,
        })
        .eq('id', cardId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }
    }

    writeLocalWallet(userId, {
      cards: current.cards.map((c) => (c.id === cardId ? updated : c)),
      rules: current.rules,
    });

    return updated;
  }

  async function deleteUserCard(userId: string, cardId: string): Promise<void> {
    await assertAuthorizedUser(userId);
    const current = readLocalWallet(userId);
    const exists = current.cards.some((c) => c.id === cardId && c.userId === userId);
    if (!exists) {
      throw new Error('Картку не знайдено або у вас немає прав на видалення.');
    }

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      const { error } = await supabase
        .from('user_cards')
        .delete()
        .eq('id', cardId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }
    }

    writeLocalWallet(userId, {
      cards: current.cards.filter((c) => c.id !== cardId),
      rules: current.rules.filter((r) => r.cardId !== cardId),
    });
  }

  async function upsertCashbackRule(
    userId: string,
    input: UpsertCashbackRuleInput,
  ): Promise<CashbackRule> {
    await assertAuthorizedUser(userId);
    const current = readLocalWallet(userId);

    // Переконуємось, що картка належить саме поточному учаснику
    const ownsCard = current.cards.some((c) => c.id === input.cardId && c.userId === userId);
    if (!ownsCard) {
      throw new Error('Доступ заборонено: картка не належить поточному учаснику.');
    }

    const cleanOwn = Math.min(100, Math.max(0, Number(input.rateOwnFunds) || 0));
    const cleanCredit = Math.min(100, Math.max(0, Number(input.rateCreditFunds) || 0));
    const now = new Date().toISOString();

    const existingRule = current.rules.find((r) => {
      if (input.id && r.id === input.id) return true;
      if (r.cardId !== input.cardId || r.monthYear !== input.monthYear || r.ruleType !== input.ruleType) {
        return false;
      }
      if (input.ruleType === 'CATEGORY') return r.categoryId === input.categoryId;
      if (input.ruleType === 'MERCHANT') {
        return (
          (input.merchantId && r.merchantId === input.merchantId) ||
          (input.customPartnerName &&
            r.customPartnerName?.toLowerCase() === input.customPartnerName.trim().toLowerCase())
        );
      }
      return true;
    });

    const rule: CashbackRule = {
      id: existingRule?.id ?? input.id ?? generateId(),
      cardId: input.cardId,
      userId,
      monthYear: input.monthYear,
      ruleType: input.ruleType,
      categoryId: input.categoryId,
      merchantId: input.merchantId,
      customPartnerName: input.customPartnerName?.trim() || undefined,
      rateOwnFunds: cleanOwn,
      rateCreditFunds: cleanCredit,
      updatedAt: now,
    };

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      const refMerchant = rule.merchantId ? MERCHANT_BY_ID.get(rule.merchantId) : undefined;
      const dbPayload = {
        id: rule.id,
        card_id: rule.cardId,
        user_id: userId,
        month_year: rule.monthYear,
        rule_type: rule.ruleType,
        category_id: rule.categoryId ?? null,
        merchant_id: rule.merchantId && UUID_REGEX.test(rule.merchantId) ? rule.merchantId : null,
        merchant_slug: rule.merchantId ?? null,
        custom_partner_name: rule.customPartnerName ?? refMerchant?.nameUk ?? null,
        rate_own_funds: rule.rateOwnFunds,
        rate_credit_funds: rule.rateCreditFunds,
        updated_at: now,
      };

      const { error } = await supabase.from('user_cashback_rules').upsert(dbPayload);
      if (error) {
        throw new Error(error.message);
      }
    }

    const nextRules = existingRule
      ? current.rules.map((r) => (r.id === existingRule.id ? rule : r))
      : [...current.rules, rule];

    writeLocalWallet(userId, {
      cards: current.cards,
      rules: nextRules,
    });

    return rule;
  }

  async function deleteCashbackRule(userId: string, ruleId: string): Promise<void> {
    await assertAuthorizedUser(userId);
    const current = readLocalWallet(userId);
    const exists = current.rules.some((r) => r.id === ruleId && r.userId === userId);
    if (!exists) {
      throw new Error('Правило кешбеку не знайдено або немає прав доступу.');
    }

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      const { error } = await supabase
        .from('user_cashback_rules')
        .delete()
        .eq('id', ruleId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }
    }

    writeLocalWallet(userId, {
      cards: current.cards,
      rules: current.rules.filter((r) => r.id !== ruleId),
    });
  }

  async function resetMonthRates(userId: string, monthYear: string): Promise<void> {
    await assertAuthorizedUser(userId);
    const current = readLocalWallet(userId);
    const now = new Date().toISOString();

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      const { error } = await supabase
        .from('user_cashback_rules')
        .update({ rate_own_funds: 0, rate_credit_funds: 0, updated_at: now })
        .eq('user_id', userId)
        .eq('month_year', monthYear);

      if (error) {
        throw new Error(error.message);
      }
    }

    writeLocalWallet(userId, {
      cards: current.cards,
      rules: current.rules.map((r) =>
        r.monthYear === monthYear
          ? { ...r, rateOwnFunds: 0, rateCreditFunds: 0, updatedAt: now }
          : r,
      ),
    });
  }

  async function populateStarterCards(
    userId: string,
    monthYear: string = getCurrentMonthYear(),
  ): Promise<StoredWalletPayload> {
    await assertAuthorizedUser(userId);

    const mono = await addUserCard(userId, {
      bankId: 'monobank',
      cardName: 'Чорна картка',
      taxPercent: 23,
    });
    const pumb = await addUserCard(userId, {
      bankId: 'pumb',
      cardName: 'ВсеМожу Online',
      taxPercent: 23,
    });
    const privat = await addUserCard(userId, {
      bankId: 'privatbank',
      cardName: 'Універсальна (Привіт)',
      taxPercent: 23,
    });
    const globus = await addUserCard(userId, {
      bankId: 'globus',
      cardName: 'GlobusPlus',
      taxPercent: 23,
    });

    await upsertCashbackRule(userId, {
      cardId: mono.id,
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'groceries',
      rateOwnFunds: 2,
      rateCreditFunds: 0.75,
    });
    await upsertCashbackRule(userId, {
      cardId: mono.id,
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'cafes',
      rateOwnFunds: 3,
      rateCreditFunds: 1,
    });
    await upsertCashbackRule(userId, {
      cardId: mono.id,
      monthYear,
      ruleType: 'MERCHANT',
      merchantId: 'm-avrora',
      rateOwnFunds: 5,
      rateCreditFunds: 5,
    });

    await upsertCashbackRule(userId, {
      cardId: pumb.id,
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'groceries',
      rateOwnFunds: 1.5,
      rateCreditFunds: 3,
    });
    await upsertCashbackRule(userId, {
      cardId: pumb.id,
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'appliances',
      rateOwnFunds: 2,
      rateCreditFunds: 4,
    });
    await upsertCashbackRule(userId, {
      cardId: pumb.id,
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'auto_fuel',
      rateOwnFunds: 2,
      rateCreditFunds: 5,
    });

    await upsertCashbackRule(userId, {
      cardId: privat.id,
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'pharmacy',
      rateOwnFunds: 3,
      rateCreditFunds: 3,
    });
    await upsertCashbackRule(userId, {
      cardId: privat.id,
      monthYear,
      ruleType: 'MERCHANT',
      merchantId: 'm-rozetka',
      rateOwnFunds: 5,
      rateCreditFunds: 5,
    });

    await upsertCashbackRule(userId, {
      cardId: globus.id,
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'all_purchases',
      rateOwnFunds: 1,
      rateCreditFunds: 1.5,
    });
    await upsertCashbackRule(userId, {
      cardId: globus.id,
      monthYear,
      ruleType: 'CATEGORY',
      categoryId: 'ai',
      rateOwnFunds: 5,
      rateCreditFunds: 5,
    });

    return readLocalWallet(userId);
  }

  async function submitChangeSuggestion(
    userId: string,
    input: SubmitSuggestionInput,
  ): Promise<ChangeSuggestion> {
    const user = await assertAuthorizedUser(userId);
    const cleanTarget = input.targetName.trim();
    const cleanDetails = input.details.trim();

    if (!cleanTarget || !cleanDetails) {
      throw new Error('Заповніть назву об’єкта та опис пропозиції змін.');
    }

    const suggestion: ChangeSuggestion = {
      id: generateId(),
      userId,
      userEmail: user.email,
      suggestionType: input.suggestionType,
      targetName: cleanTarget,
      proposedCategoryId: input.proposedCategoryId,
      proposedMcc: input.proposedMcc,
      details: cleanDetails,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      const { data, error } = await supabase
        .from('change_suggestions')
        .insert({
          id: suggestion.id,
          user_id: userId,
          user_email: user.email,
          suggestion_type: suggestion.suggestionType,
          target_name: suggestion.targetName,
          proposed_category_id: suggestion.proposedCategoryId ?? null,
          proposed_mcc: suggestion.proposedMcc ?? null,
          details: suggestion.details,
        })
        .select('id, created_at, status')
        .single();

      if (error) {
        throw new Error(error.message);
      }

      suggestion.id = data.id as string;
      suggestion.createdAt = data.created_at as string;
      suggestion.status = (data.status as ChangeSuggestion['status']) ?? 'PENDING';
    }

    const existing = readLocalSuggestions(userId);
    writeLocalSuggestions(userId, [suggestion, ...existing]);
    return suggestion;
  }

  async function listUserSuggestions(userId: string): Promise<ChangeSuggestion[]> {
    await assertAuthorizedUser(userId);

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('change_suggestions')
          .select(
            'id, user_id, user_email, suggestion_type, target_name, proposed_category_id, proposed_mcc, details, status, created_at',
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        const list: ChangeSuggestion[] = (data ?? []).map((row) => ({
          id: row.id as string,
          userId: row.user_id as string,
          userEmail: (row.user_email as string | null) ?? '',
          suggestionType: row.suggestion_type as SuggestionType,
          targetName: row.target_name as string,
          proposedCategoryId: (row.proposed_category_id as CategoryId | null) ?? undefined,
          proposedMcc: (row.proposed_mcc as number | null) ?? undefined,
          details: row.details as string,
          status: row.status as ChangeSuggestion['status'],
          createdAt: row.created_at as string,
        }));

        writeLocalSuggestions(userId, list);
        return list;
      } catch {
        return readLocalSuggestions(userId);
      }
    }

    return readLocalSuggestions(userId);
  }

  return {
    isCloudEnabled: () => useCloud && getSupabaseClient() !== null,
    getCurrentSession,
    registerParticipant,
    loginParticipant,
    loginWithDemoAccount,
    logoutParticipant,
    updateTaxModePreference,
    loadUserWallet,
    addUserCard,
    updateUserCard,
    deleteUserCard,
    upsertCashbackRule,
    deleteCashbackRule,
    resetMonthRates,
    populateStarterCards,
    submitChangeSuggestion,
    listUserSuggestions,
  };
}

export const authAndDataService = createAuthAndDataService();
