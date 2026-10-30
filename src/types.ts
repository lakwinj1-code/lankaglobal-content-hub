export enum Language {
  SI = 'si',
  EN = 'en',
}

export type AppPage = 'studio' | 'community';

export enum ProjectStatus {
  ALL = 'all',
  PITCH_READY = 'Pitch Deck Ready',
  UNDER_REVIEW = 'Under Review',
}

export enum PipelineFilter {
  ALL = 'all',
  PITCH_READY = 'pitch_ready',
  UNDER_REVIEW = 'under_review',
  NEWEST = 'newest',
  TRENDING = 'trending',
  MOST_VIEWED = 'most_viewed',
}

export type KeyArtVariant = 'ravana' | 'sinharaja' | 'colombo' | 'yaksha' | 'custom';

export type CreatorType = 'Screenwriter' | 'Producer' | 'Reader';

export type CreativeRole =
  | 'Screenwriter'
  | 'Director'
  | 'Producer'
  | 'Cinematographer'
  | 'Actor'
  | 'Editor'
  | 'Composer'
  | 'Reader';

export type ReviewStatus = 'Pending Review' | 'Shortlisted' | 'Pitch Deck Ready' | 'Archived';

export type CommunityPostCategory =
  | 'Collaboration Call'
  | 'Script Discussion'
  | 'Production Update'
  | 'Industry Insight';

export type CollabPurpose =
  | 'Story Option / Co-Production'
  | 'Directing / Production Team'
  | 'Script Feedback'
  | 'General Networking';

export type CollabStatus = 'Pending' | 'Accepted' | 'Declined';

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  email: string;
  creatorType: CreatorType;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface CreatorProfileRecord {
  uid: string;
  displayName: string;
  creativeRole: CreativeRole;
  headline: string;
  bio: string;
  location: string;
  openToCollab: boolean;
  followersCount: number;
  followingCount: number;
  isPublic: boolean;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface CreatorFollowRecord {
  followId: string;
  followerUid: string;
  followingUid: string;
  followerName: string;
  followingName: string;
  createdAtIso: string;
}

export interface CommunityPostRecord {
  postId: string;
  authorUid: string;
  authorName: string;
  authorRole: CreativeRole;
  category: CommunityPostCategory;
  title: string;
  body: string;
  linkedScriptId: string;
  linkedScriptTitle: string;
  likesCount: number;
  commentsCount: number;
  isPublished: boolean;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface PostCommentRecord {
  commentId: string;
  postId: string;
  authorUid: string;
  authorName: string;
  authorRole: CreativeRole;
  body: string;
  isPublished: boolean;
  createdAtIso: string;
}

export interface CollabRequestRecord {
  requestId: string;
  senderUid: string;
  senderName: string;
  senderRole: CreativeRole;
  recipientUid: string;
  recipientName: string;
  scriptId: string;
  scriptTitle: string;
  purpose: CollabPurpose;
  message: string;
  senderContact: string;
  status: CollabStatus;
  replyNote: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface BilingualText {
  si: string;
  en: string;
}

export interface PipelineProject {
  id: string;
  authorUid?: string;
  title: string;
  status: ProjectStatus.PITCH_READY | ProjectStatus.UNDER_REVIEW;
  genre: string;
  format: string;
  writer: string;
  episodesOrRuntime: string;
  year: string;
  keyArt: KeyArtVariant;
  logline: BilingualText;
  synopsis: BilingualText;
  visualTone: string;
  comparables: string;
  targetModel: string;
  views: number;
  createdAt?: string;
  lastViewedAt?: string;
  isTrendingSeed?: boolean;
  isRecentSeed?: boolean;
  isUserSubmitted?: boolean;
}

export interface PrivateSubmissionRecord {
  scriptId: string;
  authorUid: string;
  referenceId: string;
  title: string;
  writerName: string;
  email: string;
  phone: string;
  genre: string;
  format: string;
  logline: string;
  scriptUrl: string;
  fileName: string;
  fileMimeType: string;
  fileSizeBytes: number;
  chunkCount: number;
  ipConfirmed: boolean;
  reviewStatus: ReviewStatus;
  adminNotes: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface PitchDraft {
  title: string;
  genre: string;
  format: string;
  episodes: string;
  logline: string;
  visualTone: string;
  comparables: string;
  protagonistArc: string;
}

export interface SubmissionFormData {
  writerName: string;
  email: string;
  phone: string;
  genre: string;
  workingTitle: string;
  format: string;
  logline: string;
  scriptUrl: string;
  scriptFileName: string;
  ipConfirmed: boolean;
}
