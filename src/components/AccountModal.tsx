import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { Check, LogIn, LogOut, ShieldCheck, UserPlus, X } from 'lucide-react';
import { CREATIVE_ROLES, CREATIVE_ROLE_LABELS } from '../data/content';
import {
  creativeRoleToAccountType,
  ensureOrRegisterUserProfile,
  isAdminUser,
  signInWithGooglePopup,
  signOutCurrentUser,
  updateUserProfileDetails,
} from '../firebase';
import { CreativeRole, CreatorType, Language, UserProfileRecord } from '../types';

interface AccountModalProps {
  open: boolean;
  lang: Language;
  currentUser: User | null;
  userProfile: UserProfileRecord | null;
  onProfileUpdated: (profile: UserProfileRecord) => void;
  onOpenAdminPanel: () => void;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  open,
  lang,
  currentUser,
  userProfile,
  onProfileUpdated,
  onOpenAdminPanel,
  onClose,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [regName, setRegName] = useState<string>('');
  const [regCreativeRole, setRegCreativeRole] = useState<CreativeRole>('Screenwriter');
  const [editName, setEditName] = useState<string>('');
  const [editRole, setEditRole] = useState<CreatorType>('Screenwriter');
  const [busy, setBusy] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string>('');

  const userIsAdmin = isAdminUser(currentUser);

