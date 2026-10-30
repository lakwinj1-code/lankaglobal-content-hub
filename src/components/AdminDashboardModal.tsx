import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  Check,
  Download,
  ExternalLink,
  FileText,
  Lock,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  ADMIN_EMAIL,
  OperationType,
  auth,
  db,
  deleteSubmissionCompletely,
  downloadSubmissionFile,
  handleFirestoreError,
  isAdminUser,
  mapPrivateDocToSubmission,
  signInWithGooglePopup,
  signOutCurrentUser,
  updateSubmissionAdminReview,
} from '../firebase';
import { Language, PipelineProject, PrivateSubmissionRecord, ReviewStatus } from '../types';

interface AdminDashboardModalProps {
  open: boolean;
  lang: Language;
  currentUser: User | null;
  publicProjects: PipelineProject[];
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const kb = Math.max(1, Math.round(bytes / 1024));
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(2)} MB`;
  }
  return `${kb} KB`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  open,
  lang,
  currentUser,
  publicProjects,
  onClose,
}) => {
  const [submissions, setSubmissions] = useState<PrivateSubmissionRecord[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [authBusy, setAuthBusy] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReviewStatus>('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedToastId, setSavedToastId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>('');
  const [draftEdits, setDraftEdits] = useState<
    Record<string, { reviewStatus: ReviewStatus; adminNotes: string }>
  >({});

  const userIsAdmin = isAdminUser(currentUser);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !userIsAdmin) {
      setSubmissions([]);
      return;
    }

    setLoadingList(true);
    const path = 'privateSubmissions';
    const unsubscribe = onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items = snapshot.docs
          .map((docSnap) => mapPrivateDocToSubmission(docSnap.data()))
          .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
        setSubmissions(items);
        setLoadingList(false);
      },
      (error) => {
        setLoadingList(false);
        if (!isAdminUser(auth.currentUser)) {
          setSubmissions([]);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [open, userIsAdmin]);

  const viewsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of publicProjects) {
      map.set(p.id, p.views || 0);
    }
    return map;
  }, [publicProjects]);

  const filteredSubmissions = useMemo(() => {
    if (statusFilter === 'ALL') return submissions;
    return submissions.filter((item) => item.reviewStatus === statusFilter);
  }, [submissions, statusFilter]);

  const filesUploadedCount = useMemo(
    () => submissions.filter((s) => s.chunkCount > 0).length,
    [submissions]
  );

  if (!open) return null;

  const handleAdminSignIn = async () => {
    setAuthBusy(true);
    setAuthError('');
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setAuthError(
        lang === Language.SI
          ? 'Google පිවිසුම අවලංගු විය හෝ අසාර්ථක විය. නැවත උත්සාහ කරන්න.'
          : err instanceof Error
            ? err.message
            : 'Google sign-in failed.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleDownload = async (item: PrivateSubmissionRecord) => {
    setDownloadingId(item.scriptId);
    setActionError('');
    try {
      await downloadSubmissionFile(
        item.scriptId,
        item.chunkCount,
        item.fileName,
        item.fileMimeType
      );
    } catch (err) {
      setActionError(
        lang === Language.SI
          ? 'තිරපිටපත් ගොනුව බාගත කිරීමේදී දෝෂයක් ඇති විය.'
          : err instanceof Error
            ? err.message
            : 'Failed to download screenplay file.'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSaveReview = async (item: PrivateSubmissionRecord) => {
    const edit = draftEdits[item.scriptId] || {
      reviewStatus: item.reviewStatus,
      adminNotes: item.adminNotes,
    };
    setSavingId(item.scriptId);
    setActionError('');
    try {
      await updateSubmissionAdminReview(item.scriptId, edit.reviewStatus, edit.adminNotes);
      setSavedToastId(item.scriptId);
      window.setTimeout(() => {
        setSavedToastId((curr) => (curr === item.scriptId ? null : curr));
      }, 2500);
    } catch (err) {
      setActionError(
        lang === Language.SI
          ? 'තත්ත්වය යාවත්කාලීන කිරීමට නොහැකි විය.'
          : err instanceof Error
            ? err.message
            : 'Failed to update submission review.'
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleConfirmDelete = async (item: PrivateSubmissionRecord) => {
    setDeletingId(item.scriptId);
    setActionError('');
    try {
      await deleteSubmissionCompletely(item.scriptId, item.chunkCount);
      setConfirmDeleteId(null);
    } catch (err) {
      setActionError(
        lang === Language.SI
          ? 'මෙම තිරපිටපත ඉවත් කිරීමට නොහැකි විය.'
          : err instanceof Error
            ? err.message
            : 'Failed to delete submission.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-vault-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] rounded-2xl bg-[#0D121D] border border-white/[0.12] flex flex-col overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4 bg-[#070A12]">
          <div className="flex items-center gap-3 min-w-0">
            <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0" />
            <div className="min-w-0">
              <h2 id="admin-vault-title" className="text-base sm:text-lg font-bold text-white truncate">
                {lang === Language.SI
                  ? 'Admin කළමනාකරණ පුවරුව — Upload කළ තිරපිටපත් ගොනු'
                  : 'Admin Vault — Uploaded Screenplay Files & Submissions'}
              </h2>
              <p className="text-xs text-slate-400 truncate">
                {lang === Language.SI
                  ? 'රහස්‍ය තිරපිටපත් ගොනු (PDF/DOCX/TXT) සහ රචකයන්ගේ සම්බන්ධතා තොරතුරු'
                  : 'Confidential NDA screenplay files and creator contact records'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentUser && (
              <button
                type="button"
                onClick={async () => {
                  onClose();
                  await signOutCurrentUser();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/[0.06] text-xs text-slate-300 transition-colors min-h-[36px]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{lang === Language.SI ? 'ඉවත් වන්න' : 'Sign Out'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close admin panel"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {!currentUser ? (
            /* State 1: Sign-in Required */
            <div className="max-w-md mx-auto py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-sky-400/10 border border-sky-400/30 text-sky-400 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {lang === Language.SI ? 'Admin පිවිසුම අවශ්‍යයි' : 'Administrator Sign-In Required'}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                {lang === Language.SI
                  ? 'රචකයන් විසින් Upload කරන ලද තිරපිටපත් ගොනු (PDF / DOCX / TXT) Download කර ගැනීමට සහ ඔවුන්ගේ දුරකථන / Email තොරතුරු බැලීමට ඔබගේ Admin Google ගිණුමෙන් පිවිසෙන්න.'
                  : 'Sign in with your administrator Google account to view writer contact details and download uploaded screenplay files.'}
              </p>
              {authError && <p className="text-xs text-rose-400 mb-4">{authError}</p>}
              <button
                type="button"
                disabled={authBusy}
                onClick={handleAdminSignIn}
                className="w-full py-3 px-5 rounded-lg bg-sky-400 hover:bg-sky-300 disabled:opacity-60 text-slate-950 font-semibold text-sm transition-colors min-h-[44px]"
              >
                {authBusy
                  ? lang === Language.SI
                    ? 'පිවිසෙමින් පවතී...'
                    : 'Signing in...'
                  : lang === Language.SI
                    ? 'Google ගිණුමෙන් Admin වෙත පිවිසෙන්න'
                    : 'Sign in with Google'}
              </button>
            </div>
          ) : !userIsAdmin ? (
            /* State 2: Non-Admin User */
            <div className="max-w-md mx-auto py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {lang === Language.SI
                  ? 'ප්‍රවේශය අවසර නැත'
                  : 'Administrator Access Only'}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-2">
                {lang === Language.SI
                  ? `ඔබ දැනට පිවිස සිටින්නේ ${currentUser.email} ගිණුමෙනි. රහස්‍ය NDA තිරපිටපත් ගොනු බාගත කිරීමේ අවසරය ඇත්තේ වෙබ් අඩවි හිමිකරු (${ADMIN_EMAIL}) හට පමණි.`
                  : `Signed in as ${currentUser.email}. Confidential NDA screenplay downloads are restricted exclusively to the platform administrator (${ADMIN_EMAIL}).`}
              </p>
              <button
                type="button"
                onClick={handleAdminSignIn}
                className="mt-5 px-5 py-2.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs transition-colors min-h-[40px]"
              >
                {lang === Language.SI ? 'Admin ගිණුමට මාරු වන්න' : 'Switch Google Account'}
              </button>
            </div>
          ) : (
            /* State 3: Authenticated Admin Vault */
            <div className="space-y-6">
              {/* Summary Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl bg-[#070A12] border border-white/[0.08] p-4">
                  <p className="text-2xl font-bold font-mono tabular-nums text-white">
                    {submissions.length}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === Language.SI ? 'මුළු තිරපිටපත් ගණන' : 'Total Submissions'}
                  </p>
                </div>
                <div className="rounded-xl bg-[#070A12] border border-white/[0.08] p-4">
                  <p className="text-2xl font-bold font-mono tabular-nums text-sky-400">
                    {filesUploadedCount}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === Language.SI ? 'බාගත කළ හැකි ගොනු (Files)' : 'Attached Script Files'}
                  </p>
                </div>
                <div className="rounded-xl bg-[#070A12] border border-white/[0.08] p-4">
                  <p className="text-2xl font-bold font-mono tabular-nums text-amber-300">
                    {submissions.filter((s) => s.reviewStatus === 'Pending Review').length}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === Language.SI ? 'පරීක්ෂාවට ඇති (Pending)' : 'Pending Review'}
                  </p>
                </div>
                <div className="rounded-xl bg-[#070A12] border border-white/[0.08] p-4">
                  <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                    {submissions.filter((s) => s.reviewStatus === 'Pitch Deck Ready').length}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === Language.SI ? 'Pitch Deck සූදානම්' : 'Pitch Deck Ready'}
                  </p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#070A12] border border-white/[0.08]">
                  {(
                    [
                      { key: 'ALL', label: lang === Language.SI ? 'සියල්ල' : 'All' },
                      { key: 'Pending Review', label: 'Pending Review' },
                      { key: 'Shortlisted', label: 'Shortlisted' },
                      { key: 'Pitch Deck Ready', label: 'Pitch Deck Ready' },
                      { key: 'Archived', label: 'Archived' },
                    ] as const
                  ).map((tab) => {
                    const active = statusFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setStatusFilter(tab.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[34px] cursor-pointer ${
                          active
                            ? 'bg-sky-400 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <span className="text-xs font-mono tabular-nums text-slate-400">
                  Admin: {currentUser.email}
                </span>
              </div>

              {actionError && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-xs text-rose-300">
                  {actionError}
                </div>
              )}

              {loadingList ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  {lang === Language.SI
                    ? 'Database එකෙන් තිරපිටපත් ලබාගනිමින් පවතී...'
                    : 'Loading confidential submissions from Cloud Database...'}
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="rounded-2xl bg-[#070A12] border border-white/[0.08] py-14 px-6 text-center">
                  <p className="text-base font-semibold text-white">
                    {lang === Language.SI
                      ? 'තවම කිසිදු තිරපිටපත් ගොනුවක් ලැබී නොමැත'
                      : 'No Screenplay Submissions Found'}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                    {lang === Language.SI
                      ? 'කවුරුන් හෝ වෙබ් අඩවිය හරහා තිරපිටපතක් (PDF / DOCX / TXT) Upload කළ සැණින් එම ගොනුව මෙතැනින් Download කරගත හැකිය.'
                      : 'As soon as creators submit screenplays through the website, their uploaded PDF/DOCX/TXT files and contact details will appear here for download.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredSubmissions.map((item) => {
                    const currentEdit = draftEdits[item.scriptId] ?? {
                      reviewStatus: item.reviewStatus,
                      adminNotes: item.adminNotes,
                    };
                    const liveViews = viewsMap.get(item.scriptId) ?? 0;

                    return (
                      <div
                        key={item.scriptId}
                        className="rounded-2xl bg-[#070A12] border border-white/[0.09] p-5 sm:p-6 space-y-4"
                      >
                        {/* Top Metadata Row */}
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1">
                              <span className="font-mono tabular-nums text-sky-400 font-semibold">
                                {item.referenceId}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{item.genre}</span>
                              <span aria-hidden="true">·</span>
                              <span>{item.format}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {formatDateTime(item.createdAtIso)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums text-emerald-400">
                                {lang === Language.SI
                                  ? `නැරඹුම් ${liveViews}`
                                  : `${liveViews} views`}
                              </span>
                            </div>

                            <h3 className="text-lg sm:text-xl font-bold text-white">
                              {item.title}
                            </h3>
                          </div>

                          {/* Delete Action */}
                          <div>
                            {confirmDeleteId === item.scriptId ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={deletingId === item.scriptId}
                                  onClick={() => handleConfirmDelete(item)}
                                  className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-semibold text-xs transition-colors min-h-[34px]"
                                >
                                  {deletingId === item.scriptId
                                    ? lang === Language.SI
                                      ? 'මකමින්...'
                                      : 'Deleting...'
                                    : lang === Language.SI
                                      ? 'ස්ථිරවම මකන්න'
                                      : 'Confirm Delete'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2.5 py-1.5 rounded-lg border border-white/15 text-xs text-slate-300 hover:text-white min-h-[34px]"
                                >
                                  {lang === Language.SI ? 'අවලංගු' : 'Cancel'}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(item.scriptId)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-rose-400/50 text-xs text-slate-400 hover:text-rose-300 transition-colors min-h-[34px]"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{lang === Language.SI ? 'ඉවත් කරන්න' : 'Delete'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Creator Contact Info Row */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 px-4 rounded-xl bg-[#0D121D] border border-white/[0.06] text-xs sm:text-sm">
                          <span className="font-semibold text-white">{item.writerName}</span>
                          <a
                            href={`mailto:${item.email}`}
                            className="inline-flex items-center gap-1.5 text-sky-300 hover:text-sky-200 underline-offset-4 hover:underline"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>{item.email}</span>
                          </a>
                          <a
                            href={`tel:${item.phone}`}
                            className="inline-flex items-center gap-1.5 text-slate-200 hover:text-white font-mono tabular-nums"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{item.phone}</span>
                          </a>
                        </div>

                        {/* Logline */}
                        <p className="text-sm text-slate-300 leading-relaxed">{item.logline}</p>

                        {/* Uploaded Screenplay File Download & Cloud URL Bar */}
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          {item.chunkCount > 0 ? (
                            <button
                              type="button"
                              disabled={downloadingId === item.scriptId}
                              onClick={() => handleDownload(item)}
                              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs sm:text-sm transition-colors min-h-[42px] cursor-pointer"
                            >
                              <Download className="w-4 h-4 shrink-0" />
                              <span>
                                {downloadingId === item.scriptId
                                  ? lang === Language.SI
                                    ? 'ගොනුව සකසමින් පවතී...'
                                    : 'Downloading File...'
                                  : lang === Language.SI
                                    ? `ගොනුව Download කරන්න: ${item.fileName} (${formatBytes(item.fileSizeBytes)})`
                                    : `Download File: ${item.fileName} (${formatBytes(item.fileSizeBytes)})`}
                              </span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.04] text-xs text-slate-400">
                              <FileText className="w-4 h-4" />
                              <span>
                                {lang === Language.SI
                                  ? 'සෘජු ගොනුවක් නැත (Cloud Link පමණි)'
                                  : 'No direct file attached (Cloud link only)'}
                              </span>
                            </span>
                          )}

                          {item.scriptUrl && (
                            <a
                              href={item.scriptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/15 hover:border-sky-400/50 hover:bg-white/[0.04] text-xs sm:text-sm text-slate-200 transition-colors min-h-[42px]"
                            >
                              <ExternalLink className="w-4 h-4 text-sky-400 shrink-0" />
                              <span>
                                {lang === Language.SI
                                  ? 'Google Drive / Cloud Link විවෘත කරන්න'
                                  : 'Open Cloud Script Link'}
                              </span>
                            </a>
                          )}
                        </div>

                        {/* Editorial Status & Notes Controls */}
                        <div className="pt-4 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                          <div className="sm:col-span-4">
                            <label className="block text-xs text-slate-400 mb-1.5">
                              {lang === Language.SI
                                ? 'ව්‍යාපෘති තත්ත්වය (Gallery Status)'
                                : 'Review & Gallery Status'}
                            </label>
                            <select
                              value={currentEdit.reviewStatus}
                              onChange={(e) =>
                                setDraftEdits((prev) => ({
                                  ...prev,
                                  [item.scriptId]: {
                                    ...currentEdit,
                                    reviewStatus: e.target.value as ReviewStatus,
                                  },
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg bg-[#0D121D] border border-white/10 text-xs sm:text-sm text-white focus:border-sky-400 focus:outline-none min-h-[40px]"
                            >
                              <option value="Pending Review">Pending Review (Under Review)</option>
                              <option value="Shortlisted">Shortlisted (Under Review)</option>
                              <option value="Pitch Deck Ready">Pitch Deck Ready (Featured)</option>
                              <option value="Archived">Archived (Hidden from Gallery)</option>
                            </select>
                          </div>

                          <div className="sm:col-span-6">
                            <label className="block text-xs text-slate-400 mb-1.5">
                              {lang === Language.SI
                                ? 'පුද්ගලික Admin සටහන් (Admin Notes)'
                                : 'Private Editorial Notes'}
                            </label>
                            <input
                              type="text"
                              value={currentEdit.adminNotes}
                              onChange={(e) =>
                                setDraftEdits((prev) => ({
                                  ...prev,
                                  [item.scriptId]: {
                                    ...currentEdit,
                                    adminNotes: e.target.value,
                                  },
                                }))
                              }
                              placeholder={
                                lang === Language.SI
                                  ? 'තේරීම් කමිටු සටහනක් එක් කරන්න...'
                                  : 'Add internal coverage notes...'
                              }
                              className="w-full px-3 py-2 rounded-lg bg-[#0D121D] border border-white/10 text-xs sm:text-sm text-white focus:border-sky-400 focus:outline-none min-h-[40px]"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <button
                              type="button"
                              disabled={savingId === item.scriptId}
                              onClick={() => handleSaveReview(item)}
                              className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors inline-flex items-center justify-center gap-1.5 min-h-[40px]"
                            >
                              {savedToastId === item.scriptId ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-300">
                                    {lang === Language.SI ? 'සුරැකිණි' : 'Saved'}
                                  </span>
                                </>
                              ) : savingId === item.scriptId ? (
                                <span>{lang === Language.SI ? 'සුරකිමින්...' : 'Saving...'}</span>
                              ) : (
                                <span>{lang === Language.SI ? 'සුරකින්න' : 'Save'}</span>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
