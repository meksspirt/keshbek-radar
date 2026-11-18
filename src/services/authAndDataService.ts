import { BANK_BY_ID, CATEGORY_BY_ID, MERCHANT_BY_ID } from '../data/ukrainianCatalog';
import {
  clearPendingPasswordRecovery,
  getSupabaseClient,
  isSupabaseConfigured,
  subscribeToPasswordRecovery,
} from './supabaseClient';
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
  isDemo?: boolean;
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
const MONTH_YEAR_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_CARD_NAME_LENGTH = 120;
const MAX_PARTNER_NAME_LENGTH = 120;
const MAX_SUGGESTION_TARGET_LENGTH = 200;
const MAX_SUGGESTION_DETAILS_LENGTH = 2000;
const PBKDF2_ITERATIONS = 600_000;

const ALLOWED_RULE_TYPES = new Set<RuleType>(['CATEGORY', 'MERCHANT', 'ALL']);
const ALLOWED_SUGGESTION_TYPES = new Set<SuggestionType>([
  'NEW_MERCHANT',
  'FIX_MCC_CATEGORY',
  'BANK_UPDATE',
  'OTHER',
]);

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

function getRandomBytes(length: number): Uint8Array {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Криптографічний генератор випадкових чисел недоступний у цьому середовищі.');
  }
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // CSPRNG фолбек формату UUID v4 (ASVS V11.5)
  const bytes = getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const codeA = i < a.length ? a.charCodeAt(i) : 0;
    const codeB = i < b.length ? b.charCodeAt(i) : 0;
    diff |= codeA ^ codeB;
  }
  return diff === 0;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  // ASVS V6.2 / V11.4: PBKDF2-HMAC-SHA256 з 600 000 ітерацій (без деградації до некриптографічних хешів)
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.importKey !== 'function' || typeof subtle.deriveBits !== 'function') {
    throw new Error('WebCrypto API недоступний для безпечного хешування пароля.');
  }
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${bytesToHex(new Uint8Array(derivedBits))}`;
}

function toParticipantUser(acc: StoredLocalAccount): ParticipantUser {
  return {
    id: acc.id,
    email: acc.email,
    displayName: acc.displayName,
    preferredTaxMode: acc.preferredTaxMode,
    ...(acc.isDemo ? { isDemo: true } : {}),
    createdAt: acc.createdAt,
  };
}

function readJson<T>(storage: StorageLike, key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : (parsed as T);
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

function assertValidEmail(email: string): string {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || cleanEmail.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(cleanEmail)) {
    throw new Error('Вкажіть коректну електронну пошту.');
  }
  return cleanEmail;
}

function assertValidPassword(password: string, fieldLabel: string = 'Пароль'): void {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`${fieldLabel} має містити щонайменше ${MIN_PASSWORD_LENGTH} символів.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`${fieldLabel} не може перевищувати ${MAX_PASSWORD_LENGTH} символів.`);
  }
}

