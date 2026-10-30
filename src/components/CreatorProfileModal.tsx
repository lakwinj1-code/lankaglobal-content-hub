import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Handshake,
  LogOut,
  MapPin,
  MessageSquare,
  PenLine,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  COLLAB_PURPOSES,
  COLLAB_PURPOSE_LABELS,
  COMMUNITY_CATEGORY_LABELS,
  CREATIVE_ROLES,
  CREATIVE_ROLE_LABELS,
} from '../data/content';
import {
  creativeRoleToAccountType,
  downloadSubmissionFile,
  isAdminUser,
  polishPublicScriptDetails,
  respondToCollabRequest,
  sendCollabRequest,
  signOutCurrentUser,
  toggleFollowCreator,
  updateCreatorPublicProfile,
} from '../firebase';
import { ProjectStatus } from '../types';
import {
  CollabPurpose,
  CollabRequestRecord,
  CommunityPostRecord,
  CreativeRole,
  CreatorFollowRecord,
  CreatorProfileRecord,
  Language,
  PipelineProject,
  PrivateSubmissionRecord,
  UserProfileRecord,
} from '../types';

interface CreatorProfileModalProps {
  open: boolean;
  targetUid: string | null;
  fallbackName?: string;
  initialConnectScript?: { id: string; title: string } | null;
  initialOwnTab?: 'scripts' | 'connections' | 'posts' | 'edit';
  lang: Language;
  currentUser: User | null;
  userProfile: UserProfileRecord | null;
  allCreatorProfiles: CreatorProfileRecord[];
  allPublicScripts: PipelineProject[];
  myPrivateSubmissions: PrivateSubmissionRecord[];
  communityPosts: CommunityPostRecord[];
  myOutgoingFollows: CreatorFollowRecord[];
  myIncomingFollows: CreatorFollowRecord[];
  incomingCollabs: CollabRequestRecord[];
  outgoingCollabs: CollabRequestRecord[];
  onSelectProject: (project: PipelineProject) => void;
  onInspectCreator: (uid: string, fallbackName?: string) => void;
  onRequireSignIn: () => void;
  onOpenAdminPanel: () => void;
  onOpenCommunityForScript?: (scriptId: string) => void;
  onNavigateSubmit?: () => void;
  onUserProfileSynced: (updated: UserProfileRecord) => void;
  onClose: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatShortDate(iso: string | undefined, lang: Language): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(lang === Language.SI ? 'si-LK' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const CreatorProfileModal: React.FC<CreatorProfileModalProps> = ({
  open,
  targetUid,
  fallbackName,
  initialConnectScript,
  initialOwnTab = 'scripts',
  lang,
  currentUser,
  userProfile,
  allCreatorProfiles,
  allPublicScripts,
  myPrivateSubmissions,
  communityPosts,
  myOutgoingFollows,
  myIncomingFollows,
  incomingCollabs,
  outgoingCollabs,
  onSelectProject,
  onInspectCreator,
  onRequireSignIn,
  onOpenAdminPanel,
  onOpenCommunityForScript,
  onNavigateSubmit,
  onUserProfileSynced,
  onClose,
}) => {
  const isOwnProfile = Boolean(currentUser && targetUid && currentUser.uid === targetUid);
  const userIsAdmin = isAdminUser(currentUser);

  const [ownTab, setOwnTab] = useState<'scripts' | 'connections' | 'posts' | 'edit'>(
    initialOwnTab
  );
  const [otherTab, setOtherTab] = useState<'scripts' | 'posts' | 'connect'>('scripts');

  // Edit Own Profile Form State
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<CreativeRole>('Screenwriter');
  const [editHeadline, setEditHeadline] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editOpenCollab, setEditOpenCollab] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Follow & Download State
  const [followBusy, setFollowBusy] = useState(false);
  const [downloadingScriptId, setDownloadingScriptId] = useState<string | null>(null);

  // Send Collaboration Inquiry Form State
  const [collabPurpose, setCollabPurpose] = useState<CollabPurpose>(
    'Story Option / Co-Production'
  );
  const [collabScriptId, setCollabScriptId] = useState('');
  const [collabMessage, setCollabMessage] = useState('');
  const [collabContact, setCollabContact] = useState('');
  const [sendingCollab, setSendingCollab] = useState(false);
  const [collabSentSuccess, setCollabSentSuccess] = useState(false);
  const [collabError, setCollabError] = useState('');

  // Reply to Incoming Collaboration State
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Story Polish Editor State (for revising public Title, Logline & Synopsis)
  const [editingPolishId, setEditingPolishId] = useState<string | null>(null);
  const [polishTitle, setPolishTitle] = useState('');
  const [polishLogline, setPolishLogline] = useState('');
  const [polishSynopsis, setPolishSynopsis] = useState('');
  const [polishSaving, setPolishSaving] = useState(false);
  const [polishError, setPolishError] = useState('');
  const [polishSavedId, setPolishSavedId] = useState<string | null>(null);

  const targetProfile = useMemo(() => {
    if (!targetUid) return null;
    return allCreatorProfiles.find((p) => p.uid === targetUid) || null;
  }, [allCreatorProfiles, targetUid]);

  const myCreatorProfile = useMemo(() => {
    if (!currentUser) return null;
    return allCreatorProfiles.find((p) => p.uid === currentUser.uid) || null;
  }, [allCreatorProfiles, currentUser]);

  const creatorScripts = useMemo(() => {
    if (!targetUid) return [];
    return allPublicScripts.filter((s) => s.authorUid === targetUid);
  }, [allPublicScripts, targetUid]);

  const creatorPosts = useMemo(() => {
    if (!targetUid) return [];
    return communityPosts
      .filter((p) => p.authorUid === targetUid)
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  }, [communityPosts, targetUid]);

  const isFollowingTarget = useMemo(() => {
    if (!currentUser || !targetUid) return false;
    return myOutgoingFollows.some((f) => f.followingUid === targetUid);
  }, [currentUser, myOutgoingFollows, targetUid]);

  const pendingIncomingCount = useMemo(() => {
    return incomingCollabs.filter((c) => c.status === 'Pending').length;
  }, [incomingCollabs]);

  const publicScriptsMap = useMemo(() => {
    const map = new Map<string, PipelineProject>();
    allPublicScripts.forEach((p) => map.set(p.id, p));
    return map;
  }, [allPublicScripts]);

  const displayTitle =
    targetProfile?.displayName ||
    (isOwnProfile
      ? userProfile?.displayName || currentUser?.displayName || 'Creator'
      : fallbackName || creatorScripts[0]?.writer || 'Filmmaker');

  const displayRole: CreativeRole =
    targetProfile?.creativeRole ||
    (isOwnProfile ? (userProfile?.creatorType as CreativeRole) || 'Screenwriter' : 'Screenwriter');

  useEffect(() => {
    if (!open) return;
    setOwnTab(initialOwnTab);
    setCollabSentSuccess(false);
    setCollabError('');
    setProfileError('');
    setProfileSaved(false);
    setEditingPolishId(null);
    setPolishError('');

    if (initialConnectScript) {
      setOtherTab('connect');
      setCollabScriptId(initialConnectScript.id);
      setCollabPurpose('Story Option / Co-Production');
    } else {
      setOtherTab('scripts');
      setCollabScriptId('');
    }
    setCollabMessage('');
    setCollabContact(currentUser?.email || '');
  }, [open, targetUid, initialConnectScript, initialOwnTab, currentUser?.email]);

  useEffect(() => {
    if (!open || !isOwnProfile) return;
    setEditName(
      myCreatorProfile?.displayName ||
        userProfile?.displayName ||
        currentUser?.displayName ||
        ''
    );
    setEditRole(
      myCreatorProfile?.creativeRole ||
        (userProfile?.creatorType as CreativeRole) ||
        'Screenwriter'
    );
    setEditHeadline(myCreatorProfile?.headline || '');
    setEditBio(myCreatorProfile?.bio || '');
    setEditLocation(myCreatorProfile?.location || 'Sri Lanka');
    setEditOpenCollab(myCreatorProfile ? myCreatorProfile.openToCollab : true);
  }, [open, isOwnProfile, myCreatorProfile, userProfile, currentUser]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !targetUid) return null;

  const handleToggleFollow = async () => {
    if (!currentUser) {
      onClose();
      onRequireSignIn();
      return;
    }
    if (!targetProfile) return;
    setFollowBusy(true);
    try {
      const myName =
        myCreatorProfile?.displayName ||
        userProfile?.displayName ||
        currentUser.displayName ||
        'Member';
      await toggleFollowCreator(
        currentUser,
        myName,
        targetUid,
        targetProfile.displayName,
        isFollowingTarget
      );
    } finally {
      setFollowBusy(false);
    }
  };

  const handleSaveOwnProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (editName.trim().length < 2) {
      setProfileError(
        lang === Language.SI
          ? 'ඔබේ නම අවම වශයෙන් අකුරු 2ක් විය යුතුය.'
          : 'Display name must be at least 2 characters.'
      );
      return;
    }

    setSavingProfile(true);
    setProfileError('');
    try {
      await updateCreatorPublicProfile(currentUser, {
        displayName: editName,
        creativeRole: editRole,
        headline: editHeadline,
        bio: editBio,
        location: editLocation,
        openToCollab: editOpenCollab,
      });
      if (userProfile) {
        onUserProfileSynced({
          ...userProfile,
          displayName: editName.trim().slice(0, 100),
          creatorType: creativeRoleToAccountType(editRole),
          updatedAtIso: new Date().toISOString(),
        });
      }
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 2500);
    } catch {
      setProfileError(
        lang === Language.SI
          ? 'Profile තොරතුරු යාවත්කාලීන කිරීමට නොහැකි විය.'
          : 'Could not save profile changes.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDownloadOwnScript = async (sub: PrivateSubmissionRecord) => {
    if (sub.chunkCount <= 0) return;
    setDownloadingScriptId(sub.scriptId);
    try {
      await downloadSubmissionFile(
        sub.scriptId,
        sub.chunkCount,
        sub.fileName,
        sub.fileMimeType
      );
    } finally {
      setDownloadingScriptId(null);
    }
  };

  const handleStartPolish = (sub: PrivateSubmissionRecord, pub?: PipelineProject) => {
    setEditingPolishId(sub.scriptId);
    setPolishTitle(pub?.title || sub.title);
    setPolishLogline(pub?.logline[lang] || sub.logline);
    setPolishSynopsis(pub?.synopsis[lang] || sub.logline);
    setPolishError('');
  };

  const handleSavePolish = async (e: React.FormEvent, scriptId: string) => {
    e.preventDefault();
    if (polishTitle.trim().length < 2) {
      setPolishError(
        lang === Language.SI
          ? 'කතාවේ නම අවම වශයෙන් අකුරු 2ක් විය යුතුය.'
          : 'Title must be at least 2 characters.'
      );
      return;
    }
    if (polishLogline.trim().length < 20) {
      setPolishError(
        lang === Language.SI
          ? 'Logline සාරාංශය අවම වශයෙන් අකුරු 20ක් විය යුතුය.'
          : 'Logline must be at least 20 characters.'
      );
      return;
    }
    if (polishSynopsis.trim().length < 20) {
      setPolishError(
        lang === Language.SI
          ? 'Synopsis විස්තරය අවම වශයෙන් අකුරු 20ක් විය යුතුය.'
          : 'Synopsis must be at least 20 characters.'
      );
      return;
    }

    setPolishSaving(true);
    setPolishError('');
    try {
      await polishPublicScriptDetails({
        scriptId,
        title: polishTitle,
        logline: polishLogline,
        synopsis: polishSynopsis,
      });
      setEditingPolishId(null);
      setPolishSavedId(scriptId);
      window.setTimeout(() => setPolishSavedId(null), 2600);
    } catch {
      setPolishError(
        lang === Language.SI
          ? 'කතා සාරාංශය යාවත්කාලීන කිරීමට නොහැකි විය. (Under Review පිටපත් සඳහා පමණි)'
          : 'Could not update story summary.'
      );
    } finally {
      setPolishSaving(false);
    }
  };

  const handleSendCollab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onClose();
      onRequireSignIn();
      return;
    }
    if (collabMessage.trim().length < 10) {
      setCollabError(
        lang === Language.SI
          ? 'කරුණාකර අවම වශයෙන් අකුරු 10ක කෙටි පණිවිඩයක් සටහන් කරන්න.'
          : 'Please write a message of at least 10 characters.'
      );
      return;
    }