  useEffect(() => {
    if (!open) return;
    setErrorText('');
    setSavedNotice(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (userProfile) {
      setEditName(userProfile.displayName);
      setEditRole(userProfile.creatorType);
    } else if (currentUser) {
      setEditName(currentUser.displayName || '');
    }
  }, [userProfile, currentUser]);

  if (!open) return null;

  const handleLoginSubmit = async () => {
    setBusy(true);
    setErrorText('');
    try {
      const user = await signInWithGooglePopup();
      const profile = await ensureOrRegisterUserProfile(user);
      onProfileUpdated(profile);
      onClose();
    } catch {
      setErrorText(
        lang === Language.SI
          ? 'පිවිසීම අවලංගු විය හෝ අසාර්ථක විය. නැවත උත්සාහ කරන්න.'
          : 'Sign-in was cancelled or failed. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regName.trim().length > 0 && regName.trim().length < 2) {
      setErrorText(
        lang === Language.SI
          ? 'කරුණාකර අවම වශයෙන් අකුරු 2ක නමක් යොදන්න.'
          : 'Please enter at least 2 characters for your display name.'
      );
      return;
    }

    setBusy(true);
    setErrorText('');
    try {
      const user = await signInWithGooglePopup();
      const mappedAccountType = creativeRoleToAccountType(regCreativeRole);
      const profile = await ensureOrRegisterUserProfile(
        user,
        regName.trim() || undefined,
        mappedAccountType,
        regCreativeRole
      );
      onProfileUpdated(profile);
      onClose();
    } catch {
      setErrorText(
        lang === Language.SI
          ? 'ලියාපදිංචි වීම අවලංගු විය හෝ අසාර්ථක විය. නැවත උත්සාහ කරන්න.'
          : 'Account registration was cancelled or failed. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (editName.trim().length < 2) {
      setErrorText(
        lang === Language.SI
          ? 'ඔබේ නම අවම වශයෙන් අකුරු 2ක් විය යුතුය.'
          : 'Display name must be at least 2 characters.'
      );
      return;
    }

    setBusy(true);
    setErrorText('');
    try {
      const updated = await updateUserProfileDetails(currentUser, editName, editRole);
      onProfileUpdated(updated);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2500);
    } catch {
      setErrorText(
        lang === Language.SI
          ? 'ගිණුම් තොරතුරු යාවත්කාලීන කිරීමට නොහැකි විය.'
          : 'Failed to update profile details.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    onClose();
    await signOutCurrentUser();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl glass-panel border border-white/[0.12] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4 bg-slate-950/70">
          <h2 id="account-modal-title" className="text-base font-bold text-white">
            {currentUser
              ? lang === Language.SI
                ? 'මගේ ගිණුම'
                : 'My Account'
              : lang === Language.SI
                ? 'ගිණුමට පිවිසෙන්න හෝ ලියාපදිංචි වන්න'
                : 'Sign In or Create Account'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {!currentUser ? (
            <div className="space-y-5">
              {/* Segmented Login / Register Switcher */}
              <div
                role="tablist"
                className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#070A12] border border-white/[0.09]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === 'login'}
                  onClick={() => {
                    setAuthTab('login');
                    setErrorText('');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors min-h-[38px] inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    authTab === 'login'
                      ? 'bg-sky-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{lang === Language.SI ? 'පිවිසෙන්න (Login)' : 'Sign In'}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === 'register'}
                  onClick={() => {
                    setAuthTab('register');
                    setErrorText('');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors min-h-[38px] inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    authTab === 'register'
                      ? 'bg-sky-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{lang === Language.SI ? 'ලියාපදිංචි වන්න' : 'Register'}</span>
                </button>
              </div>

              {authTab === 'login' ? (
                <div className="space-y-4 pt-1">
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {lang === Language.SI
                      ? 'ඔබගේ LankaGlobal Creator Profile ගිණුමට පිවිසීමට, තිරපිටපත් පරීක්ෂණ තත්ත්වය බැලීමට සහ සිනමා ප්‍රජාව හා සම්බන්ධ වීමට Google හරහා පිවිසෙන්න.'
                      : 'Sign in to access your filmmaker profile, track screenplay review status, and connect in the community.'}
                  </p>

                  {errorText && <p className="text-xs text-rose-400">{errorText}</p>}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleLoginSubmit}
                    className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] disabled:opacity-60 text-white font-semibold text-xs hover:shadow-lg hover:shadow-cyan-500/30 transition-all flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>
                      {busy
                        ? lang === Language.SI
                          ? 'පිවිසෙමින් පවතී...'
                          : 'Signing in...'
                        : lang === Language.SI
                          ? 'Google ගිණුමෙන් පිවිසෙන්න'
                          : 'Continue with Google'}
                    </span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-4 pt-1">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {lang === Language.SI
                      ? 'ඔබේ නම සහ සිනමා භූමිකාව තෝරා LinkedIn / Facebook ආකාරයේ ඔබේම Creator Profile ගිණුම සාදා ගන්න.'
                      : 'Choose your display name and filmmaking role to create your public Creator Profile.'}
                  </p>

                  <div>
                    <label
                      htmlFor="reg-display-name"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      {lang === Language.SI ? 'ඔබේ නම (Display Name)' : 'Display Name'}
                    </label>
                    <input
                      id="reg-display-name"
                      type="text"
                      maxLength={100}
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder={lang === Language.SI ? 'උදා: කසුන් පෙරේරා' : 'e.g. Kasun Perera'}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#070A12] border border-white/10 text-sm text-white focus:border-sky-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-role"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      {lang === Language.SI ? 'ඔබ ලියාපදිංචි වන සිනමා අංශය' : 'Filmmaking Role'}
                    </label>
                    <select
                      id="reg-role"
                      value={regCreativeRole}
                      onChange={(e) => setRegCreativeRole(e.target.value as CreativeRole)}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#070A12] border border-white/10 text-sm text-white focus:border-sky-400 focus:outline-none"
                    >
                      {CREATIVE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {CREATIVE_ROLE_LABELS[role][lang]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {errorText && <p className="text-xs text-rose-400">{errorText}</p>}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] disabled:opacity-60 text-white font-semibold text-xs hover:shadow-lg hover:shadow-cyan-500/30 transition-all flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>
                      {busy
                        ? lang === Language.SI
                          ? 'ගිණුම සාදමින් පවතී...'
                          : 'Creating Account...'
                        : lang === Language.SI
                          ? 'Google හරහා Profile එක සාදන්න (Register)'
                          : 'Register Creator Profile with Google'}
                    </span>
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Signed-in Member Account View */
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="py-3 px-4 rounded-xl bg-[#070A12] border border-white/[0.08]">
                <p className="text-xs text-slate-400">
                  {lang === Language.SI ? 'ලියාපදිංචි විද්‍යුත් තැපෑල' : 'Registered Email'}
                </p>
                <p className="text-sm font-medium text-white truncate mt-0.5">
                  {currentUser.email}
                </p>
              </div>

              <div>
                <label
                  htmlFor="edit-display-name"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  {lang === Language.SI ? 'ඔබේ නම' : 'Display Name'}
                </label>
                <input
                  id="edit-display-name"
                  type="text"
                  maxLength={100}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#070A12] border border-white/10 text-sm text-white focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-role"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  {lang === Language.SI ? 'සාමාජික අංශය' : 'Member Role'}
                </label>
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as CreatorType)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#070A12] border border-white/10 text-sm text-white focus:border-sky-400 focus:outline-none"
                >
                  <option value="Screenwriter">
                    {lang === Language.SI ? 'තිරපිටපත් රචක (Screenwriter)' : 'Screenwriter / Creator'}
                  </option>
                  <option value="Producer">
                    {lang === Language.SI ? 'නිෂ්පාදක / අධ්‍යක්ෂ (Producer)' : 'Producer / Director'}
                  </option>
                  <option value="Reader">
                    {lang === Language.SI ? 'පාඨක / ප්‍රේක්ෂක (Reader)' : 'Reader / Industry Guest'}
                  </option>
                </select>
              </div>

              {errorText && <p className="text-xs text-rose-400">{errorText}</p>}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-sky-400 hover:bg-sky-300 disabled:opacity-60 text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[40px] cursor-pointer"
                >
                  {savedNotice ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{lang === Language.SI ? 'සුරැකිණි' : 'Saved'}</span>
                    </>
                  ) : (
                    <span>{lang === Language.SI ? 'වෙනස්කම් සුරකින්න' : 'Save Profile'}</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="py-2.5 px-4 rounded-lg border border-white/15 hover:bg-white/[0.06] text-slate-200 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 min-h-[40px] cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{lang === Language.SI ? 'ඉවත් වන්න' : 'Sign Out'}</span>
                </button>
              </div>

              {/* Strictly rendered ONLY when lakwinj1@gmail.com is signed in */}
              {userIsAdmin && (
                <div className="pt-4 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdminPanel();
                    }}
                    className="w-full py-2.5 px-4 rounded-lg bg-sky-400/12 hover:bg-sky-400/20 border border-sky-400/40 text-sky-300 font-semibold text-xs transition-colors flex items-center justify-center gap-2 min-h-[42px] cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {lang === Language.SI
                        ? 'Admin පුවරුව විවෘත කරන්න (තිරපිටපත් ගොනු)'
                        : 'Open Admin Vault'}
                    </span>
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
