-- Міграція 0001: Ініціалізація БД «КешбекРадар Україна»
-- Станом на листопад 2026: 21 український банк, 25 категорій кешбеку,
-- багатокористувацька ізоляція даних через Row Level Security (RLS) та пропозиції змін.

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. ДОВІДНИКИ СИСТЕМИ (Публічне читання для anon та authenticated)
-- ============================================================================

create table if not exists public.banks (
  id text primary key,
  name_uk text not null,
  short_name text not null,
  default_tax_percent numeric(5,2) not null default 23.00,
  brand_color text not null,
  official_url text,
  card_presets jsonb not null default '[]'::jsonb,
  sort_order int not null default 100
);

alter table public.banks enable row level security;

drop policy if exists "Public read banks" on public.banks;
create policy "Public read banks" on public.banks
  for select
  to anon, authenticated
  using (true);

create table if not exists public.categories (
  id text primary key,
  name_uk text not null,
  icon_name text not null,
  mcc_codes int[] not null default '{}',
  keywords text[] not null default '{}',
  is_universal boolean not null default false,
  sort_order int not null default 100
);

alter table public.categories enable row level security;

drop policy if exists "Public read categories" on public.categories;
create policy "Public read categories" on public.categories
  for select
  to anon, authenticated
  using (true);

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_uk text not null,
  category_id text not null references public.categories(id),
  secondary_category_id text references public.categories(id),
  default_mcc int not null,
  search_aliases text[] not null default '{}',
  notes_uk text,
  is_verified boolean not null default true
);

alter table public.merchants enable row level security;

drop policy if exists "Public read merchants" on public.merchants;
create policy "Public read merchants" on public.merchants
  for select
  to anon, authenticated
  using (true);

