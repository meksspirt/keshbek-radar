import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  CreditCard,
  Lock,
  Mail,
  Radar,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
  Wallet,
} from 'lucide-react';
import type { ParticipantUser } from '../types/domain';
import { authAndDataService } from '../services/authAndDataService';

interface AuthScreenProps {
  onAuthenticated: (user: ParticipantUser) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cloudEnabled = authAndDataService.isCloudEnabled();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user =
        mode === 'register'
          ? await authAndDataService.registerParticipant(email, password, displayName)
          : await authAndDataService.loginParticipant(email, password);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Виникла помилка авторизації.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError(null);
    setLoading(true);
    try {
      const user = await authAndDataService.loginWithDemoAccount();
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося увійти у демо-кабінет.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex items-center px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Ліва частина: Продуктовий контекст та живий приклад розрахунку */}
        <section className="lg:col-span-7 space-y-6 animate-radar-enter">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300">
              <Radar className="h-4 w-4 text-emerald-400" strokeWidth={1.75} />
              <span>КешбекРадар Україна · 21 банк · 25 категорій</span>
            </div>
            <div
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-mono ${
                cloudEnabled
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-zinc-800 bg-zinc-900/70 text-zinc-400'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  cloudEnabled ? 'bg-emerald-400' : 'bg-zinc-500'
                }`}
              />
              {cloudEnabled ? 'Supabase Cloud' : 'Локальний режим (без Supabase)'}
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.08] text-zinc-50">
              Точний вибір картки на касі за 2 секунди
            </h1>
            <p className="text-base text-zinc-400 leading-relaxed max-w-[58ch]">
              Вкажіть магазин або суть покупки та суму чека. Сервіс миттєво порівняє вигоду між
              вашими банками окремо для власних та кредитних коштів з урахуванням податку 23%.
            </p>
          </div>

          {/* Реалістичне прев'ю інтерфейсу розрахунку */}
          <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/90 px-4 py-3 text-xs">
              <div className="flex items-center gap-2 text-zinc-200 font-medium">
                <span>Запит: Сільпо</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">Продукти та супермаркети</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-zinc-400 tabular-nums">
                <span>MCC 5411</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-100 font-medium">1 250.00 ₴</span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Картка-лідер */}
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/[0.06] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-red-600 flex items-center justify-center text-white shrink-0">
                    <CreditCard className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-50">ПУМБ</span>
                      <span className="text-xs text-zinc-400">ВсеМожу Online</span>
                    </div>
                    <div className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                      <Check className="h-3.5 w-3.5" strokeWidth={2} />
                      <span>Вигідніше кредитними коштами</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:text-right">
                  <div className="rounded-lg bg-zinc-950/60 border border-zinc-800/80 px-2.5 py-1.5">
                    <div className="text-[11px] text-zinc-400 flex items-center sm:justify-end gap-1">
                      <Wallet className="h-3 w-3" /> Власні 1.5%
                    </div>
                    <div className="font-mono text-xs font-medium text-zinc-300 tabular-nums mt-0.5">
                      +14.44 ₴
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1.5">
                    <div className="text-[11px] text-emerald-300 flex items-center sm:justify-end gap-1">
                      <CreditCard className="h-3 w-3" /> Кредитні 3%
                    </div>
                    <div className="font-mono text-sm font-semibold text-emerald-300 tabular-nums mt-0.5">
                      +28.88 ₴
                    </div>
                  </div>
                </div>
              </div>

              {/* Другий рядок порівняння */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-700 shrink-0" />
                  <span className="font-medium text-zinc-200">monobank · Чорна картка</span>
                </div>
                <div className="flex items-center gap-4 font-mono tabular-nums">
                  <span className="text-zinc-200">Власні 2%: +19.25 ₴</span>
                  <span className="hidden sm:inline text-zinc-500">Кред. 0.75%: +7.22 ₴</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Права частина: Форма входу / реєстрації */}
        <section className="lg:col-span-5 w-full">
          <div className="rounded-2xl bg-zinc-900/90 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-zinc-50 tracking-tight">
                {mode === 'login' ? 'Вхід у персональний кабінет' : 'Реєстрація учасника'}
              </h2>
              <p className="text-xs text-zinc-400">
                Ваші картки та щомісячні відсотки доступні лише вам
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-950 p-1 border border-zinc-800/90">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`min-h-[42px] rounded-lg text-xs font-medium transition-[background-color,color,transform] duration-200 active:scale-[0.98] cursor-pointer ${
                  mode === 'login'
                    ? 'bg-zinc-800 text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Вхід у кабінет
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`min-h-[42px] rounded-lg text-xs font-medium transition-[background-color,color,transform] duration-200 active:scale-[0.98] cursor-pointer ${
                  mode === 'register'
                    ? 'bg-zinc-800 text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Реєстрація
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300" htmlFor="auth-name">
                    Ім’я учасника
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" strokeWidth={1.75} />
                    <input
                      id="auth-name"
                      type="text"
                      maxLength={80}
                      autoComplete="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Наприклад: Олександр"
                      className="w-full min-h-[46px] rounded-xl bg-zinc-950 border border-zinc-800 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300" htmlFor="auth-email">
                  Електронна пошта
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" strokeWidth={1.75} />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full min-h-[46px] rounded-xl bg-zinc-950 border border-zinc-800 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300" htmlFor="auth-password">
                  Пароль (мін. 8 символів)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" strokeWidth={1.75} />
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[46px] rounded-xl bg-zinc-950 border border-zinc-800 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-300 leading-relaxed">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[46px] rounded-xl bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-medium text-sm flex items-center justify-center gap-2 transition-[background-color,transform,opacity] duration-200 active:scale-[0.98] cursor-pointer"
              >
                {mode === 'register' ? (
                  <>
                    <UserPlus className="h-4 w-4" strokeWidth={1.75} />
                    {loading ? 'Створюємо кабінет...' : 'Зареєструватися'}
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                    {loading ? 'Виконується вхід...' : 'Увійти в кабінет'}
                  </>
                )}
              </button>
            </form>

            {!cloudEnabled && (
              <div className="pt-3 border-t border-zinc-800/80 space-y-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleDemoLogin}
                  className="w-full min-h-[44px] rounded-xl bg-zinc-950 hover:bg-zinc-800/80 text-zinc-200 border border-zinc-800 font-medium text-xs flex items-center justify-center gap-2 transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-emerald-400" strokeWidth={1.75} />
                  Швидкий демо-вхід (4 українські картки)
                </button>
                <p className="text-[11px] text-center text-zinc-500">
                  Локальний ізольований режим. Для хмарної синхронізації додайте ключі Supabase у .env
                </p>
              </div>
            )}

            <div className="rounded-xl bg-zinc-950/70 border border-zinc-800/80 p-3 flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" strokeWidth={1.75} />
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Ізоляція даних на рівні бази даних: кожен учасник має доступ виключно до власних
                карток, відсотків кешбеку та заявок.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
