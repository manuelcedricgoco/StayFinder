import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  Bell,
  Check,
  Clock3,
  ImagePlus,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { BackLink } from '../components/ui/BackLink';
import { useApiResource } from '../hooks/useApiResource';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { ApiError, apiRequest, apiUpload } from '../lib/api';
import type { AuthUser } from '../types/auth';

interface BoarderPreferences {
  preferredLocationId: string | null;
  minBudget: number | null;
  maxBudget: number | null;
  propertyType: 'BOARDING_HOUSE' | 'APARTMENT' | 'ROOM' | 'BEDSPACE' | null;
  occupants: number | null;
  preferredAmenityIds: string[];
  notifyInquiryReplies: boolean;
  notifyFavoriteUpdates: boolean;
  notifyListingUpdates: boolean;
  notifyReviewUpdates: boolean;
  notifyAnnouncements: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;
}

interface BoarderSettings {
  account: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    avatarUrl: string | null;
    createdAt: string;
    hasLocalPassword: boolean;
  };
  preferences: BoarderPreferences;
  locations: { id: string; name: string }[];
  amenities: { id: string; name: string; slug: string }[];
  loginHistory: {
    id: string;
    action: string;
    status: string;
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
    userAgent: string | null;
    createdAt: string;
    lastActivityAt: string;
    expiresAt: string;
    isCurrent: boolean;
  }[];
  notificationDeliveryAvailable: boolean;
  privacyControlsAvailable: boolean;
  themeSwitchingAvailable: boolean;
  accountActionsAvailable: boolean;
}

interface SettingsResponse {
  status: 'ok';
  settings: BoarderSettings;
}

interface UserResponse {
  status: 'ok';
  user: AuthUser;
}

interface PreferencesResponse {
  status: 'ok';
  preferences: BoarderPreferences;
}

type NotificationPreferenceKey =
  | 'notifyInquiryReplies'
  | 'notifyFavoriteUpdates'
  | 'notifyListingUpdates'
  | 'notifyReviewUpdates'
  | 'notifyAnnouncements'
  | 'emailNotifications'
  | 'inAppNotifications';

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30';

const notificationOptions: { key: NotificationPreferenceKey; label: string; description: string }[] = [
  { key: 'notifyInquiryReplies', label: 'Inquiry replies', description: 'An owner replies to an inquiry you sent.' },
  { key: 'notifyFavoriteUpdates', label: 'Favorite property updates', description: 'An important update is made to a saved property.' },
  { key: 'notifyListingUpdates', label: 'Property listing updates', description: 'A property you are interested in changes.' },
  { key: 'notifyReviewUpdates', label: 'Review updates', description: 'An update relates to a review you submitted.' },
  { key: 'notifyAnnouncements', label: 'System announcements', description: 'Important StayFinder announcements.' },
  { key: 'emailNotifications', label: 'Email channel', description: 'Preferred channel for future notifications.' },
  { key: 'inAppNotifications', label: 'In-app channel', description: 'Preferred channel for future notifications.' },
];

