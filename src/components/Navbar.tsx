import React, { useState } from 'react';
import {
  Film,
  Globe,
  LogIn,
  Menu,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { AppPage, Language } from '../types';
import { UI_COPY } from '../data/content';

interface NavbarProps {
  lang: Language;
  activePage: AppPage;
  isSignedIn: boolean;
  memberDisplayName: string;
  userIsAdmin: boolean;
  activeScriptsCount: number;
  pendingInquiriesCount: number;
  onLanguageChange: (nextLang: Language) => void;
  onNavigateStudio: (sectionId?: string) => void;
  onOpenCommunityPage: () => void;
  onOpenAccount: () => void;
  onOpenMyProfile: () => void;
  onOpenAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  lang,
  activePage,
  isSignedIn,
  memberDisplayName,
  userIsAdmin,
  activeScriptsCount,
  pendingInquiriesCount,
  onLanguageChange,
  onNavigateStudio,
  onOpenCommunityPage,
  onOpenAccount,
  onOpenMyProfile,
  onOpenAdmin,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const studioSectionLinks = [
    { sectionId: 'how-it-works', label: UI_COPY.nav.howItWorks[lang] },
    { sectionId: 'pipeline', label: UI_COPY.nav.pipeline[lang] },
    { sectionId: 'submit', label: UI_COPY.nav.submit[lang] },
  ];

  const handleToggleLanguage = () => {
    onLanguageChange(lang === Language.SI ? Language.EN : Language.SI);
  };

  return (
    <header className="relative z-50 w-full glass-panel border-b border-white/10 px-3 sm:px-4 xl:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5 lg:gap-3 xl:gap-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigateStudio()}
          className="flex items-center gap-2.5 xl:gap-3 group whitespace-nowrap shrink-0 cursor-pointer text-left"
        >
          <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-xl bg-gradient-to-tr from-[#06b6d4] to-[#4f46e5] flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform duration-150">
            <Film className="w-4 h-4 xl:w-5 xl:h-5" />
          </div>
          <span className="font-display text-lg xl:text-xl font-extrabold tracking-wide xl:tracking-wider text-white">
            LANKA<span className="text-[#38bdf8]">GLOBAL</span>
          </span>
        </button>

        {/* Zone 2: Primary Navigation (Clean Typography Links) */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-3.5 xl:gap-6 text-xs xl:text-sm font-medium text-slate-300 min-w-0"
        >
          {studioSectionLinks.map((item) => (
            <button
              key={item.sectionId}
              type="button"
              onClick={() => onNavigateStudio(item.sectionId)}
              className="hover:text-[#38bdf8] transition-colors duration-150 whitespace-nowrap shrink-0 py-1.5 border-b-2 border-transparent cursor-pointer"
            >
              {item.label}
            </button>
          ))}

          <button
            type="button"
            onClick={onOpenCommunityPage}
            className={`transition-colors duration-150 whitespace-nowrap shrink-0 py-1.5 border-b-2 cursor-pointer ${
              activePage === 'community'
                ? 'text-[#38bdf8] border-[#38bdf8] font-semibold'
                : 'border-transparent hover:text-[#38bdf8]'
            }`}
          >
            {UI_COPY.nav.community[lang]}
          </button>
        </nav>

        {/* Zone 3: Language Switcher + Admin Vault (Admin Only) + Profile / Register CTA */}
        <div className="flex items-center gap-2 xl:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleToggleLanguage}
            aria-label="Switch interface language"
            className="px-2.5 xl:px-3 py-2 rounded-lg glass-card text-xs font-semibold text-slate-200 hover:border-[#38bdf8] inline-flex items-center gap-1.5 xl:gap-2 transition-colors whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
            <span>{lang === Language.SI ? 'SI / EN' : 'EN / SI'}</span>
          </button>

          {userIsAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 xl:px-3.5 py-2 rounded-xl border border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#38bdf8] hover:bg-[#38bdf8]/20 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[38px] xl:min-h-[40px] cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono tabular-nums">Admin ({activeScriptsCount})</span>
            </button>
          )}

          {isSignedIn ? (
            <button
              type="button"
              onClick={onOpenMyProfile}
              className="hidden sm:inline-flex items-center justify-center gap-2 px-3.5 xl:px-5 py-2 xl:py-2.5 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white font-semibold text-xs tracking-wide hover:shadow-lg hover:shadow-cyan-500/30 transition-all duration-150 hover:-translate-y-0.5 max-w-[170px] xl:max-w-[230px] whitespace-nowrap shrink-0 min-h-[38px] xl:min-h-[40px] cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{memberDisplayName}</span>
              {pendingInquiriesCount > 0 && (
                <span className="font-mono tabular-nums text-[11px] bg-black/40 px-1.5 py-0.5 rounded-md shrink-0">
                  {pendingInquiriesCount}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAccount}
              className="hidden sm:inline-flex items-center justify-center gap-2 px-3.5 xl:px-5 py-2 xl:py-2.5 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white font-semibold text-xs tracking-wide hover:shadow-lg hover:shadow-cyan-500/30 transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0 min-h-[38px] xl:min-h-[40px] cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span>
                {lang === Language.SI ? 'ලියාපදිංචි වන්න / Login' : 'Register / Login'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/15 text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0 cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileOpen && (
        <div className="lg:hidden mt-3 pt-3 border-t border-slate-800 space-y-2 px-2">

          {studioSectionLinks.map((item) => (
            <button
              key={item.sectionId}
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onNavigateStudio(item.sectionId);
              }}
              className="block w-full text-left text-slate-300 hover:text-[#38bdf8] py-1.5 text-sm font-medium transition-colors cursor-pointer"
            >
              {item.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onOpenCommunityPage();
            }}
            className={`block w-full text-left py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              activePage === 'community'
                ? 'text-[#38bdf8] font-semibold'
                : 'text-slate-300 hover:text-[#38bdf8]'
            }`}
          >
            {UI_COPY.nav.community[lang]}
          </button>

          {userIsAdmin && (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenAdmin();
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#38bdf8] font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {lang === Language.SI
                  ? `Admin පුවරුව (${activeScriptsCount})`
                  : `Admin Vault (${activeScriptsCount})`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              if (isSignedIn) {
                onOpenMyProfile();
              } else {
                onOpenAccount();
              }
            }}
            className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#4f46e5] text-white font-semibold text-sm transition-all cursor-pointer"
          >
            {isSignedIn ? (
              <>
                <UserIcon className="w-4 h-4" />
                <span className="truncate">{memberDisplayName}</span>
                {pendingInquiriesCount > 0 && (
                  <span className="font-mono tabular-nums text-xs bg-black/40 px-1.5 py-0.5 rounded-md">
                    {pendingInquiriesCount}
                  </span>
                )}
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>
                  {lang === Language.SI
                    ? 'ලියාපදිංචි වන්න / Login'
                    : 'Register / Login'}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </header>
  );
};
