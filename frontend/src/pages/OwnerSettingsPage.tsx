import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  LogOut,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { BackLink } from '../components/ui/BackLink';
import { FilterDropdown } from '../components/ui/FilterDropdown';
import { useApiResource } from '../hooks/useApiResource';
import { useAuth } from '../hooks/useAuth';
import { ApiError, apiRequest, apiUpload } from '../lib/api';
import type { AuthUser } from '../types/auth';

interface OwnerPreferences {
  defaultPropertyId: string | null;
  notifyNewInquiry: boolean;
  notifyNewReview: boolean;
  notifyListingStatus: boolean;
  notifyVerification: boolean;
  notifyPayment: boolean;
  notifyAnnouncements: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;
}

interface OwnerSettingData {
  account: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    avatarUrl: string | null;
    createdAt: string;
    accountStatusAvailable: boolean;
    hasLocalPassword: boolean;
  };
  preferences: OwnerPreferences;
  properties: { id: string; name: string }[];
  loginHistory: {
    id: string;
    action: string;
    status: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
  }[];
  activity: {
    id: string;
    action: string;
    target: string | null;
    status: string;
    createdAt: string;
  }[];
  sessions: {
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    lastActivityAt: string;
    expiresAt: string;
    isCurrent: boolean;
  }[];
  notificationDeliveryAvailable: boolean;
}

interface SettingsResponse {
  status: 'ok';
  settings: OwnerSettingData;
}

interface UserResponse {
  status: 'ok';
  user: AuthUser;
}

interface PreferencesResponse {
  status: 'ok';
  preferences: OwnerPreferences;
}

