import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  FileText,
  Lock,
  Send,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { UI_COPY } from '../data/content';
import {
  MAX_UPLOAD_BYTES,
  ensureOrRegisterUserProfile,
  parseFirebaseAuthError,
  signInWithGooglePopup,
  submitScreenplayToCloud,
} from '../firebase';
import {
  Language,
  PipelineProject,
  SubmissionFormData,
  UserProfileRecord,
} from '../types';

interface SubmissionSectionProps {
  lang: Language;
  currentUser: User | null;
  userProfile: UserProfileRecord | null;
  prefill: Partial<SubmissionFormData> | null;
  onOpenAccountModal: () => void;
  onProjectSubmitted: (newProject: PipelineProject) => void;
}

const INITIAL_FORM: SubmissionFormData = {
  writerName: '',
  email: '',
  phone: '',
  genre: '',
  workingTitle: '',
  format: 'OTT Web Series',
  logline: '',
  scriptUrl: '',
  scriptFileName: '',
  ipConfirmed: false,
};

export const SubmissionSection: React.FC<SubmissionSectionProps> = ({
  lang,
  currentUser,
  userProfile,
  prefill,
  onOpenAccountModal,
  onProjectSubmitted,
}) => {
  const [form, setForm] = useState<SubmissionFormData>(INITIAL_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSizeLabel, setFileSizeLabel] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [submitError, setSubmitError] = useState<string>('');
  const [errors, setErrors] = useState<
    Partial<Record<keyof SubmissionFormData, string>>
  >({});
  const [receiptModal, setReceiptModal] = useState<{
    referenceId: string;
    title: string;
    email: string;
    fileName: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const preferredName =
      userProfile?.displayName || currentUser.displayName || '';
    setForm((prev) => ({
      ...prev,
      writerName: prev.writerName || preferredName,
      email: prev.email || currentUser.email || '',
    }));
  }, [currentUser, userProfile]);

  useEffect(() => {
    if (!prefill) return;
    setForm((prev) => ({
      ...prev,
      workingTitle: prefill.workingTitle ?? prev.workingTitle,
      genre: prefill.genre ?? prev.genre,
      format: prefill.format ?? prev.format,
      logline: prefill.logline ?? prev.logline,
    }));
  }, [prefill]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setErrors((prev) => ({
        ...prev,
        scriptUrl:
          lang === Language.SI
            ? 'ගොනුවේ උපරිම ප්‍රමාණය 10 MB විය යුතුය. ඊට වැඩි නම් Google Drive Link එකක් එක් කරන්න.'
            : 'Maximum direct file size is 10 MB. For larger files, paste a Google Drive or Dropbox link.',
      }));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const kb = Math.max(1, Math.round(file.size / 1024));
    const sizeText = kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${kb} KB`;
    setSelectedFile(file);
    setForm((prev) => ({ ...prev, scriptFileName: file.name }));
    setFileSizeLabel(sizeText);
    setErrors((prev) => ({ ...prev, scriptUrl: undefined }));
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setForm((prev) => ({ ...prev, scriptFileName: '' }));
    setFileSizeLabel('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof SubmissionFormData, string>> = {};
    const trimmedWriter = form.writerName.trim();
    const trimmedEmail = form.email.trim();
    const trimmedPhone = form.phone.trim();
    const trimmedTitle = form.workingTitle.trim();
    const trimmedLogline = form.logline.trim();
    const trimmedUrl = form.scriptUrl.trim();

    if (trimmedWriter.length < 2 || trimmedWriter.length > 100) {
      nextErrors.writerName =
        lang === Language.SI
          ? 'කරුණාකර රචකයාගේ නම ඇතුළත් කරන්න (අකුරු 2–100).'
          : 'Please enter the writer or creator name (2–100 characters).';
    }
    if (
      trimmedEmail.length < 3 ||
      trimmedEmail.length > 160 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
    ) {
      nextErrors.email =
        lang === Language.SI
          ? 'වලංගු විද්‍යුත් තැපැල් ලිපිනයක් ඇතුළත් කරන්න.'
          : 'Enter a valid email address.';
    }
    if (
      trimmedPhone.length < 7 ||
      trimmedPhone.length > 40 ||
      !/^[+\d][\d\s()-]{6,39}$/.test(trimmedPhone)
    ) {
      nextErrors.phone =
        lang === Language.SI
          ? 'වලංගු දුරකථන හෝ WhatsApp අංකයක් ඇතුළත් කරන්න.'
          : 'Enter a valid phone or WhatsApp number.';
    }
    if (!form.genre) {
      nextErrors.genre =
        lang === Language.SI
          ? 'කරුණාකර කතාවේ වර්ගය තෝරන්න.'
          : 'Select a primary genre.';
    }
    if (!trimmedTitle || trimmedTitle.length > 140) {
      nextErrors.workingTitle =
        lang === Language.SI
          ? 'කතාවේ නම ඇතුළත් කරන්න (උපරිම අකුරු 140).'
          : 'Enter your project working title (max 140 chars).';
    }
    if (trimmedLogline.length < 20 || trimmedLogline.length > 1000) {
      nextErrors.logline =
        lang === Language.SI
          ? 'කතාවේ සාරාංශය අකුරු 20 ත් 1000 ත් අතර විය යුතුය.'
          : 'Provide a concise 2–3 sentence logline (20–1000 characters).';
    }

    const hasFile = Boolean(selectedFile && form.scriptFileName.trim());
    const hasUrl = Boolean(trimmedUrl);

    if (!hasFile && !hasUrl) {
      nextErrors.scriptUrl =
        lang === Language.SI
          ? 'කරුණාකර තිරපිටපත් ගොනුවක් (PDF/DOCX/TXT) Upload කරන්න හෝ Google Drive / Dropbox Link එකක් ඇතුළත් කරන්න.'
          : 'Please upload a script file (PDF/DOCX/TXT) or provide a Google Drive / Dropbox link.';
    } else if (hasUrl) {
      if (trimmedUrl.length > 500) {
        nextErrors.scriptUrl =
          lang === Language.SI
            ? 'සබැඳිය දිග වැඩිය.'
            : 'Cloud link must be under 500 characters.';
      } else {
        try {
          const parsed = new URL(trimmedUrl);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            nextErrors.scriptUrl =
              lang === Language.SI
                ? 'https:// සහිත වලංගු සබැඳියක් යොදන්න.'
                : 'Provide a valid https:// script or deck link.';
          }
        } catch {
          nextErrors.scriptUrl =
            lang === Language.SI
              ? 'Google Drive හෝ Dropbox සබැඳිය නිවැරදිව ඇතුළත් කරන්න.'
              : 'Enter a valid URL (e.g. https://drive.google.com/...).';
        }
      }
    }

    if (!form.ipConfirmed) {
      nextErrors.ipConfirmed =
        lang === Language.SI
          ? 'බුද්ධිමය දේපළ හිමිකම තහවුරු කිරීම අනිවාර්ය වේ.'
          : 'You must confirm sole intellectual property ownership.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    setUploadPercent(0);
    setSubmitError('');

    let activeUser = currentUser;
    if (!activeUser) {
      try {
        activeUser = await signInWithGooglePopup({
          displayName: form.writerName.trim() || undefined,
        });
      } catch (authErr) {
        const parsed = parseFirebaseAuthError(authErr, lang);
        setSubmitting(false);
        setSubmitError(parsed.message);
        return;
      }

      try {
        await ensureOrRegisterUserProfile(activeUser, form.writerName);
      } catch {
        // Proceed with screenplay submission using authenticated user
      }
    }

    const randomCode = Math.floor(100000 + Math.random() * 900000);
    const referenceId = `LG-${randomCode}`;

    try {
      const createdProject = await submitScreenplayToCloud({
        user: activeUser,
        referenceId,
        writerName: form.writerName,
        email: form.email,
        phone: form.phone,
        genre: form.genre,
        workingTitle: form.workingTitle,
        format: form.format,
        logline: form.logline,
        scriptUrl: form.scriptUrl,
        file: selectedFile,
        onProgress: (pct) => setUploadPercent(pct),
      });

      onProjectSubmitted(createdProject);

      setReceiptModal({
        referenceId,
        title: form.workingTitle.trim(),
        email: form.email.trim(),
        fileName: selectedFile ? selectedFile.name : '',
      });

      setForm({
        ...INITIAL_FORM,
        writerName: userProfile?.displayName || activeUser.displayName || '',
        email: activeUser.email || '',
      });
      setSelectedFile(null);
      setFileSizeLabel('');
      setUploadPercent(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setErrors({});
    } catch (err) {
      let msg =
        lang === Language.SI
          ? 'තිරපිටපත Upload කිරීමේදී දෝෂයක් ඇති විය. කරුණාකර නැවත උත්සාහ කරන්න.'
          : 'Failed to upload screenplay. Please try again.';
      if (err instanceof Error && err.message.includes('Quota exceeded')) {
        msg =
          lang === Language.SI
            ? 'දෛනික Database සීමාව ඉක්මවා ඇත (Quota exceeded). හෙට දින නැවත සක්‍රීය වේ.'
            : 'Daily Cloud Firestore free quota exceeded. Quota resets tomorrow.';
      }
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="submit" className="py-20 px-4 md:px-8 max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <p className="text-xs font-bold text-[#38bdf8] tracking-wide mb-2">
          {UI_COPY.submit.kicker[lang]}
        </p>
        <h2 className="text-3xl md:text-5xl font-extrabold text-white mt-2">
          {UI_COPY.submit.heading[lang]}
        </h2>
        <p className="text-slate-400 text-sm mt-3 max-w-xl mx-auto leading-relaxed">
          {UI_COPY.submit.description[lang]}
        </p>
      </div>

      {/* Form Container */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="glass-panel p-6 md:p-10 rounded-3xl border border-white/10 space-y-6 shadow-2xl"
      >
        {/* Member Account Status Bar */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {currentUser ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldCheck className="w-4 h-4 text-[#38bdf8] shrink-0" />
                <span className="text-xs text-slate-200 truncate">
                  {lang === Language.SI
                    ? `පිවිස සිටින ගිණුම: ${userProfile?.displayName || currentUser.displayName || currentUser.email}`
                    : `Signed in as: ${userProfile?.displayName || currentUser.displayName || currentUser.email}`}
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenAccountModal}
                className="text-xs font-semibold text-[#38bdf8] hover:underline self-start sm:self-auto shrink-0 cursor-pointer"
              >
                {lang === Language.SI ? 'ගිණුම කළමනාකරණය' : 'Manage Account'}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-[#38bdf8] shrink-0" />
                <span className="text-xs text-slate-300 leading-relaxed">
                  {lang === Language.SI
                    ? 'NDA හිමිකම යටතේ තිරපිටපත Upload කිරීමට ඔබේ ගිණුමට පිවිසෙන්න හෝ ලියාපදිංචි වන්න.'
                    : 'Sign in or register a creator account to upload your screenplay under NDA protection.'}
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenAccountModal}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white text-xs font-semibold transition-all whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
              >
                {lang === Language.SI
                  ? 'ලියාපදිංචි වන්න / Login'
                  : 'Register / Login'}
              </button>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Creator Name */}
          <div>
            <label
              htmlFor="sub-writer"
              className="block text-xs font-semibold text-slate-300 mb-2"
            >
              {lang === Language.SI
                ? 'ඔබේ නම / රචකයාගේ නම *'
                : 'Creator / Writer Name *'}
            </label>
            <input
              id="sub-writer"
              type="text"
              maxLength={100}
              value={form.writerName}
              onChange={(e) => setForm({ ...form, writerName: e.target.value })}
              placeholder="e.g. Kasun Kalhara"
              className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:border-[#38bdf8] focus:outline-none"
            />
            {errors.writerName && (
              <p className="text-xs text-rose-400 mt-1.5">{errors.writerName}</p>
            )}
          </div>

          {/* Email Address */}
          <div>
            <label
              htmlFor="sub-email"
              className="block text-xs font-semibold text-slate-300 mb-2"
            >
              {lang === Language.SI
                ? 'විද්‍යුත් තැපෑල (Email) *'
                : 'Email Address *'}
            </label>
            <input
              id="sub-email"
              type="email"
              maxLength={160}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="creator@example.com"
              className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:border-[#38bdf8] focus:outline-none"
            />
            {errors.email && (
              <p className="text-xs text-rose-400 mt-1.5">{errors.email}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Number */}
          <div>
            <label
              htmlFor="sub-phone"
              className="block text-xs font-semibold text-slate-300 mb-2"
            >
              {lang === Language.SI
                ? 'දුරකථන අංකය *'
                : 'Phone / WhatsApp Number *'}
            </label>
            <input
              id="sub-phone"
              type="tel"
              maxLength={40}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+94 7X XXX XXXX"
              className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm font-mono tabular-nums focus:border-[#38bdf8] focus:outline-none"
            />
            {errors.phone && (
              <p className="text-xs text-rose-400 mt-1.5">{errors.phone}</p>
            )}
          </div>

          {/* Genre Selection */}
          <div>
            <label
              htmlFor="sub-genre"
              className="block text-xs font-semibold text-slate-300 mb-2"
            >
              {lang === Language.SI
                ? 'කතාවේ වර්ගය (Genre) *'
                : 'Primary Genre *'}
            </label>
            <select
              id="sub-genre"
              value={form.genre}
              onChange={(e) => setForm({ ...form, genre: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:border-[#38bdf8] focus:outline-none"
            >
              <option value="">
                {lang === Language.SI ? 'Select Genre...' : 'Select Genre...'}
              </option>
              <option value="Sci-Fi Thriller">Sci-Fi / Futuristic</option>
              <option value="Noir Crime Drama">
                Psychological / Crime Thriller
              </option>
              <option value="Action Fantasy">Mythological / Fantasy</option>
              <option value="High-Concept Drama">High-Concept Drama</option>
              <option value="Folk Horror">Folk Horror / Supernatural</option>
              <option value="Historical Siege Thriller">
                Historical / Period Drama
              </option>
            </select>
            {errors.genre && (
              <p className="text-xs text-rose-400 mt-1.5">{errors.genre}</p>
            )}
          </div>
        </div>

        {/* Story Title & Format */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label
              htmlFor="sub-title"
              className="block text-xs font-semibold text-slate-300 mb-2"
            >
              {lang === Language.SI ? 'කතාවේ නම *' : 'Working Title *'}
            </label>
            <input
              id="sub-title"
              type="text"
              maxLength={140}
              value={form.workingTitle}
              onChange={(e) =>
                setForm({ ...form, workingTitle: e.target.value })
              }
              placeholder="Project Working Title"
              className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:border-[#38bdf8] focus:outline-none"
            />
            {errors.workingTitle && (
              <p className="text-xs text-rose-400 mt-1.5">
                {errors.workingTitle}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="sub-format"
              className="block text-xs font-semibold text-slate-300 mb-2"
            >
              {lang === Language.SI ? 'ආකෘතිය *' : 'Format *'}
            </label>
            <select
              id="sub-format"
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:border-[#38bdf8] focus:outline-none"
            >
              <option value="OTT Web Series">OTT Web Series</option>
              <option value="Original Series">Netflix Original Series</option>
              <option value="Feature Film">Feature Film</option>
              <option value="Limited Series">Limited Mini-Series</option>
            </select>
          </div>
        </div>

        {/* Logline */}
        <div>
          <label
            htmlFor="sub-logline"
            className="block text-xs font-semibold text-slate-300 mb-2"
          >
            {lang === Language.SI
              ? 'කතාවේ කෙටි සාරාංශය (Logline) *'
              : 'Logline / Story Summary (Max 3 Lines) *'}
          </label>
          <textarea
            id="sub-logline"
            rows={3}
            maxLength={1000}
            value={form.logline}
            onChange={(e) => setForm({ ...form, logline: e.target.value })}
            placeholder="Explain the main conflict, protagonist, and hook in 2-3 sentences..."
            className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm leading-relaxed focus:border-[#38bdf8] focus:outline-none"
          />
          {errors.logline && (
            <p className="text-xs text-rose-400 mt-1.5">{errors.logline}</p>
          )}
        </div>

        {/* Confidential File Upload + Google Drive / Dropbox Link */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              {lang === Language.SI
                ? 'තිරපිටපත් ගොනුව Upload කරන්න (PDF / DOCX / TXT — උපරිම 10 MB) හෝ පහතින් Link එකක් එක් කරන්න *'
                : 'Upload Screenplay File (PDF / DOCX / TXT — up to 10 MB) or Provide Script Link Below *'}
            </label>

            <input
              ref={fileInputRef}
              id="sub-file"
              type="file"
              accept=".pdf,.doc,.docx,.txt,.fountain"
              onChange={handleFileChange}
              className="sr-only"
            />

            {!form.scriptFileName ? (
              <label
                htmlFor="sub-file"
                className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl bg-slate-900/90 border border-dashed border-slate-600 hover:border-[#38bdf8] cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2.5 text-sm text-slate-300">
                  <Upload className="w-4 h-4 text-[#38bdf8] shrink-0" />
                  <span>
                    {lang === Language.SI
                      ? 'තිරපිටපත් ගොනුව තෝරන්න (PDF, DOCX, TXT — NDA රහස්‍යභාවය සහිතයි)'
                      : 'Choose screenplay file (stored confidentially under NDA)'}
                  </span>
                </span>
                <span className="text-xs font-semibold text-[#38bdf8] whitespace-nowrap shrink-0">
                  {lang === Language.SI ? 'ගොනුව තෝරන්න' : 'Browse'}
                </span>
              </label>
            ) : (
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900/90 border border-[#38bdf8]/40">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-[#38bdf8] shrink-0" />
                  <span className="text-sm text-white truncate">
                    {form.scriptFileName}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                    ({fileSizeLabel})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedFile}
                  aria-label="Remove uploaded file"
                  className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="sub-url"
              className="block text-xs font-semibold text-slate-300 mb-2"
            >
              {lang === Language.SI
                ? 'ලිපිගොනුවේ Link එක (PDF / Script Drive Link)'
                : 'Full Script Link or Pitch Deck PDF (Google Drive / Dropbox)'}
            </label>
            <input
              id="sub-url"
              type="url"
              maxLength={500}
              value={form.scriptUrl}
              onChange={(e) => setForm({ ...form, scriptUrl: e.target.value })}
              placeholder="https://drive.google.com/file/d/..."
              className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:border-[#38bdf8] focus:outline-none"
            />
          </div>

          {errors.scriptUrl && (
            <p className="text-xs text-rose-400">{errors.scriptUrl}</p>
          )}
        </div>

        {/* Copyright Checkbox */}
        <div className="pt-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ipConfirmed}
              onChange={(e) =>
                setForm({ ...form, ipConfirmed: e.target.checked })
              }
              className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 accent-[#06b6d4]"
            />
            <span className="text-xs text-slate-400 leading-relaxed">
              {lang === Language.SI
                ? 'මෙම නිර්මාණයේ පූර්ණ බුද්ධිමය අයිතිය මා සතු බවත්, LankaGlobal Content Hub හි නීතිමය කොන්දේසිවලට එකඟ වන බවත් සහතික කරමි.'
                : 'I confirm that I am the sole owner of this intellectual property (IP). I agree to LankaGlobal Content Hub terms for evaluation and pitch deck packaging.'}
            </span>
          </label>
          {errors.ipConfirmed && (
            <p className="text-xs text-rose-400 mt-1.5">{errors.ipConfirmed}</p>
          )}
        </div>

        {submitError && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-xs text-rose-300">
            {submitError}
          </div>
        )}

        {submitting && uploadPercent > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[#38bdf8] font-mono tabular-nums">
              <span>
                {lang === Language.SI
                  ? 'ආරක්ෂිතව තැන්පත් වෙමින් පවතී...'
                  : 'Uploading to encrypted NDA vault...'}
              </span>
              <span>{uploadPercent}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] transition-all duration-150"
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] disabled:opacity-60 text-white font-bold text-sm tracking-wide hover:shadow-xl hover:shadow-cyan-500/35 transition-all duration-150 hover:-translate-y-0.5 flex items-center justify-center gap-2.5 min-h-[50px] cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>
            {submitting
              ? lang === Language.SI
                ? 'ආරක්ෂිතව Upload කරමින් පවතී...'
                : 'Uploading Screenplay...'
              : lang === Language.SI
                ? 'තිරපිටපත නිල වශයෙන් යොමු කරන්න'
                : 'Submit Script Concept to Hub'}
          </span>
        </button>
      </form>

      {/* SUCCESS MODAL POPUP */}
      {receiptModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submission-receipt-heading"
          onClick={() => setReceiptModal(null)}
        >
          <div
            className="glass-panel p-8 rounded-3xl max-w-md w-full text-center border border-[#38bdf8]/40 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-[#38bdf8]/20 border border-[#38bdf8] flex items-center justify-center text-[#38bdf8] mx-auto mb-4">
              <Check className="w-8 h-8" />
            </div>

            <h3
              id="submission-receipt-heading"
              className="text-2xl font-bold text-white mb-2"
            >
              {lang === Language.SI
                ? 'අයදුම්පත සාර්ථකව ලැබුණි!'
                : 'Submission Received!'}
            </h3>

            <p className="text-xs font-mono tabular-nums text-[#38bdf8] mb-3">
              NDA Ref: {receiptModal.referenceId}
            </p>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
              {lang === Language.SI
                ? `"${receiptModal.title}" ඔබේ කතාව ආරක්ෂිතව පද්ධතියට එක් විය. අපගේ මණ්ඩලය විසින් පිටපත පරීක්ෂා කර දින 14ක් ඇතුළත ${receiptModal.email} විද්‍යුත් තැපෑල මගින් ඔබව සම්බන්ධ කර ගනු ඇත.`
                : `Your concept "${receiptModal.title}" has been safely logged under automated IP Protection. Our creative team will review your script and contact you at ${receiptModal.email} within 14 business days.`}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="#pipeline"
                onClick={() => setReceiptModal(null)}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white font-bold text-xs tracking-wide flex items-center justify-center min-h-[42px]"
              >
                {lang === Language.SI
                  ? 'නිර්මාණ ලැයිස්තුව බලන්න'
                  : 'View Pipeline'}
              </a>
              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                className="flex-1 py-3 px-4 rounded-xl bg-[#06b6d4] text-slate-950 font-bold text-xs tracking-wider hover:bg-[#38bdf8] transition-colors min-h-[42px] cursor-pointer"
              >
                OK / තහවුරුයි
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
