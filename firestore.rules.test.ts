/**
 * Adversarial Firestore Security Rules Test Suite ("Dirty Dozen" Verification)
 * Validates that all 12 adversarial payloads specified in security_spec.md
 * evaluate to PERMISSION_DENIED under firestore.rules.
 */

export interface SimulatedAuth {
  uid: string;
  email: string;
  email_verified: boolean;
}

export interface DirtyDozenCase {
  id: number;
  name: string;
  auth: SimulatedAuth | null;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expectedAllowed: false;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unverified Admin Email Spoof',
    auth: { uid: 'spoof_1', email: 'lakwinj1@gmail.com', email_verified: false },
    operation: 'list',
    path: '/privateSubmissions',
    expectedAllowed: false,
  },
  {
    id: 2,
    name: 'Shadow Field Injection on CreatorProfile Create',
    auth: { uid: 'writer_1', email: 'writer@example.com', email_verified: true },
    operation: 'create',
    path: '/creatorProfiles/writer_1',
    payload: { uid: 'writer_1', displayName: 'Writer One', isVerifiedBadge: true },
    expectedAllowed: false,
  },
  {
    id: 3,
    name: 'Orphaned Public Script Create Without PrivateSubmission',
    auth: { uid: 'writer_1', email: 'writer@example.com', email_verified: true },
    operation: 'create',
    path: '/publicScripts/scr_orphan',
    payload: { scriptId: 'scr_orphan', authorUid: 'writer_1' },
    expectedAllowed: false,
  },
  {
    id: 4,
    name: 'Identity Spoofing on Community Post Create',
    auth: { uid: 'writer_1', email: 'writer@example.com', email_verified: true },
    operation: 'create',
    path: '/communityPosts/post_1',
    payload: { postId: 'post_1', authorUid: 'victim_uid' },
    expectedAllowed: false,
  },
  {
    id: 5,
    name: 'PII Leak via Direct Get on CollabRequest by Non-Participant',
    auth: { uid: 'stranger_uid', email: 'stranger@example.com', email_verified: true },
    operation: 'get',
    path: '/collabRequests/req_between_a_and_b',
    expectedAllowed: false,
  },
  {
    id: 6,
    name: 'Unauthorized Query Scraping on CollabRequests',
    auth: { uid: 'stranger_uid', email: 'stranger@example.com', email_verified: true },
    operation: 'list',
    path: '/collabRequests',
    expectedAllowed: false,
  },
  {
    id: 7,
    name: 'Fake Follower Inflation Attack (+1000)',
    auth: { uid: 'viewer_1', email: 'viewer@example.com', email_verified: true },
    operation: 'update',
    path: '/creatorProfiles/writer_1',
    payload: { followersCount: 1000 },
    expectedAllowed: false,
  },
  {
    id: 8,
    name: 'Value Poisoning on Whitelisted Bio Key',
    auth: { uid: 'writer_1', email: 'writer@example.com', email_verified: true },
    operation: 'update',
    path: '/creatorProfiles/writer_1',
    payload: { bio: 'X'.repeat(50000) },
    expectedAllowed: false,
  },
  {
    id: 9,
    name: 'ID Poisoning Attack on CommunityPosts',
    auth: { uid: 'writer_1', email: 'writer@example.com', email_verified: true },
    operation: 'create',
    path: `/communityPosts/${'a'.repeat(300)}`,
    payload: {},
    expectedAllowed: false,
  },
  {
    id: 10,
    name: 'Forged Past Client Timestamp on CommunityPost',
    auth: { uid: 'writer_1', email: 'writer@example.com', email_verified: true },
    operation: 'create',
    path: '/communityPosts/post_1',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expectedAllowed: false,
  },
  {
    id: 11,
    name: 'Terminal State Bypass on Accepted CollabRequest',
    auth: { uid: 'writer_1', email: 'writer@example.com', email_verified: true },
    operation: 'update',
    path: '/collabRequests/req_accepted',
    payload: { status: 'Declined', replyNote: 'Mutating terminal state' },
    expectedAllowed: false,
  },
  {
    id: 12,
    name: 'Self-Follow Injection Attack',
    auth: { uid: 'writer_1', email: 'writer@example.com', email_verified: true },
    operation: 'create',
    path: '/follows/writer_1_writer_1',
    payload: {
      followId: 'writer_1_writer_1',
      followerUid: 'writer_1',
      followingUid: 'writer_1',
      followerName: 'Writer',
      followingName: 'Writer',
    },
    expectedAllowed: false,
  },
];
