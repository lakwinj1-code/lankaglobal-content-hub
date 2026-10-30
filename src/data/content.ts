import {
  CollabPurpose,
  CommunityPostCategory,
  CreativeRole,
  PitchDraft,
} from '../types';

export const DEFAULT_PITCH_DRAFT: PitchDraft = {
  title: 'THE LAST YAKSHA',
  genre: 'Action Fantasy',
  format: 'Netflix Original Series',
  episodes: '8 × 50 min',
  logline:
    "When an ancient guardian awakens in modern-day Kandy, he must team up with a skeptical cybernetics engineer to prevent a multi-national syndicate from draining the island's ley-line energy.",
  visualTone: 'Cold Cinematic, Cyberpunk Neon, Moody Fog',
  comparables: 'Kingdom · Katla · Warrior Nun',
  protagonistArc: 'Reluctant immortal protector confronting modern industrial hubris',
};

export const PITCH_PRESETS: Array<{ label: string; draft: PitchDraft }> = [
  {
    label: 'THE LAST YAKSHA',
    draft: DEFAULT_PITCH_DRAFT,
  },
  {
    label: 'GALLE FORT 1658',
    draft: {
      title: 'GALLE FORT 1658',
      genre: 'Historical Siege Thriller',
      format: 'Mini-Series (6 Ep)',
      episodes: '6 × 58 min',
      logline:
        'Trapped inside the coral ramparts of Galle during the final maritime blockade, a double-agent cartographer smuggles ciphered tide charts between Kandyan envoys and mutinous garrison officers.',
      visualTone: 'Dark Earthy, Sinister Forest, High Contrast Shadows',
      comparables: 'Shōgun · Black Sails · The Terror',
      protagonistArc: 'Divided mapmaker choosing sovereignty over survival',
    },
  },
  {
    label: 'MONSOON STATION ZERO',
    draft: {
      title: 'MONSOON STATION ZERO',
      genre: 'Sci-Fi Thriller',
      format: 'Feature Film',
      episodes: '114 min Feature',
      logline:
        'Isolated inside a high-altitude Pidurutalagala weather radar dome, two meteorologists receive an acoustic broadcast timestamped forty-eight hours in their future.',
      visualTone: 'Sleek Urban Noir, Cold Rain, Muted Blue Tones',
      comparables: 'Arrival · Coherence · The Lighthouse',
      protagonistArc: 'Obsessive scientist tested by deterministic grief',
    },
  },
];

export const CREATIVE_ROLES: CreativeRole[] = [
  'Screenwriter',
  'Director',
  'Producer',
  'Cinematographer',
  'Actor',
  'Editor',
  'Composer',
  'Reader',
];

export const CREATIVE_ROLE_LABELS: Record<CreativeRole, { si: string; en: string }> = {
  Screenwriter: { si: 'තිරපිටපත් රචක (Screenwriter)', en: 'Screenwriter' },
  Director: { si: 'අධ්‍යක්ෂ (Director)', en: 'Director' },
  Producer: { si: 'නිෂ්පාදක (Producer)', en: 'Producer' },
  Cinematographer: { si: 'කැමරා අධ්‍යක්ෂ (Cinematographer)', en: 'Cinematographer' },
  Actor: { si: 'රංගන ශිල්පී (Actor / Talent)', en: 'Actor / Talent' },
  Editor: { si: 'සංස්කාරක / VFX (Editor)', en: 'Editor / Post' },
  Composer: { si: 'සංගීත අධ්‍යක්ෂ (Composer)', en: 'Composer / Sound' },
  Reader: { si: 'සිනමා රසික / පාඨක (Reader)', en: 'Reader / Film Enthusiast' },
};

export const COMMUNITY_CATEGORIES: CommunityPostCategory[] = [
  'Collaboration Call',
  'Script Discussion',
  'Production Update',
  'Industry Insight',
];

export const COMMUNITY_CATEGORY_LABELS: Record<
  CommunityPostCategory,
  { si: string; en: string }
