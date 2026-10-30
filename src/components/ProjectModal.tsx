import React, { useEffect } from 'react';
import { ArrowUpRight, Handshake, User as UserIcon, X } from 'lucide-react';
import { Language, PipelineProject, PitchDraft } from '../types';
import { CinemaKeyArt } from './CinemaKeyArt';

interface ProjectModalProps {
  project: PipelineProject | null;
  lang: Language;
  onClose: () => void;
  onLoadIntoStudio: (draft: PitchDraft) => void;
  onInspectCreator: (
    uid: string,
    fallbackName?: string,
    connectScript?: { id: string; title: string } | null
  ) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  project,
  lang,
  onClose,
  onLoadIntoStudio,
  onInspectCreator,
}) => {
  useEffect(() => {
    if (!project) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, onClose]);

  if (!project) return null;

  const handleOpenInBuilder = () => {
    onLoadIntoStudio({
      title: project.title,
      genre: project.genre,
      format: project.format,
      episodes: project.episodesOrRuntime,
      logline: project.logline[lang],
      visualTone: project.visualTone,
      comparables: project.comparables,
      protagonistArc:
        lang === Language.SI
          ? 'ජාත්‍යන්තර OTT ප්‍රේක්ෂකයින් උදෙසා සකස් කළ ප්‍රධාන චරිත ගමන්මඟ'
          : 'High-stakes character arc structured for international streaming retention',
    });
    onClose();
    const el = document.getElementById('builder');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-project-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl glass-panel border border-white/[0.12] overflow-hidden my-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[16/8] bg-[#060911] overflow-hidden border-b border-white/[0.08]">
          <CinemaKeyArt
            variant={project.keyArt}
            title={project.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D121D] via-[#0D121D]/35 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close project details"
            className="absolute top-4 right-4 w-10 h-10 rounded-lg bg-black/70 hover:bg-black text-slate-200 hover:text-white flex items-center justify-center border border-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-5 left-6 right-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-400 font-medium">
              <span>{project.genre}</span>
              <span aria-hidden="true">·</span>
              <span>{project.format}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {lang === Language.SI
                  ? `නැරඹුම් ${project.views ?? 0}`
                  : `${project.views ?? 0} views`}
              </span>
            </div>
            <h3 id="modal-project-title" className="text-2xl sm:text-3xl font-bold text-white mt-1">
              {project.title}
            </h3>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1.5">
              {lang === Language.SI ? 'කතාවේ මූලික සාරාංශය (Logline)' : 'Series Logline'}
            </p>
            <p className="font-serif italic text-lg sm:text-xl text-white leading-relaxed">
              “{project.logline[lang]}”
            </p>
          </div>

          <div className="pt-5 border-t border-white/[0.08]">
            <p className="text-xs font-medium text-slate-400 mb-2">
              {lang === Language.SI ? 'විස්තරාත්මක කතා සැලැස්ම (Synopsis)' : 'Development Synopsis'}
            </p>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {project.synopsis[lang]}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-5 border-t border-white/[0.08] text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-1">
                {lang === Language.SI ? 'තිර රචනය' : 'Screenwriter'}
              </p>
              {project.authorUid ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onInspectCreator(project.authorUid!, project.writer);
                  }}
                  className="text-white hover:text-[#38bdf8] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>{project.writer}</span>
                </button>
              ) : (
                <p className="text-white font-medium">{project.writer}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">
                {lang === Language.SI ? 'සමාන ජාත්‍යන්තර නිර්මාණ' : 'Global Tonal Comps'}
              </p>
              <p className="text-slate-200">{project.comparables}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">
                {lang === Language.SI ? 'ඉලක්කගත මූල්‍ය ආකෘතිය' : 'Target Deal Structure'}
              </p>
              <p className="text-slate-200">{project.targetModel}</p>
            </div>
          </div>

          <div className="pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              {lang === Language.SI ? 'දෘශ්‍ය ශෛලිය: ' : 'Visual Direction: '}
              <span className="text-slate-200">{project.visualTone}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {project.authorUid && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onInspectCreator(project.authorUid!, project.writer, {
                      id: project.id,
                      title: project.title,
                    });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#38bdf8]/40 bg-[#38bdf8]/12 hover:bg-[#38bdf8]/20 text-[#38bdf8] font-semibold text-xs transition-all whitespace-nowrap shrink-0 min-h-[40px] cursor-pointer"
                >
                  <Handshake className="w-4 h-4" />
                  <span>
                    {lang === Language.SI
                      ? 'මෙම කතාව ගැන සම්බන්ධ වන්න'
                      : 'Connect About This Story'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenInBuilder}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] hover:shadow-lg hover:shadow-cyan-500/25 text-white font-semibold text-xs transition-all whitespace-nowrap shrink-0 min-h-[40px] cursor-pointer"
              >
                <span>
                  {lang === Language.SI ? 'Pitch Deck සාදන්නාට ගන්න' : 'Load in Pitch Builder'}
                </span>
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-white/15 hover:bg-white/[0.06] text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[40px] cursor-pointer"
              >
                {lang === Language.SI ? 'වසන්න' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
