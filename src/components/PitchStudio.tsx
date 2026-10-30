import React, { useState } from 'react';
import { ArrowDown, Check, Copy, Download, Lock, Shield } from 'lucide-react';
import { Language, PitchDraft } from '../types';
import { PITCH_PRESETS, UI_COPY } from '../data/content';

interface PitchStudioProps {
  lang: Language;
  draft: PitchDraft;
  onChange: (next: PitchDraft) => void;
  onTransferToSubmission: (draft: PitchDraft) => void;
}

const GENRE_OPTIONS = [
  'Action Fantasy',
  'Sci-Fi Thriller',
  'Psychological Horror',
  'Noir Crime Drama',
  'Folk Horror',
  'Historical Siege Thriller',
];

const FORMAT_OPTIONS = [
  'Netflix Original Series',
  'Feature Film',
  'Mini-Series (6 Ep)',
  'International Co-Production Series',
];

const TONE_OPTIONS = [
  'Cold Cinematic, Cyberpunk Neon, Moody Fog',
  'Dark Earthy, Sinister Forest, High Contrast Shadows',
  'Sleek Urban Noir, Cold Rain, Muted Blue Tones',
  'Salt-Weathered Limestone, Candlelight Chiaroscuro, Storm-Lashed Ocean',
];

export const PitchStudio: React.FC<PitchStudioProps> = ({
  lang,
  draft,
  onChange,
  onTransferToSubmission,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const buildMarkdownSpec = (): string => {
    return [
      `# LANKAGLOBAL CONTENT HUB — PITCH BIBLE PREVIEW`,
      ``,
      `Working Title: ${draft.title || 'Untitled Project'}`,
      `Format: ${draft.format} (${draft.episodes})`,
      `Primary Genre: ${draft.genre}`,
      `Target Co-Production: Global OTT Pre-Sales / Co-Financed`,
      ``,
      `## Logline`,
      `"${draft.logline}"`,
      ``,
      `## Visual Aesthetics`,
      `${draft.visualTone}`,
      ``,
      `## Global Comparable Titles`,
      `${draft.comparables}`,
      ``,
      `## Protagonist Spine`,
      `${draft.protagonistArc}`,
      ``,
      `---`,
      `Prepared via LankaGlobal Content Hub · Mutual Evaluation NDA Framework`,
    ].join('\n');
  };

  const handleDownloadSpec = () => {
    const content = buildMarkdownSpec();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeSlug = (draft.title || 'pitch-deck-spec')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeSlug || 'lankaglobal-pitch'}-bible-spec.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 2400);
  };

  const handleCopySpec = async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdownSpec());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      handleDownloadSpec();
    }
  };

  return (
    <section id="builder" className="py-20 px-4 md:px-8 max-w-7xl mx-auto">
      <div className="glass-panel rounded-3xl p-6 md:p-12 border border-[#06b6d4]/20 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="max-w-3xl">
            <p className="text-xs font-bold text-[#38bdf8] tracking-wide mb-2">
              {UI_COPY.builder.kicker[lang]}
            </p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white">
              {UI_COPY.builder.heading[lang]}
            </h2>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              {UI_COPY.builder.description[lang]}
            </p>
          </div>

          {/* Preset Quick-Load Controls */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800 self-start lg:self-auto">
            {PITCH_PRESETS.map((preset) => {
              const isActive =
                draft.title.toLowerCase() === preset.draft.title.toLowerCase();
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onChange(preset.draft)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[36px] cursor-pointer ${
                    isActive
                      ? 'bg-[#06b6d4] text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Builder Input Controls */}
          <div className="lg:col-span-5 space-y-4 glass-card p-6 rounded-2xl">
            <div>
              <label
                htmlFor="studio-title"
                className="block text-xs font-semibold text-slate-300 mb-2"
              >
                {lang === Language.SI ? 'නිර්මාණයේ නම' : 'Project Title'}
              </label>
              <input
                id="studio-title"
                type="text"
                value={draft.title}
                onChange={(e) => onChange({ ...draft, title: e.target.value })}
                placeholder="THE LAST YAKSHA"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:border-[#38bdf8] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                {lang === Language.SI ? 'වර්ගය සහ ස්වභාවය' : 'Genre & Format'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  aria-label="Primary Genre"
                  value={
                    GENRE_OPTIONS.includes(draft.genre)
                      ? draft.genre
                      : GENRE_OPTIONS[0]
                  }
                  onChange={(e) => onChange({ ...draft, genre: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:border-[#38bdf8] focus:outline-none"
                >
                  {GENRE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Distribution Format"
                  value={
                    FORMAT_OPTIONS.includes(draft.format)
                      ? draft.format
                      : FORMAT_OPTIONS[0]
                  }
                  onChange={(e) => onChange({ ...draft, format: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:border-[#38bdf8] focus:outline-none"
                >
                  {FORMAT_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="studio-episodes"
                  className="block text-xs font-semibold text-slate-300 mb-2"
                >
                  {lang === Language.SI ? 'කොටස් ගණන / කාලය' : 'Runtime / Episodes'}
                </label>
                <input
                  id="studio-episodes"
                  type="text"
                  value={draft.episodes}
                  onChange={(e) => onChange({ ...draft, episodes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm font-mono tabular-nums focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="studio-comps"
                  className="block text-xs font-semibold text-slate-300 mb-2"
                >
                  {lang === Language.SI ? 'සමාන ජාත්‍යන්තර නිර්මාණ' : 'Comparable Titles'}
                </label>
                <input
                  id="studio-comps"
                  type="text"
                  value={draft.comparables}
                  onChange={(e) =>
                    onChange({ ...draft, comparables: e.target.value })
                  }
                  placeholder="Dark · Kingdom"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:border-[#38bdf8] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="studio-logline"
                className="block text-xs font-semibold text-slate-300 mb-2"
              >
                {lang === Language.SI
                  ? 'ප්‍රධාන සාරාංශය (Logline)'
                  : 'Logline / Hook'}
              </label>
              <textarea
                id="studio-logline"
                rows={3}
                value={draft.logline}
                onChange={(e) => onChange({ ...draft, logline: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm leading-relaxed focus:border-[#38bdf8] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="studio-tone"
                className="block text-xs font-semibold text-slate-300 mb-2"
              >
                {lang === Language.SI
                  ? 'දෘශ්‍ය පරිසරය (Visual Tone)'
                  : 'Visual Atmosphere'}
              </label>
              <select
                id="studio-tone"
                value={
                  TONE_OPTIONS.includes(draft.visualTone)
                    ? draft.visualTone
                    : TONE_OPTIONS[0]
                }
                onChange={(e) =>
                  onChange({ ...draft, visualTone: e.target.value })
                }
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:border-[#38bdf8] focus:outline-none"
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Pitch Deck Card Preview */}
          <div className="lg:col-span-7">
            <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-[#38bdf8]/30 relative shadow-2xl bg-gradient-to-b from-slate-900/90 to-slate-950">
              {/* Top Header Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800/90 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#38bdf8]">
                  <Shield className="w-3.5 h-3.5" />
                  <span>LankaGlobal Pitch Bible Preview</span>
                </span>
                <span className="font-mono tabular-nums text-slate-400">
                  {draft.episodes || '8 × 50 min'}
                </span>
              </div>

              <div className="mb-6 pt-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-[#06b6d4] tracking-wider">
                    {draft.format}
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="text-slate-300 font-medium">{draft.genre}</span>
                </div>

                <h3 className="text-3xl sm:text-4xl font-extrabold mt-2 tracking-tight gradient-text">
                  {draft.title.trim() || 'TITLE'}
                </h3>
              </div>

              <div className="space-y-4 text-sm border-t border-slate-800 pt-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-400">
                    {lang === Language.SI ? 'Logline සාරාංශය' : 'Logline'}
                  </h4>
                  <p className="text-slate-200 leading-relaxed mt-1.5 italic font-serif text-lg sm:text-xl">
                    “
                    {draft.logline.trim() ||
                      'Type your core conflict, protagonist, and hook on the left to preview your formatted pitch logline.'}
                    ”
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400">
                      {lang === Language.SI
                        ? 'දෘශ්‍ය ශෛලිය (Visual Aesthetics)'
                        : 'Visual Aesthetics'}
                    </h4>
                    <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                      {draft.visualTone}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400">
                      {lang === Language.SI
                        ? 'ඉලක්කගත සම-නිෂ්පාදන මාදිලිය'
                        : 'Target Co-Production'}
                    </h4>
                    <p className="text-emerald-400 text-xs mt-1 font-semibold">
                      Global OTT Pre-Sales / Co-Financed
                    </p>
                    {draft.comparables && (
                      <p className="text-slate-400 text-xs mt-0.5">
                        {draft.comparables}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>
                    {lang === Language.SI
                      ? 'NDA බුද්ධිමය දේපළ ආරක්ෂණ ආකෘතිය'
                      : 'Encrypted IP Protection Standard'}
                  </span>
                </span>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCopySpec}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copied
                        ? lang === Language.SI
                          ? 'පිටපත් විය'
                          : 'Copied'
                        : lang === Language.SI
                          ? 'පිටපත් කරන්න'
                          : 'Copy Spec'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSpec}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#38bdf8]/20 hover:bg-[#38bdf8]/30 text-[#38bdf8] text-xs font-bold transition-colors whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
                  >
                    {downloaded ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {downloaded
                        ? lang === Language.SI
                          ? 'බාගත විය'
                          : 'Downloaded'
                        : lang === Language.SI
                          ? 'Deck Spec බාගන්න'
                          : 'Download Deck Spec'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onTransferToSubmission(draft)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white text-xs font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
                  >
                    <span>
                      {lang === Language.SI
                        ? 'අයදුම්පතට යවන්න'
                        : 'Use in Submission'}
                    </span>
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
