/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileOutput,
  FileText,
  Film,
  Flame,
  Globe,
  Handshake,
  Layers,
  Play,
  Sparkles,
  Trophy,
  Tv,
  Upload,
  User as UserIcon,
  UserCog,
  Users,
} from 'lucide-react';
import {
  AppPage,
  CollabRequestRecord,
  CommunityPostRecord,
  CreatorFollowRecord,
  CreatorProfileRecord,
  Language,
  PipelineFilter,
  PipelineProject,
  PitchDraft,
  PrivateSubmissionRecord,
  ProjectStatus,
  SubmissionFormData,
  UserProfileRecord,
} from './types';
import { DEFAULT_PITCH_DRAFT, UI_COPY } from './data/content';
import {
  OperationType,
  auth,
  consumeGoogleRedirectResult,
  creativeRoleToAccountType,
  db,
  ensureOrRegisterUserProfile,
  handleFirestoreError,
  incrementCloudScriptViews,
  isAdminUser,
  mapDocToCollabRequest,
  mapDocToCommunityPost,
  mapDocToCreatorProfile,
  mapDocToFollow,
  mapPrivateDocToSubmission,
  mapPublicDocToProject,
} from './firebase';
import { Navbar } from './components/Navbar';
import { CinemaKeyArt } from './components/CinemaKeyArt';
import { PitchStudio } from './components/PitchStudio';
import { ProjectModal } from './components/ProjectModal';
import { SubmissionSection } from './components/SubmissionSection';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { AccountModal } from './components/AccountModal';
import { CommunityHubSection } from './components/CommunityHubSection';
import { CreatorProfileModal } from './components/CreatorProfileModal';

function computeTrendingScore(project: PipelineProject): number {
  const views = project.views || 0;
  const lastActivityMs = project.lastViewedAt
    ? Date.parse(project.lastViewedAt)
    : project.createdAt
      ? Date.parse(project.createdAt)
      : 0;
  const ageHours = lastActivityMs
    ? Math.max(0.25, (Date.now() - lastActivityMs) / (1000 * 60 * 60))
    : 24;
  return views * 1.5 + (views + 1) / Math.pow(ageHours + 1, 0.55);
}

