import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  Check,
  Film,
  Handshake,
  Heart,
  Lock,
  MapPin,
  MessageSquare,
  PenLine,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_CATEGORY_LABELS,
  CREATIVE_ROLES,
  CREATIVE_ROLE_LABELS,
  FEEDBACK_LENSES,
} from '../data/content';
import {
  OperationType,
  addCommunityComment,
  createCommunityPost,
  db,
  deleteCommunityPost,
  handleFirestoreError,
  isAdminUser,
  mapDocToComment,
  polishPublicScriptDetails,
  toggleFollowCreator,
  toggleLikeCommunityPost,
} from '../firebase';
import {
  CommunityPostCategory,
  CommunityPostRecord,
  CreativeRole,
  CreatorFollowRecord,
  CreatorProfileRecord,
  Language,
  PipelineProject,
  PostCommentRecord,
  ProjectStatus,
  UserProfileRecord,
} from '../types';

type HubWorkspaceTab = 'all' | 'polish' | 'crew' | 'directory';

interface CommunityHubSectionProps {
  lang: Language;
  currentUser: User | null;
  userProfile: UserProfileRecord | null;
  creatorProfiles: CreatorProfileRecord[];
  communityPosts: CommunityPostRecord[];
  publicScripts: PipelineProject[];
  myOutgoingFollows: CreatorFollowRecord[];
  pendingInquiriesCount: number;
  preselectedScriptId?: string | null;
  onClearPreselectedScript?: () => void;
  onBackToStudio: () => void;
  onOpenMyProfile: () => void;
  onInspectCreator: (
    uid: string,
    fallbackName?: string,
    connectScript?: { id: string; title: string } | null
  ) => void;
  onSelectProject: (project: PipelineProject) => void;
  onRequireSignIn: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatRelativeTime(iso: string, lang: Language): string {
  const diffMs = Math.max(0, Date.now() - Date.parse(iso));
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return lang === Language.SI ? 'දැන්' : 'Just now';
  if (mins < 60) return lang === Language.SI ? `මිනිත්තු ${mins}කට පෙර` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === Language.SI ? `පැය ${hrs}කට පෙර` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === Language.SI ? `දින ${days}කට පෙර` : `${days}d ago`;
}

interface PostCardProps {
  post: CommunityPostRecord;
  lang: Language;
  currentUser: User | null;
  myDisplayName: string;
  myCreativeRole: CreativeRole;
  userIsAdmin: boolean;
  isFollowingAuthor: boolean;
  hasAuthorProfile: boolean;
  linkedProject: PipelineProject | undefined;
  onInspectCreator: (
    uid: string,
    fallbackName?: string,
    connectScript?: { id: string; title: string } | null
  ) => void;
  onSelectProject: (project: PipelineProject) => void;
  onOpenInlinePolish: (project: PipelineProject) => void;
  onToggleFollow: (targetUid: string, targetName: string, currentlyFollowing: boolean) => void;
  onRequireSignIn: () => void;
}

const CommunityPostCard: React.FC<PostCardProps> = ({
  post,
  lang,
  currentUser,
  myDisplayName,
  myCreativeRole,
  userIsAdmin,
  isFollowingAuthor,
  hasAuthorProfile,
  linkedProject,
  onInspectCreator,
  onSelectProject,
  onOpenInlinePolish,
  onToggleFollow,
  onRequireSignIn,
}) => {
  const [likedByMe, setLikedByMe] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(
    post.category === 'Script Discussion'
  );
  const [comments, setComments] = useState<PostCommentRecord[]>([]);
  const [selectedLensId, setSelectedLensId] = useState<string>('');
  const [commentInput, setCommentInput] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);

