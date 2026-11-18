import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, ShieldCheck, User, X } from 'lucide-react';
import { authAndDataService } from '../services/authAndDataService';
import type { ParticipantUser } from '../types/domain';

interface ChangePasswordModalProps {
  isOpen: boolean;
  user: ParticipantUser;
  isRecovery?: boolean;
  onClose: () => void;
}

interface PasswordFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  autoComplete: 'current-password' | 'new-password';
  autoFocus?: boolean;
  minLength?: number;
  invalid?: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}

function PasswordField({
  id,
  name,
  label,
  value,
  autoComplete,
  autoFocus = false,
  minLength,
  invalid = false,
  describedBy,
  onChange,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-300" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          maxLength={128}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          enterKeyHint={autoComplete === 'current-password' ? 'next' : 'done'}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="w-full min-h-[48px] rounded-xl bg-zinc-950 border border-zinc-800 pl-10 pr-12 text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-pressed={visible}
          aria-label={visible ? 'Приховати пароль' : 'Показати пароль'}
          className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

export function ChangePasswordModal({
  isOpen,
  user,
  isRecovery = false,
  onClose,
}: ChangePasswordModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const errorId = useId();
  const statusId = useId();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setError(null);
      setSuccessMessage(null);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, isRecovery]);

  function handleDialogClose() {
    if (isOpen) {
      onClose();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      await authAndDataService.changePassword({
        currentPassword: isRecovery ? undefined : currentPassword,
        newPassword,
        isRecovery,
      });
      setCurrentPassword('');
      setNewPassword('');
      setSuccessMessage(
        isRecovery
          ? 'Новий пароль збережено. Тепер ви можете користуватися ним для входу.'
          : 'Пароль успішно змінено.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося змінити пароль.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={handleDialogClose}
      className="w-[calc(100%-2rem)] max-w-md max-h-[92dvh] m-auto bg-transparent p-0 text-zinc-100 backdrop:bg-zinc-950/80 backdrop:backdrop-blur-sm"
    >
      <div className="overflow-y-auto max-h-[92dvh] rounded-2xl bg-zinc-900 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-zinc-800 border border-white/[0.08] flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-zinc-50">
                {isRecovery ? 'Встановлення нового пароля' : 'Зміна пароля'}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400">
                {isRecovery
                  ? 'Задайте новий пароль для входу у ваш кабінет'
                  : 'Керування доступом до вашого облікового запису'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Закрити вікно"
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div className="rounded-xl bg-zinc-950 border border-zinc-800/90 px-3.5 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-100 truncate">{user.displayName}</div>
            <div className="text-xs font-mono text-zinc-400 truncate">{user.email}</div>
          </div>
        </div>

        {isRecovery && !successMessage && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2.5 text-xs sm:text-sm text-emerald-200 flex items-start gap-2 leading-relaxed">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
            <span>Посилання для відновлення підтверджено. Введіть новий пароль нижче.</span>
          </div>
        )}

        {user.isDemo ? (
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 text-sm text-zinc-300 leading-relaxed space-y-2">
            <p>
              Демо-кабінет використовує тимчасову локальну сесію без постійного пароля, тому зміна
              пароля для нього вимкнена.
            </p>
            <p className="text-xs text-zinc-400">
              Щоб мати власний пароль і зберігати картки під особистим захистом, вийдіть із
              демо-режиму та зареєструйте персональний обліковий запис.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isRecovery && (
              <PasswordField
                id="account-current-password"
                name="currentPassword"
                label="Поточний пароль"
                value={currentPassword}
                autoComplete="current-password"
                autoFocus
                invalid={Boolean(error)}
                describedBy={error ? errorId : undefined}
                onChange={(val) => {
                  setCurrentPassword(val);
                  if (error) setError(null);
                }}
              />
            )}

            <PasswordField
              id="account-new-password"
              name="newPassword"
              label="Новий пароль (мін. 8 символів)"
              value={newPassword}
              autoComplete="new-password"
              autoFocus={isRecovery}
              minLength={8}
              invalid={Boolean(error)}
              describedBy={error ? errorId : undefined}
              onChange={(val) => {
                setNewPassword(val);
                if (error) setError(null);
              }}
            />

            {error && (
              <div
                id={errorId}
                role="alert"
                className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-sm text-rose-300 leading-relaxed"
              >
                {error}
              </div>
            )}

            {successMessage && (
              <div
                id={statusId}
                role="status"
                aria-live="polite"
                className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2.5 text-sm text-emerald-300 flex items-start gap-2 leading-relaxed"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="sm:flex-1 min-h-[48px] rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium text-sm transition-colors cursor-pointer"
              >
                {successMessage ? 'Готово' : 'Скасувати'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="sm:flex-[1.4] min-h-[48px] rounded-xl bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-medium text-sm flex items-center justify-center gap-2 transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] cursor-pointer"
              >
                <KeyRound className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                <span>
                  {submitting
                    ? 'Зберігаємо...'
                    : isRecovery
                      ? 'Зберегти новий пароль'
                      : 'Змінити пароль'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