function formatUploadAge(iso: string | undefined, lang: Language): string {
  if (!iso) return lang === Language.SI ? 'අලුතින් එක්වූ' : 'Recently added';
  const diffMs = Math.max(0, Date.now() - Date.parse(iso));
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) {
    return lang === Language.SI ? 'දැන් එක්වූ' : 'Just added';
  }
  if (mins < 60) {
    return lang === Language.SI ? `මිනිත්තු ${mins}කට පෙර` : `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return lang === Language.SI ? `පැය ${hours}කට පෙර` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return lang === Language.SI ? `දින ${days}කට පෙර` : `${days}d ago`;
}

export default function App() {
  const [lang, setLang] = useState<Language>(Language.SI);
  const [activePage, setActivePage] = useState<AppPage>(() =>
    typeof window !== 'undefined' && window.location.hash === '#community-hub'
      ? 'community'
      : 'studio'
  );
  const [communityPreselectScriptId, setCommunityPreselectScriptId] = useState<
    string | null
  >(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileRecord | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [uploadedProjects, setUploadedProjects] = useState<PipelineProject[]>(
    []
  );
  const [creatorProfiles, setCreatorProfiles] = useState<
    CreatorProfileRecord[]
  >([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPostRecord[]>(
    []
  );
  const [myPrivateSubmissions, setMyPrivateSubmissions] = useState<
    PrivateSubmissionRecord[]
  >([]);
  const [myOutgoingFollows, setMyOutgoingFollows] = useState<
    CreatorFollowRecord[]
  >([]);
  const [myIncomingFollows, setMyIncomingFollows] = useState<
    CreatorFollowRecord[]
  >([]);
  const [incomingCollabs, setIncomingCollabs] = useState<
    CollabRequestRecord[]
  >([]);
  const [outgoingCollabs, setOutgoingCollabs] = useState<
    CollabRequestRecord[]
  >([]);

  const [localGuestViewBumps, setLocalGuestViewBumps] = useState<
    Record<string, number>
  >({});
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>(
    PipelineFilter.ALL
  );
  const [slideIndex, setSlideIndex] = useState<number>(0);
  const [slideDirection, setSlideDirection] = useState<number>(1);
  const [isCarouselPaused, setIsCarouselPaused] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] =
    useState<PipelineProject | null>(null);
  const [accountOpen, setAccountOpen] = useState<boolean>(false);
  const [adminOpen, setAdminOpen] = useState<boolean>(false);

  // Creator Profile Modal State (Own Profile or Public Filmmaker Profile)
  const [profileModalState, setProfileModalState] = useState<{
    open: boolean;
    targetUid: string | null;
    fallbackName?: string;
    connectScript?: { id: string; title: string } | null;
    ownTab?: 'scripts' | 'connections' | 'posts' | 'edit';
  }>({
    open: false,
    targetUid: null,
  });

  const [pitchDraft, setPitchDraft] =
    useState<PitchDraft>(DEFAULT_PITCH_DRAFT);
  const [submissionPrefill, setSubmissionPrefill] =
    useState<Partial<SubmissionFormData> | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');

  // Track Firebase Authentication State & Load/Ensure Member Profile + Public Creator Profile
  useEffect(() => {
    void consumeGoogleRedirectResult().then(async (redirectResult) => {
      if (!redirectResult?.user?.emailVerified) return;
      try {
        const regRole = redirectResult.pendingReg?.creativeRole;
        const regType = regRole ? creativeRoleToAccountType(regRole) : undefined;
        const profile = await ensureOrRegisterUserProfile(
          redirectResult.user,
          redirectResult.pendingReg?.displayName,
          regType,
          regRole
        );
        setUserProfile(profile);
      } catch {
        // Profile listener / fallback will continue normally
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (user && user.emailVerified) {
        try {
          const profile = await ensureOrRegisterUserProfile(user);
          setUserProfile(profile);
        } catch {
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
        setAdminOpen(false);
        setMyPrivateSubmissions([]);
        setMyOutgoingFollows([]);
        setMyIncomingFollows([]);
        setIncomingCollabs([]);
        setOutgoingCollabs([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-Time Firestore Subscription to Published Screenplays (Zero Mock Data)
  useEffect(() => {
    if (!authReady) return;
    const path = 'publicScripts';
    const q = query(collection(db, path), where('isPublished', '==', true));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) =>
          mapPublicDocToProject(docSnap.data())
        );
        setUploadedProjects(items);
        setLastSyncedTime(
          new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
    return () => unsubscribe();
  }, [authReady]);

  // Real-Time Subscription to Public Filmmaker Profiles
  useEffect(() => {
    if (!authReady) return;
    const path = 'creatorProfiles';
    const q = query(collection(db, path), where('isPublic', '==', true));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCreatorProfiles(
          snapshot.docs.map((docSnap) => mapDocToCreatorProfile(docSnap.data()))
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
    return () => unsubscribe();
  }, [authReady]);

  // Real-Time Subscription to Open Filmmaker Community Posts
  useEffect(() => {
    if (!authReady) return;
    const path = 'communityPosts';
    const q = query(collection(db, path), where('isPublished', '==', true));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCommunityPosts(
          snapshot.docs.map((docSnap) => mapDocToCommunityPost(docSnap.data()))
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
    return () => unsubscribe();
  }, [authReady]);

  // Real-Time Subscriptions for Signed-In Creator's Own Scripts, Follows, and Collaboration Inbox
  useEffect(() => {
    if (!authReady || !currentUser || !currentUser.emailVerified) return;
    const uid = currentUser.uid;

    const unsubSubs = onSnapshot(
      query(collection(db, 'privateSubmissions'), where('authorUid', '==', uid)),
      (snap) => {
        const records = snap.docs
          .map((d) => mapPrivateDocToSubmission(d.data()))
          .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
        setMyPrivateSubmissions(records);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'privateSubmissions')
    );

    const unsubOutFollows = onSnapshot(
      query(collection(db, 'follows'), where('followerUid', '==', uid)),
      (snap) => {
        setMyOutgoingFollows(snap.docs.map((d) => mapDocToFollow(d.data())));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'follows')
    );

    const unsubInFollows = onSnapshot(
      query(collection(db, 'follows'), where('followingUid', '==', uid)),
      (snap) => {
        setMyIncomingFollows(snap.docs.map((d) => mapDocToFollow(d.data())));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'follows')
    );

    const unsubInCollabs = onSnapshot(
      query(collection(db, 'collabRequests'), where('recipientUid', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => mapDocToCollabRequest(d.data()))
          .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
        setIncomingCollabs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'collabRequests')
    );

    const unsubOutCollabs = onSnapshot(
      query(collection(db, 'collabRequests'), where('senderUid', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => mapDocToCollabRequest(d.data()))
          .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
        setOutgoingCollabs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'collabRequests')
    );

    return () => {
      unsubSubs();
      unsubOutFollows();
      unsubInFollows();
      unsubInCollabs();
      unsubOutCollabs();
    };
  }, [authReady, currentUser]);

  // Merge cloud view counts with any guest-session increments
  const mergedProjects = useMemo(() => {
    return uploadedProjects.map((proj) => ({
      ...proj,
      views: (proj.views || 0) + (localGuestViewBumps[proj.id] || 0),
    }));
  }, [uploadedProjects, localGuestViewBumps]);

  const activeScriptsCount = mergedProjects.length;
  const userIsAdmin = isAdminUser(currentUser);
  const memberDisplayName =
    userProfile?.displayName ||
    currentUser?.displayName ||
    currentUser?.email?.split('@')[0] ||
    '';

  const pendingInquiriesCount = useMemo(() => {
    return incomingCollabs.filter((c) => c.status === 'Pending').length;
  }, [incomingCollabs]);

  const handleOpenCreatorProfile = (
    uid: string,
    fallbackName?: string,
    connectScript?: { id: string; title: string } | null
  ) => {
    setProfileModalState({
      open: true,
      targetUid: uid,
      fallbackName,
      connectScript: connectScript || null,
      ownTab: 'scripts',
    });
  };

  const handleOpenMyProfile = () => {
    if (!currentUser) {
      setAccountOpen(true);
      return;
    }
    setProfileModalState({
      open: true,
      targetUid: currentUser.uid,
      fallbackName: memberDisplayName,
      connectScript: null,
      ownTab: pendingInquiriesCount > 0 ? 'connections' : 'scripts',
    });
  };

  // Sorted category lists from real user uploads
  const newestList = useMemo(() => {
    return [...mergedProjects].sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }, [mergedProjects]);

  const trendingList = useMemo(() => {
    return [...mergedProjects].sort((a, b) => {
      const scoreDiff = computeTrendingScore(b) - computeTrendingScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.views || 0) - (a.views || 0);
    });
  }, [mergedProjects]);

  const mostViewedList = useMemo(() => {
    return [...mergedProjects].sort((a, b) => {
      const diff = (b.views || 0) - (a.views || 0);
      if (diff !== 0) return diff;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [mergedProjects]);

  const pitchReadyList = useMemo(() => {
    return trendingList.filter(
      (p) => p.status === ProjectStatus.PITCH_READY
    );
  }, [trendingList]);

  const underReviewList = useMemo(() => {
    return trendingList.filter(
      (p) => p.status === ProjectStatus.UNDER_REVIEW
    );
  }, [trendingList]);

  // Top Trending & Most Viewed list for Hero Auto-Sliding Showcase
  const heroTrendingSlides = useMemo(() => {
    return trendingList.slice(0, 5);
  }, [trendingList]);

  const safeSlideIndex =
    heroTrendingSlides.length > 0
      ? slideIndex % heroTrendingSlides.length
      : 0;
  const activeHeroProject = heroTrendingSlides[safeSlideIndex] || null;

  // Auto-slide animation interval for Hero Trending list
  useEffect(() => {
    if (heroTrendingSlides.length <= 1 || isCarouselPaused) return;
    const timer = window.setInterval(() => {
      setSlideDirection(1);
      setSlideIndex((prev) => (prev + 1) % heroTrendingSlides.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [heroTrendingSlides.length, isCarouselPaused]);

  const goToSlide = (targetIdx: number) => {
    if (heroTrendingSlides.length === 0) return;
    setSlideDirection(targetIdx >= safeSlideIndex ? 1 : -1);
    setSlideIndex(targetIdx);
  };

  const stepSlide = (delta: number) => {
    if (heroTrendingSlides.length <= 1) return;
    setSlideDirection(delta);
    setSlideIndex(
      (prev) =>
        (prev + delta + heroTrendingSlides.length) %
        heroTrendingSlides.length
    );
  };

  const trendingIdSet = useMemo(
    () => new Set(trendingList.slice(0, 3).map((p) => p.id)),
    [trendingList]
  );

  const newestIdSet = useMemo(
    () => new Set(newestList.slice(0, 3).map((p) => p.id)),
    [newestList]
  );

  const displayedProjects = useMemo(() => {
    if (pipelineFilter === PipelineFilter.PITCH_READY) return pitchReadyList;
    if (pipelineFilter === PipelineFilter.UNDER_REVIEW) return underReviewList;
    if (pipelineFilter === PipelineFilter.NEWEST) return newestList;
    if (pipelineFilter === PipelineFilter.TRENDING) return trendingList;
    if (pipelineFilter === PipelineFilter.MOST_VIEWED) return mostViewedList;
    return trendingList;
  }, [
    pitchReadyList,
    underReviewList,
    newestList,
    trendingList,
    mostViewedList,
    pipelineFilter,
  ]);

  const totalGalleryViews = useMemo(() => {
    return mergedProjects.reduce((sum, item) => sum + (item.views || 0), 0);
  }, [mergedProjects]);

  const activeCategoryInfo = useMemo(() => {
    if (pipelineFilter === PipelineFilter.PITCH_READY) {
      return {
        label:
          lang === Language.SI
            ? 'Pitch Deck සූදානම් කළ ව්‍යාපෘති'
            : 'Projects with Pitch Deck Ready',
        emptyNote:
          lang === Language.SI
            ? 'Admin මණ්ඩලය විසින් "Pitch Deck Ready" ලෙස අනුමත කළ තිරපිටපත් මෙහි දිස්වේ.'
            : 'Screenplays approved as Pitch Deck Ready by the editorial board appear here.',
      };
    }
    if (pipelineFilter === PipelineFilter.UNDER_REVIEW) {
      return {
        label:
          lang === Language.SI
            ? 'දැනට පරීක්ෂාවේ පවතින තිරපිටපත්'
            : 'Screenplays Currently Under Review',
        emptyNote:
          lang === Language.SI
            ? 'කවුරුන් හෝ තිරපිටපතක් Upload කළ සැණින් පරීක්ෂාවේ පවතින නිර්මාණ මෙහි දිස්වේ.'
            : 'Newly submitted screenplays undergoing editorial review appear here.',
      };
    }
    if (pipelineFilter === PipelineFilter.TRENDING) {
      return {
        label:
          lang === Language.SI
            ? 'දැන් වැඩිම පාඨක අවධානයක් දිනාගත් Trending තිරපිටපත්'
            : 'Currently Trending Uploaded Screenplays',
        emptyNote:
          lang === Language.SI
            ? 'කවුරුන් හෝ තිරපිටපත් Upload කළ පසු, දැන් Trending වන නිර්මාණ මෙම කොටසේ ස්වයංක්‍රීයව දිස්වේ.'
            : 'Once screenplays are uploaded, currently trending titles will automatically display here.',
      };
    }
    if (pipelineFilter === PipelineFilter.NEWEST) {
      return {
        label:
          lang === Language.SI
            ? 'අලුතින්ම Upload කරන ලද තිරපිටපත්'
            : 'Most Recently Uploaded Screenplays',
        emptyNote:
          lang === Language.SI
            ? 'අලුතින්ම Upload කරන තිරපිටපත් එසැණින් මෙම ගැලරි කොටසට එක් වේ.'
            : 'Newly uploaded screenplays appear immediately in this gallery view.',
      };
    }
    if (pipelineFilter === PipelineFilter.MOST_VIEWED) {
      return {
        label:
          lang === Language.SI
            ? 'වැඩිම නැරඹුම් වාර (Views) හිමි කරගත් තිරපිටපත්'
            : 'Most Viewed Uploaded Screenplays',
        emptyNote:
          lang === Language.SI
            ? 'තිරපිටපත් Upload වී පාඨකයින් කියවන විට, වැඩිම නැරඹුම් සහිත නිර්මාණ මෙහි පෙළගැස්වේ.'
            : 'As readers open uploaded screenplays, the highest-viewed titles rank here automatically.',
      };
    }
    return {
      label:
        lang === Language.SI
          ? 'සියලුම සංවර්ධනය වන සහ Upload කළ තිරපිටපත් එකතුව'
          : 'All Uploaded Screenplays in Pipeline',
      emptyNote:
        lang === Language.SI
          ? 'වෙබ් අඩවියට තිරපිටපත් Upload වූ පසු සියලුම නිර්මාණ මෙම ලැයිස්තුවේ සජීවීව ප්‍රදර්ශනය වේ.'
          : 'All uploaded screenplays will be showcased in this pipeline once submitted.',
    };
  }, [pipelineFilter, lang]);

  const handleOpenProject = async (project: PipelineProject) => {
    const optimisticProject: PipelineProject = {
      ...project,
      views: (project.views || 0) + 1,
      lastViewedAt: new Date().toISOString(),
    };
    setSelectedProject(optimisticProject);

    if (currentUser?.emailVerified) {
      await incrementCloudScriptViews(project.id);
    } else {
      setLocalGuestViewBumps((prev) => ({
        ...prev,
        [project.id]: (prev[project.id] || 0) + 1,
      }));
    }
  };

  const handleLanguageChange = (nextLang: Language) => {
    setLang(nextLang);
    document.documentElement.lang = nextLang;
  };

  const handleNavigateStudio = (sectionId?: string) => {
    setActivePage('studio');
    if (typeof window !== 'undefined') {
      window.history.replaceState(
        null,
        '',
        sectionId ? `#${sectionId}` : window.location.pathname
      );
    }
    window.setTimeout(() => {
      if (sectionId) {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          return;
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 40);
  };

  const handleOpenCommunityPage = (preselectScriptId?: string) => {
    if (preselectScriptId) {
      setCommunityPreselectScriptId(preselectScriptId);
    }
    setActivePage('community');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#community-hub');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleTransferToSubmission = (draft: PitchDraft) => {
    const mappedFormat = draft.format.includes('Feature')
      ? 'Feature Film'
      : draft.format.includes('Mini')
        ? 'Limited Series'
        : 'OTT Web Series';

    setSubmissionPrefill({
      workingTitle: draft.title,
      genre: draft.genre,
      format: mappedFormat,
      logline: draft.logline,
    });

    handleNavigateStudio('submit');
  };

  const handleProjectSubmitted = (newProject: PipelineProject) => {
    setUploadedProjects((prev) =>
      prev.some((item) => item.id === newProject.id)
        ? prev
        : [newProject, ...prev]
    );
    setSlideDirection(1);
    setSlideIndex(0);
    setPipelineFilter(PipelineFilter.ALL);
  };

  const stepIconConfigs = [
    {
      Icon: FileText,
      boxClass: 'bg-[#06b6d4]/10 border-[#06b6d4]/30 text-[#06b6d4]',
    },
    {
      Icon: UserCog,
      boxClass: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    },
    {
      Icon: Sparkles,
      boxClass: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    },
    {
      Icon: Handshake,
      boxClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    },
  ];

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 flex flex-col relative">
      {/* Ambient Background Lighting Glows */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-1/4 w-96 h-96 bg-[#06b6d4]/10 rounded-full blur-[120px] pointer-events-none z-0"
      />
      <div
        aria-hidden="true"
        className="fixed bottom-10 right-10 w-[500px] h-[500px] bg-[#4f46e5]/10 rounded-full blur-[150px] pointer-events-none z-0"
      />

      {/* Top Navigation Header (non-sticky relative z-50 per explicit layout requirement) */}
      <Navbar
        lang={lang}
        activePage={activePage}
        isSignedIn={Boolean(currentUser)}
        memberDisplayName={memberDisplayName}
        userIsAdmin={userIsAdmin}
        activeScriptsCount={activeScriptsCount}
        pendingInquiriesCount={pendingInquiriesCount}
        onLanguageChange={handleLanguageChange}
        onNavigateStudio={handleNavigateStudio}
        onOpenCommunityPage={() => handleOpenCommunityPage()}
        onOpenAccount={() => setAccountOpen(true)}
        onOpenMyProfile={handleOpenMyProfile}
        onOpenAdmin={() => setAdminOpen(true)}
      />

      <main className="relative z-10 flex-1">
        {activePage === 'community' ? (
          <CommunityHubSection
            lang={lang}
            currentUser={currentUser}
            userProfile={userProfile}
            creatorProfiles={creatorProfiles}
            communityPosts={communityPosts}
            publicScripts={mergedProjects}
            myOutgoingFollows={myOutgoingFollows}
            pendingInquiriesCount={pendingInquiriesCount}
            preselectedScriptId={communityPreselectScriptId}
            onClearPreselectedScript={() => setCommunityPreselectScriptId(null)}
            onBackToStudio={() => handleNavigateStudio()}
            onOpenMyProfile={handleOpenMyProfile}
            onInspectCreator={handleOpenCreatorProfile}
            onSelectProject={handleOpenProject}
            onRequireSignIn={() => setAccountOpen(true)}
          />
        ) : (
          <>
            {/* HERO SECTION */}
            <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 px-4 md:px-8 max-w-7xl mx-auto text-center">
              {/* Kicker */}
              <p className="text-xs sm:text-sm font-semibold text-[#38bdf8] tracking-wide mb-6">
                {UI_COPY.hero.kicker[lang]}
              </p>

              {/* Title */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight max-w-5xl mx-auto mb-6">
                <span className="gradient-text">
                  {UI_COPY.hero.titlePrimary[lang]}
                </span>
                <span className="block text-slate-300 text-xl sm:text-3xl lg:text-4xl font-medium mt-3">
                  {UI_COPY.hero.titleSecondary[lang]}
                </span>
              </h1>

              {/* Description */}
              <p className="text-slate-400 text-base md:text-lg max-w-3xl mx-auto leading-relaxed mb-10">
                {UI_COPY.hero.description[lang]}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-xl mx-auto mb-14">
                <a
                  href="#submit"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white font-bold text-sm tracking-wide hover:shadow-xl hover:shadow-cyan-500/35 transition-all duration-150 hover:-translate-y-0.5 flex items-center justify-center gap-2.5 whitespace-nowrap shrink-0 min-h-[50px]"
                >
                  <FileOutput className="w-4 h-4 shrink-0" />
                  <span>{UI_COPY.hero.primaryBtn[lang]}</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleOpenCommunityPage()}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl glass-panel hover:bg-slate-800/80 text-slate-200 font-semibold text-sm tracking-wide hover:border-slate-500 transition-all duration-150 flex items-center justify-center gap-2 whitespace-nowrap shrink-0 min-h-[50px] cursor-pointer"
                >
                  <Users className="w-4 h-4 text-[#38bdf8] shrink-0" />
                  <span>{UI_COPY.hero.secondaryBtn[lang]}</span>
                </button>
              </div>

          {/* Live User-Uploaded Trending & Most-Viewed Screenplay Showcase */}
          <div
            className="max-w-4xl mx-auto mb-14 text-left"
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
          >
            <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              {/* Showcase Header */}
              <div className="px-5 py-3.5 border-b border-slate-800/90 flex items-center justify-between gap-3 bg-slate-950/60">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <Flame className="w-4 h-4 text-[#38bdf8] shrink-0" />
                  <span>
                    {lang === Language.SI
                      ? 'දැන් Trending හා වැඩිම නැරඹුම් ලැයිස්තුව'
                      : 'Live Trending & Most Viewed Slate'}
                  </span>
                </div>

                <span className="text-xs font-mono tabular-nums text-[#38bdf8] shrink-0">
                  {lang === Language.SI
                    ? `පිටපත් ${activeScriptsCount}`
                    : `${activeScriptsCount} Live`}
                </span>
              </div>

              {/* Showcase Body: Empty 0-State OR Side-Sliding Real Uploads */}
              {!activeHeroProject ? (
                <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#38bdf8] flex items-center justify-center mb-3">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-base font-semibold text-white">
                    {lang === Language.SI
                      ? 'තවම කිසිදු තිරපිටපතක් Upload කර නොමැත'
                      : 'No Screenplays Uploaded Yet'}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mt-1.5 max-w-lg">
                    {lang === Language.SI
                      ? 'කවුරුන් හෝ තිරපිටපතක් Upload කළ සැණින්, වැඩිම නැරඹුම් හා Trending ලැයිස්තුවේ නිර්මාණ Side-Slide ඇනිමේෂන් එකක් සහිතව මෙතැන සජීවීව දිස්වේ.'
                      : 'As soon as a creator uploads a screenplay, the top-viewed and trending list will automatically slide through this live showcase.'}
                  </p>
                  <a
                    href="#submit"
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-[#38bdf8] transition-colors min-h-[40px]"
                  >
                    <span>
                      {lang === Language.SI
                        ? 'පළමු තිරපිටපත Upload කරන්න'
                        : 'Upload First Screenplay'}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={activeHeroProject.id}
                      initial={{
                        opacity: 0,
                        x: slideDirection >= 0 ? 44 : -44,
                      }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{
                        opacity: 0,
                        x: slideDirection >= 0 ? -44 : 44,
                      }}
                      transition={{
                        duration: 0.3,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      onClick={() => handleOpenProject(activeHeroProject)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenProject(activeHeroProject);
                        }
                      }}
                      className="cursor-pointer group grid grid-cols-1 md:grid-cols-12 items-stretch"
                    >
                      <div className="md:col-span-5 aspect-[16/10] md:aspect-auto bg-[#060911] relative overflow-hidden border-b md:border-b-0 md:border-r border-slate-800/80">
                        <CinemaKeyArt
                          variant={activeHeroProject.keyArt}
                          title={activeHeroProject.title}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#090d16]/85 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#38bdf8]">
                            {lang === Language.SI
                              ? `දැන් Trending #${safeSlideIndex + 1}`
                              : `Trending #${safeSlideIndex + 1}`}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums text-slate-200">
                            <Eye className="w-3.5 h-3.5 text-[#38bdf8]" />
                            <span>
                              {lang === Language.SI
                                ? `නැරඹුම් ${activeHeroProject.views ?? 0}`
                                : `${activeHeroProject.views ?? 0} views`}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="md:col-span-7 p-5 sm:p-6 flex flex-col justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1.5">
                            <span className="text-[#06b6d4] font-semibold">
                              {activeHeroProject.status}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{activeHeroProject.genre}</span>
                            <span aria-hidden="true">·</span>
                            <span>{activeHeroProject.format}</span>
                          </div>

                          <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-[#38bdf8] transition-colors">
                            {activeHeroProject.title}
                          </h2>

                          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-2 line-clamp-2">
                            {activeHeroProject.logline[lang]}
                          </p>
                        </div>

                        <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                          {activeHeroProject.authorUid ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCreatorProfile(
                                  activeHeroProject.authorUid!,
                                  activeHeroProject.writer
                                );
                              }}
                              className="inline-flex items-center gap-1.5 truncate font-medium text-slate-200 hover:text-[#38bdf8] transition-colors cursor-pointer"
                            >
                              <UserIcon className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                              <span className="truncate">
                                {activeHeroProject.writer}
                              </span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 truncate font-medium text-slate-200">
                              <UserIcon className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                              <span className="truncate">
                                {activeHeroProject.writer}
                              </span>
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 text-[#38bdf8] font-semibold shrink-0">
                            <span>
                              {lang === Language.SI
                                ? 'විස්තර බලන්න'
                                : 'Read Coverage'}
                            </span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* Carousel Controls if > 1 Uploaded Project */}
                  {heroTrendingSlides.length > 1 && (
                    <div className="px-5 py-3 bg-slate-950/70 border-t border-slate-800/90 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        {heroTrendingSlides.map((proj, idx) => (
                          <button
                            key={proj.id}
                            type="button"
                            onClick={() => goToSlide(idx)}
                            aria-label={`Slide ${idx + 1}: ${proj.title}`}
                            className={`h-1.5 rounded-full transition-all cursor-pointer ${
                              idx === safeSlideIndex
                                ? 'w-6 bg-[#38bdf8]'
                                : 'w-2 bg-white/20 hover:bg-white/40'
                            }`}
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => stepSlide(-1)}
                          aria-label="Previous trending screenplay"
                          className="w-7 h-7 rounded-md border border-white/15 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => stepSlide(1)}
                          aria-label="Next trending screenplay"
                          className="w-7 h-7 rounded-md border border-white/15 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Target Pitch Platforms & Distribution Models */}
          <div className="pt-8 border-t border-slate-800/80 max-w-4xl mx-auto">
            <p className="text-xs tracking-wider text-slate-400 mb-6">
              {UI_COPY.hero.channelsLabel[lang]}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 text-slate-300 font-bold text-base sm:text-lg">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-red-500 fill-red-500" />
                <span>NETFLIX</span>
              </div>
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-cyan-400" />
                <span>PRIME VIDEO</span>
              </div>
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-purple-400" />
                <span>VIU ORIGINALS</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-400" />
                <span>CO-PRODUCTIONS</span>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section
          id="how-it-works"
          className="py-20 px-4 md:px-8 max-w-7xl mx-auto border-t border-slate-800/80"
        >
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-[#38bdf8] tracking-wide mb-2">
              {UI_COPY.howItWorks.kicker[lang]}
            </p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white">
              {UI_COPY.howItWorks.heading[lang]}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {UI_COPY.howItWorks.steps.map((step, idx) => {
              const { Icon, boxClass } =
                stepIconConfigs[idx] || stepIconConfigs[0];
              return (
                <div
                  key={step.num}
                  className="glass-card p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div
                        className={`w-12 h-12 rounded-xl border flex items-center justify-center ${boxClass}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-2xl font-black font-mono tabular-nums text-slate-700">
                        {step.num}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2.5">
                      {step.title[lang]}
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      {step.desc[lang]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* PROJECT PIPELINE / CURATED SHOWCASE */}
        <section
          id="pipeline"
          className="py-20 px-4 md:px-8 max-w-7xl mx-auto border-t border-slate-800/80"
        >
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs font-bold text-[#38bdf8] tracking-wide mb-2">
                {UI_COPY.pipeline.kicker[lang]}
              </p>
              <h2 className="text-2xl md:text-4xl font-extrabold text-white">
                {UI_COPY.pipeline.heading[lang]}
              </h2>
              <p className="text-slate-400 text-sm mt-2 max-w-2xl leading-relaxed">
                {UI_COPY.pipeline.subhead[lang]}
              </p>
            </div>

            {/* Category & Status Filters */}
            <div
              role="group"
              aria-label="Filter project pipeline"
              className="flex flex-wrap gap-2"
            >
              {[
                {
                  key: PipelineFilter.ALL,
                  label: UI_COPY.pipeline.filters.all[lang],
                  count: mergedProjects.length,
                },
                {
                  key: PipelineFilter.PITCH_READY,
                  label: UI_COPY.pipeline.filters.pitchReady[lang],
                  count: pitchReadyList.length,
                },
                {
                  key: PipelineFilter.UNDER_REVIEW,
                  label: UI_COPY.pipeline.filters.underReview[lang],
                  count: underReviewList.length,
                },
                {
                  key: PipelineFilter.TRENDING,
                  label: UI_COPY.pipeline.filters.trending[lang],
                  count: trendingList.length,
                },
                {
                  key: PipelineFilter.NEWEST,
                  label: UI_COPY.pipeline.filters.newest[lang],
                  count: newestList.length,
                },
                {
                  key: PipelineFilter.MOST_VIEWED,
                  label: UI_COPY.pipeline.filters.mostViewed[lang],
                  count: mostViewedList.length,
                },
              ].map((tab) => {
                const active = pipelineFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPipelineFilter(tab.key)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 min-h-[38px] inline-flex items-center gap-1.5 cursor-pointer ${
                      active
                        ? 'bg-[#06b6d4] text-slate-950'
                        : 'glass-panel text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        active ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      ({tab.count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Sync Context Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-8 border-b border-slate-800/80 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-white font-medium">
                {activeCategoryInfo.label}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {lang === Language.SI ? 'මුළු නැරඹුම්:' : 'Total Views:'}{' '}
                <strong className="text-[#38bdf8] font-mono tabular-nums">
                  {totalGalleryViews}
                </strong>
              </span>
            </div>

            <span className="font-mono tabular-nums text-slate-400">
              {lang === Language.SI
                ? `සජීවී යාවත්කාලීන කිරීම සක්‍රීයයි${lastSyncedTime ? ` · ${lastSyncedTime}` : ''}`
                : `Live cloud sync${lastSyncedTime ? ` · ${lastSyncedTime}` : ''}`}
            </span>
          </div>

          {/* Pipeline Grid */}
          {displayedProjects.length === 0 ? (
            <div className="glass-panel rounded-2xl px-6 py-14 sm:px-10 sm:py-16 text-center">
              <p className="text-base sm:text-lg font-semibold text-white">
                {activeCategoryInfo.label}
              </p>
              <p className="text-sm text-slate-400 leading-relaxed mt-2 max-w-xl mx-auto">
                {activeCategoryInfo.emptyNote}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayedProjects.map((project, index) => {
                const isTrending = trendingIdSet.has(project.id);
                const isNewest = newestIdSet.has(project.id);
                const viewsCount = project.views ?? 0;
                const isPitchReady =
                  project.status === ProjectStatus.PITCH_READY;

                return (
                  <article
                    key={project.id}
                    onClick={() => handleOpenProject(project)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenProject(project);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="glass-card rounded-2xl overflow-hidden flex flex-col justify-between text-left cursor-pointer group"
                  >
                    <div>
                      <div className="h-48 bg-slate-900 relative overflow-hidden border-b border-slate-800/80">
                        <CinemaKeyArt
                          variant={project.keyArt}
                          title={project.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#090d16]/90 via-[#090d16]/20 to-transparent" />

                        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2 text-xs">
                          <span
                            className={`font-bold ${
                              isPitchReady
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {project.status}
                          </span>
                          <span className="text-cyan-300 font-medium">
                            {project.genre}
                          </span>
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-2">
                          {pipelineFilter === PipelineFilter.MOST_VIEWED ? (
                            <span className="inline-flex items-center gap-1 font-medium text-[#38bdf8]">
                              <Trophy
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                              <span>
                                {lang === Language.SI
                                  ? `වැඩිම නැරඹුම් #${index + 1}`
                                  : `Most Viewed #${index + 1}`}
                              </span>
                            </span>
                          ) : pipelineFilter === PipelineFilter.NEWEST ? (
                            <span className="inline-flex items-center gap-1 font-medium text-[#38bdf8]">
                              <Clock
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                              <span>
                                {formatUploadAge(project.createdAt, lang)}
                              </span>
                            </span>
                          ) : isTrending ? (
                            <span className="inline-flex items-center gap-1 font-medium text-[#38bdf8]">
                              <Flame
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                              <span>
                                {lang === Language.SI
                                  ? `දැන් Trending #${index + 1}`
                                  : `Trending #${index + 1}`}
                              </span>
                            </span>
                          ) : isNewest ? (
                            <span className="inline-flex items-center gap-1 font-medium text-[#38bdf8]">
                              <Clock
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                              <span>
                                {formatUploadAge(project.createdAt, lang)}
                              </span>
                            </span>
                          ) : null}
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#38bdf8] transition-colors">
                          {project.title}
                        </h3>

                        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed line-clamp-3">
                          {project.logline[lang]}
                        </p>
                      </div>
                    </div>

                    <div className="px-6 pb-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs text-slate-400">
                      {project.authorUid ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCreatorProfile(
                              project.authorUid!,
                              project.writer
                            );
                          }}
                          className="inline-flex items-center gap-1.5 truncate text-slate-200 hover:text-[#38bdf8] font-medium transition-colors cursor-pointer"
                        >
                          <UserIcon className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                          <span className="truncate">{project.writer}</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 truncate text-slate-200 font-medium">
                          <UserIcon className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                          <span className="truncate">{project.writer}</span>
                        </span>
                      )}

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex items-center gap-1 text-[#06b6d4]">
                          <Layers className="w-3.5 h-3.5" />
                          <span>{project.format}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums text-slate-300">
                          <Eye className="w-3.5 h-3.5 text-[#38bdf8]" />
                          <span>{viewsCount}</span>
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

            {/* DEDICATED COMMUNITY & STORY POLISH HUB GATEWAY BANNER */}
            <section className="py-12 px-4 md:px-8 max-w-7xl mx-auto">
              <div className="glass-panel rounded-3xl p-8 md:p-10 border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="max-w-2xl space-y-2.5">
                  <p className="text-xs font-bold text-[#38bdf8] tracking-wide">
                    {lang === Language.SI
                      ? 'වෙනම විවෘත වන සිනමා නිර්මාණකරුවන්ගේ ප්‍රජාව'
                      : 'Dedicated Filmmaker Network & Story Workshop'}
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    {lang === Language.SI
                      ? 'කතාව තවත් Polish කරගෙන සිනමා කණ්ඩායම එකම තැනකින් සම්බන්ධ කරගන්න'
                      : 'Polish Your Story Concepts & Assemble Your Film Crew'}
                  </h2>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {lang === Language.SI
                      ? 'ඔබේ සම්පූර්ණ තිරපිටපත NDA ආරක්ෂාව යටතේ රහසිගතව තබාගෙනම, අපගේ වෙනමම වූ Community Hub පිටුවට පිවිස කතා සාරාංශ ගැන අදහස් ලබාගන්න, නිර්මාණකරුවන්ව Follow කරන්න සහ අධ්‍යක්ෂවරුන් හා නිෂ්පාදකවරුන් සමඟ එකතු වන්න.'
                      : 'Step into our dedicated full-page Community Hub to gather structured feedback on your Loglines while keeping your full script safely under NDA, follow fellow filmmakers, and form co-production teams.'}
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono tabular-nums">
                    <span>
                      <strong className="text-white">{creatorProfiles.length}</strong>{' '}
                      {lang === Language.SI ? 'නිර්මාණකරුවන්' : 'Filmmakers'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      <strong className="text-white">{communityPosts.length}</strong>{' '}
                      {lang === Language.SI ? 'සංවාද හා විචාර' : 'Active Discussions'}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenCommunityPage()}
                    className="w-full sm:w-auto px-7 py-4 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white font-bold text-sm hover:shadow-xl hover:shadow-cyan-500/30 transition-all inline-flex items-center justify-center gap-2.5 whitespace-nowrap cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    <span>
                      {lang === Language.SI
                        ? 'Community Hub පිටුවට පිවිසෙන්න'
                        : 'Enter Community Hub'}
                    </span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>

            {/* INTERACTIVE PITCH DECK BUILDER */}
            <PitchStudio
              lang={lang}
              draft={pitchDraft}
              onChange={setPitchDraft}
              onTransferToSubmission={handleTransferToSubmission}
            />

            {/* OFFICIAL SCRIPT SUBMISSION FORM */}
            <SubmissionSection
              lang={lang}
              currentUser={currentUser}
              userProfile={userProfile}
              prefill={submissionPrefill}
              onOpenAccountModal={() => setAccountOpen(true)}
              onProjectSubmitted={handleProjectSubmitted}
            />
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-black/80 py-12 px-4 md:px-8 relative z-10 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#06b6d4] to-[#4f46e5] flex items-center justify-center text-white">
              <Film className="w-4 h-4" />
            </div>
            <span className="font-display font-bold text-white text-sm tracking-wide">
              LANKAGLOBAL CONTENT HUB
            </span>
          </div>

          <p className="text-center text-slate-400">
            {UI_COPY.footer.copyright[lang]}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-5 text-slate-300">
            <button
              type="button"
              onClick={() => handleNavigateStudio('how-it-works')}
              className="hover:text-[#38bdf8] transition-colors cursor-pointer"
            >
              {UI_COPY.nav.howItWorks[lang]}
            </button>
            <button
              type="button"
              onClick={() => handleNavigateStudio('pipeline')}
              className="hover:text-[#38bdf8] transition-colors cursor-pointer"
            >
              {UI_COPY.nav.pipeline[lang]}
            </button>
            <button
              type="button"
              onClick={() => handleOpenCommunityPage()}
              className="hover:text-[#38bdf8] transition-colors cursor-pointer"
            >
              {UI_COPY.nav.community[lang]}
            </button>
            <button
              type="button"
              onClick={handleOpenMyProfile}
              className="hover:text-[#38bdf8] transition-colors cursor-pointer"
            >
              {currentUser
                ? lang === Language.SI
                  ? 'මගේ Profile පිටුව'
                  : 'My Profile'
                : lang === Language.SI
                  ? 'ලියාපදිංචි වන්න / Login'
                  : 'Register / Login'}
            </button>
            {userIsAdmin && (
              <button
                type="button"
                onClick={() => setAdminOpen(true)}
                className="text-[#38bdf8] hover:underline font-semibold cursor-pointer"
              >
                {lang === Language.SI ? 'Admin පුවරුව' : 'Admin Vault'}
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* PROJECT COVERAGE MODAL */}
      <ProjectModal
        project={selectedProject}
        lang={lang}
        onClose={() => setSelectedProject(null)}
        onLoadIntoStudio={(draft) => {
          setPitchDraft(draft);
          handleNavigateStudio('builder');
        }}
        onInspectCreator={handleOpenCreatorProfile}
      />

      {/* CREATOR PROFILE & COLLABORATION HUB MODAL */}
      <CreatorProfileModal
        open={profileModalState.open}
        targetUid={profileModalState.targetUid}
        fallbackName={profileModalState.fallbackName}
        initialConnectScript={profileModalState.connectScript}
        initialOwnTab={profileModalState.ownTab}
        lang={lang}
        currentUser={currentUser}
        userProfile={userProfile}
        allCreatorProfiles={creatorProfiles}
        allPublicScripts={mergedProjects}
        myPrivateSubmissions={myPrivateSubmissions}
        communityPosts={communityPosts}
        myOutgoingFollows={myOutgoingFollows}
        myIncomingFollows={myIncomingFollows}
        incomingCollabs={incomingCollabs}
        outgoingCollabs={outgoingCollabs}
        onSelectProject={handleOpenProject}
        onInspectCreator={handleOpenCreatorProfile}
        onRequireSignIn={() => setAccountOpen(true)}
        onOpenAdminPanel={() => setAdminOpen(true)}
        onOpenCommunityForScript={(scriptId) =>
          handleOpenCommunityPage(scriptId)
        }
        onNavigateSubmit={() => handleNavigateStudio('submit')}
        onUserProfileSynced={(updated) => setUserProfile(updated)}
        onClose={() =>
          setProfileModalState((prev) => ({ ...prev, open: false }))
        }
      />

      {/* PUBLIC MEMBER REGISTRATION & LOGIN MODAL */}
      <AccountModal
        open={accountOpen}
        lang={lang}
        currentUser={currentUser}
        userProfile={userProfile}
        onProfileUpdated={(profile) => setUserProfile(profile)}
        onOpenAdminPanel={() => setAdminOpen(true)}
        onClose={() => setAccountOpen(false)}
      />

      {/* CONFIDENTIAL ADMIN DASHBOARD MODAL */}
      <AdminDashboardModal
        open={adminOpen}
        lang={lang}
        currentUser={currentUser}
        publicProjects={mergedProjects}
        onClose={() => setAdminOpen(false)}
      />
    </div>
  );
}
