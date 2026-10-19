import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, ImagePlus, LoaderCircle, Save, Settings2, Trash2, UserRound } from 'lucide-react';
import { BackLink } from '../components/ui/BackLink';
import { useAuth } from '../hooks/useAuth';
import { useApiResource } from '../hooks/useApiResource';
import { ApiError, apiRequest, apiUpload } from '../lib/api';
import type { AuthUser } from '../types/auth';

interface PlatformSettings {
  id: string;
  siteName: string;
  allowRegistrations: boolean;
  autoApproveListings: boolean;
  updatedAt: string;
}

interface PlatformSettingsResponse {
  status: 'ok';
  settings: PlatformSettings;
}

interface AdminProfileResponse {
  status: 'ok';
  user: AuthUser;
}

export function AdminSettingsPage() {
  const { user, updateUser } = useAuth();
  const { state, reload } = useApiResource<PlatformSettingsResponse>('/admin/settings');
  const [siteName, setSiteName] = useState('');
  const [allowRegistrations, setAllowRegistrations] = useState(true);
  const [autoApproveListings, setAutoApproveListings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileEmail, setProfileEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState('');

  useEffect(() => {
    if (state.status !== 'success') return;
    setSiteName(state.data.settings.siteName);
    setAllowRegistrations(state.data.settings.allowRegistrations);
    setAutoApproveListings(state.data.settings.autoApproveListings);
  }, [state]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview('');
      return;
    }
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      await apiRequest<PlatformSettingsResponse>('PUT', '/admin/settings', {
        siteName,
        allowRegistrations,
        autoApproveListings,
      });
      setSaved(true);
      reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save platform settings.');
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError('');
    setProfileSaved(false);
    if (newPassword && newPassword !== confirmPassword) {
      setProfileError('The new password and confirmation do not match.');
      return;
    }
    setProfileSaving(true);
    try {
      const response = await apiRequest<AdminProfileResponse>('PATCH', '/admin/profile', {
        name: profileName,
        email: profileEmail,
        ...(newPassword ? { currentPassword, newPassword } : {}),
      });
      updateUser(response.user);
      setProfileName(response.user.name);
      setProfileEmail(response.user.email);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setProfileSaved(true);
    } catch (cause) {
      setProfileError(cause instanceof ApiError ? cause.message : 'Could not update your admin profile.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function uploadAvatar() {
    if (!avatarFile) return;
    setProfileError('');
    setAvatarMessage('');
    setAvatarBusy(true);
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      const response = await apiUpload<AdminProfileResponse>('/admin/profile/avatar', formData);
      updateUser(response.user);
      setAvatarFile(null);
      setAvatarMessage('Profile picture updated.');
    } catch (cause) {
      setProfileError(cause instanceof ApiError ? cause.message : 'Could not upload your profile picture.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setProfileError('');
    setAvatarMessage('');
    setAvatarBusy(true);
    try {
      const response = await apiRequest<AdminProfileResponse>('DELETE', '/admin/profile/avatar');
      updateUser(response.user);
      setAvatarFile(null);
      setAvatarMessage('Profile picture removed.');
    } catch (cause) {
      setProfileError(cause instanceof ApiError ? cause.message : 'Could not remove your profile picture.');
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
      <BackLink to="/admin">Admin dashboard</BackLink>
      <div className="mt-3">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Platform settings</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Manage site identity, account registration, and listing review behavior.</p>
      </div>

      {state.status === 'loading' && (
        <p role="status" className="py-12 text-center text-slate-500 dark:text-slate-400">Loading platform settings…</p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 dark:bg-red-950 p-4 text-sm text-red-800 dark:text-red-300">{state.message}</p>
      )}
      {state.status === 'success' && (
        <div className="mt-7 space-y-5">
          <form onSubmit={saveProfile} className="space-y-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Admin profile</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">Update the account you use to sign in to the admin panel.</p>
              </div>
            </div>
            {profileError && <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-300">{profileError}</p>}
            {profileSaved && (
              <p role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Admin profile updated.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 dark:bg-slate-800 p-4">
              {avatarPreview || user?.avatarUrl ? (
                <img
                  src={avatarPreview || user?.avatarUrl || ''}
                  alt="Admin profile"
                  className="h-16 w-16 rounded-full border border-slate-200 dark:border-slate-700 object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-xl font-semibold text-emerald-800 dark:text-emerald-300" aria-hidden="true">
                  {profileName.trim().charAt(0).toUpperCase() || <UserRound className="h-6 w-6" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Profile picture</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">JPEG, PNG, or WebP. Maximum file size: 2 MB.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <ImagePlus className="h-4 w-4" aria-hidden="true" />
                    Choose image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={avatarBusy}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setAvatarMessage('');
                        if (!file) {
                          setAvatarFile(null);
                          return;
                        }
                        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                          setAvatarFile(null);
                          setProfileError('Choose a JPEG, PNG, or WebP image.');
                          event.target.value = '';
                          return;
                        }
                        if (file.size > 2 * 1024 * 1024) {
                          setAvatarFile(null);
                          setProfileError('Choose an image smaller than 2 MB.');
                          event.target.value = '';
                          return;
                        }
                        setProfileError('');
                        setAvatarFile(file);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={uploadAvatar}
                    disabled={!avatarFile || avatarBusy}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {avatarBusy ? 'Saving…' : 'Upload picture'}
                  </button>
                  {user?.avatarUrl && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      disabled={avatarBusy}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </button>
                  )}
                </div>
                {avatarFile && <p className="mt-2 break-all text-xs text-slate-600 dark:text-slate-300">Selected: {avatarFile.name}</p>}
                {avatarMessage && <p role="status" className="mt-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">{avatarMessage}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Name
                <input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Email
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(event) => setProfileEmail(event.target.value)}
                  required
                  maxLength={254}
                  autoComplete="email"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>
                <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Change password</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Leave these fields empty to keep your current password.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Current password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      autoComplete="current-password"
                      maxLength={128}
                      required={Boolean(newPassword)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 sm:max-w-md"
                    />
                  </div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    New password
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      pattern="(?=.*[A-Za-z])(?=.*\d).{8,128}"
                      title="Use at least 8 characters with a letter and a number."
                      className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">At least 8 characters, including a letter and a number.</span>
                  </label>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Confirm new password
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required={Boolean(newPassword)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                </div>
            <button
              type="submit"
              disabled={profileSaving || profileName.trim().length < 2 || !profileEmail.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {profileSaving
                ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Save className="h-4 w-4" aria-hidden="true" />}
              {profileSaving ? 'Updating profile…' : 'Update admin profile'}
            </button>
          </form>

          <form onSubmit={saveSettings} className="space-y-5">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">General</h2>
            </div>
            <label htmlFor="platform-site-name" className="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Site name
            </label>
            <input
              id="platform-site-name"
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              required
              minLength={2}
              maxLength={60}
              className="mt-1.5 w-full max-w-lg rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Shown in the public site and account panels.</p>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Accounts and listings</h2>
            <label className="mt-5 flex items-start gap-3">
              <input
                type="checkbox"
                checked={allowRegistrations}
                onChange={(event) => setAllowRegistrations(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-emerald-700"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">Allow new account registrations</span>
                <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-300">
                  When disabled, new email and social-sign-in accounts cannot be created. Existing users can still sign in.
                </span>
              </span>
            </label>
            <label className="mt-5 flex items-start gap-3">
              <input
                type="checkbox"
                checked={autoApproveListings}
                onChange={(event) => setAutoApproveListings(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-emerald-700"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">Automatically approve property listings</span>
                <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-300">
                  New listings and owner edits are published immediately instead of waiting for admin review.
                </span>
              </span>
            </label>
            {autoApproveListings && (
              <p className="mt-5 flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-950 p-3 text-sm text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                New submissions and edits will be publicly visible without moderation.
              </p>
            )}
          </section>

          {error && <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-300">{error}</p>}
          {saved && (
            <p role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Settings saved.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Last saved {new Date(state.data.settings.updatedAt).toLocaleString()}
            </p>
            <button
              type="submit"
              disabled={saving || siteName.trim().length < 2}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Save className="h-4 w-4" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
          </form>
        </div>
      )}
    </section>
  );
}
