import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Lock,
  Mail,
  Radar,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 shadow-lg shadow-emerald-950/50">
            <Radar className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">КешбекРадар</h1>
          <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            Персональний помічник для вибору найвигіднішої української картки перед оплатою:
            порівнюйте <span className="text-emerald-400 font-medium">власні</span> та{' '}
            <span className="text-sky-400 font-medium">кредитні</span> кошти за 2 секунди.
          </p>
        </div>

        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-2xl space-y-5">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-950 p-1 border border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`min-h-[44px] rounded-xl text-sm font-semibold transition ${
                mode === 'login'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
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
              className={`min-h-[44px] rounded-xl text-sm font-semibold transition ${
                mode === 'register'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Реєстрація
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300" htmlFor="auth-name">
                  Ім’я учасника
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="auth-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Наприклад: Олександр"
                    className="w-full min-h-[48px] rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="auth-email">
                Електронна пошта
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full min-h-[48px] rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="auth-password">
                Пароль (мін. 6 символів)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[48px] rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
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
              className="w-full min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {mode === 'register' ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  {loading ? 'Створюємо кабінет...' : 'Зареєструватися'}
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  {loading ? 'Виконується вхід...' : 'Увійти в кабінет'}
                </>
              )}
            </button>
          </form>

          {!cloudEnabled && (
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleDemoLogin}
                className="w-full min-h-[44px] rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/70 font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-amber-400" />
                Швидкий демо-вхід (з прикладом 4 українських карток)
              </button>
              <p className="text-[11px] text-center text-slate-500">
                Працює у локальному ізольованому режимі (ключі Supabase можна додати у `.env` для
                хмарної синхронізації).
              </p>
            </div>
          )}

          <div className="rounded-2xl bg-slate-950/70 border border-slate-800/80 p-3.5 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="text-slate-200 font-medium">Приватність та ізоляція:</span> кожен
              учасник бачить та редагує виключно власні картки, відсотки кешбеку та пропозиції
              (захищено Row Level Security у Supabase).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