function SectionCard(props: { title: string; description?: string; icon: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={props.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="rounded-lg bg-emerald-50 dark:bg-emerald-950 p-2 text-emerald-800 dark:text-emerald-300" aria-hidden="true">{props.icon}</span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{props.title}</h2>
          {props.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{props.description}</p>}
        </div>
      </div>
      {props.children}
    </section>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

function actionLabel(action: string) {
  return action.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function BoarderSettingsPage() {
  const { updateUser } = useAuth();
  const { preference, setPreference } = useTheme();
  const { state, reload } = useApiResource<SettingsResponse>('/boarder/settings');
  const settings = state.status === 'success' ? state.data.settings : null;
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [preferences, setPreferences] = useState<BoarderPreferences | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [sessionsSaving, setSessionsSaving] = useState(false);
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
      const result = await apiRequest<UserResponse>('PATCH', '/boarder/profile', {
        name: name.trim(),
        phoneNumber: phoneNumber.trim() || null,
        avatarUrl: settings.account.avatarUrl,
      });
      updateUser(result.user);
      setProfileMessage('Changes saved successfully.');
      reload();
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : 'Could not save your profile.');
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
      const result = await apiUpload<UserResponse>('/boarder/profile/avatar', formData);
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
      const result = await apiRequest<UserResponse>('DELETE', '/boarder/profile/avatar');
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
    if (!preferences) return;
    setPreferencesSaving(true);
    setPreferencesError('');
    setPreferencesMessage('');
    try {
      const result = await apiRequest<PreferencesResponse>('PUT', '/boarder/settings/preferences', preferences);
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
      await apiRequest('POST', '/boarder/password', { currentPassword, newPassword, confirmPassword });
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
    setSessionsSaving(true);
    setSecurityError('');
    setSecurityMessage('');
    try {
      const result = await apiRequest<{ status: 'ok'; revokedCount: number }>(
        'POST',
        '/boarder/sessions/revoke-others',
      );
      setConfirmRevokeSessions(false);
      setSecurityMessage(result.revokedCount
        ? `${result.revokedCount} other session(s) signed out.`
        : 'No other active sessions were found.');
      reload();
    } catch (error) {
      setSecurityError(error instanceof ApiError ? error.message : 'Could not sign out other sessions.');
    } finally {
      setSessionsSaving(false);
    }
  }

  function updatePreference<K extends keyof BoarderPreferences>(key: K, value: BoarderPreferences[K]) {
    setPreferences((current) => current ? { ...current, [key]: value } : current);
    setPreferencesMessage('');
    setPreferencesError('');
  }

  if (state.status === 'loading') {
    return <p role="status" className="py-16 text-center text-slate-500 dark:text-slate-400">Loading your settings…</p>;
  }
  if (state.status === 'error') {
    return <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-sm text-red-800 dark:text-red-400">{state.message}</p>;
  }
  if (!settings || !preferences) return null;

  const hasSearchPreferences = Boolean(
    preferences.preferredLocationId
    || preferences.minBudget !== null
    || preferences.maxBudget !== null
    || preferences.propertyType
    || preferences.occupants !== null
    || preferences.preferredAmenityIds.length,
  );
  const otherSessions = settings.sessions.filter((session) => !session.isCurrent);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <BackLink to="/boarder">Boarder dashboard</BackLink>
      <div className="mt-3">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Manage your account, preferences, notifications, security, and privacy.
        </p>
      </div>

      <div className="mt-7 space-y-5">
        <SectionCard title="Account & Profile" description="Your account details are private to your signed-in account." icon={<UserRound size={20} />}>
          <form onSubmit={saveProfile} className="space-y-4">
            {(profileMessage || profileError) && (
              <p role={profileError ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${profileError ? 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'}`}>
                {profileError || profileMessage}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 dark:bg-slate-800 p-4">
              {avatarPreview || settings.account.avatarUrl ? (
                <img src={avatarPreview || settings.account.avatarUrl || ''} alt="Profile preview" className="h-20 w-20 rounded-full border border-slate-200 dark:border-slate-700 object-cover" />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-2xl font-bold text-emerald-800 dark:text-emerald-300" aria-hidden="true">
                  {name.trim().charAt(0).toUpperCase() || <UserRound size={28} />}
                </span>
              )}
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <ImagePlus size={16} /> Choose picture
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => chooseAvatar(event.target.files?.[0])} />
                </label>
                {avatarFile && (
                  <>
                    <button type="button" onClick={() => void uploadAvatar()} disabled={avatarSaving} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      {avatarSaving ? 'Uploading…' : 'Upload picture'}
                    </button>
                    <button type="button" onClick={() => setAvatarFile(null)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300">Cancel preview</button>
                  </>
                )}
                {settings.account.avatarUrl && !avatarFile && (
                  <button type="button" onClick={() => void removeAvatar()} disabled={avatarSaving} className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-60">
                    Remove picture
                  </button>
                )}
                <p className="w-full text-xs text-slate-500 dark:text-slate-400">JPEG, PNG, or WebP · up to 2 MB. Image signatures are validated by the server.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Full name
                <input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Email address
                <input disabled value={settings.account.email} className={`${fieldClass} bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400`} />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Phone number
                <input type="tel" maxLength={30} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} className={fieldClass} placeholder="Add a phone number (optional)" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Account type</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Boarder</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Member since</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{new Date(settings.account.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={profileSaving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                {profileSaving && <LoaderCircle size={16} className="animate-spin" />}
                {profileSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => { setShowPasswordForm(true); document.getElementById('security')?.scrollIntoView({ behavior: 'smooth' }); }} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                Change Password
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Notification Preferences" description="Preferences are saved to your account. Notification delivery is not implemented yet." icon={<Bell size={20} />}>
          <form onSubmit={savePreferences} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {notificationOptions.map((option) => (
                <label key={option.key} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <span>
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{option.description}</span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={preferences[option.key] as boolean}
                    onChange={(event) => updatePreference(option.key, event.target.checked)}
                    className="h-5 w-9 shrink-0 cursor-pointer accent-emerald-700"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs leading-5 text-amber-800 dark:text-amber-300">
              These choices are persisted, but they do not yet send or suppress email or in-app messages.
            </p>
            {(preferencesMessage || preferencesError) && (
              <p role={preferencesError ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${preferencesError ? 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'}`}>
                {preferencesError || preferencesMessage}
              </p>
            )}
            <button type="submit" disabled={preferencesSaving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {preferencesSaving && <LoaderCircle size={16} className="animate-spin" />}
              {preferencesSaving ? 'Saving…' : 'Save Notification Preferences'}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Search Preferences" description="Save criteria for future personalized search and recommendations." icon={<MapPin size={20} />}>
          {!hasSearchPreferences && (
            <div className="mb-4 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/60 p-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">No search preferences saved</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Set your preferences to make finding a place easier.</p>
            </div>
          )}
          <form onSubmit={savePreferences} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Preferred location
                <select value={preferences.preferredLocationId ?? ''} onChange={(event) => updatePreference('preferredLocationId', event.target.value || null)} className={fieldClass}>
                  <option value="">Any municipality</option>
                  {settings.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Property type
                <select value={preferences.propertyType ?? ''} onChange={(event) => updatePreference('propertyType', (event.target.value || null) as BoarderPreferences['propertyType'])} className={fieldClass}>
                  <option value="">Any type</option>
                  <option value="BOARDING_HOUSE">Boarding house</option>
                  <option value="APARTMENT">Apartment</option>
                  <option value="ROOM">Room</option>
                  <option value="BEDSPACE">Bedspace</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Minimum monthly budget (₱)
                <input type="number" min="0" max="1000000" step="1" value={preferences.minBudget ?? ''} onChange={(event) => updatePreference('minBudget', event.target.value === '' ? null : Number(event.target.value))} className={fieldClass} placeholder="No minimum" />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Maximum monthly budget (₱)
                <input type="number" min="0" max="1000000" step="1" value={preferences.maxBudget ?? ''} onChange={(event) => updatePreference('maxBudget', event.target.value === '' ? null : Number(event.target.value))} className={fieldClass} placeholder="No maximum" />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Occupants
                <input type="number" min="1" max="50" step="1" value={preferences.occupants ?? ''} onChange={(event) => updatePreference('occupants', event.target.value === '' ? null : Number(event.target.value))} className={fieldClass} placeholder="Not specified" />
              </label>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">Preferred amenities</legend>
              {settings.amenities.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No amenities are currently available.</p>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {settings.amenities.map((amenity) => (
                    <label key={amenity.id} className="flex items-center gap-2 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={preferences.preferredAmenityIds.includes(amenity.id)}
                        onChange={(event) => updatePreference(
                          'preferredAmenityIds',
                          event.target.checked
                            ? [...preferences.preferredAmenityIds, amenity.id]
                            : preferences.preferredAmenityIds.filter((id) => id !== amenity.id),
                        )}
                        className="accent-emerald-700"
                      />
                      {amenity.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            {(preferencesMessage || preferencesError) && (
              <p role={preferencesError ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${preferencesError ? 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'}`}>
                {preferencesError || preferencesMessage}
              </p>
            )}
            <button type="submit" disabled={preferencesSaving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {preferencesSaving && <LoaderCircle size={16} className="animate-spin" />}
              {preferencesSaving ? 'Saving…' : 'Set Preferences'}
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">Saved criteria are not yet automatically applied to Find a Place.</p>
          </form>
        </SectionCard>

        <SectionCard id="security" title="Security & Privacy" description="Review real account access records and protect your account." icon={<ShieldCheck size={20} />}>
          {(securityMessage || securityError) && (
            <p role={securityError ? 'alert' : 'status'} className={`mb-4 rounded-lg p-3 text-sm ${securityError ? 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'}`}>
              {securityError || securityMessage}
            </p>
          )}
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Change Password</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{settings.account.hasLocalPassword ? 'Update your account password.' : 'This account uses a linked sign-in provider and has no local password.'}</p>
              </div>
              {settings.account.hasLocalPassword && (
                <button type="button" onClick={() => setShowPasswordForm((shown) => !shown)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                  {showPasswordForm ? 'Cancel' : 'Change Password'}
                </button>
              )}
            </div>
            {showPasswordForm && settings.account.hasLocalPassword && (
              <form onSubmit={changePassword} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">Current password
                  <input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={fieldClass} />
                </label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">New password
                  <input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={fieldClass} />
                </label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Confirm new password
                  <input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={fieldClass} />
                </label>
                <div className="sm:col-span-2">
                  <button type="submit" disabled={passwordSaving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {passwordSaving && <LoaderCircle size={16} className="animate-spin" />}
                    {passwordSaving ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Login History</h3>
              {settings.loginHistory.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No login history is available for this account yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {settings.loginHistory.map((event) => (
                    <li key={event.id} className="flex items-start gap-3 text-sm">
                      <Clock3 size={16} className="mt-0.5 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{event.action === 'LOGIN_SUCCESS' ? 'Successful login' : 'Failed login'} · {event.status}</p>
                        <p className="mt-0.5 break-words text-xs text-slate-500 dark:text-slate-400">{formatDate(event.createdAt)}{event.userAgent ? ` · ${event.userAgent}` : ''}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Active Sessions</h3>
                {otherSessions.length > 0 && (
                  <button type="button" onClick={() => setConfirmRevokeSessions(true)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    Sign out other sessions
                  </button>
                )}
              </div>
              {settings.sessions.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No active sessions were found.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {settings.sessions.map((session) => (
                    <li key={session.id} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-sm">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{session.isCurrent ? 'Current session' : 'Other session'}</p>
                      <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{session.userAgent || 'Device details unavailable'}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Signed in {formatDate(session.createdAt)} · Last active {formatDate(session.lastActivityAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {settings.activity.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-100 dark:border-slate-800 p-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Recent Account Activity</h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {settings.activity.map((event) => (
                  <li key={event.id} className="flex items-start gap-3 text-sm">
                    <Activity size={16} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{actionLabel(event.action)}{event.target ? ` · ${event.target}` : ''}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatDate(event.createdAt)} · {event.status}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/60 p-4">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Privacy controls</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Profile visibility, phone visibility, and owner-contact controls are not available in the current inquiry/profile system. Your phone number is not shared in owner inquiry records.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="App Preferences" description="StayFinder currently uses fixed language and currency settings." icon={<Check size={20} />}>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4">
              <dt className="text-sm text-slate-500 dark:text-slate-400">Language</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">English</dd>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Only English is currently available.</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4">
              <dt className="text-sm text-slate-500 dark:text-slate-400">Currency</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">PHP — Philippine Peso (₱)</dd>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Fixed for Philippine property listings.</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4">
              <dt className="text-sm text-slate-500 dark:text-slate-400">Theme</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {preference === 'light' ? 'Light' : preference === 'dark' ? 'Dark' : 'System'}
              </dd>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['light', 'dark', 'system'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPreference(option)}
                    aria-pressed={preference === option}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                      preference === option
                        ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-500 dark:bg-emerald-600'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {option === 'light' ? 'Light' : option === 'dark' ? 'Dark' : 'System'}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Saved on this device. System follows your operating system setting.</p>
            </div>
          </dl>
        </SectionCard>

        <section className="rounded-2xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-400">Danger Zone</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Account deactivation and deletion are unavailable. These actions require a supported retention and data-handling workflow.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-red-100 dark:border-red-800 p-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Deactivate Account</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Temporarily disable your StayFinder account.</p>
              <button type="button" disabled className="mt-3 cursor-not-allowed rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-400" title="Account deactivation is not supported">
                Unavailable
              </button>
            </div>
            <div className="rounded-xl border border-red-100 dark:border-red-800 p-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Delete Account</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Permanently delete your account and associated personal data.</p>
              <button type="button" disabled className="mt-3 cursor-not-allowed rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-400" title="Account deletion is not supported">
                Unavailable
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Inquiries, reviews, reports, favorites, security events, and moderation records have different retention needs. No destructive action has been enabled.
          </p>
        </section>
      </div>

      {confirmRevokeSessions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="presentation">
          <section role="alertdialog" aria-modal="true" aria-labelledby="revoke-sessions-title" className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h2 id="revoke-sessions-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sign out other sessions?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">This will sign out {otherSessions.length} other session(s). Your current session will remain active.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmRevokeSessions(false)} disabled={sessionsSaving} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={() => void revokeOtherSessions()} disabled={sessionsSaving} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {sessionsSaving ? 'Signing out…' : 'Sign out sessions'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