> = {
  'Script Discussion': {
    si: 'කතා ඔපමට්ටම් හා විචාර (Story Polish)',
    en: 'Story Polish & Critique',
  },
  'Collaboration Call': {
    si: 'නිෂ්පාදන කණ්ඩායම් ඇරයුම් (Crew Call)',
    en: 'Crew & Talent Call',
  },
  'Production Update': {
    si: 'නිෂ්පාදන යාවත්කාලීන',
    en: 'Production Update',
  },
  'Industry Insight': {
    si: 'සිනමා දැනුම හා අදහස්',
    en: 'Industry Insight',
  },
};

export const FEEDBACK_LENSES: Array<{
  id: string;
  tagSi: string;
  tagEn: string;
}> = [
  {
    id: 'plot',
    tagSi: 'කතා ආකෘතිය (Plot)',
    tagEn: 'Plot & Structure',
  },
  {
    id: 'character',
    tagSi: 'චරිත ගොඩනැගීම (Characters)',
    tagEn: 'Character Arc',
  },
  {
    id: 'global',
    tagSi: 'ජාත්‍යන්තර OTT ගැළපීම',
    tagEn: 'Global OTT Appeal',
  },
  {
    id: 'collab',
    tagSi: 'නිෂ්පාදනයට එක්වීම (Crew Offer)',
    tagEn: 'Production Interest',
  },
];

export const COLLAB_PURPOSES: CollabPurpose[] = [
  'Story Option / Co-Production',
  'Directing / Production Team',
  'Script Feedback',
  'General Networking',
];

export const COLLAB_PURPOSE_LABELS: Record<CollabPurpose, { si: string; en: string }> = {
  'Story Option / Co-Production': {
    si: 'කතාව නිෂ්පාදනය / Co-Production සාකච්ඡාව',
    en: 'Story Option / Co-Production',
  },
  'Directing / Production Team': {
    si: 'චිත්‍රපට කණ්ඩායමට එක්වීම (Directing / Crew)',
    en: 'Directing / Production Team',
  },
  'Script Feedback': {
    si: 'තිරපිටපත පිළිබඳ අදහස් හුවමාරුව',
    en: 'Script Feedback & Story Notes',
  },
  'General Networking': {
    si: 'නිර්මාණකරුවන් ලෙස සම්බන්ධ වීම',
    en: 'General Filmmaker Networking',
  },
};