  // Check if current signed-in user liked this post
  useEffect(() => {
    if (!currentUser?.emailVerified) {
      setLikedByMe(false);
      return;
    }
    const path = `communityPosts/${post.postId}/likes`;
    const q = query(collection(db, path), where('uid', '==', currentUser.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLikedByMe(!snap.empty);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    return () => unsub();
  }, [currentUser, post.postId]);

  // Subscribe to comments when thread is expanded
  useEffect(() => {
    if (!commentsOpen) return;
    const path = `communityPosts/${post.postId}/comments`;
    const q = query(collection(db, path), where('isPublished', '==', true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => mapDocToComment(d.data()))
          .sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso));
        setComments(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    return () => unsub();
  }, [commentsOpen, post.postId]);

  const handleLikeClick = async () => {
    if (!currentUser) {
      onRequireSignIn();
      return;
    }
    setLikeBusy(true);
    try {
      await toggleLikeCommunityPost(currentUser, post.postId, likedByMe);
    } finally {
      setLikeBusy(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireSignIn();
      return;
    }
    if (!commentInput.trim()) return;

    const lens = FEEDBACK_LENSES.find((l) => l.id === selectedLensId);
    const lensPrefix = lens
      ? `[${lang === Language.SI ? lens.tagSi : lens.tagEn}] `
      : '';
    const finalBody = `${lensPrefix}${commentInput.trim()}`.slice(0, 800);

    setCommentBusy(true);
    try {
      await addCommunityComment(
        currentUser,
        post.postId,
        myDisplayName,
        myCreativeRole,
        finalBody
      );
      setCommentInput('');
      setSelectedLensId('');
    } finally {
      setCommentBusy(false);
    }
  };

  const isOwnPost = Boolean(currentUser && currentUser.uid === post.authorUid);
  const canDelete = isOwnPost || userIsAdmin;
  const canPolishAttached =
    isOwnPost &&
    linkedProject &&
    linkedProject.status === ProjectStatus.UNDER_REVIEW;

  return (
    <article className="glass-card rounded-2xl p-6 space-y-4">
      {/* Author Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onInspectCreator(post.authorUid, post.authorName)}
            className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#06b6d4]/80 to-[#4f46e5]/80 flex items-center justify-center text-white font-bold text-sm shrink-0 cursor-pointer"
          >
            {getInitials(post.authorName)}
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onInspectCreator(post.authorUid, post.authorName)}
                className="text-sm font-bold text-white hover:text-[#38bdf8] transition-colors truncate cursor-pointer"
              >
                {post.authorName}
              </button>

              {hasAuthorProfile && !isOwnPost && (
                <button
                  type="button"
                  onClick={() =>
                    onToggleFollow(
                      post.authorUid,
                      post.authorName,
                      isFollowingAuthor
                    )
                  }
                  className={`text-xs font-semibold transition-colors cursor-pointer ${
                    isFollowingAuthor
                      ? 'text-emerald-400'
                      : 'text-[#38bdf8] hover:underline'
                  }`}
                >
                  {isFollowingAuthor ? '· Following' : '· + Follow'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 mt-0.5">
              <span>{CREATIVE_ROLE_LABELS[post.authorRole][lang]}</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#38bdf8] font-medium">
                {COMMUNITY_CATEGORY_LABELS[post.category][lang]}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatRelativeTime(post.createdAtIso, lang)}</span>
            </div>
          </div>
        </div>

        {canDelete && (
          <button
            type="button"
            onClick={() => void deleteCommunityPost(post.postId)}
            aria-label="Delete post"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Post Content */}
      <div>
        <h3 className="text-lg font-bold text-white mb-2">{post.title}</h3>
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {post.body}
        </p>
      </div>

      {/* Attached Public Screenplay Summary Card (Zero NDA File Exposure) */}
      {post.linkedScriptId && post.linkedScriptTitle && (
        <div className="p-4 rounded-xl bg-slate-950/85 border border-white/10 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Film className="w-4 h-4 text-[#38bdf8] shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400">
                  {lang === Language.SI
                    ? 'සාකච්ඡාවට අමුණා ඇති කතා සාරාංශය (NDA ආරක්ෂිතයි)'
                    : 'Attached Story Concept (Full Script Protected Under NDA)'}
                </p>
                <p className="text-xs sm:text-sm font-bold text-white truncate">
                  {linkedProject?.title || post.linkedScriptTitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {canPolishAttached && linkedProject && (
                <button
                  type="button"
                  onClick={() => onOpenInlinePolish(linkedProject)}
                  className="px-3 py-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  <span>
                    {lang === Language.SI
                      ? 'ලැබුණු අදහස් අනුව Polish කරන්න'
                      : 'Polish Story Now'}
                  </span>
                </button>
              )}

              {linkedProject && (
                <button
                  type="button"
                  onClick={() => onSelectProject(linkedProject)}
                  className="px-3 py-1.5 rounded-lg bg-[#38bdf8]/15 hover:bg-[#38bdf8]/25 text-[#38bdf8] text-xs font-semibold whitespace-nowrap cursor-pointer"
                >
                  {lang === Language.SI ? 'සාරාංශය බලන්න →' : 'Read Logline →'}
                </button>
              )}
            </div>
          </div>

          {linkedProject && (
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 pt-1 border-t border-white/[0.06]">
              “{linkedProject.logline[lang]}”
            </p>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={likeBusy}
            onClick={handleLikeClick}
            className={`inline-flex items-center gap-1.5 font-semibold transition-colors cursor-pointer py-1 ${
              likedByMe ? 'text-rose-400' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Heart
              className={`w-4 h-4 ${likedByMe ? 'fill-rose-400 text-rose-400' : ''}`}
            />
            <span className="font-mono tabular-nums">{post.likesCount}</span>
            <span>{lang === Language.SI ? 'අගයන්න' : 'Applaud'}</span>
          </button>

          <button
            type="button"
            onClick={() => setCommentsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer py-1"
          >
            <MessageSquare className="w-4 h-4 text-[#38bdf8]" />
            <span className="font-mono tabular-nums">{post.commentsCount}</span>
            <span>
              {lang === Language.SI
                ? 'කතාවට අදහස් දෙන්න'
                : 'Critique & Notes'}
            </span>
          </button>
        </div>

        {!isOwnPost && (
          <button
            type="button"
            onClick={() =>
              onInspectCreator(
                post.authorUid,
                post.authorName,
                post.linkedScriptId
                  ? { id: post.linkedScriptId, title: post.linkedScriptTitle }
                  : null
              )
            }
            className="inline-flex items-center gap-1.5 text-[#38bdf8] hover:text-cyan-300 font-semibold cursor-pointer py-1"
          >
            <Handshake className="w-3.5 h-3.5" />
            <span>
              {lang === Language.SI
                ? 'නිර්මාණයට සම්බන්ධ වන්න'
                : 'Connect / Join Crew'}
            </span>
          </button>
        )}
      </div>

      {/* Expandable Structured Critique & Comments Thread */}
      {commentsOpen && (
        <div className="pt-3 border-t border-slate-800/70 space-y-3">
          {comments.length === 0 ? (
            <p className="text-xs text-slate-400">
              {lang === Language.SI
                ? 'මෙම කතාව තවත් දියුණු කරගැනීමට ඔබේ පළමු නිර්මාණාත්මක අදහස එක් කරන්න.'
                : 'Share the first constructive note to help polish this story.'}
            </p>
          ) : (
            <div className="space-y-2.5">
              {comments.map((cmt) => (
                <div
                  key={cmt.commentId}
                  className="p-3 rounded-xl bg-slate-950/70 border border-white/[0.06] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onInspectCreator(cmt.authorUid, cmt.authorName)
                      }
                      className="font-bold text-white hover:text-[#38bdf8] cursor-pointer text-left"
                    >
                      {cmt.authorName}{' '}
                      <span className="font-normal text-slate-400">
                        · {CREATIVE_ROLE_LABELS[cmt.authorRole][lang]}
                      </span>
                    </button>
                    <span className="text-slate-500 shrink-0">
                      {formatRelativeTime(cmt.createdAtIso, lang)}
                    </span>
                  </div>
                  <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {cmt.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Structured Feedback Lens Selector */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 mr-1">
                {lang === Language.SI ? 'විචාර අංශය:' : 'Feedback focus:'}
              </span>
              {FEEDBACK_LENSES.map((lens) => {
                const active = selectedLensId === lens.id;
                return (
                  <button
                    key={lens.id}
                    type="button"
                    onClick={() =>
                      setSelectedLensId(active ? '' : lens.id)
                    }
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#06b6d4] text-slate-950 font-semibold'
                        : 'bg-white/[0.05] text-slate-300 hover:text-white'
                    }`}
                  >
                    {lang === Language.SI ? lens.tagSi : lens.tagEn}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
              <input
                type="text"
                maxLength={740}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={
                  currentUser
                    ? lang === Language.SI
                      ? 'කතාව තවත් ඔපමට්ටම් කරගැනීමට ඔබේ අදහස ලියන්න...'
                      : 'Write your story feedback or collaboration note...'
                    : lang === Language.SI
                      ? 'අදහස් දැක්වීමට Login වන්න...'
                      : 'Sign in to share feedback...'
                }
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#060911] border border-white/10 text-xs text-white focus:border-[#38bdf8] focus:outline-none"
              />
              <button
                type="submit"
                disabled={commentBusy}
                className="px-4 py-2.5 rounded-xl bg-[#06b6d4] hover:bg-[#38bdf8] text-slate-950 font-semibold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{lang === Language.SI ? 'එක් කරන්න' : 'Post Note'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </article>
  );
};

export const CommunityHubSection: React.FC<CommunityHubSectionProps> = ({
  lang,
  currentUser,
  userProfile,
  creatorProfiles,
  communityPosts,
  publicScripts,
  myOutgoingFollows,
  pendingInquiriesCount,
  preselectedScriptId,
  onClearPreselectedScript,
  onBackToStudio,
  onOpenMyProfile,
  onInspectCreator,
  onSelectProject,
  onRequireSignIn,
}) => {
  const [workspaceTab, setWorkspaceTab] = useState<HubWorkspaceTab>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | CreativeRole>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer State
  const [composeCategory, setComposeCategory] =
    useState<CommunityPostCategory>('Script Discussion');
  const [composeTitle, setComposeTitle] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeScriptId, setComposeScriptId] = useState('');
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeError, setComposeError] = useState('');

  // Inline Story Polish Drawer State inside Community Hub
  const [polishingScript, setPolishingScript] =
    useState<PipelineProject | null>(null);
  const [polishTitle, setPolishTitle] = useState('');
  const [polishLogline, setPolishLogline] = useState('');
  const [polishSynopsis, setPolishSynopsis] = useState('');
  const [polishBusy, setPolishBusy] = useState(false);
  const [polishError, setPolishError] = useState('');
  const [polishSuccessBanner, setPolishSuccessBanner] = useState(false);

  const userIsAdmin = isAdminUser(currentUser);

  const myCreatorProfile = useMemo(() => {
    if (!currentUser) return null;
    return creatorProfiles.find((p) => p.uid === currentUser.uid) || null;
  }, [creatorProfiles, currentUser]);

  const myDisplayName =
    myCreatorProfile?.displayName ||
    userProfile?.displayName ||
    currentUser?.displayName ||
    'Member';

  const myCreativeRole: CreativeRole =
    myCreatorProfile?.creativeRole ||
    (userProfile?.creatorType as CreativeRole) ||
    'Screenwriter';

  const myUploadedScripts = useMemo(() => {
    if (!currentUser) return [];
    return publicScripts.filter((s) => s.authorUid === currentUser.uid);
  }, [publicScripts, currentUser]);

  const myPolishableScripts = useMemo(() => {
    return myUploadedScripts.filter(
      (s) => s.status === ProjectStatus.UNDER_REVIEW
    );
  }, [myUploadedScripts]);

  const followingSet = useMemo(
    () => new Set(myOutgoingFollows.map((f) => f.followingUid)),
    [myOutgoingFollows]
  );

  const profileUidSet = useMemo(
    () => new Set(creatorProfiles.map((p) => p.uid)),
    [creatorProfiles]
  );

  const scriptMap = useMemo(() => {
    const map = new Map<string, PipelineProject>();
    publicScripts.forEach((s) => map.set(s.id, s));
    return map;
  }, [publicScripts]);

  const scriptCountByAuthor = useMemo(() => {
    const counts = new Map<string, number>();
    publicScripts.forEach((s) => {
      if (s.authorUid) {
        counts.set(s.authorUid, (counts.get(s.authorUid) || 0) + 1);
      }
    });
    return counts;
  }, [publicScripts]);

  const filteredPosts = useMemo(() => {
    const sorted = [...communityPosts].sort((a, b) =>
      b.createdAtIso.localeCompare(a.createdAtIso)
    );
    if (workspaceTab === 'polish') {
      return sorted.filter((p) => p.category === 'Script Discussion');
    }
    if (workspaceTab === 'crew') {
      return sorted.filter((p) => p.category === 'Collaboration Call');
    }
    return sorted;
  }, [communityPosts, workspaceTab]);

  const filteredCreators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...creatorProfiles]
      .filter((p) => {
        if (roleFilter !== 'all' && p.creativeRole !== roleFilter) return false;
        if (!q) return true;
        return (
          p.displayName.toLowerCase().includes(q) ||
          p.headline.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.bio.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.followersCount - a.followersCount);
  }, [creatorProfiles, roleFilter, searchQuery]);

  const openToCollabCreators = useMemo(() => {
    return [...creatorProfiles]
      .filter((p) => p.openToCollab && (!currentUser || p.uid !== currentUser.uid))
      .sort((a, b) => b.followersCount - a.followersCount)
      .slice(0, 5);
  }, [creatorProfiles, currentUser]);

  // Pre-populate Story Polish composer if user navigated here from a specific script in their Profile
  useEffect(() => {
    if (!preselectedScriptId) return;
    const matched = scriptMap.get(preselectedScriptId);
    if (matched) {
      setWorkspaceTab('polish');
      setComposeCategory('Script Discussion');
      setComposeScriptId(matched.id);
      setComposeTitle(
        lang === Language.SI
          ? `"${matched.title}" කතාව තවත් ඔපමට්ටම් කරගැනීමට ඔබේ අදහස් දෙන්න`
          : `Seeking Story Polish & OTT Notes on "${matched.title}"`
      );
      setComposeBody(
        lang === Language.SI
          ? `මගේ "${matched.title}" (${matched.genre} · ${matched.format}) කතාවේ මූලික Logline එක:\n“${matched.logline.si}”\n\nමෙහි කතා ආකෘතිය (Plot), ප්‍රධාන චරිත සහ ජාත්‍යන්තර OTT ප්‍රේක්ෂකයින්ට ගැළපෙන සේ තවත් දියුණු කළ හැකි තැන් ගැන ඔබේ අදහස් බෙදාගන්න.`
          : `Logline for "${matched.title}" (${matched.genre} · ${matched.format}):\n“${matched.logline.en}”\n\nI would love constructive feedback on plot structure, character stakes, and international streaming appeal.`
      );
    }
    if (onClearPreselectedScript) {
      onClearPreselectedScript();
    }
  }, [preselectedScriptId, scriptMap, lang, onClearPreselectedScript]);

  const handleOpenInlinePolish = (project: PipelineProject) => {
    setPolishingScript(project);
    setPolishTitle(project.title);
    setPolishLogline(project.logline[lang]);
    setPolishSynopsis(project.synopsis[lang]);
    setPolishError('');
    setPolishSuccessBanner(false);
  };

  const handleSaveInlinePolish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!polishingScript) return;
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

    setPolishBusy(true);
    setPolishError('');
    try {
      await polishPublicScriptDetails({
        scriptId: polishingScript.id,
        title: polishTitle,
        logline: polishLogline,
        synopsis: polishSynopsis,
      });
      setPolishingScript(null);
      setPolishSuccessBanner(true);
      window.setTimeout(() => setPolishSuccessBanner(false), 3200);
    } catch {
      setPolishError(
        lang === Language.SI
          ? 'කතා සාරාංශය යාවත්කාලීන කිරීමට නොහැකි විය.'
          : 'Could not save story polish changes.'
      );
    } finally {
      setPolishBusy(false);
    }
  };

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireSignIn();
      return;
    }
    if (composeTitle.trim().length < 3) {
      setComposeError(
        lang === Language.SI
          ? 'කරුණාකර අවම වශයෙන් අකුරු 3ක මාතෘකාවක් යොදන්න.'
          : 'Please enter a post headline of at least 3 characters.'
      );
      return;
    }
    if (composeBody.trim().length < 10) {
      setComposeError(
        lang === Language.SI
          ? 'කරුණාකර අවම වශයෙන් අකුරු 10ක විස්තරයක් ඇතුළත් කරන්න.'
          : 'Please enter at least 10 characters for your post.'
      );
      return;
    }

    const attached = myUploadedScripts.find((s) => s.id === composeScriptId);
    setComposeBusy(true);
    setComposeError('');
    try {
      await createCommunityPost({
        user: currentUser,
        authorName: myDisplayName,
        authorRole: myCreativeRole,
        category: composeCategory,
        title: composeTitle,
        body: composeBody,
        linkedScriptId: attached ? attached.id : '',
        linkedScriptTitle: attached ? attached.title : '',
      });
      setComposeTitle('');
      setComposeBody('');
      setComposeScriptId('');
    } catch {
      setComposeError(
        lang === Language.SI
          ? 'සටහන පළ කිරීමට නොහැකි විය. නැවත උත්සාහ කරන්න.'
          : 'Could not publish post. Please try again.'
      );
    } finally {
      setComposeBusy(false);
    }
  };

  const handleToggleFollow = async (
    targetUid: string,
    targetName: string,
    currentlyFollowing: boolean
  ) => {
    if (!currentUser) {
      onRequireSignIn();
      return;
    }
    await toggleFollowCreator(
      currentUser,
      myDisplayName,
      targetUid,
      targetName,
      currentlyFollowing
    );
  };

  const handleSelectScriptForComposer = (scriptId: string) => {
    setComposeScriptId(scriptId);
    const chosen = myUploadedScripts.find((s) => s.id === scriptId);
    if (chosen && !composeTitle.trim() && composeCategory === 'Script Discussion') {
      setComposeTitle(
        lang === Language.SI
          ? `"${chosen.title}" කතා සංකල්පය තවත් දියුණු කරගැනීමට අදහස් විමසීම`
          : `Story Polish & Critique Request: "${chosen.title}"`
      );
    }
  };

  return (
    <div className="py-8 md:py-12 px-4 md:px-8 max-w-7xl mx-auto">
      {/* Dedicated Full-Page Hub Header */}
      <div className="pb-8 mb-8 border-b border-slate-800/80 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <button
            type="button"
            onClick={onBackToStudio}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-[#38bdf8] transition-colors mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>
              {lang === Language.SI
                ? 'Studio ප්‍රධාන පිටුවට ආපසු යන්න'
                : 'Back to Studio Home'}
            </span>
          </button>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            {lang === Language.SI
              ? 'Filmmaker Community & Story Polish Hub'
              : 'Filmmaker Community & Story Polish Hub'}
          </h1>
          <p className="text-sm sm:text-base text-slate-400 mt-2 max-w-3xl leading-relaxed">
            {lang === Language.SI
              ? 'ඔබේ සම්පූර්ණ තිරපිටපත NDA ආරක්ෂාව යටතේ රහසිගතව තබාගෙනම, කතාවේ මූලික අදහස (Logline / Concept) ගැන ප්‍රජාවගේ විචාර ලබාගෙන හොඳම කතාව තවත් ඔපමට්ටම් කරගන්න. අධ්‍යක්ෂවරුන්, නිෂ්පාදකවරුන් සහ ශිල්පීන් එකම තැනකින් සම්බන්ධ කරගන්න.'
              : 'Keep your full screenplay locked safely in our NDA Vault while workshopping your Logline and story concepts with fellow writers, directors, and producers—and assemble your creative team in one place.'}
          </p>
        </div>

        {/* NDA Protection Notice */}
        <div className="glass-panel rounded-2xl px-4 py-3.5 border border-white/10 max-w-sm shrink-0">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-[#38bdf8] shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === Language.SI
                ? 'NDA ආරක්ෂාව: සම්පූර්ණ තිරපිටපත් ගොනු පෙනෙන්නේ Admin මණ්ඩලයට පමණි. මෙහි සංවාදයට ලක්වන්නේ ඔබ බෙදාගන්නා කෙටි සාරාංශ පමණි.'
                : 'NDA Protected: Full screenplay files are strictly restricted to the Admin Vault. Only public Loglines and concepts you share appear here.'}
            </p>
          </div>
        </div>
      </div>

      {/* 3-Column LinkedIn / Story Workshop Hub Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ==================== LEFT COLUMN: CREATOR CARD & HUB NAVIGATION ==================== */}
        <aside className="lg:col-span-3 space-y-6">
          {/* Creator Profile Card */}
          <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-4">
            {currentUser ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#06b6d4] to-[#4f46e5] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {getInitials(myDisplayName)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-white truncate">
                      {myDisplayName}
                    </h2>
                    <p className="text-xs text-[#38bdf8] truncate">
                      {CREATIVE_ROLE_LABELS[myCreativeRole][lang]}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="font-mono tabular-nums font-bold text-white text-sm">
                      {myCreatorProfile?.followersCount ?? 0}
                    </p>
                    <p className="text-slate-400 text-[11px]">Followers</p>
                  </div>
                  <div>
                    <p className="font-mono tabular-nums font-bold text-white text-sm">
                      {myCreatorProfile?.followingCount ?? 0}
                    </p>
                    <p className="text-slate-400 text-[11px]">Following</p>
                  </div>
                  <div>
                    <p className="font-mono tabular-nums font-bold text-white text-sm">
                      {myUploadedScripts.length}
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      {lang === Language.SI ? 'කතා' : 'Scripts'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={onOpenMyProfile}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>
                      {lang === Language.SI
                        ? 'මගේ Profile හා පරීක්ෂණ මට්ටම'
                        : 'My Profile & Review Status'}
                    </span>
                    {pendingInquiriesCount > 0 && (
                      <span className="font-mono tabular-nums bg-[#06b6d4] text-slate-950 px-1.5 py-0.5 rounded font-bold">
                        {pendingInquiriesCount}
                      </span>
                    )}
                  </button>

                  {myPolishableScripts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenInlinePolish(myPolishableScripts[0])}
                      className="w-full py-2.5 px-3.5 rounded-xl border border-[#38bdf8]/40 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-xs font-semibold text-[#38bdf8] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <PenLine className="w-3.5 h-3.5" />
                      <span>
                        {lang === Language.SI
                          ? 'මගේ කතා සාරාංශය Polish කරන්න'
                          : 'Polish My Story Summary'}
                      </span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-white">
                  {lang === Language.SI
                    ? 'ඔබේ නිර්මාණකරු Profile එක අරඹන්න'
                    : 'Create Your Filmmaker Profile'}
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {lang === Language.SI
                    ? 'ලියාපදිංචි වී කතා ගැන අදහස් දක්වන්න, නිර්මාණකරුවන්ව Follow කරන්න සහ චිත්‍රපට කණ්ඩායම් හා එක්වන්න.'
                    : 'Sign in to workshop story concepts, follow creators, and send private collaboration requests.'}
                </p>
                <button
                  type="button"
                  onClick={onRequireSignIn}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white text-xs font-semibold cursor-pointer"
                >
                  {lang === Language.SI
                    ? 'ලියාපදිංචි වන්න / Login'
                    : 'Register / Sign In'}
                </button>
              </div>
            )}
          </div>

          {/* Hub Workspace Switcher */}
          <div className="glass-panel rounded-2xl p-3 border border-white/10 space-y-1">
            <p className="px-3 py-1.5 text-[11px] font-semibold text-slate-400">
              {lang === Language.SI ? 'ප්‍රජා අංශ (Hub Spaces)' : 'Hub Workspaces'}
            </p>
            {[
              {
                id: 'all' as const,
                labelSi: 'සියලුම සංවාද (All Feed)',
                labelEn: 'All Community Feed',
                count: communityPosts.length,
              },
              {
                id: 'polish' as const,
                labelSi: 'කතා ඔපමට්ටම් කිරීම (Story Polish)',
                labelEn: 'Story Polish & Critique Lab',
                count: communityPosts.filter(
                  (p) => p.category === 'Script Discussion'
                ).length,
              },
              {
                id: 'crew' as const,
                labelSi: 'කණ්ඩායම් ඇරයුම් (Crew Calls)',
                labelEn: 'Crew & Co-Production Calls',
                count: communityPosts.filter(
                  (p) => p.category === 'Collaboration Call'
                ).length,
              },
              {
                id: 'directory' as const,
                labelSi: 'නිර්මාණකරුවන්ගේ නාමාවලිය',
                labelEn: 'Filmmaker Directory',
                count: creatorProfiles.length,
              },
            ].map((item) => {
              const active = workspaceTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setWorkspaceTab(item.id)}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#06b6d4] text-slate-950'
                      : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <span className="truncate">
                    {lang === Language.SI ? item.labelSi : item.labelEn}
                  </span>
                  <span
                    className={`font-mono tabular-nums text-[11px] shrink-0 ${
                      active ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ==================== CENTER COLUMN: STORY POLISH LAB / FEED / DIRECTORY ==================== */}
        <div className="lg:col-span-6 space-y-6">
          {polishSuccessBanner && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 flex items-center gap-2.5 text-xs text-emerald-300 font-medium">
              <Check className="w-4 h-4 shrink-0" />
              <span>
                {lang === Language.SI
                  ? 'ඔබේ කතාවේ නම, Logline සහ Synopsis සාර්ථකව Polish කර යාවත්කාලීන කරන ලදී!'
                  : 'Your public story Title, Logline & Synopsis were polished and saved!'}
              </span>
            </div>
          )}

          {/* Inline Story Polish Drawer (for writers refining their uploaded Under Review story) */}
          {polishingScript && (
            <form
              onSubmit={handleSaveInlinePolish}
              className="glass-panel rounded-2xl p-6 border border-[#38bdf8]/40 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#38bdf8]" />
                    <span>
                      {lang === Language.SI
                        ? 'කතාව තවත් ඔපමට්ටම් කරන්න (Polish Public Story)'
                        : 'Polish Your Public Story Concept'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === Language.SI
                      ? 'ප්‍රජාවෙන් ලැබුණු හොඳ අදහස් අනුව ඔබේ කතාවේ නම, Logline සහ Synopsis මෙතැනින් යාවත්කාලීන කරන්න.'
                      : 'Update your public Title, Logline, and Synopsis using insights from the community.'}
                  </p>
                </div>

                {myPolishableScripts.length > 1 && (
                  <select
                    value={polishingScript.id}
                    onChange={(e) => {
                      const next = myPolishableScripts.find(
                        (s) => s.id === e.target.value
                      );
                      if (next) handleOpenInlinePolish(next);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#060911] border border-white/10 text-xs text-white focus:border-[#38bdf8] focus:outline-none"
                  >
                    {myPolishableScripts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lang === Language.SI ? 'කතාවේ නම (Title)' : 'Story Title'}
                </label>
                <input
                  type="text"
                  maxLength={140}
                  value={polishTitle}
                  onChange={(e) => setPolishTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lang === Language.SI
                    ? 'ඔපමට්ටම් කළ කෙටි සාරාංශය (Polished Logline)'
                    : 'Polished Logline'}
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={polishLogline}
                  onChange={(e) => setPolishLogline(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lang === Language.SI
                    ? 'විස්තරාත්මක කතා සැලැස්ම (Polished Synopsis)'
                    : 'Polished Synopsis'}
                </label>
                <textarea
                  rows={3}
                  maxLength={1500}
                  value={polishSynopsis}
                  onChange={(e) => setPolishSynopsis(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              {polishError && (
                <p className="text-xs text-rose-400">{polishError}</p>
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="submit"
                  disabled={polishBusy}
                  className="px-5 py-2.5 rounded-xl bg-[#06b6d4] hover:bg-[#38bdf8] text-slate-950 font-semibold text-xs cursor-pointer"
                >
                  {polishBusy
                    ? lang === Language.SI
                      ? 'සුරකිමින්...'
                      : 'Saving...'
                    : lang === Language.SI
                      ? 'Polish කළ කතාව සුරකින්න'
                      : 'Save Polished Story'}
                </button>
                <button
                  type="button"
                  onClick={() => setPolishingScript(null)}
                  className="px-4 py-2.5 rounded-xl border border-white/15 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  {lang === Language.SI ? 'වසන්න' : 'Close'}
                </button>
              </div>
            </form>
          )}

          {workspaceTab === 'directory' ? (
            /* FILMMAKER DIRECTORY VIEW */
            <div className="space-y-5">
              <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      lang === Language.SI
                        ? 'නම, භූමිකාව හෝ නගරය අනුව සිනමාකරුවන් සොයන්න...'
                        : 'Search writers, directors, producers, DOPs, actors...'
                    }
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRoleFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      roleFilter === 'all'
                        ? 'bg-[#06b6d4] text-slate-950'
                        : 'bg-white/[0.04] text-slate-300 hover:text-white'
                    }`}
                  >
                    {lang === Language.SI ? 'සියලුම ශිල්පීන්' : 'All Roles'}
                  </button>
                  {CREATIVE_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRoleFilter(role)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        roleFilter === role
                          ? 'bg-[#06b6d4] text-slate-950'
                          : 'bg-white/[0.04] text-slate-300 hover:text-white'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {filteredCreators.length === 0 ? (
                <div className="glass-panel rounded-2xl p-10 text-center text-sm text-slate-400">
                  {lang === Language.SI
                    ? 'ගැළපෙන සිනමා නිර්මාණකරුවන් හමු නොවීය.'
                    : 'No matching filmmakers found yet.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredCreators.map((creator) => {
                    const isMe = Boolean(
                      currentUser && currentUser.uid === creator.uid
                    );
                    const isFollowing = followingSet.has(creator.uid);
                    const scriptsCount = scriptCountByAuthor.get(creator.uid) || 0;

                    return (
                      <div
                        key={creator.uid}
                        className="glass-card rounded-2xl p-5 flex flex-col justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                onInspectCreator(creator.uid, creator.displayName)
                              }
                              className="flex items-center gap-3 text-left min-w-0 cursor-pointer"
                            >
                              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#06b6d4] to-[#4f46e5] flex items-center justify-center text-white font-bold text-xs shrink-0">
                                {getInitials(creator.displayName)}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-sm font-bold text-white hover:text-[#38bdf8] truncate">
                                  {creator.displayName}
                                </h3>
                                <p className="text-xs text-[#38bdf8] truncate">
                                  {CREATIVE_ROLE_LABELS[creator.creativeRole][lang]}
                                </p>
                              </div>
                            </button>
                          </div>

                          {creator.headline && (
                            <p className="text-xs text-slate-300 mt-3 line-clamp-2">
                              {creator.headline}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-3">
                            {creator.location && (
                              <>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span>{creator.location}</span>
                                </span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            <span className="font-mono tabular-nums">
                              {creator.followersCount} Followers
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {scriptsCount}{' '}
                              {lang === Language.SI ? 'පිටපත්' : 'Scripts'}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onInspectCreator(creator.uid, creator.displayName)
                            }
                            className="text-xs font-semibold text-slate-200 hover:text-[#38bdf8] cursor-pointer"
                          >
                            {lang === Language.SI ? 'Profile බලන්න →' : 'View Profile →'}
                          </button>

                          {!isMe && (
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleFollow(
                                  creator.uid,
                                  creator.displayName,
                                  isFollowing
                                )
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                                isFollowing
                                  ? 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                                  : 'bg-[#38bdf8]/15 text-[#38bdf8] hover:bg-[#38bdf8]/25'
                              }`}
                            >
                              {isFollowing ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Following</span>
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>Follow</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* STORY POLISH & COMMUNITY FEED VIEW */
            <>
              {/* Post & Story Polish Composer */}
              <form
                onSubmit={handlePublishPost}
                className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-white">
                    {lang === Language.SI
                      ? 'කතා අදහසක් Polish කරගැනීමට හෝ කණ්ඩායමක් සෙවීමට පළ කරන්න'
                      : 'Share a Story Concept for Polish or Post a Crew Call'}
                  </h2>

                  <div className="flex flex-wrap gap-1.5">
                    {COMMUNITY_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setComposeCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                          composeCategory === cat
                            ? 'bg-[#06b6d4] text-slate-950'
                            : 'bg-white/[0.05] text-slate-300 hover:text-white'
                        }`}
                      >
                        {COMMUNITY_CATEGORY_LABELS[cat][lang]}
                      </button>
                    ))}
                  </div>
                </div>

                {myUploadedScripts.length > 0 && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      {lang === Language.SI
                        ? 'ඔබ Upload කළ කතාවක සාරාංශය අමුණන්න (අත්‍යවශ්‍ය නොවේ — සම්පූර්ණ පිටපත හෙළි නොවේ)'
                        : 'Attach One of Your Uploaded Story Loglines (Optional — NDA File Stays Private)'}
                    </label>
                    <select
                      value={composeScriptId}
                      onChange={(e) => handleSelectScriptForComposer(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#060911] border border-white/10 text-xs sm:text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                    >
                      <option value="">
                        {lang === Language.SI
                          ? 'තිරපිටපතක් අමුණන්නේ නැත (සාමාන්‍ය සංවාදයක්)'
                          : 'No attached screenplay'}
                      </option>
                      {myUploadedScripts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} ({s.genre} · {s.format})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <input
                  type="text"
                  maxLength={140}
                  value={composeTitle}
                  onChange={(e) => setComposeTitle(e.target.value)}
                  placeholder={
                    composeCategory === 'Script Discussion'
                      ? lang === Language.SI
                        ? 'මාතෘකාව: උදා - මගේ Sci-Fi කතාවේ අවසානය තවත් ප්‍රබල කරගන්නේ කෙසේද?'
                        : 'Headline: e.g. Seeking Plot & Character Notes on My Thriller Concept'
                      : lang === Language.SI
                        ? 'මාතෘකාව: උදා - කෙටි චිත්‍රපටයක් සඳහා කැමරා අධ්‍යක්ෂවරයෙකු (DOP) සොයයි'
                        : 'Headline: e.g. Looking for a Director / Cinematographer for Noir Pilot'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                />

                <textarea
                  rows={3}
                  maxLength={2000}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder={
                    composeCategory === 'Script Discussion'
                      ? lang === Language.SI
                        ? 'ඔබේ කතාවේ කෙටි අදහස (Logline) හෝ ගැටලුව මෙහි ලියන්න. අනෙකුත් රචකයන් හා අධ්‍යක්ෂවරුන් එය තවත් Polish කරගැනීමට අදහස් ලබා දෙනු ඇත...'
                        : 'Share your Logline, scene dilemma, or character arc question so fellow filmmakers can help polish it...'
                      : lang === Language.SI
                        ? 'ඔබේ ව්‍යාපෘතිය සහ ඔබ සම්බන්ධ කරගැනීමට කැමති නිර්මාණකරුවන් ගැන විස්තර කරන්න...'
                        : 'Describe your project and the collaborators or crew roles you want to connect with...'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#060911] border border-white/10 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                />

                {composeError && (
                  <p className="text-xs text-rose-400">{composeError}</p>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-[11px] text-slate-400">
                    {currentUser
                      ? `${myDisplayName} · ${CREATIVE_ROLE_LABELS[myCreativeRole][lang]}`
                      : lang === Language.SI
                        ? 'පළ කිරීමට Login වීම අවශ්‍යයි'
                        : 'Sign in required to publish'}
                  </span>

                  <button
                    type="submit"
                    disabled={composeBusy}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white font-semibold text-xs inline-flex items-center gap-2 hover:shadow-lg hover:shadow-cyan-500/25 transition-all whitespace-nowrap shrink-0 min-h-[40px] cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {composeBusy
                        ? lang === Language.SI
                          ? 'පළ කරමින්...'
                          : 'Publishing...'
                        : lang === Language.SI
                          ? 'ප්‍රජාවට එක් කරන්න'
                          : 'Publish to Hub'}
                    </span>
                  </button>
                </div>
              </form>

              {/* Feed Stream */}
              {filteredPosts.length === 0 ? (
                <div className="glass-panel rounded-2xl p-10 text-center space-y-2 border border-white/10">
                  <p className="text-base font-bold text-white">
                    {lang === Language.SI
                      ? 'මෙම අංශයේ තවම සංවාද ආරම්භ වී නොමැත'
                      : 'No discussions in this workspace yet'}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                    {lang === Language.SI
                      ? 'ඔබේ කතා සංකල්පයක් (Logline) හෝ නිර්මාණ ඇරයුමක් ඉහතින් පළ කර පළමු සංවාදය අරඹන්න.'
                      : 'Start the first Story Polish workshop or crew collaboration post above.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredPosts.map((post) => (
                    <CommunityPostCard
                      key={post.postId}
                      post={post}
                      lang={lang}
                      currentUser={currentUser}
                      myDisplayName={myDisplayName}
                      myCreativeRole={myCreativeRole}
                      userIsAdmin={userIsAdmin}
                      isFollowingAuthor={followingSet.has(post.authorUid)}
                      hasAuthorProfile={profileUidSet.has(post.authorUid)}
                      linkedProject={
                        post.linkedScriptId
                          ? scriptMap.get(post.linkedScriptId)
                          : undefined
                      }
                      onInspectCreator={onInspectCreator}
                      onSelectProject={onSelectProject}
                      onOpenInlinePolish={handleOpenInlinePolish}
                      onToggleFollow={handleToggleFollow}
                      onRequireSignIn={onRequireSignIn}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ==================== RIGHT COLUMN: MATCHMAKING & ACTIVE STORIES ==================== */}
        <aside className="lg:col-span-3 space-y-6">
          {/* Open to Collaborate Filmmakers */}
          <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#38bdf8]" />
                <span>
                  {lang === Language.SI
                    ? 'එක්වීමට සූදානම් ශිල්පීන්'
                    : 'Open to Collaborate'}
                </span>
              </h2>

              <button
                type="button"
                onClick={() => setWorkspaceTab('directory')}
                className="text-xs font-semibold text-[#38bdf8] hover:underline cursor-pointer"
              >
                {lang === Language.SI ? 'සියල්ල' : 'See All'}
              </button>
            </div>

            {openToCollabCreators.length === 0 ? (
              <p className="text-xs text-slate-400 leading-relaxed">
                {lang === Language.SI
                  ? 'නව නිර්මාණකරුවන් ලියාපදිංචි වූ සැණින් ඔවුන්ගේ Profile මෙහි දිස්වේ.'
                  : 'Registered filmmakers open to collaboration will appear here.'}
              </p>
            ) : (
              <div className="space-y-3.5">
                {openToCollabCreators.map((creator) => {
                  const isFollowing = followingSet.has(creator.uid);
                  return (
                    <div
                      key={creator.uid}
                      className="pb-3.5 border-b border-slate-800/70 last:border-b-0 last:pb-0 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onInspectCreator(creator.uid, creator.displayName)
                          }
                          className="text-left min-w-0 cursor-pointer"
                        >
                          <p className="text-xs font-bold text-white hover:text-[#38bdf8] truncate">
                            {creator.displayName}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {CREATIVE_ROLE_LABELS[creator.creativeRole][lang]}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFollow(
                              creator.uid,
                              creator.displayName,
                              isFollowing
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer ${
                            isFollowing
                              ? 'text-emerald-300 bg-emerald-500/10'
                              : 'text-[#38bdf8] bg-[#38bdf8]/12 hover:bg-[#38bdf8]/20'
                          }`}
                        >
                          {isFollowing ? 'Following' : '+ Follow'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Public Story Concepts Seeking Crew / Interest */}
          <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-[#38bdf8]" />
              <span>
                {lang === Language.SI
                  ? 'සංවර්ධනය වන කතා සාරාංශ'
                  : 'Active Story Concepts'}
              </span>
            </h2>

            {publicScripts.length === 0 ? (
              <p className="text-xs text-slate-400 leading-relaxed">
                {lang === Language.SI
                  ? 'තිරපිටපත් Upload වූ පසු ඒවායේ ප්‍රසිද්ධ Logline සාරාංශ මෙතැනින් කියවා රචකයන් හා සම්බන්ධ විය හැකිය.'
                  : 'Uploaded story Loglines appear here so producers and directors can connect with writers.'}
              </p>
            ) : (
              <div className="space-y-3.5">
                {publicScripts.slice(0, 4).map((proj) => (
                  <div
                    key={proj.id}
                    className="pb-3.5 border-b border-slate-800/70 last:border-b-0 last:pb-0 space-y-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProject(proj)}
                      className="text-left block w-full cursor-pointer group"
                    >
                      <p className="text-xs font-bold text-white group-hover:text-[#38bdf8] truncate">
                        {proj.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {proj.genre} · {proj.format}
                      </p>
                    </button>

                    {proj.authorUid &&
                      (!currentUser || currentUser.uid !== proj.authorUid) && (
                        <button
                          type="button"
                          onClick={() =>
                            onInspectCreator(proj.authorUid!, proj.writer, {
                              id: proj.id,
                              title: proj.title,
                            })
                          }
                          className="text-[11px] font-semibold text-[#38bdf8] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Handshake className="w-3 h-3" />
                          <span>
                            {lang === Language.SI
                              ? `${proj.writer} හා සම්බන්ධ වන්න`
                              : `Connect with ${proj.writer}`}
                          </span>
                        </button>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