-- ============================================================================
-- 2. ПЕРСОНАЛЬНІ ТАБЛИЦІ УЧАСНИКІВ (Сувора ізоляція даних через RLS)
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  preferred_tax_mode text not null default 'NET' check (preferred_tax_mode in ('NET', 'GROSS')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bank_id text not null references public.banks(id),
  card_name text not null,
  tax_percent numeric(5,2) not null default 23.00 check (tax_percent >= 0 and tax_percent <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.user_cards enable row level security;

drop policy if exists "Users can select own cards" on public.user_cards;
create policy "Users can select own cards" on public.user_cards
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own cards" on public.user_cards;
create policy "Users can insert own cards" on public.user_cards
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own cards" on public.user_cards;
create policy "Users can update own cards" on public.user_cards
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own cards" on public.user_cards;
create policy "Users can delete own cards" on public.user_cards
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.user_cashback_rules (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.user_cards(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month_year text not null,
  rule_type text not null check (rule_type in ('CATEGORY', 'MERCHANT', 'ALL')),
  category_id text references public.categories(id),
  merchant_id uuid references public.merchants(id),
  merchant_slug text,
  custom_partner_name text,
  rate_own_funds numeric(5,2) not null default 0.00 check (rate_own_funds >= 0 and rate_own_funds <= 100),
  rate_credit_funds numeric(5,2) not null default 0.00 check (rate_credit_funds >= 0 and rate_credit_funds <= 100),
  updated_at timestamptz not null default now()
);

alter table public.user_cashback_rules enable row level security;

drop policy if exists "Users can select own rules" on public.user_cashback_rules;
create policy "Users can select own rules" on public.user_cashback_rules
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own rules" on public.user_cashback_rules;
create policy "Users can insert own rules" on public.user_cashback_rules
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own rules" on public.user_cashback_rules;
create policy "Users can update own rules" on public.user_cashback_rules
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own rules" on public.user_cashback_rules;
create policy "Users can delete own rules" on public.user_cashback_rules
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================================
-- 3. ПРОПОЗИЦІЇ ЗМІН ВІД УЧАСНИКІВ (Кнопка «Запропонувати зміни»)
-- ============================================================================

create table if not exists public.change_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_email text,
  suggestion_type text not null check (suggestion_type in ('NEW_MERCHANT', 'FIX_MCC_CATEGORY', 'BANK_UPDATE', 'OTHER')),
  target_name text not null,
  proposed_category_id text references public.categories(id),
  proposed_mcc int,
  details text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz not null default now()
);

alter table public.change_suggestions enable row level security;

drop policy if exists "Users can select own suggestions" on public.change_suggestions;
create policy "Users can select own suggestions" on public.change_suggestions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own suggestions" on public.change_suggestions;
create policy "Users can insert own suggestions" on public.change_suggestions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- ============================================================================
-- 4. ДОСТУПИ ДО DATA API ТА ІНДЕКСИ ПРОДУКТИВНОСТІ
-- ============================================================================

grant select on public.banks, public.categories, public.merchants to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.user_cards, public.user_cashback_rules to authenticated;
grant select, insert on public.change_suggestions to authenticated;

create index if not exists idx_merchants_category_id on public.merchants(category_id);
create index if not exists idx_merchants_aliases_gin on public.merchants using gin(search_aliases);
create index if not exists idx_categories_keywords_gin on public.categories using gin(keywords);
create index if not exists idx_user_cards_user_id on public.user_cards(user_id);
create index if not exists idx_user_rules_user_month on public.user_cashback_rules(user_id, month_year);
create index if not exists idx_user_rules_card_id on public.user_cashback_rules(card_id);
create index if not exists idx_change_suggestions_user_id on public.change_suggestions(user_id);

-- ============================================================================
-- 5. ТРИГЕР АВТОСТВОРЕННЯ ПРОФІЛЮ ПРИ РЕЄСТРАЦІЇ УЧАСНИКА
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'Учасник'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 6. ПОЧАТКОВИЙ SEED: 21 УКРАЇНСЬКИЙ БАНК (ЛИСТОПАД 2026) ТА 25 КАТЕГОРІЙ
-- ============================================================================

insert into public.banks (id, name_uk, short_name, default_tax_percent, brand_color, official_url, card_presets, sort_order) values
  ('monobank', 'monobank', 'mono', 23.00, '#111827', 'https://www.monobank.ua', '["Чорна картка","Біла картка","Картка АТБ","Platinum","Залізна"]'::jsonb, 1),
  ('pumb', 'ПУМБ', 'ПУМБ', 23.00, '#dc2626', 'https://www.pumb.ua', '["ВсеМожу Online","ВсеКарта"]'::jsonb, 2),
  ('privatbank', 'ПриватБанк', 'Приват', 23.00, '#16a34a', 'https://privatbank.ua', '["Універсальна (Привіт)","Картка для виплат (Привіт)","Преміум"]'::jsonb, 3),
  ('sense', 'Сенс Банк', 'Сенс', 23.00, '#2563eb', 'https://sensebank.ua', '["Red (Cash''u Club)","Caméléon","White","Black"]'::jsonb, 4),
  ('abank', 'àбанк', 'àбанк', 23.00, '#15803d', 'https://a-bank.com.ua', '["Зелена","Картка АТБ","Вигода"]'::jsonb, 5),
  ('globus', 'Глобус Банк', 'Глобус', 23.00, '#0284c7', 'https://globusbank.com.ua', '["GlobusPlus"]'::jsonb, 6),
  ('izibank', 'izibank', 'izi', 23.00, '#ea580c', 'https://izibank.com.ua', '["Основна картка izibank"]'::jsonb, 7),
  ('taskombank', 'ТАСкомбанк', 'ТАС', 23.00, '#1d4ed8', 'https://tascombank.ua', '["Very Card","Success Card","Велика п''ятірка"]'::jsonb, 8),
  ('raiffeisen', 'Райффайзен Банк', 'Райф', 23.00, '#ca8a04', 'https://raiffeisen.ua', '["Картка АТБ","2 кешбеки","Fishka"]'::jsonb, 9),
  ('unex', 'Юнекс Банк', 'Юнекс', 23.00, '#7c3aed', 'https://unexbank.ua', '["Unex Smart","Кредитна картка"]'::jsonb, 10),
  ('accordbank', 'Акордбанк', 'Акорд', 23.00, '#0f766e', 'https://accordbank.com.ua', '["Найкраща картка"]'::jsonb, 11),
  ('creditdnepr', 'Банк Кредит Дніпро', 'Кредит Дніпро', 23.00, '#0369a1', 'https://creditdnepr.com.ua', '["Freecard"]'::jsonb, 12),
  ('alliance', 'Банк Альянс', 'Альянс', 23.00, '#0d9488', 'https://bankalliance.ua', '["Стартова"]'::jsonb, 13),
  ('ideabank', 'Ідея Банк', 'Ідея', 23.00, '#b45309', 'https://ideabank.ua', '["Card Blanche","O.Картка"]'::jsonb, 14),
  ('radabank', 'Радабанк', 'Радабанк', 23.00, '#1e40af', 'https://www.radabank.com.ua', '["ТУТ картка"]'::jsonb, 15),
  ('crystalbank', 'Кристалбанк', 'Кристал', 23.00, '#0891b2', 'https://crystalbank.com.ua', '["Кристал картка"]'::jsonb, 16),
  ('bizbank', 'Бізбанк', 'Бізбанк', 23.00, '#4f46e5', 'https://bizbank.ua', '["Біз-картка"]'::jsonb, 17),
  ('vstbank', 'ВСТ Банк', 'ВСТ', 23.00, '#334155', 'https://vstbank.ua', '["ВСТ картка"]'::jsonb, 18),
  ('mtbbank', 'МТБ Банк', 'МТБ', 23.00, '#be123c', 'https://mtb.ua', '["МТБ картка"]'::jsonb, 19),
  ('ukrcapital', 'Банк Український капітал', 'УкрКапітал', 23.00, '#4338ca', 'https://ukrcapital.com.ua', '["Капітал картка"]'::jsonb, 20),
  ('bankkd', 'Банк КД (Кліринговий Дім)', 'Банк КД', 23.00, '#6d28d9', 'https://clhs.com.ua', '["Вільна картка"]'::jsonb, 21)
on conflict (id) do update set
  name_uk = excluded.name_uk,
  short_name = excluded.short_name,
  default_tax_percent = excluded.default_tax_percent,
  brand_color = excluded.brand_color,
  official_url = excluded.official_url,
  card_presets = excluded.card_presets,
  sort_order = excluded.sort_order;

insert into public.categories (id, name_uk, icon_name, mcc_codes, keywords, is_universal, sort_order) values
  ('groceries', 'Продукти та супермаркети', 'ShoppingCart', '{5411,5422,5441,5451,5462,5499}', '{"продукти","супермаркет","їжа","продукты","еда","магазин","гастроном"}', false, 1),
  ('appliances', 'Побутова техніка', 'Laptop', '{5722,5732,5734,5045,4812}', '{"електроніка","техніка","побутова техніка","гаджети","телефон","ноутбук","электроника"}', false, 2),
  ('auto_fuel', 'Авто та АЗС', 'Fuel', '{5541,5542,5533,5532,7538,7542}', '{"азс","авто","бензин","дизель","газ","заправка","шини","сто","паливо"}', false, 3),
  ('clothing', 'Одяг та взуття', 'Shirt', '{5651,5661,5691,5621,5611,5699}', '{"одяг","взуття","одежда","обувь","шопінг","футболка","куртка","джинси"}', false, 4),
  ('cafes', 'Кафе та ресторани', 'Coffee', '{5812,5814,5813,5811}', '{"кафе","ресторан","кава","фастфуд","їжа доставка","обід","кофе","бар"}', false, 5),
  ('beauty', 'Магазини краси', 'Sparkles', '{5977,7230,7298}', '{"краса","косметика","парфуми","дрогері","салон","парфюмерия","макіяж"}', false, 6),
  ('kids', 'Дитячі товари', 'Baby', '{5641,5945}', '{"діти","дитячі товари","іграшки","підгузки","игрушки","детские"}', false, 7),
  ('home_repair', 'Все для дому, Дім та ремонт', 'Hammer', '{5211,5200,5712,5719,5251,5039}', '{"дім","ремонт","будівництво","меблі","посуд","будівельний","стройматериалы","дом"}', false, 8),
  ('pharmacy', 'Аптеки', 'Pill', '{5912,5122}', '{"аптека","ліки","таблетки","вітаміни","лекарства","фармація"}', false, 9),
  ('medicine', 'Медицина', 'Stethoscope', '{8011,8021,8071,8099,8062}', '{"медицина","лікар","аналізи","клініка","стоматолог","лабораторія","врач"}', false, 10),
  ('utilities', 'Комунальні послуги', 'Zap', '{4900,4814,4899}', '{"комуналка","комунальні","світло","газ","вода","інтернет","мобільний"}', false, 11),
  ('pets', 'Тварини', 'PawPrint', '{5995,742}', '{"тварини","зоотовари","зоомагазин","корм","кіт","собака","ветеринар"}', false, 12),
  ('public_transport', 'Громадський транспорт', 'Bus', '{4111,4131,4784}', '{"транспорт","метро","автобус","тролейбус","трамвай","маршрутка","проїзд"}', false, 13),
  ('marketplaces', 'Маркетплейси', 'Package', '{5262,5311,5399}', '{"маркетплейс","онлайн магазин","інтернет замовлення","доставка товарів"}', false, 14),
  ('taxi', 'Таксі', 'CarTaxiFront', '{4121}', '{"таксі","такси","поїздка","авто виклик"}', false, 15),
  ('cinema', 'Кіно', 'Film', '{7832,7841}', '{"кіно","кінотеатр","фільм","билеты в кино"}', false, 16),
  ('books', 'Книги', 'BookOpen', '{5942,5943,5192}', '{"книги","книгарня","канцтовари","література","книжки"}', false, 17),
  ('education', 'Навчання та освітні курси', 'GraduationCap', '{8299,8220,8249,8211}', '{"навчання","курси","освіта","мова","школа","університет","курсы"}', false, 18),
  ('travel', 'Подорожі', 'Plane', '{4112,7011,4511,4722,7512}', '{"подорожі","потяг","квитки","готель","авіа","путешествия","залізниця"}', false, 19),
  ('flowers', 'Квіти', 'Flower2', '{5992,5193}', '{"квіти","букет","цветы","флористика"}', false, 20),
  ('multimarkets', 'Мультимаркети (Аврора та інші)', 'Store', '{5331,5310,5947}', '{"мультимаркет","аврора","дрібниці","одна ціна","все по 10"}', false, 21),
  ('games_fun', 'Ігри та розваги', 'Gamepad2', '{7994,7999,5816,7922,7933,5815}', '{"ігри","розваги","підписки","стрімінг","концерт","театр","игры"}', false, 22),
  ('sport', 'Спорт та фітнес', 'Dumbbell', '{5941,7941,7997,5655}', '{"спорт","фітнес","зал","спортзал","тренажерний","спорттовари"}', false, 23),
  ('ai', 'Штучний інтелект', 'Bot', '{5734,7372,5817}', '{"штучний інтелект","ші","ai","нейромережа","підписка ші","ии"}', false, 24),
  ('all_purchases', 'Кешбек на усі покупки', 'Sparkle', '{}', '{"усі покупки","все покупки","базовий кешбек","на все","будь-що"}', true, 25)
on conflict (id) do update set
  name_uk = excluded.name_uk,
  icon_name = excluded.icon_name,
  mcc_codes = excluded.mcc_codes,
  keywords = excluded.keywords,
  is_universal = excluded.is_universal,
  sort_order = excluded.sort_order;