    const matchedScript = creatorScripts.find((s) => s.id === collabScriptId);
    setSendingCollab(true);
    setCollabError('');
    try {
      await sendCollabRequest({
        user: currentUser,
        senderName:
          myCreatorProfile?.displayName ||
          userProfile?.displayName ||
          currentUser.displayName ||
          'Member',
        senderRole: myCreatorProfile?.creativeRole || 'Producer',
        recipientUid: targetUid,
        recipientName: displayTitle,
        scriptId: matchedScript ? matchedScript.id : '',
        scriptTitle: matchedScript ? matchedScript.title : '',
        purpose: collabPurpose,
        message: collabMessage,
        senderContact: collabContact,
      });
      setCollabSentSuccess(true);
      setCollabMessage('');
    } catch {
      setCollabError(
        lang === Language.SI
          ? 'සම්බන්ධතා පණිවිඩය යැවීමට නොහැකි විය. නැවත උත්සාහ කරන්න.'
          : 'Could not send collaboration request. Please try again.'
      );
    } finally {
      setSendingCollab(false);
    }
  };

  const handleRespondCollab = async (
    reqId: string,
    nextStatus: 'Accepted' | 'Declined'
  ) => {
    setRespondingId(reqId);
    try {
      await respondToCollabRequest(reqId, nextStatus, replyDrafts[reqId] || '');
    } finally {
      setRespondingId(null);
    }
  };

  const handleSignOut = async () => {
    onClose();
    await signOutCurrentUser();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="creator-profile-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-3xl glass-panel border border-white/[0.12] overflow-hidden my-auto shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Cover Header */}
        <div className="relative px-6 pt-6 pb-5 border-b border-white/[0.08] bg-gradient-to-br from-slate-900 via-[#080d1a] to-[#060911] shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#06b6d4] to-[#4f46e5] flex items-center justify-center text-white font-display font-extrabold text-xl shrink-0 shadow-lg shadow-cyan-500/20">
                {getInitials(displayTitle)}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#38bdf8] font-medium">
                  <span>{CREATIVE_ROLE_LABELS[displayRole][lang]}</span>
                  {targetProfile?.location ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-slate-300">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{targetProfile.location}</span>
                      </span>
                    </>
                  ) : null}
                  {(targetProfile?.openToCollab ?? true) && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-400 font-semibold">
                        {lang === Language.SI
                          ? 'නව නිර්මාණ සඳහා විවෘතයි'
                          : 'Open to Collaborate'}
                      </span>
                    </>
                  )}
                </div>

                <h2
                  id="creator-profile-modal-title"
                  className="text-xl sm:text-2xl font-extrabold text-white truncate mt-1"
                >
                  {displayTitle}
                </h2>

                {targetProfile?.headline && (
                  <p className="text-xs sm:text-sm text-slate-300 mt-0.5 line-clamp-1">
                    {targetProfile.headline}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close profile"
              className="w-9 h-9 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {targetProfile?.bio && (
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-4 max-w-3xl">
              {targetProfile.bio}
            </p>
          )}

          {/* Metrics & Action Row */}
          <div className="mt-5 pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-5 text-xs text-slate-400">
              <span>
                <strong className="text-white font-mono tabular-nums text-sm">
                  {targetProfile?.followersCount ?? 0}
                </strong>{' '}
                {lang === Language.SI ? 'Followers' : 'Followers'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-white font-mono tabular-nums text-sm">
                  {targetProfile?.followingCount ?? 0}
                </strong>{' '}
                {lang === Language.SI ? 'Following' : 'Following'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-white font-mono tabular-nums text-sm">
                  {isOwnProfile ? myPrivateSubmissions.length : creatorScripts.length}
                </strong>{' '}
                {lang === Language.SI ? 'තිරපිටපත්' : 'Scripts'}
              </span>
            </div>

            {isOwnProfile ? (
              <div className="flex flex-wrap items-center gap-2.5">
                {userIsAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdminPanel();
                    }}
                    className="px-3.5 py-2 rounded-xl border border-[#38bdf8]/40 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-[#38bdf8] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{lang === Language.SI ? 'Admin පුවරුව' : 'Admin Vault'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3.5 py-2 rounded-xl border border-white/15 hover:bg-white/[0.06] text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{lang === Language.SI ? 'ඉවත් වන්න' : 'Sign Out'}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                {targetProfile && (
                  <button
                    type="button"
                    disabled={followBusy}
                    onClick={handleToggleFollow}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer ${
                      isFollowingTarget
                        ? 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                        : 'border border-[#38bdf8]/40 bg-[#38bdf8]/15 text-[#38bdf8] hover:bg-[#38bdf8]/25'
                    }`}
                  >
                    {isFollowingTarget ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{lang === Language.SI ? 'Follow කරන්න' : 'Follow'}</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setOtherTab('connect')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:shadow-lg hover:shadow-cyan-500/25 transition-all whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
                >
                  <Handshake className="w-3.5 h-3.5" />
                  <span>
                    {lang === Language.SI ? 'සම්බන්ධ වන්න / Collaborate' : 'Connect / Collaborate'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {isOwnProfile ? (
              <>
                {[
                  {
                    id: 'scripts' as const,
                    label:
                      lang === Language.SI
                        ? `මගේ තිරපිටපත් (${myPrivateSubmissions.length})`
                        : `My Scripts (${myPrivateSubmissions.length})`,
                  },
                  {
                    id: 'connections' as const,
                    label:
                      lang === Language.SI
                        ? `සම්බන්ධතා හා පණිවිඩ (${pendingIncomingCount > 0 ? `${pendingIncomingCount} නව` : incomingCollabs.length + outgoingCollabs.length})`
                        : `Inquiries & Network (${pendingIncomingCount > 0 ? `${pendingIncomingCount} new` : incomingCollabs.length + outgoingCollabs.length})`,
                  },
                  {
                    id: 'posts' as const,
                    label:
                      lang === Language.SI
                        ? `මගේ ප්‍රජා සටහන් (${creatorPosts.length})`
                        : `My Posts (${creatorPosts.length})`,
                  },
                  {
                    id: 'edit' as const,
                    label:
                      lang === Language.SI ? 'Profile සංස්කරණය' : 'Edit Public Profile',
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setOwnTab(tab.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[36px] cursor-pointer ${
                      ownTab === tab.id
                        ? 'bg-[#06b6d4] text-slate-950'
                        : 'bg-white/[0.04] text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </>
            ) : (
              <>
                {[
                  {
                    id: 'scripts' as const,
                    label:
                      lang === Language.SI
                        ? `තිරපිටපත් (${creatorScripts.length})`
                        : `Screenplays (${creatorScripts.length})`,
                  },
                  {
                    id: 'posts' as const,
                    label:
                      lang === Language.SI
                        ? `ප්‍රජා සටහන් (${creatorPosts.length})`
                        : `Community Posts (${creatorPosts.length})`,
                  },
                  {
                    id: 'connect' as const,
                    label:
                      lang === Language.SI
                        ? 'සෘජුව සම්බන්ධ වන්න'
                        : 'Send Collaboration Note',
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setOtherTab(tab.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[36px] cursor-pointer ${
                      otherTab === tab.id
                        ? 'bg-[#06b6d4] text-slate-950'
                        : 'bg-white/[0.04] text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* ==================== OWN PROFILE MODE ==================== */}
          {isOwnProfile && ownTab === 'scripts' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {lang === Language.SI
                      ? 'ඔබ ඉදිරිපත් කළ තිරපිටපත් සහ පරීක්ෂණ තත්ත්වය'
                      : 'Your Submitted Screenplays & Editorial Review Status'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {lang === Language.SI
                      ? 'අපගේ තේරීම් කමිටුව මගින් ඔබේ පිටපත පරීක්ෂා කරන ආකාරය මෙහි සජීවීව යාවත්කාලීන වේ.'
                      : 'Track live review stages and editorial board notes for every script you submit.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onNavigateSubmit) {
                      onNavigateSubmit();
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white text-xs font-semibold whitespace-nowrap shrink-0 min-h-[38px] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>
                    {lang === Language.SI ? 'නව පිටපතක් යවන්න' : 'Submit New Script'}
                  </span>
                </button>
              </div>

              {myPrivateSubmissions.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <p className="text-sm font-semibold text-white">
                    {lang === Language.SI
                      ? 'ඔබ තවම කිසිදු තිරපිටපතක් ඉදිරිපත් කර නොමැත'
                      : 'You have not submitted any screenplays yet'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto">
                    {lang === Language.SI
                      ? 'ඔබ තිරපිටපතක් Upload කළ සැණින් එහි NDA යොමු අංකය සහ පරීක්ෂණ මට්ටම (Pending Review → Shortlisted → Pitch Deck Ready) මෙතැනින් බලාගත හැකිය.'
                      : 'Once you upload a screenplay, its NDA reference, view count, and editorial review stage appear here automatically.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myPrivateSubmissions.map((sub) => {
                    const stepIndex =
                      sub.reviewStatus === 'Pitch Deck Ready'
                        ? 3
                        : sub.reviewStatus === 'Shortlisted'
                          ? 2
                          : sub.reviewStatus === 'Pending Review'
                            ? 1
                            : 0;
                    const pubProject = publicScriptsMap.get(sub.scriptId);
                    const views = pubProject?.views ?? 0;
                    const canPolishPublic =
                      pubProject && pubProject.status === ProjectStatus.UNDER_REVIEW;
                    const isEditingThis = editingPolishId === sub.scriptId;

                    return (
                      <div
                        key={sub.scriptId}
                        className="glass-card rounded-2xl p-5 space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span className="font-mono tabular-nums text-[#38bdf8] font-semibold">
                                {sub.referenceId}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{sub.genre}</span>
                              <span aria-hidden="true">·</span>
                              <span>{sub.format}</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatShortDate(sub.createdAtIso, lang)}</span>
                            </div>

                            <h4 className="text-lg font-bold text-white mt-1">
                              {pubProject?.title || sub.title}
                            </h4>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 shrink-0 text-xs">
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums text-slate-300">
                              <Eye className="w-3.5 h-3.5 text-[#38bdf8]" />
                              <span>
                                {lang === Language.SI
                                  ? `නැරඹුම් ${views}`
                                  : `${views} views`}
                              </span>
                            </span>

                            {onOpenCommunityForScript && pubProject && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onOpenCommunityForScript(sub.scriptId);
                                }}
                                className="px-3 py-1.5 rounded-lg border border-[#38bdf8]/40 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-[#38bdf8] font-medium inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Users className="w-3.5 h-3.5" />
                                <span>
                                  {lang === Language.SI
                                    ? 'ප්‍රජා අදහස් ගන්න'
                                    : 'Get Community Notes'}
                                </span>
                              </button>
                            )}

                            {canPolishPublic && (
                              <button
                                type="button"
                                onClick={() =>
                                  isEditingThis
                                    ? setEditingPolishId(null)
                                    : handleStartPolish(sub, pubProject)
                                }
                                className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/[0.06] text-slate-200 font-medium inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <PenLine className="w-3.5 h-3.5 text-[#38bdf8]" />
                                <span>
                                  {lang === Language.SI
                                    ? 'කතාව Polish කරන්න'
                                    : 'Polish Summary'}
                                </span>
                              </button>
                            )}

                            {sub.chunkCount > 0 && (
                              <button
                                type="button"
                                disabled={downloadingScriptId === sub.scriptId}
                                onClick={() => handleDownloadOwnScript(sub)}
                                className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/[0.06] text-slate-200 font-medium inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5 text-[#38bdf8]" />
                                <span>
                                  {downloadingScriptId === sub.scriptId
                                    ? '...'
                                    : lang === Language.SI
                                      ? 'මගේ NDA ගොනුව'
                                      : 'My NDA File'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>

                        {polishSavedId === sub.scriptId && (
                          <p className="text-xs text-emerald-400 font-medium">
                            {lang === Language.SI
                              ? 'ඔබේ කතාවේ Public Logline සහ Synopsis සාර්ථකව යාවත්කාලීන (Polish) කරන ලදී!'
                              : 'Your public story Logline & Synopsis have been updated!'}
                          </p>
                        )}

                        {isEditingThis && (
                          <form
                            onSubmit={(e) => handleSavePolish(e, sub.scriptId)}
                            className="p-4 rounded-xl bg-slate-950/90 border border-[#38bdf8]/35 space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-[#38bdf8]">
                                {lang === Language.SI
                                  ? 'ප්‍රජාවේ අදහස් අනුව කතාවේ නම, Logline සහ Synopsis තවදුරටත් ඔපමට්ටම් කරන්න (ඔබේ NDA පිටපත් ගොනුව රහසිගතවම පවතී)'
                                  : 'Polish your public Title, Logline & Synopsis based on community feedback (your NDA file stays locked)'}
                              </p>
                            </div>

                            <div>
                              <label className="block text-xs text-slate-300 mb-1">
                                {lang === Language.SI ? 'කතාවේ නම (Title)' : 'Working Title'}
                              </label>
                              <input
                                type="text"
                                maxLength={140}
                                value={polishTitle}
                                onChange={(e) => setPolishTitle(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[#060911] border border-white/10 text-xs sm:text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs text-slate-300 mb-1">
                                {lang === Language.SI
                                  ? 'කෙටි සාරාංශය (Polished Logline)'
                                  : 'Polished Logline'}
                              </label>
                              <textarea
                                rows={2}
                                maxLength={1000}
                                value={polishLogline}
                                onChange={(e) => setPolishLogline(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[#060911] border border-white/10 text-xs sm:text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs text-slate-300 mb-1">
                                {lang === Language.SI
                                  ? 'විස්තරාත්මක කතා සැලැස්ම (Polished Synopsis)'
                                  : 'Polished Synopsis'}
                              </label>
                              <textarea
                                rows={3}
                                maxLength={1500}
                                value={polishSynopsis}
                                onChange={(e) => setPolishSynopsis(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[#060911] border border-white/10 text-xs sm:text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                              />
                            </div>

                            {polishError && (
                              <p className="text-xs text-rose-400">{polishError}</p>
                            )}

                            <div className="flex items-center gap-2.5">
                              <button
                                type="submit"
                                disabled={polishSaving}
                                className="px-4 py-2 rounded-lg bg-[#06b6d4] hover:bg-[#38bdf8] text-slate-950 font-semibold text-xs cursor-pointer"
                              >
                                {polishSaving
                                  ? lang === Language.SI
                                    ? 'සුරකිමින්...'
                                    : 'Saving...'
                                  : lang === Language.SI
                                    ? 'Polish කළ කතාව සුරකින්න'
                                    : 'Save Polished Story'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPolishId(null)}
                                className="px-3.5 py-2 rounded-lg border border-white/15 text-slate-300 text-xs cursor-pointer"
                              >
                                {lang === Language.SI ? 'අවලංගු කරන්න' : 'Cancel'}
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Visual 3-Step Review Status Tracker */}
                        {sub.reviewStatus === 'Archived' ? (
                          <div className="py-2.5 px-3.5 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-slate-300">
                            {lang === Language.SI
                              ? 'තත්ත්වය: සංරක්ෂිත ලේඛනාගාරයට යොමු කර ඇත (Archived)'
                              : 'Status: Archived from active slate'}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                            {[
                              {
                                step: 1,
                                si: '1. පරීක්ෂාවට යොමු කර ඇත',
                                en: '1. Pending Review',
                              },
                              {
                                step: 2,
                                si: '2. මූලික වටයෙන් තෝරාගෙන ඇත',
                                en: '2. Shortlisted',
                              },
                              {
                                step: 3,
                                si: '3. Pitch Deck සූදානම්!',
                                en: '3. Pitch Deck Ready',
                              },
                            ].map((item) => {
                              const active = stepIndex >= item.step;
                              const isCurrent = stepIndex === item.step;
                              return (
                                <div
                                  key={item.step}
                                  className={`px-3 py-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                                    isCurrent
                                      ? 'border-[#38bdf8]/60 bg-[#38bdf8]/12 text-white'
                                      : active
                                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                        : 'border-white/[0.06] bg-slate-950/60 text-slate-500'
                                  }`}
                                >
                                  {active ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#38bdf8]" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span className="truncate">
                                    {lang === Language.SI ? item.si : item.en}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {sub.adminNotes ? (
                          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs space-y-1">
                            <p className="font-semibold text-[#38bdf8]">
                              {lang === Language.SI
                                ? 'සංස්කාරක මණ්ඩලයේ සටහන (Editorial Feedback):'
                                : 'Editorial Board Coverage Note:'}
                            </p>
                            <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                              {sub.adminNotes}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">
                            {lang === Language.SI
                              ? 'සංස්කාරක මණ්ඩලයේ විශේෂ සටහන් ලැබුණු වහාම මෙහි දිස්වේ.'
                              : 'Editorial coverage notes will appear here once reviewed by our script advisors.'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isOwnProfile && ownTab === 'connections' && (
            <div className="space-y-8">
              {/* Incoming Collaboration Inquiries */}
              <div className="space-y-3">
                <h3 className="text-base font-bold text-white">
                  {lang === Language.SI
                    ? `ඔබ වෙත ලැබුණු නිර්මාණ හා කතා ඇරයුම් (${incomingCollabs.length})`
                    : `Incoming Story & Collaboration Inquiries (${incomingCollabs.length})`}
                </h3>

                {incomingCollabs.length === 0 ? (
                  <div className="glass-card rounded-2xl p-6 text-xs sm:text-sm text-slate-400">
                    {lang === Language.SI
                      ? 'වෙනත් නිෂ්පාදකයෙකු, අධ්‍යක්ෂවරයෙකු හෝ රචකයෙකු ඔබේ තිරපිටපතකට කැමති වී ඔබව සම්බන්ධ කරගත් විට එම පණිවිඩ මෙහි දිස්වේ.'
                      : 'When producers, directors, or fellow writers reach out about your stories, their inquiries appear here.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {incomingCollabs.map((req) => (
                      <div
                        key={req.requestId}
                        className="glass-card rounded-2xl p-5 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onInspectCreator(req.senderUid, req.senderName)
                              }
                              className="font-bold text-white hover:text-[#38bdf8] transition-colors cursor-pointer"
                            >
                              {req.senderName}
                            </button>
                            <span aria-hidden="true" className="text-slate-500">
                              ·
                            </span>
                            <span className="text-[#38bdf8]">
                              {CREATIVE_ROLE_LABELS[req.senderRole][lang]}
                            </span>
                            <span aria-hidden="true" className="text-slate-500">
                              ·
                            </span>
                            <span className="text-slate-400">
                              {COLLAB_PURPOSE_LABELS[req.purpose][lang]}
                            </span>
                          </div>

                          <span
                            className={`font-semibold ${
                              req.status === 'Accepted'
                                ? 'text-emerald-400'
                                : req.status === 'Declined'
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>

                        {req.scriptTitle && (
                          <p className="text-xs text-slate-300">
                            {lang === Language.SI ? 'අදාළ තිරපිටපත: ' : 'Regarding Script: '}
                            <strong className="text-white">{req.scriptTitle}</strong>
                          </p>
                        )}

                        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {req.message}
                        </p>

                        {req.senderContact && (
                          <p className="text-xs text-slate-300">
                            {lang === Language.SI
                              ? 'සම්බන්ධ කරගත හැකි තොරතුරු: '
                              : 'Direct Contact: '}
                            <span className="font-mono text-[#38bdf8]">
                              {req.senderContact}
                            </span>
                          </p>
                        )}

                        {req.status === 'Pending' ? (
                          <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
                            <input
                              type="text"
                              maxLength={1000}
                              value={replyDrafts[req.requestId] || ''}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({
                                  ...prev,
                                  [req.requestId]: e.target.value,
                                }))
                              }
                              placeholder={
                                lang === Language.SI
                                  ? 'පිළිතුරු සටහනක් හෝ ඔබේ WhatsApp / Email අංකය මෙහි ලියන්න...'
                                  : 'Write a reply note or share your preferred contact details...'
                              }
                              className="w-full px-3.5 py-2 rounded-lg bg-[#060911] border border-white/10 text-xs text-white focus:border-[#38bdf8] focus:outline-none"
                            />
                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                disabled={respondingId === req.requestId}
                                onClick={() =>
                                  handleRespondCollab(req.requestId, 'Accepted')
                                }
                                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>
                                  {lang === Language.SI
                                    ? 'පිළිගන්න (Accept)'
                                    : 'Accept & Reply'}
                                </span>
                              </button>
                              <button
                                type="button"
                                disabled={respondingId === req.requestId}
                                onClick={() =>
                                  handleRespondCollab(req.requestId, 'Declined')
                                }
                                className="px-4 py-2 rounded-lg border border-white/15 hover:bg-white/[0.06] text-slate-300 font-semibold text-xs cursor-pointer"
                              >
                                {lang === Language.SI ? 'ප්‍රතික්ෂේප කරන්න' : 'Decline'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          req.replyNote && (
                            <p className="text-xs text-slate-400 pt-2 border-t border-white/[0.08]">
                              {lang === Language.SI ? 'ඔබේ පිළිතුර: ' : 'Your Reply: '}
                              <span className="text-slate-200">{req.replyNote}</span>
                            </p>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sent Inquiries */}
              <div className="space-y-3">
                <h3 className="text-base font-bold text-white">
                  {lang === Language.SI
                    ? `ඔබ යැවූ සම්බන්ධතා පණිවිඩ (${outgoingCollabs.length})`
                    : `Inquiries You Sent (${outgoingCollabs.length})`}
                </h3>

                {outgoingCollabs.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    {lang === Language.SI
                      ? 'ඔබ තවම වෙනත් නිර්මාණකරුවෙකු වෙත සම්බන්ධතා පණිවිඩයක් යවා නොමැත.'
                      : 'You have not sent any collaboration inquiries yet.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {outgoingCollabs.map((req) => (
                      <div
                        key={req.requestId}
                        className="glass-card rounded-2xl p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              onInspectCreator(req.recipientUid, req.recipientName)
                            }
                            className="font-bold text-white hover:text-[#38bdf8] cursor-pointer"
                          >
                            {lang === Language.SI ? 'වෙත: ' : 'To: '}
                            {req.recipientName}
                          </button>
                          <span
                            className={`font-semibold ${
                              req.status === 'Accepted'
                                ? 'text-emerald-400'
                                : req.status === 'Declined'
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        {req.scriptTitle && (
                          <p className="text-xs text-[#38bdf8]">{req.scriptTitle}</p>
                        )}
                        <p className="text-xs text-slate-300">{req.message}</p>
                        {req.replyNote && (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200">
                            <strong>
                              {lang === Language.SI ? 'ලැබුණු පිළිතුර: ' : 'Creator Reply: '}
                            </strong>
                            {req.replyNote}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Followers & Following Lists */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-white/[0.08]">
                <div>
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#38bdf8]" />
                    <span>
                      {lang === Language.SI
                        ? `ඔබව Follow කරන අය (${myIncomingFollows.length})`
                        : `Followers (${myIncomingFollows.length})`}
                    </span>
                  </h4>
                  {myIncomingFollows.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      {lang === Language.SI ? 'තවම කිසිවෙකු නැත.' : 'No followers yet.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {myIncomingFollows.map((f) => (
                        <button
                          key={f.followId}
                          type="button"
                          onClick={() => onInspectCreator(f.followerUid, f.followerName)}
                          className="w-full text-left px-3.5 py-2.5 rounded-xl glass-card text-xs font-semibold text-slate-200 hover:text-[#38bdf8] flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate">{f.followerName}</span>
                          <span className="text-[#38bdf8] shrink-0">Profile →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#38bdf8]" />
                    <span>
                      {lang === Language.SI
                        ? `ඔබ Follow කරන අය (${myOutgoingFollows.length})`
                        : `Following (${myOutgoingFollows.length})`}
                    </span>
                  </h4>
                  {myOutgoingFollows.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      {lang === Language.SI
                        ? 'තවම කිසිවෙකු Follow කර නොමැත.'
                        : 'Not following anyone yet.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {myOutgoingFollows.map((f) => (
                        <button
                          key={f.followId}
                          type="button"
                          onClick={() =>
                            onInspectCreator(f.followingUid, f.followingName)
                          }
                          className="w-full text-left px-3.5 py-2.5 rounded-xl glass-card text-xs font-semibold text-slate-200 hover:text-[#38bdf8] flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate">{f.followingName}</span>
                          <span className="text-[#38bdf8] shrink-0">Profile →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {isOwnProfile && ownTab === 'edit' && (
            <form onSubmit={handleSaveOwnProfile} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {lang === Language.SI ? 'ඔබේ නම (Display Name)' : 'Display Name'}
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {lang === Language.SI ? 'සිනමා ක්ෂේත්‍රයේ භූමිකාව' : 'Primary Filmmaking Role'}
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as CreativeRole)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                  >
                    {CREATIVE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {CREATIVE_ROLE_LABELS[role][lang]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {lang === Language.SI
                      ? 'වෘත්තීය හඳුන්වාදීම (Headline)'
                      : 'Professional Headline'}
                  </label>
                  <input
                    type="text"
                    maxLength={160}
                    value={editHeadline}
                    onChange={(e) => setEditHeadline(e.target.value)}
                    placeholder={
                      lang === Language.SI
                        ? 'උදා: Thriller සහ Sci-Fi තිරපිටපත් රචක'
                        : 'e.g. Thriller & Sci-Fi Screenwriter | Short Film Director'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {lang === Language.SI ? 'ප්‍රදේශය / නගරය' : 'City / Location'}
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder={lang === Language.SI ? 'කොළඹ, ශ්‍රී ලංකාව' : 'Colombo, Sri Lanka'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {lang === Language.SI
                    ? 'ඔබ පිළිබඳ විස්තරය සහ සිනමා නිර්මාණ රුචිකත්වය (Bio)'
                    : 'Filmmaker Bio & Creative Interests'}
                </label>
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder={
                    lang === Language.SI
                      ? 'ඔබේ නිර්මාණ අත්දැකීම්, ප්‍රියතම ශානර (Genres) සහ ඔබ සම්බන්ධ වීමට කැමති නිර්මාණ ගැන සඳහන් කරන්න...'
                      : 'Share your filmmaking background, favorite genres, and what kind of projects or collaborators you are looking for...'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editOpenCollab}
                  onChange={(e) => setEditOpenCollab(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#06b6d4]"
                />
                <span className="text-xs sm:text-sm text-slate-200">
                  {lang === Language.SI
                    ? 'නව චිත්‍රපට / කතාමාලා නිර්මාණ සඳහා අනෙකුත් නිර්මාණකරුවන් හා සම්බන්ධ වීමට විවෘතයි (Open to Collaborate)'
                    : 'Show as Open to Collaborate for film & series projects'}
                </span>
              </label>

              {profileError && <p className="text-xs text-rose-400">{profileError}</p>}

              <button
                type="submit"
                disabled={savingProfile}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white font-semibold text-xs inline-flex items-center gap-2 hover:shadow-lg hover:shadow-cyan-500/25 transition-all min-h-[42px] cursor-pointer"
              >
                {profileSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {lang === Language.SI
                        ? 'Profile එක යාවත්කාලීන විය!'
                        : 'Profile Updated!'}
                    </span>
                  </>
                ) : (
                  <span>
                    {savingProfile
                      ? lang === Language.SI
                        ? 'සුරකිමින් පවතී...'
                        : 'Saving...'
                      : lang === Language.SI
                        ? 'Public Profile එක සුරකින්න'
                        : 'Save Public Profile'}
                  </span>
                )}
              </button>
            </form>
          )}

          {/* ==================== SHARED POSTS TAB ==================== */}
          {((isOwnProfile && ownTab === 'posts') ||
            (!isOwnProfile && otherTab === 'posts')) && (
            <div className="space-y-3">
              {creatorPosts.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center text-xs sm:text-sm text-slate-400">
                  {lang === Language.SI
                    ? 'තවම සිනමා ප්‍රජාවේ කිසිදු සටහනක් පළ කර නොමැත.'
                    : 'No community posts published yet.'}
                </div>
              ) : (
                creatorPosts.map((post) => (
                  <div key={post.postId} className="glass-card rounded-2xl p-5 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="text-[#38bdf8] font-semibold">
                        {COMMUNITY_CATEGORY_LABELS[post.category][lang]}
                      </span>
                      <span>{formatShortDate(post.createdAtIso, lang)}</span>
                    </div>
                    <h4 className="text-base font-bold text-white">{post.title}</h4>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {post.body}
                    </p>
                    <div className="pt-2 flex items-center gap-4 text-xs text-slate-400 font-mono tabular-nums">
                      <span>
                        <Sparkles className="w-3.5 h-3.5 inline mr-1 text-[#38bdf8]" />
                        {post.likesCount}
                      </span>
                      <span>
                        <MessageSquare className="w-3.5 h-3.5 inline mr-1 text-[#38bdf8]" />
                        {post.commentsCount}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ==================== OTHER CREATOR SCRIPTS TAB ==================== */}
          {!isOwnProfile && otherTab === 'scripts' && (
            <div className="space-y-4">
              {creatorScripts.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center text-xs sm:text-sm text-slate-400">
                  {lang === Language.SI
                    ? 'මෙම නිර්මාණකරුවා විසින් තවම ප්‍රසිද්ධ ගැලරියට තිරපිටපත් එක් කර නොමැත.'
                    : 'This creator has not published any public screenplays yet.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {creatorScripts.map((script) => (
                    <div
                      key={script.id}
                      className="glass-card rounded-2xl p-5 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1.5">
                          <span className="text-[#38bdf8] font-semibold">
                            {script.status}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{script.genre}</span>
                          <span aria-hidden="true">·</span>
                          <span>{script.format}</span>
                        </div>
                        <h4 className="text-lg font-bold text-white">{script.title}</h4>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-2 line-clamp-3">
                          {script.logline[lang]}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectProject(script);
                          }}
                          className="text-xs font-semibold text-slate-200 hover:text-[#38bdf8] cursor-pointer"
                        >
                          {lang === Language.SI ? 'කතාව කියවන්න →' : 'Read Coverage →'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCollabScriptId(script.id);
                            setOtherTab('connect');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#38bdf8]/15 hover:bg-[#38bdf8]/25 text-[#38bdf8] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Handshake className="w-3.5 h-3.5" />
                          <span>
                            {lang === Language.SI
                              ? 'මේ කතාව ගැන කතා කරන්න'
                              : 'Inquire About Story'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==================== OTHER CREATOR DIRECT CONNECT TAB ==================== */}
          {!isOwnProfile && otherTab === 'connect' && (
            <div className="max-w-2xl">
              {!currentUser ? (
                <div className="glass-card rounded-2xl p-8 text-center space-y-4">
                  <p className="text-base font-bold text-white">
                    {lang === Language.SI
                      ? `${displayTitle} සමඟ සෘජුව සම්බන්ධ වීමට ගිණුමට පිවිසෙන්න`
                      : `Sign in to connect directly with ${displayTitle}`}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                    {lang === Language.SI
                      ? 'ඔබේ නිර්මාණකරු ගිණුම හරහා තිරපිටපත් නිෂ්පාදනය හෝ චිත්‍රපට කටයුතු සඳහා ආරක්ෂිතව පණිවිඩ යැවිය හැකිය.'
                      : 'Sign in with your member account to send private story option or filmmaking collaboration requests.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequireSignIn();
                    }}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white text-xs font-semibold cursor-pointer"
                  >
                    {lang === Language.SI
                      ? 'ලියාපදිංචි වන්න / Login වන්න'
                      : 'Register / Sign In'}
                  </button>
                </div>
              ) : collabSentSuccess ? (
                <div className="glass-card rounded-2xl p-8 text-center space-y-3 border border-emerald-500/30">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h4 className="text-lg font-bold text-white">
                    {lang === Language.SI
                      ? 'ඔබේ සම්බන්ධතා පණිවිඩය සාර්ථකව යොමු කෙරිණි!'
                      : 'Collaboration Inquiry Sent!'}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                    {lang === Language.SI
                      ? `${displayTitle} ඔබේ පණිවිඩයට පිළිතුරු දුන් විට ඔබේ Profile පිටුවේ "සම්බන්ධතා හා පණිවිඩ" කොටසින් එය බලාගත හැකිය.`
                      : `When ${displayTitle} responds, you will see their reply inside your Profile under Inquiries & Network.`}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSendCollab} className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {lang === Language.SI
                        ? `${displayTitle} වෙත සෘජු නිර්මාණ ඇරයුමක් යවන්න`
                        : `Send a Collaboration or Story Inquiry to ${displayTitle}`}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {lang === Language.SI
                        ? 'මෙම පණිවිඩය පෞද්ගලිකව අදාළ නිර්මාණකරුවාගේ Profile ගිණුමට පමණක් ලැබේ.'
                        : 'This private inquiry is visible only to you and the recipient creator.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        {lang === Language.SI ? 'සම්බන්ධ වීමේ අරමුණ' : 'Collaboration Purpose'}
                      </label>
                      <select
                        value={collabPurpose}
                        onChange={(e) =>
                          setCollabPurpose(e.target.value as CollabPurpose)
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                      >
                        {COLLAB_PURPOSES.map((p) => (
                          <option key={p} value={p}>
                            {COLLAB_PURPOSE_LABELS[p][lang]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {creatorScripts.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          {lang === Language.SI
                            ? 'අදාළ තිරපිටපත (අත්‍යවශ්‍ය නොවේ)'
                            : 'Referenced Screenplay (Optional)'}
                        </label>
                        <select
                          value={collabScriptId}
                          onChange={(e) => setCollabScriptId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                        >
                          <option value="">
                            {lang === Language.SI
                              ? 'සාමාන්‍ය සිනමා සම්බන්ධතාවක්'
                              : 'General Filmmaking Inquiry'}
                          </option>
                          {creatorScripts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      {lang === Language.SI ? 'ඔබේ පණිවිඩය / යෝජනාව' : 'Your Proposal / Message'}
                    </label>
                    <textarea
                      rows={4}
                      maxLength={1200}
                      value={collabMessage}
                      onChange={(e) => setCollabMessage(e.target.value)}
                      placeholder={
                        lang === Language.SI
                          ? 'ඔබ කැමති වූ කතාව හෝ එක්ව නිර්මාණය කිරීමට අදහස් කරන චිත්‍රපට ව්‍යාපෘතිය ගැන කෙටියෙන් සඳහන් කරන්න...'
                          : 'Share what resonated with you about their story or how you would like to collaborate...'
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      {lang === Language.SI
                        ? 'ඔබව සම්බන්ධ කරගත හැකි Email හෝ WhatsApp (කැමති නම් පමණක්)'
                        : 'Your Direct Email or WhatsApp (Optional — Shared Privately)'}
                    </label>
                    <input
                      type="text"
                      maxLength={160}
                      value={collabContact}
                      onChange={(e) => setCollabContact(e.target.value)}
                      placeholder="name@email.com / +94 7X XXX XXXX"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                    />
                  </div>

                  {collabError && <p className="text-xs text-rose-400">{collabError}</p>}

                  <button
                    type="submit"
                    disabled={sendingCollab}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white font-semibold text-xs inline-flex items-center gap-2 hover:shadow-lg hover:shadow-cyan-500/25 transition-all min-h-[42px] cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {sendingCollab
                        ? lang === Language.SI
                          ? 'යොමු කරමින් පවතී...'
                          : 'Sending...'
                        : lang === Language.SI
                          ? 'සම්බන්ධතා පණිවිඩය යවන්න'
                          : 'Send Collaboration Request'}
                    </span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