function assertValidCredentials(email: string, password: string): string {
  const cleanEmail = assertValidEmail(email);
  assertValidPassword(password);
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
    const raw = readJson<unknown>(storage, ACCOUNTS_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is StoredLocalAccount =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as StoredLocalAccount).id === 'string' &&
        typeof (item as StoredLocalAccount).email === 'string' &&
        typeof (item as StoredLocalAccount).salt === 'string' &&
        typeof (item as StoredLocalAccount).passwordHash === 'string',
    );
  }

  function saveLocalAccounts(accounts: StoredLocalAccount[]): void {
    writeJson(storage, ACCOUNTS_KEY, accounts);
  }

  function getLocalSessionUser(): ParticipantUser | null {
    const raw = readJson<unknown>(storage, ACTIVE_SESSION_KEY, null);
    if (!raw || typeof raw !== 'object') return null;
    const candidate = raw as Partial<ParticipantUser>;
    if (typeof candidate.id !== 'string' || typeof candidate.email !== 'string') {
      return null;
    }
    const matched = getLocalAccounts().find(
      (acc) => acc.id === candidate.id && acc.email === candidate.email,
    );
    return matched ? toParticipantUser(matched) : null;
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

  function clearUserLocalCache(userId: string): void {
    storage.removeItem(getWalletKey(userId));
    storage.removeItem(getSuggestionsKey(userId));
  }

  function readLocalWallet(userId: string): StoredWalletPayload {
    const raw = readJson<unknown>(storage, getWalletKey(userId), {
      cards: [],
      rules: [],
    });
    if (!raw || typeof raw !== 'object') {
      return { cards: [], rules: [] };
    }
    const obj = raw as Partial<StoredWalletPayload>;
    const cards = Array.isArray(obj.cards) ? obj.cards : [];
    const rules = Array.isArray(obj.rules) ? obj.rules : [];
    return {
      cards: cards.filter((c) => Boolean(c) && typeof c === 'object' && c.userId === userId),
      rules: rules.filter((r) => Boolean(r) && typeof r === 'object' && r.userId === userId),
    };
  }

  function writeLocalWallet(userId: string, payload: StoredWalletPayload): void {
    writeJson(storage, getWalletKey(userId), {
      cards: payload.cards.filter((c) => c.userId === userId),
      rules: payload.rules.filter((r) => r.userId === userId),
    });
  }

  function readLocalSuggestions(userId: string): ChangeSuggestion[] {
    const raw = readJson<unknown>(storage, getSuggestionsKey(userId), []);
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (s): s is ChangeSuggestion =>
        Boolean(s) && typeof s === 'object' && (s as ChangeSuggestion).userId === userId,
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
      // У хмарному режимі не покладаємось на ACTIVE_SESSION_KEY у localStorage
      setLocalSessionUser(null);
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        return null;
      }
      const user = data.user;
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, preferred_tax_mode')
        .eq('id', user.id)
        .maybeSingle();

      return {
        id: user.id,
        email: user.email ?? '',
        displayName:
          profile?.display_name ??
          (user.user_metadata?.display_name as string | undefined) ??
          (user.email?.split('@')[0] || 'Учасник'),
        preferredTaxMode: profile?.preferred_tax_mode === 'GROSS' ? 'GROSS' : 'NET',
        createdAt: user.created_at,
      };
    }

    return getLocalSessionUser();
  }

  async function registerParticipant(
    email: string,
    password: string,
    displayName: string,
  ): Promise<ParticipantUser> {
    const cleanEmail = assertValidCredentials(email, password);
    const cleanName =
      (displayName.trim() || cleanEmail.split('@')[0]).slice(0, MAX_DISPLAY_NAME_LENGTH);

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
        throw new Error('Не вдалося завершити реєстрацію. Перевірте дані або спробуйте увійти.');
      }
      if (!data.user) {
        throw new Error('Не вдалося завершити реєстрацію. Спробуйте ще раз.');
      }
      if (!data.session) {
        throw new Error(
          'Акаунт створено! Перевірте вашу пошту та підтвердьте email, після чого увійдіть у кабінет.',
        );
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: data.user.id,
            email: cleanEmail,
            display_name: cleanName,
            preferred_tax_mode: 'NET',
          },
          { onConflict: 'id', ignoreDuplicates: true },
        );

      if (profileError) {
        throw new Error('Не вдалося ініціалізувати профіль учасника.');
      }

      return {
        id: data.user.id,
        email: cleanEmail,
        displayName: cleanName,
        preferredTaxMode: 'NET',
        createdAt: data.user.created_at,
      };
    }

    const accounts = getLocalAccounts();
    if (accounts.some((acc) => acc.email === cleanEmail)) {
      throw new Error('Не вдалося зареєструвати акаунт із цією електронною поштою.');
    }

    const salt = bytesToHex(getRandomBytes(16));
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
        throw new Error('Невірна електронна пошта або пароль.');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, preferred_tax_mode')
        .eq('id', data.user.id)
        .maybeSingle();

      return {
        id: data.user.id,
        email: data.user.email ?? cleanEmail,
        displayName:
          profile?.display_name ??
          (data.user.user_metadata?.display_name as string | undefined) ??
          cleanEmail.split('@')[0],
        preferredTaxMode: profile?.preferred_tax_mode === 'GROSS' ? 'GROSS' : 'NET',
        createdAt: data.user.created_at,
      };
    }

    const accounts = getLocalAccounts();
    const found = accounts.find((acc) => acc.email === cleanEmail);
    if (!found) {
      throw new Error('Невірна електронна пошта або пароль.');
    }

    const candidateHash = await hashPassword(password, found.salt);
    if (!constantTimeEqual(candidateHash, found.passwordHash)) {
      throw new Error('Невірна електронна пошта або пароль.');
    }

    const participant = toParticipantUser(found);
    setLocalSessionUser(participant);
    return participant;
  }

  async function loginWithDemoAccount(monthYear: string = getCurrentMonthYear()): Promise<ParticipantUser> {
    if (useCloud && getSupabaseClient() !== null) {
      throw new Error('Демо-вхід доступний лише в локальному режимі.');
    }

    const demoEmail = 'demo@cashbackradar.ua';
    const accounts = getLocalAccounts();
    let demoAccount = accounts.find((acc) => acc.email === demoEmail && acc.isDemo);

    if (!demoAccount) {
      const existingByEmail = accounts.find((acc) => acc.email === demoEmail);
      if (existingByEmail) {
        throw new Error('Демо-адреса зайнята локальним користувачем. Увійдіть за паролем.');
      }
      const salt = bytesToHex(getRandomBytes(16));
      const randomSecret = bytesToHex(getRandomBytes(24));
      const passwordHash = await hashPassword(randomSecret, salt);
      demoAccount = {
        id: generateId(),
        email: demoEmail,
        displayName: 'Демо Учасник',
        preferredTaxMode: 'NET',
        salt,
        passwordHash,
        isDemo: true,
        createdAt: new Date().toISOString(),
      };
      saveLocalAccounts([...accounts, demoAccount]);
    }

    const user = toParticipantUser(demoAccount);
    setLocalSessionUser(user);

    const wallet = await loadUserWallet(user.id);
    if (wallet.cards.length === 0) {
      await populateStarterCards(user.id, monthYear);
    }
    return user;
  }

  async function logoutParticipant(): Promise<void> {
    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user?.id) {
          clearUserLocalCache(data.user.id);
        }
      } catch {
        // Ігноруємо помилки мережі під час виходу
      }
      await supabase.auth.signOut();
    }
    setLocalSessionUser(null);
  }

  async function requestPasswordReset(email: string, redirectTo?: string): Promise<void> {
    const cleanEmail = assertValidEmail(email);

    const supabase = useCloud ? getSupabaseClient() : null;
    if (!supabase) {
      throw new Error(
        'Відновлення пароля через електронну пошту доступне лише у хмарному режимі (Supabase).',
      );
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      cleanEmail,
      redirectTo ? { redirectTo } : undefined,
    );
    if (error) {
      if (error.status === 429 || /rate limit|too many/i.test(error.message)) {
        throw new Error('Забагато запитів. Зачекайте кілька хвилин перед повторною спробою.');
      }
      throw new Error('Не вдалося надіслати лист для відновлення пароля. Спробуйте ще раз пізніше.');
    }
  }

  async function changePassword(input: {
    currentPassword?: string;
    newPassword: string;
    isRecovery?: boolean;
  }): Promise<void> {
    assertValidPassword(input.newPassword, 'Новий пароль');

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        throw new Error('Потрібна авторизація: увійдіть у свій кабінет учасника.');
      }

      if (!input.isRecovery) {
        if (!input.currentPassword) {
          throw new Error('Введіть поточний пароль.');
        }
        if (input.currentPassword === input.newPassword) {
          throw new Error('Новий пароль має відрізнятися від поточного.');
        }
        if (userData.user.email) {
          const { error: verifyErr } = await supabase.auth.signInWithPassword({
            email: userData.user.email,
            password: input.currentPassword,
          });
          if (verifyErr) {
            throw new Error('Поточний пароль невірний.');
          }
        }
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: input.newPassword,
      });
      if (updateErr) {
        if (/different from the old|same_password/i.test(updateErr.message)) {
          throw new Error('Новий пароль має відрізнятися від поточного.');
        }
        if (/weak|password/i.test(updateErr.message) && /short|character|length/i.test(updateErr.message)) {
          throw new Error(`Новий пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів.`);
        }
        throw new Error('Не вдалося змінити пароль. Спробуйте ще раз.');
      }
      return;
    }

    const current = getLocalSessionUser();
    if (!current) {
      throw new Error('Потрібна авторизація: увійдіть у свій кабінет учасника.');
    }

    const accounts = getLocalAccounts();
    const found = accounts.find((acc) => acc.id === current.id);
    if (!found) {
      throw new Error('Обліковий запис не знайдено.');
    }
    if (found.isDemo) {
      throw new Error('Для демо-акаунта зміна пароля недоступна.');
    }

    if (!input.isRecovery) {
      if (!input.currentPassword) {
        throw new Error('Введіть поточний пароль.');
      }
      const candidateHash = await hashPassword(input.currentPassword, found.salt);
      if (!constantTimeEqual(candidateHash, found.passwordHash)) {
        throw new Error('Поточний пароль невірний.');
      }
      if (input.currentPassword === input.newPassword) {
        throw new Error('Новий пароль має відрізнятися від поточного.');
      }
    }

    const newSalt = bytesToHex(getRandomBytes(16));
    const newHash = await hashPassword(input.newPassword, newSalt);
    saveLocalAccounts(
      accounts.map((acc) =>
        acc.id === found.id ? { ...acc, salt: newSalt, passwordHash: newHash } : acc,
      ),
    );
  }

  async function updateTaxModePreference(userId: string, taxMode: TaxMode): Promise<ParticipantUser> {
    if (taxMode !== 'NET' && taxMode !== 'GROSS') {
      throw new Error('Некоректний режим розрахунку податку.');
    }
    const current = await assertAuthorizedUser(userId);
    const updated: ParticipantUser = { ...current, preferredTaxMode: taxMode };

    const supabase = useCloud ? getSupabaseClient() : null;
    if (supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_tax_mode: taxMode })
        .eq('id', userId);
      if (error) {
        throw new Error('Не вдалося оновити налаштування податку.');
      }
    } else {
      const accounts = getLocalAccounts();
      saveLocalAccounts(
        accounts.map((acc) =>
          acc.id === userId ? { ...acc, preferredTaxMode: taxMode } : acc,
        ),
      );
      setLocalSessionUser(updated);
    }

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

  function clampPercent(value: number): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.min(100, Math.max(0, num));
  }

  async function addUserCard(userId: string, input: AddUserCardInput): Promise<UserCard> {
    await assertAuthorizedUser(userId);
    if (!BANK_BY_ID.has(input.bankId)) {
      throw new Error('Обрано невідомий банк.');
    }
    const cleanName = input.cardName.trim();
    if (!cleanName || cleanName.length > MAX_CARD_NAME_LENGTH) {
      throw new Error(`Назва картки має містити від 1 до ${MAX_CARD_NAME_LENGTH} символів.`);
    }

    const card: UserCard = {
      id: generateId(),
      userId,
      bankId: input.bankId,
      cardName: cleanName,
      taxPercent: clampPercent(input.taxPercent),
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

    const trimmedCardName = patch.cardName !== undefined ? patch.cardName.trim() : undefined;
    if (trimmedCardName !== undefined && trimmedCardName.length > MAX_CARD_NAME_LENGTH) {
      throw new Error(`Назва картки не може перевищувати ${MAX_CARD_NAME_LENGTH} символів.`);
    }

    const updated: UserCard = {
      ...existing,
      ...(trimmedCardName ? { cardName: trimmedCardName } : {}),
      ...(patch.taxPercent !== undefined ? { taxPercent: clampPercent(patch.taxPercent) } : {}),
      ...(patch.isActive !== undefined ? { isActive: Boolean(patch.isActive) } : {}),
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

    if (!MONTH_YEAR_REGEX.test(input.monthYear)) {
      throw new Error('Некоректний формат місяця (очікується YYYY-MM).');
    }
    if (!ALLOWED_RULE_TYPES.has(input.ruleType)) {
      throw new Error('Некоректний тип правила кешбеку.');
    }
    if (input.categoryId !== undefined && !CATEGORY_BY_ID.has(input.categoryId)) {
      throw new Error('Обрано невідому категорію кешбеку.');
    }

    const cleanPartnerName = input.customPartnerName?.trim() || undefined;
    if (cleanPartnerName && cleanPartnerName.length > MAX_PARTNER_NAME_LENGTH) {
      throw new Error(`Назва партнера не може перевищувати ${MAX_PARTNER_NAME_LENGTH} символів.`);
    }

    const cleanOwn = clampPercent(input.rateOwnFunds);
    const cleanCredit = clampPercent(input.rateCreditFunds);
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
          (cleanPartnerName &&
            r.customPartnerName?.toLowerCase() === cleanPartnerName.toLowerCase())
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
      customPartnerName: cleanPartnerName,
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
    if (!MONTH_YEAR_REGEX.test(monthYear)) {
      throw new Error('Некоректний формат місяця (очікується YYYY-MM).');
    }
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
    if (!ALLOWED_SUGGESTION_TYPES.has(input.suggestionType)) {
      throw new Error('Некоректний тип пропозиції змін.');
    }

    const cleanTarget = input.targetName.trim();
    const cleanDetails = input.details.trim();

    if (!cleanTarget || !cleanDetails) {
      throw new Error('Заповніть назву об’єкта та опис пропозиції змін.');
    }
    if (cleanTarget.length > MAX_SUGGESTION_TARGET_LENGTH) {
      throw new Error(`Назва об’єкта не може перевищувати ${MAX_SUGGESTION_TARGET_LENGTH} символів.`);
    }
    if (cleanDetails.length > MAX_SUGGESTION_DETAILS_LENGTH) {
      throw new Error(`Опис пропозиції не може перевищувати ${MAX_SUGGESTION_DETAILS_LENGTH} символів.`);
    }
    if (input.proposedCategoryId !== undefined && !CATEGORY_BY_ID.has(input.proposedCategoryId)) {
      throw new Error('Обрано невідому категорію витрат.');
    }
    if (
      input.proposedMcc !== undefined &&
      (!Number.isInteger(input.proposedMcc) || input.proposedMcc < 0 || input.proposedMcc > 9999)
    ) {
      throw new Error('MCC-код має бути цілим числом від 0000 до 9999.');
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
    requestPasswordReset,
    changePassword,
    onPasswordRecovery: (listener: () => void) =>
      useCloud && getSupabaseClient() !== null ? subscribeToPasswordRecovery(listener) : () => {},
    clearPendingPasswordRecovery,
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