export const UI_COPY = {
  nav: {
    studioHome: { si: 'ප්‍රධාන පිටුව', en: 'Studio Home' },
    howItWorks: { si: 'ක්‍රියාකාරීත්වය', en: 'How it Works' },
    pipeline: { si: 'නිර්මාණ ලැයිස්තුව', en: 'Project Pipeline' },
    community: { si: 'Community Hub', en: 'Community Hub' },
    builder: { si: 'Pitch Deck සාදන්නා', en: 'Pitch Builder' },
    submit: { si: 'කතාව යොමු කරන්න', en: 'Submit Script' },
    cta: { si: 'Pitch එක යවන්න', en: 'Submit Pitch' },
  },
  hero: {
    kicker: {
      si: 'ශ්‍රී ලාංකේය නිර්මාණ Netflix සහ ජාත්‍යන්තර OTT වෙත ගෙන යාම',
      en: 'Connecting Sri Lankan Creators to Netflix & Global OTTs',
    },
    titlePrimary: {
      si: 'ලංකාවෙන් ගෝලීය තිරයට',
      en: 'Lanka to Global Content Hub',
    },
    titleSecondary: {
      si: 'ජාත්‍යන්තර ප්‍රමිතියේ සිනමා සහ කතාමාලා එකමුතුව',
      en: 'Co-producing High-End Stories for World Audiences',
    },
    description: {
      si: 'ඔබේ නිර්මාණාත්මක අදහස් දේශීය රාමුවට පමණක් සීමා නොකරන්න. NDA ආරක්ෂාව යටතේ ඔබේ තිරපිටපත යොමු කරන්න, සහ අපගේ වෙනමම වූ Community Hub පිටුව හරහා අදහස් ලබාගෙන කතාව තවත් ඔපමට්ටම් කරගනිමින් සිනමා කණ්ඩායම් සමඟ එකතු වන්න.',
      en: "Don't limit your ideas to local boundaries. Submit your screenplay under strict NDA protection, and step into our dedicated Community Hub to polish your story concepts and build your production team.",
    },
    primaryBtn: {
      si: 'ඔබේ තිරපිටපත යොමු කරන්න',
      en: 'Submit Your Script',
    },
    secondaryBtn: {
      si: 'Community Hub වෙත පිවිසෙන්න',
      en: 'Open Community Hub',
    },
    channelsLabel: {
      si: 'අප ඉලක්ක කරන ජාත්‍යන්තර නාලිකා සහ මාදිලි',
      en: 'Target Pitch Platforms & Distribution Models',
    },
  },
  metrics: [
    {
      value: '0',
      label: { si: 'සංවර්ධනය වන තිරපිටපත්', en: 'Scripts in Development' },
      detail: { si: 'නිර්මාණ සංචිතය', en: 'Curated Slate' },
    },
    {
      value: '100%',
      label: { si: 'මූලික බුද්ධිමය දේපළ හිමිකම', en: 'Creator Moral & Base IP Retained' },
      detail: { si: 'NDA ගිවිසුම යටතේ ආරක්ෂිතයි', en: 'Mutual Evaluation NDA' },
    },
    {
      value: '14 Days',
      label: { si: 'මූලික පිටපත් පරීක්ෂණ කාලය', en: 'Editorial Coverage Turnaround' },
      detail: { si: 'මාසික තේරීම් කමිටුව', en: 'Monthly Development Board' },
    },
    {
      value: '4 Models',
      label: { si: 'ජාත්‍යන්තර මූල්‍ය හා බෙදාහැරීම් මාර්ග', en: 'Global Financing Pathways' },
      detail: { si: 'Netflix · Prime · Viu · Co-Prod', en: 'Netflix · Prime · Viu · Co-Prod' },
    },
  ],
  howItWorks: {
    kicker: { si: 'ජාත්‍යන්තරයට යන මඟ', en: 'Simplified Global Path' },
    heading: {
      si: 'ඔබේ කතාව ජාත්‍යන්තර තිරයට යන පියවර 4',
      en: 'How We Take Your Story to Netflix',
    },
    steps: [
      {
        num: '01',
        title: { si: '1. කථාව හෝ පිටපත යොමු කිරීම', en: '1. Concept Submission' },
        desc: {
          si: 'ඔබේ Logline එක, Synopsis එක හෝ තිරපිටපත අපගේ ආරක්ෂිත පද්ධතිය හරහා යොමු කර ඔබේ Profile පිටුවෙන් පරීක්ෂණ තත්ත්වය සජීවීව බලාගන්න.',
          en: 'Submit your Logline, Synopsis, or Pilot Script under NDA protection and track editorial review status directly on your profile.',
        },
      },
      {
        num: '02',
        title: { si: '2. ජාත්‍යන්තර ප්‍රමිතියට සංවර්ධනය', en: '2. Script Doctoring' },
        desc: {
          si: 'අපගේ විශේෂඥ කණ්ඩායම විසින් කතාවේ විශ්වීය ආකර්ෂණය (Universal Appeal) පරීක්ෂා කර, පිටපත ජාත්‍යන්තර ප්‍රමිතියට සංවර්ධනය කරයි.',
          en: 'Our script advisors analyze universal storytelling elements, character arcs, and refine script structure for global audiences.',
        },
      },
      {
        num: '03',
        title: { si: '3. High-End Pitch Deck සෑදීම', en: '3. Pitch Deck & Proof of Concept' },
        desc: {
          si: 'සිනමාත්මක ප්‍රමිතියෙන් යුත් Series Bibles, Moodboards, Visual style guides සහ Proof of Concept Teaser එකක් සකස් කරනු ලැබේ.',
          en: 'We construct cinematic Pitch Bibles, Moodboards, Visual style guides, and short Teasers showing the cold, high-end aesthetics.',
        },
      },
      {
        num: '04',
        title: { si: '4. Pre-Sales සහ Netflix Pitching', en: '4. Netflix Pitching & Co-Production' },
        desc: {
          si: 'ජාත්‍යන්තර OTT ආයතන හමුවේ සෘජුව Pitch කර, Pre-Sales හෝ Co-Production ගිවිසුම් හරහා නිෂ්පාදන කටයුතු ආරම්භ කරනු ලබයි.',
          en: 'Pitching directly to OTT acquisition teams under Licensing or Co-Production model, ensuring budget and global exposure.',
        },
      },
    ],
  },
  pipeline: {
    kicker: { si: 'තේරී පත් වූ නිර්මාණ සංචිතය', en: 'Script Pipeline' },
    heading: {
      si: 'දැනට සංවර්ධනය වන කතාමාලා සහ සිනමා',
      en: 'Current Projects in Development',
    },
    subhead: {
      si: 'අලුතින් Upload වන තිරපිටපත් කියවා බලන්න. යම් කතාවකට ඔබ කැමති නම් රචකයාගේ Profile එකට පිවිස Follow කිරීමට හෝ සෘජුව සම්බන්ධ වීමට හැකිය.',
      en: 'Browse uploaded screenplays in real time. Open any creator profile to follow their work or send a direct collaboration inquiry.',
    },
    filters: {
      all: { si: 'සියල්ල', en: 'All Status' },
      pitchReady: { si: 'Pitch සූදානම්', en: 'Pitch Ready' },
      underReview: { si: 'පරීක්ෂාවේ', en: 'Under Review' },
      trending: { si: 'දැන් Trending', en: 'Trending' },
      newest: { si: 'අලුතින් එක්වූ', en: 'Newest' },
      mostViewed: { si: 'වැඩිම නැරඹුම්', en: 'Most Viewed' },
    },
  },
  community: {
    kicker: { si: 'නිදහස් සිනමා නිර්මාණකරුවන්ගේ ජාලය', en: 'Filmmaker Network & Open Stage' },
    heading: {
      si: 'සිනමා ප්‍රජාව සහ නිර්මාණකරුවන්ගේ වේදිකාව',
      en: 'Creator Community & Collaboration Stage',
    },
    subhead: {
      si: 'තිරපිටපත් රචකයින්, අධ්‍යක්ෂවරුන්, නිෂ්පාදකයින් සහ සිනමාවට ආදරය කරන සැමට නිදහසේ අදහස් බෙදාගැනීමට, Follow කිරීමට සහ නව චිත්‍රපට සඳහා එකතු වීමට වෙන්වූ විවෘත වේදිකාව.',
      en: 'An open professional stage where screenwriters, directors, producers, and film enthusiasts follow each other, discuss stories, and team up on films.',
    },
  },
  builder: {
    kicker: { si: 'අත්හදා බැලීමේ මෙවලම', en: 'Interactive Tool Demo' },
    heading: {
      si: 'ඔබේ Pitch Deck එක තත්පරයෙන් පරීක්ෂා කරන්න',
      en: 'Instant Netflix Pitch Deck Preview',
    },
    description: {
      si: 'ඔබේ කතාවේ මූලික කරුණු පහත සටහන් කර ජාත්‍යන්තර ප්‍රමිතියේ Pitch Deck එකක් සකස් වන ආකාරය නරඹන්න.',
      en: 'Type your core idea details below to preview how our script doctoring engine formats your pitch for international streaming buyers.',
    },
  },
  submit: {
    kicker: { si: 'නිල අයදුම්පත', en: 'Official Submission' },
    heading: {
      si: 'ඔබේ කතාව හෝ Pitch එක අප වෙත එවන්න',
      en: 'Submit Your Story Concept',
    },
    description: {
      si: 'අයදුම්පත යොමු කළ සැනින් ඔබේ බුද්ධිමය දේපළ අයිතිය (IP) නීතිමය වශයෙන් සුරක්ෂිත වේ. අපගේ කණ්ඩායම මසකට වරක් තේරීම් සිදුකරයි.',
      en: 'Your intellectual property is protected by automated NDA terms upon submission. Our creative board reviews all submissions monthly.',
    },
  },
  footer: {
    copyright: {
      si: '© 2026 LankaGlobal Content Hub. ශ්‍රී ලාංකේය සිනමා නිර්මාණ ලෝකය හමුවට.',
      en: '© 2026 LankaGlobal Content Hub. Empowering Sri Lankan Cinema & Series globally.',
    },
    location: {
      si: 'කොළඹ 03 · ජාත්‍යන්තර තිරපිටපත් සංවර්ධන හා සම-නිෂ්පාදන ඒකකය',
      en: 'Colombo 03 · Screenplay Packaging & International Co-Production Desk',
    },
  },
};
