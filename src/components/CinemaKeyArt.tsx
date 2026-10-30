import React from 'react';
import { KeyArtVariant } from '../types';

interface CinemaKeyArtProps {
  variant: KeyArtVariant;
  className?: string;
  title?: string;
}

export const CinemaKeyArt: React.FC<CinemaKeyArtProps> = ({
  variant,
  className = 'w-full h-full',
  title = 'Key Art',
}) => {
  if (variant === 'ravana') {
    return (
      <svg
        viewBox="0 0 800 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label={title}
      >
        <defs>
          <linearGradient id="ravanaSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#040814" />
            <stop offset="55%" stopColor="#0B192C" />
            <stop offset="100%" stopColor="#082F49" />
          </linearGradient>
          <radialGradient id="ravanaCore" cx="50%" cy="42%" r="40%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.48" />
            <stop offset="50%" stopColor="#0284C7" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#040814" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="monolithGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#090D16" />
          </linearGradient>
        </defs>
        <rect width="800" height="500" fill="url(#ravanaSky)" />
        <rect width="800" height="500" fill="url(#ravanaCore)" />

        {/* Acoustic concentric wave rings */}
        <circle cx="400" cy="210" r="78" stroke="#38BDF8" strokeOpacity="0.35" strokeWidth="1.2" />
        <circle cx="400" cy="210" r="128" stroke="#38BDF8" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="6 6" />
        <circle cx="400" cy="210" r="185" stroke="#38BDF8" strokeOpacity="0.1" strokeWidth="1" />

        {/* Distant flooded Colombo sea-wall towers */}
        <g fill="#0A1220" opacity="0.9">
          <rect x="70" y="210" width="38" height="170" />
          <rect x="118" y="245" width="28" height="135" />
          <rect x="170" y="190" width="44" height="190" />
          <rect x="590" y="205" width="42" height="175" />
          <rect x="645" y="235" width="32" height="145" />
          <rect x="692" y="180" width="46" height="200" />
        </g>

        {/* Ancient-futuristic Sigiriya acoustic monolith */}
        <polygon points="315,380 355,145 445,145 485,380" fill="url(#monolithGrad)" stroke="#38BDF8" strokeOpacity="0.28" strokeWidth="1.2" />
        <line x1="400" y1="115" x2="400" y2="380" stroke="#38BDF8" strokeOpacity="0.65" strokeWidth="2" />
        <polygon points="400,165 422,210 400,255 378,210" fill="#0EA5E9" fillOpacity="0.22" stroke="#7DD3FC" strokeWidth="1.4" />

        {/* Sea wall & flooded horizon */}
        <rect x="0" y="378" width="800" height="122" fill="#050B14" />
        <line x1="0" y1="378" x2="800" y2="378" stroke="#38BDF8" strokeOpacity="0.4" strokeWidth="1.2" />

        {/* Water reflections */}
        <g stroke="#38BDF8" strokeOpacity="0.28" strokeWidth="1.2">
          <line x1="350" y1="396" x2="450" y2="396" />
          <line x1="365" y1="412" x2="435" y2="412" />
          <line x1="382" y1="428" x2="418" y2="428" />
          <line x1="160" y1="404" x2="230" y2="404" strokeOpacity="0.14" />
          <line x1="585" y1="408" x2="655" y2="408" strokeOpacity="0.14" />
        </g>

        {/* Lone investigator silhouette on causeway */}
        <path d="M396 356 C396 350 404 350 404 356 L407 378 L393 378 Z" fill="#E2E8F0" />
        <circle cx="400" cy="346" r="4" fill="#E2E8F0" />
      </svg>
    );
  }

  if (variant === 'sinharaja') {
    return (
      <svg
        viewBox="0 0 800 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label={title}
      >
        <defs>
          <linearGradient id="forestBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#04100E" />
            <stop offset="60%" stopColor="#09221D" />
            <stop offset="100%" stopColor="#040908" />
          </linearGradient>
          <radialGradient id="mistGlow" cx="50%" cy="54%" r="42%">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.32" />
            <stop offset="45%" stopColor="#10B981" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#04100E" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="500" fill="url(#forestBg)" />
        <rect width="800" height="500" fill="url(#mistGlow)" />

        {/* Rainforest canopy layers */}
        <path d="M0 140 Q200 190 400 130 T800 155 L800 0 L0 0 Z" fill="#030B09" opacity="0.85" />
        <rect x="95" y="0" width="34" height="500" fill="#051310" />
        <rect x="190" y="0" width="22" height="500" fill="#071915" />
        <rect x="610" y="0" width="26" height="500" fill="#071915" />
        <rect x="680" y="0" width="42" height="500" fill="#051310" />

        {/* Hanging liana vines */}
        <path d="M250 0 Q262 150 244 290" stroke="#13382E" strokeWidth="2.5" />
        <path d="M545 0 Q530 165 552 310" stroke="#13382E" strokeWidth="2" />

        {/* Ancient moss-covered stone shrine arch */}
        <path
          d="M325 395 L340 205 L460 205 L475 395 Z"
          fill="#0B1917"
          stroke="#34D399"
          strokeOpacity="0.22"
          strokeWidth="1.5"
        />
        <path d="M368 395 L374 260 L426 260 L432 395 Z" fill="#040908" />

        {/* Torchlight / ritual amber sigil */}
        <circle cx="400" cy="312" r="14" fill="#F59E0B" fillOpacity="0.25" />
        <circle cx="400" cy="312" r="4.5" fill="#FDE68A" />

        {/* Bioluminescent spores */}
        <circle cx="290" cy="240" r="2.2" fill="#6EE7B7" opacity="0.8" />
        <circle cx="330" cy="180" r="1.8" fill="#6EE7B7" opacity="0.6" />
        <circle cx="485" cy="225" r="2.4" fill="#6EE7B7" opacity="0.75" />
        <circle cx="520" cy="285" r="1.6" fill="#FDE68A" opacity="0.7" />
        <circle cx="360" cy="155" r="2" fill="#6EE7B7" opacity="0.5" />

        {/* Monsoon mist bands */}
        <rect x="0" y="388" width="800" height="112" fill="#030807" />
        <ellipse cx="400" cy="390" rx="340" ry="22" fill="#10B981" fillOpacity="0.08" />
      </svg>
    );
  }

  if (variant === 'colombo') {
    return (
      <svg
        viewBox="0 0 800 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label={title}
      >
        <defs>
          <linearGradient id="noirSky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#06080F" />
            <stop offset="60%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#172554" />
          </linearGradient>
          <radialGradient id="harborGlow" cx="62%" cy="38%" r="45%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.26" />
            <stop offset="65%" stopColor="#F59E0B" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#06080F" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="500" fill="url(#noirSky)" />
        <rect width="800" height="500" fill="url(#harborGlow)" />

        {/* Colombo skyline & stylized Lotus Tower silhouette */}
        <g fill="#090E1A">
          <rect x="90" y="230" width="58" height="170" />
          <rect x="162" y="185" width="72" height="215" />
          <rect x="252" y="250" width="52" height="150" />
          <rect x="330" y="210" width="66" height="190" />
          <rect x="565" y="195" width="76" height="205" />
          <rect x="655" y="240" width="55" height="160" />
        </g>

        {/* Stylized Colombo Lotus Spire */}
        <line x1="485" y1="78" x2="485" y2="165" stroke="#94A3B8" strokeWidth="2.5" />
        <path d="M485 155 C455 178 458 212 485 222 C512 212 515 178 485 155 Z" fill="#0F172A" stroke="#38BDF8" strokeOpacity="0.55" strokeWidth="1.5" />
        <polygon points="476,222 494,222 503,400 467,400" fill="#0B1120" />

        {/* Office grid lights */}
        <g fill="#FBBF24" opacity="0.55">
          <rect x="180" y="210" width="8" height="4" />
          <rect x="196" y="210" width="8" height="4" />
          <rect x="180" y="236" width="8" height="4" />
          <rect x="210" y="262" width="8" height="4" />
          <rect x="584" y="222" width="10" height="4" />
          <rect x="604" y="222" width="10" height="4" />
          <rect x="584" y="254" width="10" height="4" />
        </g>

        {/* Monsoon diagonal rain streaks */}
        <g stroke="#94A3B8" strokeOpacity="0.18" strokeWidth="1">
          <line x1="140" y1="60" x2="105" y2="170" />
          <line x1="280" y1="40" x2="245" y2="150" />
          <line x1="410" y1="80" x2="375" y2="190" />
          <line x1="620" y1="55" x2="585" y2="165" />
          <line x1="720" y1="95" x2="685" y2="205" />
        </g>

        {/* Wet harbor asphalt */}
        <rect x="0" y="398" width="800" height="102" fill="#05070C" />
        <line x1="0" y1="398" x2="800" y2="398" stroke="#38BDF8" strokeOpacity="0.3" strokeWidth="1" />
        <rect x="468" y="410" width="34" height="3" fill="#38BDF8" fillOpacity="0.35" />
        <rect x="178" y="418" width="42" height="3" fill="#FBBF24" fillOpacity="0.28" />
      </svg>
    );
  }

  // 'yaksha' or 'custom' cinematic highland monolith frame
  return (
    <svg
      viewBox="0 0 800 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="kandySky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#070912" />
          <stop offset="55%" stopColor="#111827" />
          <stop offset="100%" stopColor="#090D16" />
        </linearGradient>
        <radialGradient id="leyGlow" cx="50%" cy="48%" r="44%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.35" />
          <stop offset="55%" stopColor="#6366F1" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#070912" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="500" fill="url(#kandySky)" />
      <rect width="800" height="500" fill="url(#leyGlow)" />

      {/* Highland mountain ridges */}
      <polygon points="0,390 185,220 365,345 555,195 800,375 800,500 0,500" fill="#0B111E" />
      <polygon points="0,420 265,275 460,385 675,255 800,395 800,500 0,500" fill="#070B14" />

      {/* Ley-line geometric meridian */}
      <circle cx="400" cy="230" r="92" stroke="#38BDF8" strokeOpacity="0.32" strokeWidth="1.2" />
      <polygon points="400,148 456,272 344,272" stroke="#7DD3FC" strokeOpacity="0.45" strokeWidth="1.4" fill="#0EA5E9" fillOpacity="0.08" />
      <line x1="400" y1="90" x2="400" y2="410" stroke="#38BDF8" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="4 4" />
    </svg>
  );
};