const preferenceOptions: { key: keyof OwnerPreferences; label: string; description: string }[] = [
  { key: 'notifyNewInquiry', label: 'New inquiries', description: 'A boarder asks a question about one of your properties.' },
  { key: 'notifyNewReview', label: 'New reviews', description: 'A boarder submits a review for one of your properties.' },
  { key: 'notifyListingStatus', label: 'Listing status', description: 'A listing is approved, rejected, or needs changes.' },
  { key: 'notifyVerification', label: 'Verification updates', description: 'Your owner verification status changes.' },
  { key: 'notifyPayment', label: 'Payment records', description: 'A payment is recorded or needs attention.' },
  { key: 'notifyAnnouncements', label: 'System announcements', description: 'Important StayFinder announcements.' },
  { key: 'emailNotifications', label: 'Email channel', description: 'Preferred channel for future email notifications.' },
  { key: 'inAppNotifications', label: 'In-app channel', description: 'Preferred channel for future in-app notifications.' },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function SectionCard(props: { title: string; description?: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-5 flex items-start gap-3">
        <span className="rounded-lg bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" aria-hidden="true">{props.icon}</span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{props.title}</h2>
          {props.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{props.description}</p>}
        </div>
      </div>
      {props.children}
    </section>
  );
}

function PreferenceToggle(props: {
  checked: boolean;
  disabled: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-100 px-3 py-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
      <span>
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{props.label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{props.description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.checked)}
        className="h-5 w-9 shrink-0 cursor-pointer accent-emerald-700 disabled:cursor-not-allowed"
      />
    </label>
  );
}

function actionLabel(action: string) {
  return action.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function OwnerSettingsPage() {
  const { updateUser } = useAuth();
  const { state, reload } = useApiResource<SettingsResponse>('/owner/settings');
  const settings = state.status === 'success' ? state.data.settings : null;
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [preferences, setPreferences] = useState<OwnerPreferences | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [preferencesMessage, setPreferencesMessage] = useState('');
  const [preferencesError, setPreferencesError] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmRevokeSessions, setConfirmRevokeSessions] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setName(settings.account.name);
    setPhoneNumber(settings.account.phoneNumber ?? '');
    setPreferences(settings.preferences);
  }, [settings]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview('');
      return;
    }
    const preview = URL.createObjectURL(avatarFile);
    setAvatarPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [avatarFile]);

  function chooseAvatar(file: File | undefined) {
    setProfileMessage('');
    setProfileError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProfileError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Profile pictures must be 2 MB or smaller.');
      return;
    }
    setAvatarFile(file);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setProfileError('');
    setProfileMessage('');
    setProfileSaving(true);
    try {
      const result = await apiRequest<UserResponse>('PATCH', '/owner/profile', {
        name,
        phoneNumber: phoneNumber.trim() || null,
        avatarUrl: settings.account.avatarUrl,
      });
      updateUser(result.user);
      setProfileMessage('Account information saved.');
      reload();
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : 'Could not save account information.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function uploadAvatar() {
    if (!avatarFile) return;
    setAvatarSaving(true);
    setProfileError('');
    setProfileMessage('');
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      const result = await apiUpload<UserResponse>('/owner/profile/avatar', formData);
      updateUser(result.user);
      setAvatarFile(null);
      setProfileMessage('Profile picture updated.');
      reload();
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : 'Could not upload your profile picture.');
    } finally {
      setAvatarSaving(false);
    }
  }

  async function removeAvatar() {
    setAvatarSaving(true);
    setProfileError('');
    setProfileMessage('');
    try {
      const result = await apiRequest<UserResponse>('DELETE', '/owner/profile/avatar');
      updateUser(result.user);
      setAvatarFile(null);
      setProfileMessage('Profile picture removed.');
      reload();
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : 'Could not remove your profile picture.');
    } finally {
      setAvatarSaving(false);
    }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistPreferences();
  }

  async function persistPreferences() {
    if (!preferences) return;
    setPreferencesSaving(true);
    setPreferencesError('');
    setPreferencesMessage('');
    try {
      const result = await apiRequest<PreferencesResponse>('PUT', '/owner/settings/preferences', preferences);
      setPreferences(result.preferences);
      setPreferencesMessage('Preferences saved to your account.');
    } catch (error) {
      setPreferencesError(error instanceof ApiError ? error.message : 'Could not save your preferences.');
    } finally {
      setPreferencesSaving(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSecurityError('');
    setSecurityMessage('');
    if (newPassword !== confirmPassword) {
      setSecurityError('New password and confirmation do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      await apiRequest('POST', '/owner/password', { currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setSecurityMessage('Password changed. Other signed-in sessions were signed out.');
      reload();
    } catch (error) {
      setSecurityError(error instanceof ApiError ? error.message : 'Could not change your password.');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function revokeOtherSessions() {
    setSessionSaving(true);
    setSecurityError('');
    setSecurityMessage('');
    try {
      const result = await apiRequest<{ status: 'ok'; revokedCount: number }>('POST', '/owner/sessions/revoke-others');
      setConfirmRevokeSessions(false);
      setSecurityMessage(result.revokedCount
        ? `${result.revokedCount} other session(s) signed out.`
        : 'No other active sessions were found.');
      reload();
    } catch (error) {
      setSecurityError(error instanceof ApiError ? error.message : 'Could not sign out other sessions.');
    } finally {
      setSessionSaving(false);
    }
  }

  function setPreference(key: keyof OwnerPreferences, value: boolean | string) {
    setPreferences((current) => current ? { ...current, [key]: value } : current);
    setPreferencesMessage('');
    setPreferencesError('');
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <BackLink to="/owner">Owner dashboard</BackLink>
      <div className="mt-3">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">Manage your StayFinder account, security, and owner preferences.</p>
      </div>

      {state.status === 'loading' && <p role="status" className="py-12 text-center text-slate-500 dark:text-slate-400">Loading your settings…</p>}
      {state.status === 'error' && <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{state.message}</p>}

      {settings && preferences && (
        <div className="mt-7 space-y-5">
          <SectionCard title="Account Information" description="Update your owner profile. Email changes are not supported." icon={<UserRound size={20} />}>
            <form onSubmit={saveProfile} className="space-y-4">
              {(profileMessage || profileError) && (
                <p role={profileError ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${profileError ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                  {profileError || profileMessage}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                {avatarPreview || settings.account.avatarUrl ? (
                  <img src={avatarPreview || settings.account.avatarUrl || ''} alt="Profile preview" className="h-20 w-20 rounded-full border border-slate-200 object-cover dark:border-slate-600" />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" aria-hidden="true">
                    {name.trim().charAt(0).toUpperCase() || <UserRound size={28} />}
                  </span>
                )}
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                    <ImagePlus size={16} /> Choose picture
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => chooseAvatar(event.target.files?.[0])} />
                  </label>
                  {avatarFile && (
                    <button type="button" onClick={() => void uploadAvatar()} disabled={avatarSaving} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      {avatarSaving ? 'Uploading…' : 'Upload picture'}
                    </button>
                  )}
                  {settings.account.avatarUrl && !avatarFile && (
                    <button type="button" onClick={() => void removeAvatar()} disabled={avatarSaving} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200">
                      Remove picture
                    </button>
                  )}
                  {avatarFile && <button type="button" onClick={() => setAvatarFile(null)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300">Cancel preview</button>}
                  <p className="w-full text-xs text-slate-500 dark:text-slate-400">JPEG, PNG, or WebP · up to 2 MB. Images are validated by the server.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Full name
                  <input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600" />
                </label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Email address
                  <input disabled value={settings.account.email} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400" />
                  <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">Email updates are not supported.</span>
                </label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Phone number
                  <input type="tel" maxLength={30} pattern="\\+?[0-9 ()-]{7,30}" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600" placeholder="+63…" />
                </label>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Account status</p>
                  <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{settings.account.accountStatusAvailable ? 'Available' : 'Not tracked by the account system'}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 sm:col-span-2 dark:border-slate-700">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Account created</p>
                  <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{formatDate(settings.account.createdAt)}</p>
                </div>
              </div>
              <button type="submit" disabled={profileSaving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                {profileSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                {profileSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Notification Preferences" description="These choices are saved to your account. Notification delivery is not available yet, so changing them will not send or suppress messages." icon={<Bell size={20} />}>
            <form onSubmit={savePreferences} className="space-y-4">
              {!settings.notificationDeliveryAvailable && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  Notification preferences are stored, but StayFinder does not currently deliver email or in-app notifications.
                </p>
              )}
              <div className="grid gap-2 md:grid-cols-2">
                {preferenceOptions.map((option) => (
                  <PreferenceToggle
                    key={option.key}
                    checked={preferences[option.key] as boolean}
                    disabled={preferencesSaving}
                    label={option.label}
                    description={option.description}
                    onChange={(checked) => setPreference(option.key, checked)}
                  />
                ))}
              </div>
              {preferencesMessage && <p role="status" className="text-sm text-emerald-800 dark:text-emerald-300">{preferencesMessage}</p>}
              {preferencesError && <p role="alert" className="text-sm text-red-800 dark:text-red-300">{preferencesError}</p>}
              <button type="submit" disabled={preferencesSaving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                {preferencesSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                {preferencesSaving ? 'Saving…' : 'Save Preferences'}
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Security & Privacy" description="Review sign-ins and sessions, or update your password." icon={<ShieldCheck size={20} />}>
            {(securityMessage || securityError) && (
              <p role={securityError ? 'alert' : 'status'} className={`mb-4 rounded-lg p-3 text-sm ${securityError ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                {securityError || securityMessage}
              </p>
            )}
            <div className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <div className="flex items-start gap-3">
                <KeyRound size={18} className="mt-0.5 text-slate-500 dark:text-slate-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Change password</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {settings.account.hasLocalPassword ? 'Verify your current password before setting a new one.' : 'This account has no local password; use its linked sign-in provider.'}
                  </p>
                </div>
              </div>
              <button type="button" disabled={!settings.account.hasLocalPassword} onClick={() => setShowPasswordForm((shown) => !shown)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200">
                {showPasswordForm ? 'Cancel' : 'Change Password'}
              </button>
            </div>
            {showPasswordForm && (
              <form onSubmit={changePassword} className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3 dark:bg-slate-800">
                <label className="text-sm font-medium text-slate-700 sm:col-span-3 dark:text-slate-200">Current password
                  <input required type="password" autoComplete="current-password" maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900" />
                </label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">New password
                  <input required type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900" />
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2 dark:text-slate-200">Confirm new password
                  <input required type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900" />
                </label>
                <p className="text-xs text-slate-500 sm:col-span-3 dark:text-slate-400">At least 8 characters, including a letter and a number.</p>
                <button type="submit" disabled={passwordSaving} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-3 sm:justify-self-start">
                  {passwordSaving ? 'Changing…' : 'Save New Password'}
                </button>
              </form>
            )}

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Login History</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Latest 20 events</span>
                </div>
                {settings.loginHistory.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">No login events are available for this account.</p> : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto">
                    {settings.loginHistory.map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium ${entry.action === 'LOGIN_SUCCESS' ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-400'}`}>{entry.action === 'LOGIN_SUCCESS' ? 'Successful sign-in' : 'Failed sign-in'}</p>
                          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{formatDate(entry.createdAt)}</span>
                        </div>
                        <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{entry.userAgent || 'Browser details unavailable'}{entry.ipAddress ? ` · ${entry.ipAddress}` : ''}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Active Sessions</h3>
                  <button type="button" disabled={sessionSaving || settings.sessions.filter((session) => !session.isCurrent).length === 0} onClick={() => setConfirmRevokeSessions(true)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200">
                    <LogOut size={13} /> Sign out other sessions
                  </button>
                </div>
                {settings.sessions.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">No active sessions found.</p> : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto">
                    {settings.sessions.map((session) => (
                      <li key={session.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{session.isCurrent ? 'Current session' : 'Other session'}</p>
                          {session.isCurrent && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">This device</span>}
                        </div>
                        <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{session.userAgent || 'Browser details unavailable'}{session.ipAddress ? ` · ${session.ipAddress}` : ''}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Clock3 size={12} /> Last active {formatDate(session.lastActivityAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Property Preferences" description="Save a preferred property for future owner workflows; it does not filter other pages yet." icon={<Activity size={20} />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Default property
                <span className="sr-only">Default property</span>
                <div className="mt-1">
                  <FilterDropdown
                    fullWidth
                    className={preferencesSaving ? 'pointer-events-none opacity-60' : ''}
                    options={[
                      { label: 'All Properties', value: '' },
                      ...settings.properties.map((property) => ({ label: property.name, value: property.id })),
                    ]}
                    selected={preferences.defaultPropertyId ?? ''}
                    onSelect={(val) => {
                      setPreferences((current) => current ? { ...current, defaultPropertyId: val || null } : current);
                      setPreferencesMessage('');
                    }}
                  />
                </div>
                {settings.properties.length === 0 && <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">Add a property before choosing a default.</span>}
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Currency</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">PHP — Philippine Peso (₱)</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Fixed to preserve existing financial records.</p>
              </div>
            </div>
            {preferencesMessage && <p role="status" className="mt-3 text-sm text-emerald-800 dark:text-emerald-300">{preferencesMessage}</p>}
            {preferencesError && <p role="alert" className="mt-3 text-sm text-red-800 dark:text-red-300">{preferencesError}</p>}
            <PropertyPreferenceSave
              saving={preferencesSaving}
              onSave={() => void persistPreferences()}
            />
          </SectionCard>

          <SectionCard title="Recent Account Activity" description="Only events recorded by the security audit log are shown." icon={<Clock3 size={20} />}>
            {settings.activity.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">No account activity events are available.</p> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {settings.activity.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{actionLabel(entry.action)}</p>
                      {entry.target && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{entry.target}</p>}
                    </div>
                    <time className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{formatDate(entry.createdAt)}</time>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm sm:p-6 dark:border-rose-900 dark:bg-rose-950/40">
            <div className="mb-5 flex items-start gap-3">
              <span className="rounded-lg bg-rose-100 p-2 text-rose-800 dark:bg-rose-950 dark:text-rose-300" aria-hidden="true"><AlertTriangle size={20} /></span>
              <div>
                <h2 className="text-lg font-semibold text-rose-900 dark:text-rose-200">Danger Zone</h2>
                <p className="mt-1 text-sm text-rose-800 dark:text-rose-300">Account suspension and deletion are not currently supported.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 border-t border-rose-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Deactivate Account</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Temporarily disable your StayFinder owner account.</p>
                  <p className="mt-1 text-xs text-rose-800 dark:text-rose-300">Unavailable: account suspension is not implemented in authentication.</p>
                </div>
                <button type="button" disabled className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-400">Deactivate Account</button>
              </div>
              <div className="flex flex-col gap-3 border-t border-rose-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Delete Account</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Permanently delete your account and associated data.</p>
                  <p className="mt-1 text-xs text-rose-800 dark:text-rose-300">Unavailable: this could cascade-delete properties and conversations, and conflicts with retained payment records.</p>
                </div>
                <button type="button" disabled className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={15} /> Delete Account</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {confirmRevokeSessions && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="revoke-sessions-title" className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="revoke-sessions-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">Sign out other sessions?</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Other browsers and devices will need to sign in again. This current session will remain active.</p>
              </div>
              <button type="button" aria-label="Cancel" disabled={sessionSaving} onClick={() => setConfirmRevokeSessions(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={sessionSaving} onClick={() => setConfirmRevokeSessions(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">Cancel</button>
              <button type="button" disabled={sessionSaving} onClick={() => void revokeOtherSessions()} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{sessionSaving ? 'Signing out…' : 'Sign out other sessions'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );

}

function PropertyPreferenceSave(props: { saving: boolean; onSave: () => void }) {
  return (
    <button type="button" onClick={props.onSave} disabled={props.saving} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
      {props.saving ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
      {props.saving ? 'Saving…' : 'Save Preferences'}
    </button>
  );
}
