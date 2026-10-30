import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  DocumentData,
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  CollabPurpose,
  CollabRequestRecord,
  CollabStatus,
  CommunityPostCategory,
  CommunityPostRecord,
  CreativeRole,
  CreatorFollowRecord,
  CreatorProfileRecord,
  CreatorType,
  KeyArtVariant,
  PipelineProject,
  PostCommentRecord,
  PrivateSubmissionRecord,
  ProjectStatus,
  ReviewStatus,
  UserProfileRecord,
} from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const ADMIN_EMAIL = 'lakwinj1@gmail.com';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB max screenplay file
const MAX_BASE64_CHUNK_CHARS = 600000; // <= 650,000 rule limit (~450 KB binary per doc)
const MAX_CHUNKS = 25;

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  return user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export async function signInWithGooglePopup(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(auth);
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return new Date().toISOString();
}

const VALID_CREATIVE_ROLES: CreativeRole[] = [
  'Screenwriter',
  'Director',
  'Producer',
  'Cinematographer',
  'Actor',
  'Editor',
  'Composer',
  'Reader',
];

function normalizeCreativeRole(value: unknown): CreativeRole {
  if (typeof value === 'string' && VALID_CREATIVE_ROLES.includes(value as CreativeRole)) {
    return value as CreativeRole;
  }
  return 'Screenwriter';
}

export function creativeRoleToAccountType(role: CreativeRole): CreatorType {
  if (role === 'Producer' || role === 'Director') return 'Producer';
  if (role === 'Reader') return 'Reader';
  return 'Screenwriter';
}

export function mapUserDocToProfile(data: DocumentData): UserProfileRecord {
  const creatorType: CreatorType =
    data.creatorType === 'Producer' || data.creatorType === 'Reader'
      ? data.creatorType
      : 'Screenwriter';
  return {
    uid: String(data.uid || ''),
    displayName: String(data.displayName || ''),
    email: String(data.email || ''),
    creatorType,
    createdAtIso: timestampToIso(data.createdAt),
    updatedAtIso: timestampToIso(data.updatedAt),
  };
}

export function mapDocToCreatorProfile(data: DocumentData): CreatorProfileRecord {
  return {
    uid: String(data.uid || ''),
    displayName: String(data.displayName || ''),
    creativeRole: normalizeCreativeRole(data.creativeRole),
    headline: String(data.headline || ''),
    bio: String(data.bio || ''),
    location: String(data.location || ''),
    openToCollab: data.openToCollab !== false,
    followersCount: typeof data.followersCount === 'number' ? data.followersCount : 0,
    followingCount: typeof data.followingCount === 'number' ? data.followingCount : 0,
    isPublic: data.isPublic !== false,
    createdAtIso: timestampToIso(data.createdAt),
    updatedAtIso: timestampToIso(data.updatedAt),
  };
}

export function mapDocToFollow(data: DocumentData): CreatorFollowRecord {
  return {
    followId: String(data.followId || ''),
    followerUid: String(data.followerUid || ''),
    followingUid: String(data.followingUid || ''),
    followerName: String(data.followerName || ''),
    followingName: String(data.followingName || ''),
    createdAtIso: timestampToIso(data.createdAt),
  };
}

export function mapDocToCommunityPost(data: DocumentData): CommunityPostRecord {
  const category: CommunityPostCategory =
    data.category === 'Script Discussion' ||
    data.category === 'Production Update' ||
    data.category === 'Industry Insight'
      ? data.category
      : 'Collaboration Call';

  return {
    postId: String(data.postId || ''),
    authorUid: String(data.authorUid || ''),
    authorName: String(data.authorName || ''),
    authorRole: normalizeCreativeRole(data.authorRole),
    category,
    title: String(data.title || ''),
    body: String(data.body || ''),
    linkedScriptId: String(data.linkedScriptId || ''),
    linkedScriptTitle: String(data.linkedScriptTitle || ''),
    likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
    commentsCount: typeof data.commentsCount === 'number' ? data.commentsCount : 0,
    isPublished: data.isPublished !== false,
    createdAtIso: timestampToIso(data.createdAt),
    updatedAtIso: timestampToIso(data.updatedAt),
  };
}

export function mapDocToComment(data: DocumentData): PostCommentRecord {
  return {
    commentId: String(data.commentId || ''),
    postId: String(data.postId || ''),
    authorUid: String(data.authorUid || ''),
    authorName: String(data.authorName || ''),
    authorRole: normalizeCreativeRole(data.authorRole),
    body: String(data.body || ''),
    isPublished: data.isPublished !== false,
    createdAtIso: timestampToIso(data.createdAt),
  };
}

export function mapDocToCollabRequest(data: DocumentData): CollabRequestRecord {
  const purpose: CollabPurpose =
    data.purpose === 'Directing / Production Team' ||
    data.purpose === 'Script Feedback' ||
    data.purpose === 'General Networking'
      ? data.purpose
      : 'Story Option / Co-Production';

  const status: CollabStatus =
    data.status === 'Accepted' || data.status === 'Declined' ? data.status : 'Pending';

  return {
    requestId: String(data.requestId || ''),
    senderUid: String(data.senderUid || ''),
    senderName: String(data.senderName || ''),
    senderRole: normalizeCreativeRole(data.senderRole),
    recipientUid: String(data.recipientUid || ''),
    recipientName: String(data.recipientName || ''),
    scriptId: String(data.scriptId || ''),
    scriptTitle: String(data.scriptTitle || ''),
    purpose,
    message: String(data.message || ''),
    senderContact: String(data.senderContact || ''),
    status,
    replyNote: String(data.replyNote || ''),
    createdAtIso: timestampToIso(data.createdAt),
    updatedAtIso: timestampToIso(data.updatedAt),
  };
}

const inFlightProfilePromises = new Map<string, Promise<UserProfileRecord>>();

async function ensureCreatorProfileDoc(
  uid: string,
  displayName: string,
  preferredCreativeRole?: CreativeRole
): Promise<CreatorProfileRecord> {
  const profilePath = `creatorProfiles/${uid}`;
  const profileRef = doc(db, 'creatorProfiles', uid);

  let snap;
  try {
    snap = await getDoc(profileRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  if (snap.exists()) {
    const existing = mapDocToCreatorProfile(snap.data());
    if (
      (displayName.length >= 2 && displayName !== existing.displayName) ||
      (preferredCreativeRole && preferredCreativeRole !== existing.creativeRole)
    ) {
      const nextName = displayName.length >= 2 ? displayName.slice(0, 100) : existing.displayName;
      const nextRole = preferredCreativeRole || existing.creativeRole;
      try {
        await updateDoc(profileRef, {
          displayName: nextName,
          creativeRole: nextRole,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, profilePath);
      }
      return {
        ...existing,
        displayName: nextName,
        creativeRole: nextRole,
        updatedAtIso: new Date().toISOString(),
      };
    }
    return existing;
  }

  const cleanName = (displayName.trim().slice(0, 100).length >= 2
    ? displayName.trim().slice(0, 100)
    : 'Member');
  const cleanRole: CreativeRole = preferredCreativeRole || 'Screenwriter';
  const defaultHeadline = `${cleanRole} · LankaGlobal Filmmaker Network`.slice(0, 160);

  try {
    await setDoc(profileRef, {
      uid,
      displayName: cleanName,
      creativeRole: cleanRole,
      headline: defaultHeadline,
      bio: '',
      location: 'Sri Lanka',
      openToCollab: true,
      followersCount: 0,
      followingCount: 0,
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    try {
      const retrySnap = await getDoc(profileRef);
      if (retrySnap.exists()) {
        return mapDocToCreatorProfile(retrySnap.data());
      }
    } catch {
      // Proceed to structured error handler
    }
    handleFirestoreError(error, OperationType.CREATE, profilePath);
  }

  const nowIso = new Date().toISOString();
  return {
    uid,
    displayName: cleanName,
    creativeRole: cleanRole,
    headline: defaultHeadline,
    bio: '',
    location: 'Sri Lanka',
    openToCollab: true,
    followersCount: 0,
    followingCount: 0,
    isPublic: true,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };
}

async function createOrFetchBaseUserProfile(
  user: User,
  preferredName?: string,
  preferredType?: CreatorType,
  preferredCreativeRole?: CreativeRole
): Promise<UserProfileRecord> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (existingSnap.exists()) {
    const base = mapUserDocToProfile(existingSnap.data());
    await ensureCreatorProfileDoc(
      user.uid,
      preferredName && preferredName.trim().length >= 2 ? preferredName.trim() : base.displayName,
      preferredCreativeRole || (base.creatorType as CreativeRole)
    );
    return base;
  }

  const rawName = (preferredName || user.displayName || user.email?.split('@')[0] || 'Creator')
    .trim()
    .slice(0, 100);
  const cleanName = rawName.length >= 2 ? rawName : 'Member';
  const cleanEmail = (user.email || '').trim().slice(0, 160);
  const cleanRole: CreativeRole = preferredCreativeRole || preferredType || 'Screenwriter';
  const cleanType: CreatorType = preferredType || creativeRoleToAccountType(cleanRole);
  const defaultHeadline = `${cleanRole} · LankaGlobal Filmmaker Network`.slice(0, 160);

  const batch = writeBatch(db);
  batch.set(userRef, {
    uid: user.uid,
    displayName: cleanName,
    email: cleanEmail,
    creatorType: cleanType,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'creatorProfiles', user.uid), {
    uid: user.uid,
    displayName: cleanName,
    creativeRole: cleanRole,
    headline: defaultHeadline,
    bio: '',
    location: 'Sri Lanka',
    openToCollab: true,
    followersCount: 0,
    followingCount: 0,
    isPublic: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    try {
      const retrySnap = await getDoc(userRef);
      if (retrySnap.exists()) {
        const base = mapUserDocToProfile(retrySnap.data());
        await ensureCreatorProfileDoc(user.uid, base.displayName, cleanRole);
        return base;
      }
    } catch {
      // Proceed to structured Firestore error handler if doc truly wasn't created
    }
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  const nowIso = new Date().toISOString();
  return {
    uid: user.uid,
    displayName: cleanName,
    email: cleanEmail,
    creatorType: cleanType,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };
}

export async function ensureOrRegisterUserProfile(
  user: User,
  preferredName?: string,
  preferredType?: CreatorType,
  preferredCreativeRole?: CreativeRole
): Promise<UserProfileRecord> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let pending = inFlightProfilePromises.get(user.uid);
  if (!pending) {
    pending = createOrFetchBaseUserProfile(
      user,
      preferredName,
      preferredType,
      preferredCreativeRole
    ).finally(() => {
      inFlightProfilePromises.delete(user.uid);
    });
    inFlightProfilePromises.set(user.uid, pending);
  }

  const current = await pending;
  const trimmedPreferred = preferredName ? preferredName.trim().slice(0, 100) : '';
  const shouldUpdate =
    (trimmedPreferred.length >= 2 && trimmedPreferred !== current.displayName) ||
    (preferredType !== undefined && preferredType !== current.creatorType);

  if (shouldUpdate) {
    const nextName = trimmedPreferred.length >= 2 ? trimmedPreferred : current.displayName;
    const nextType = preferredType || current.creatorType;
    try {
      await updateDoc(userRef, {
        displayName: nextName,
        creatorType: nextType,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
    await ensureCreatorProfileDoc(
      user.uid,
      nextName,
      preferredCreativeRole || (nextType as CreativeRole)
    );
    return {
      ...current,
      displayName: nextName,
      creatorType: nextType,
      updatedAtIso: new Date().toISOString(),
    };
  }

  return current;
}

export async function updateUserProfileDetails(
  user: User,
  displayName: string,
  creatorType: CreatorType
): Promise<UserProfileRecord> {
  const userPath = `users/${user.uid}`;
  const cleanName = displayName.trim().slice(0, 100);
  if (cleanName.length < 2) {
    throw new Error('Display name must be at least 2 characters.');
  }

  try {
    await updateDoc(doc(db, 'users', user.uid), {
      displayName: cleanName,
      creatorType,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  await ensureCreatorProfileDoc(user.uid, cleanName, creatorType as CreativeRole);

  const nowIso = new Date().toISOString();
  return {
    uid: user.uid,
    displayName: cleanName,
    email: user.email || '',
    creatorType,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };
}

export interface UpdateCreatorProfileInput {
  displayName: string;
  creativeRole: CreativeRole;
  headline: string;
  bio: string;
  location: string;
  openToCollab: boolean;
}

export async function updateCreatorPublicProfile(
  user: User,
  input: UpdateCreatorProfileInput
): Promise<void> {
  const cleanName = input.displayName.trim().slice(0, 100);
  if (cleanName.length < 2) {
    throw new Error('Display name must be at least 2 characters.');
  }
  const cleanHeadline = input.headline.trim().slice(0, 160);
  const cleanBio = input.bio.trim().slice(0, 1000);
  const cleanLocation = input.location.trim().slice(0, 80);
  const mappedAccountType = creativeRoleToAccountType(input.creativeRole);

  const batch = writeBatch(db);
  batch.update(doc(db, 'creatorProfiles', user.uid), {
    displayName: cleanName,
    creativeRole: input.creativeRole,
    headline: cleanHeadline,
    bio: cleanBio,
    location: cleanLocation,
    openToCollab: Boolean(input.openToCollab),
    isPublic: true,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'users', user.uid), {
    displayName: cleanName,
    creatorType: mappedAccountType,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `creatorProfiles/${user.uid}`);
  }
}

export async function toggleFollowCreator(
  currentUser: User,
  currentDisplayName: string,
  targetUid: string,
  targetDisplayName: string,
  isCurrentlyFollowing: boolean
): Promise<void> {
  if (!currentUser.emailVerified || currentUser.uid === targetUid) return;
  const followId = `${currentUser.uid}_${targetUid}`;
  const batch = writeBatch(db);
  const followRef = doc(db, 'follows', followId);
  const myProfileRef = doc(db, 'creatorProfiles', currentUser.uid);
  const targetProfileRef = doc(db, 'creatorProfiles', targetUid);

  if (isCurrentlyFollowing) {
    batch.delete(followRef);
    batch.update(targetProfileRef, {
      followersCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
    batch.update(myProfileRef, {
      followingCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  } else {
    const cleanFollowerName =
      currentDisplayName.trim().slice(0, 100).length >= 2
        ? currentDisplayName.trim().slice(0, 100)
        : 'Member';
    const cleanTargetName =
      targetDisplayName.trim().slice(0, 100).length >= 2
        ? targetDisplayName.trim().slice(0, 100)
        : 'Creator';
    batch.set(followRef, {
      followId,
      followerUid: currentUser.uid,
      followingUid: targetUid,
      followerName: cleanFollowerName,
      followingName: cleanTargetName,
      createdAt: serverTimestamp(),
    });
    batch.update(targetProfileRef, {
      followersCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    batch.update(myProfileRef, {
      followingCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `follows/${followId}`);
  }
}

export interface CreateCommunityPostInput {
  user: User;
  authorName: string;
  authorRole: CreativeRole;
  category: CommunityPostCategory;
  title: string;
  body: string;
  linkedScriptId?: string;
  linkedScriptTitle?: string;
}

export async function createCommunityPost(input: CreateCommunityPostInput): Promise<void> {
  const safeRandom = Math.random().toString(36).replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'p1';
  const postId = `post_${Date.now()}_${safeRandom}`.slice(0, 120);
  const cleanAuthor =
    input.authorName.trim().slice(0, 100).length >= 2
      ? input.authorName.trim().slice(0, 100)
      : 'Member';
  const cleanTitle = input.title.trim().slice(0, 140);
  const cleanBody = input.body.trim().slice(0, 2500);
  const cleanScriptId = (input.linkedScriptId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 128);
  const cleanScriptTitle = cleanScriptId ? (input.linkedScriptTitle || '').trim().slice(0, 140) : '';

  const path = `communityPosts/${postId}`;
  try {
    await setDoc(doc(db, 'communityPosts', postId), {
      postId,
      authorUid: input.user.uid,
      authorName: cleanAuthor,
      authorRole: input.authorRole,
      category: input.category,
      title: cleanTitle,
      body: cleanBody,
      linkedScriptId: cleanScriptId,
      linkedScriptTitle: cleanScriptTitle,
      likesCount: 0,
      commentsCount: 0,
      isPublished: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  const path = `communityPosts/${postId}`;
  try {
    await deleteDoc(doc(db, 'communityPosts', postId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function toggleLikeCommunityPost(
  user: User,
  postId: string,
  isCurrentlyLiked: boolean
): Promise<void> {
  if (!user.emailVerified) return;
  const batch = writeBatch(db);
  const likeRef = doc(db, 'communityPosts', postId, 'likes', user.uid);
  const postRef = doc(db, 'communityPosts', postId);

  if (isCurrentlyLiked) {
    batch.delete(likeRef);
    batch.update(postRef, {
      likesCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(likeRef, {
      postId,
      uid: user.uid,
      createdAt: serverTimestamp(),
    });
    batch.update(postRef, {
      likesCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `communityPosts/${postId}/likes/${user.uid}`);
  }
}

export async function addCommunityComment(
  user: User,
  postId: string,
  authorName: string,
  authorRole: CreativeRole,
  body: string
): Promise<void> {
  const safeRandom = Math.random().toString(36).replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'c1';
  const commentId = `cmt_${Date.now()}_${safeRandom}`.slice(0, 120);
  const cleanAuthor =
    authorName.trim().slice(0, 100).length >= 2 ? authorName.trim().slice(0, 100) : 'Member';
  const cleanBody = body.trim().slice(0, 800);
  if (!cleanBody) return;

  const batch = writeBatch(db);
  batch.set(doc(db, 'communityPosts', postId, 'comments', commentId), {
    commentId,
    postId,
    authorUid: user.uid,
    authorName: cleanAuthor,
    authorRole,
    body: cleanBody,
    isPublished: true,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, 'communityPosts', postId), {
    commentsCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `communityPosts/${postId}/comments/${commentId}`
    );
  }
}

export interface SendCollabRequestInput {
  user: User;
  senderName: string;
  senderRole: CreativeRole;
  recipientUid: string;
  recipientName: string;
  scriptId?: string;
  scriptTitle?: string;
  purpose: CollabPurpose;
  message: string;
  senderContact?: string;
}

export async function sendCollabRequest(input: SendCollabRequestInput): Promise<void> {
  if (input.user.uid === input.recipientUid) {
    throw new Error('Cannot send a collaboration request to yourself.');
  }
  const safeRandom = Math.random().toString(36).replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'r1';
  const requestId = `req_${Date.now()}_${safeRandom}`.slice(0, 120);
  const cleanSender =
    input.senderName.trim().slice(0, 100).length >= 2
      ? input.senderName.trim().slice(0, 100)
      : 'Member';
  const cleanRecipient =
    input.recipientName.trim().slice(0, 100).length >= 2
      ? input.recipientName.trim().slice(0, 100)
      : 'Creator';
  const cleanScriptId = (input.scriptId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 128);
  const cleanScriptTitle = cleanScriptId ? (input.scriptTitle || '').trim().slice(0, 140) : '';
  const cleanMessage = input.message.trim().slice(0, 1200);
  const cleanContact = (input.senderContact || '').trim().slice(0, 160);

  const path = `collabRequests/${requestId}`;
  try {
    await setDoc(doc(db, 'collabRequests', requestId), {
      requestId,
      senderUid: input.user.uid,
      senderName: cleanSender,
      senderRole: input.senderRole,
      recipientUid: input.recipientUid,
      recipientName: cleanRecipient,
      scriptId: cleanScriptId,
      scriptTitle: cleanScriptTitle,
      purpose: input.purpose,
      message: cleanMessage,
      senderContact: cleanContact,
      status: 'Pending',
      replyNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function respondToCollabRequest(
  requestId: string,
  status: 'Accepted' | 'Declined',
  replyNote: string
): Promise<void> {
  const path = `collabRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'collabRequests', requestId), {
      status,
      replyNote: replyNote.trim().slice(0, 1000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const step = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += step) {
    const slice = bytes.subarray(i, i + step);
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(''));
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function sliceFileIntoBase64Chunks(file: File): Promise<string[]> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds the 10 MB maximum upload limit.');
  }
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength === 0) {
    return [];
  }
  const fullBase64 = arrayBufferToBase64(buffer);
  const chunks: string[] = [];
  for (let offset = 0; offset < fullBase64.length; offset += MAX_BASE64_CHUNK_CHARS) {
    chunks.push(fullBase64.slice(offset, offset + MAX_BASE64_CHUNK_CHARS));
  }
  if (chunks.length > MAX_CHUNKS) {
    throw new Error('Screenplay file is too large for chunked cloud storage (max 10 MB).');
  }
  return chunks;
}

function selectKeyArtForGenre(genre: string): KeyArtVariant {
  const g = genre.toLowerCase();
  if (g.includes('sci-fi')) return 'ravana';
  if (g.includes('horror')) return 'sinharaja';
  if (g.includes('crime') || g.includes('noir')) return 'colombo';
  return 'yaksha';
}

export function mapPublicDocToProject(data: DocumentData): PipelineProject {
  const rawStatus =
    data.status === 'Pitch Deck Ready'
      ? ProjectStatus.PITCH_READY
      : ProjectStatus.UNDER_REVIEW;
  const keyArt: KeyArtVariant =
    data.keyArt === 'ravana' ||
    data.keyArt === 'sinharaja' ||
    data.keyArt === 'colombo' ||
    data.keyArt === 'yaksha' ||
    data.keyArt === 'custom'
      ? data.keyArt
      : 'yaksha';

  return {
    id: String(data.scriptId || ''),
    authorUid: String(data.authorUid || ''),
    title: String(data.title || ''),
    status: rawStatus,
    genre: String(data.genre || ''),
    format: String(data.format || 'Original Series'),
    writer: String(data.writer || ''),
    episodesOrRuntime: String(data.episodesOrRuntime || 'Pilot Draft'),
    year: String(data.year || 'නිර්මාණ සංචිතය'),
    keyArt,
    logline: {
      si: String(data.loglineSi || ''),
      en: String(data.loglineEn || ''),
    },
    synopsis: {
      si: String(data.synopsisSi || ''),
      en: String(data.synopsisEn || ''),
    },
    visualTone: String(data.visualTone || ''),
    comparables: String(data.comparables || ''),
    targetModel: String(data.targetModel || ''),
    views: typeof data.views === 'number' ? data.views : 0,
    createdAt: timestampToIso(data.createdAt),
    lastViewedAt: timestampToIso(data.updatedAt),
    isUserSubmitted: true,
  };
}

export function mapPrivateDocToSubmission(data: DocumentData): PrivateSubmissionRecord {
  const validStatus: ReviewStatus =
    data.reviewStatus === 'Shortlisted' ||
    data.reviewStatus === 'Pitch Deck Ready' ||
    data.reviewStatus === 'Archived'
      ? data.reviewStatus
      : 'Pending Review';

  return {
    scriptId: String(data.scriptId || ''),
    authorUid: String(data.authorUid || ''),
    referenceId: String(data.referenceId || ''),
    title: String(data.title || ''),
    writerName: String(data.writerName || ''),
    email: String(data.email || ''),
    phone: String(data.phone || ''),
    genre: String(data.genre || ''),
    format: String(data.format || ''),
    logline: String(data.logline || ''),
    scriptUrl: String(data.scriptUrl || ''),
    fileName: String(data.fileName || ''),
    fileMimeType: String(data.fileMimeType || ''),
    fileSizeBytes: typeof data.fileSizeBytes === 'number' ? data.fileSizeBytes : 0,
    chunkCount: typeof data.chunkCount === 'number' ? data.chunkCount : 0,
    ipConfirmed: Boolean(data.ipConfirmed),
    reviewStatus: validStatus,
    adminNotes: String(data.adminNotes || ''),
    createdAtIso: timestampToIso(data.createdAt),
    updatedAtIso: timestampToIso(data.updatedAt),
  };
}

export interface SubmitCloudPayload {
  user: User;
  referenceId: string;
  writerName: string;
  email: string;
  phone: string;
  genre: string;
  workingTitle: string;
  format: string;
  logline: string;
  scriptUrl: string;
  file: File | null;
  onProgress?: (percent: number) => void;
}

export async function submitScreenplayToCloud(
  payload: SubmitCloudPayload
): Promise<PipelineProject> {
  const { user, onProgress } = payload;
  if (!user.emailVerified) {
    throw new Error('Verified Google account required to submit under NDA.');
  }

  onProgress?.(10);
  const chunks = payload.file ? await sliceFileIntoBase64Chunks(payload.file) : [];
  onProgress?.(25);

  const safeRandom = Math.random().toString(36).replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'x1';
  const scriptId = `scr_${Date.now()}_${safeRandom}`.slice(0, 120);
  const referenceId =
    payload.referenceId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || `LG-${Date.now()}`;

  const cleanTitle = payload.workingTitle.trim().slice(0, 140);
  const cleanWriter = payload.writerName.trim().slice(0, 100);
  const cleanEmail = payload.email.trim().slice(0, 160);
  const cleanPhone = payload.phone.trim().slice(0, 40);
  const cleanGenre = payload.genre.trim().slice(0, 80);
  const cleanFormat = payload.format.trim().slice(0, 80);
  const cleanLogline = payload.logline.trim().slice(0, 1000);
  const cleanUrl = payload.scriptUrl.trim().slice(0, 500);
  const cleanFileName = payload.file ? payload.file.name.trim().slice(0, 200) : '';
  const cleanMimeType = payload.file
    ? (payload.file.type || 'application/octet-stream').trim().slice(0, 120)
    : '';
  const fileSizeBytes = payload.file ? Math.min(payload.file.size, MAX_UPLOAD_BYTES) : 0;

  const episodesOrRuntime = cleanFormat === 'Feature Film' ? 'Feature Script' : 'Pilot Draft';
  const keyArt = selectKeyArtForGenre(cleanGenre);
  const synopsisSi = `${cleanLogline} (NDA යොමු අංකය: ${referenceId} යටතේ සංවර්ධන පරීක්ෂාව සඳහා ලියාපදිංචි කර ඇත.)`.slice(
    0,
    1500
  );
  const synopsisEn = `${cleanLogline} (Logged under Mutual Evaluation NDA Ref ${referenceId} for editorial coverage.)`.slice(
    0,
    1500
  );

  const batch = writeBatch(db);
  const publicRef = doc(db, 'publicScripts', scriptId);
  const privateRef = doc(db, 'privateSubmissions', scriptId);

  batch.set(publicRef, {
    scriptId,
    authorUid: user.uid,
    title: cleanTitle,
    status: 'Under Review',
    genre: cleanGenre,
    format: cleanFormat,
    writer: cleanWriter,
    episodesOrRuntime,
    year: 'නිර්මාණ සංචිතය',
    keyArt,
    loglineSi: cleanLogline,
    loglineEn: cleanLogline,
    synopsisSi,
    synopsisEn,
    visualTone: 'Creator screenplay package in active evaluation',
    comparables: 'Pending Editorial Coverage',
    targetModel: 'Global OTT Co-Production & Pre-Sales Evaluation',
    views: 0,
    isPublished: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(privateRef, {
    scriptId,
    authorUid: user.uid,
    referenceId,
    title: cleanTitle,
    writerName: cleanWriter,
    email: cleanEmail,
    phone: cleanPhone,
    genre: cleanGenre,
    format: cleanFormat,
    logline: cleanLogline,
    scriptUrl: cleanUrl,
    fileName: cleanFileName,
    fileMimeType: cleanMimeType,
    fileSizeBytes,
    chunkCount: chunks.length,
    ipConfirmed: true,
    reviewStatus: 'Pending Review',
    adminNotes: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `privateSubmissions/${scriptId}`);
  }

  onProgress?.(chunks.length === 0 ? 100 : 45);

  for (let i = 0; i < chunks.length; i++) {
    const chunkId = `chunk_${i}`;
    const chunkPath = `privateSubmissions/${scriptId}/fileChunks/${chunkId}`;
    try {
      await setDoc(doc(db, 'privateSubmissions', scriptId, 'fileChunks', chunkId), {
        scriptId,
        chunkId,
        authorUid: user.uid,
        chunkIndex: i,
        dataBase64: chunks[i],
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, chunkPath);
    }
    const pct = 45 + Math.round(((i + 1) / chunks.length) * 55);
    onProgress?.(pct);
  }

  const nowIso = new Date().toISOString();
  return {
    id: scriptId,
    authorUid: user.uid,
    title: cleanTitle,
    status: ProjectStatus.UNDER_REVIEW,
    genre: cleanGenre,
    format: cleanFormat,
    writer: cleanWriter,
    episodesOrRuntime,
    year: 'නිර්මාණ සංචිතය',
    keyArt,
    logline: { si: cleanLogline, en: cleanLogline },
    synopsis: { si: synopsisSi, en: synopsisEn },
    visualTone: 'Creator screenplay package in active evaluation',
    comparables: 'Pending Editorial Coverage',
    targetModel: 'Global OTT Co-Production & Pre-Sales Evaluation',
    views: 0,
    createdAt: nowIso,
    lastViewedAt: nowIso,
    isUserSubmitted: true,
  };
}

export async function downloadSubmissionFile(
  scriptId: string,
  chunkCount: number,
  fileName: string,
  fileMimeType: string
): Promise<void> {
  if (chunkCount <= 0) {
    throw new Error('No uploaded file chunks attached to this submission.');
  }

  const base64Segments: string[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const chunkId = `chunk_${i}`;
    const chunkPath = `privateSubmissions/${scriptId}/fileChunks/${chunkId}`;
    try {
      const snap = await getDoc(doc(db, 'privateSubmissions', scriptId, 'fileChunks', chunkId));
      if (!snap.exists()) {
        throw new Error(`Missing file segment ${chunkId}`);
      }
      base64Segments.push(String(snap.data().dataBase64 || ''));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, chunkPath);
    }
  }

  const bytes = base64ToUint8Array(base64Segments.join(''));
  const blob = new Blob([bytes], {
    type: fileMimeType || 'application/octet-stream',
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName || `${scriptId}_screenplay.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}

export async function incrementCloudScriptViews(scriptId: string): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;
  const path = `publicScripts/${scriptId}`;
  try {
    await updateDoc(doc(db, 'publicScripts', scriptId), {
      views: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function polishPublicScriptDetails(payload: {
  scriptId: string;
  title: string;
  logline: string;
  synopsis: string;
}): Promise<void> {
  if (!auth.currentUser?.emailVerified) {
    throw new Error('Verified Google account required to update your screenplay summary.');
  }

  const cleanTitle = payload.title.trim().slice(0, 140);
  const cleanLogline = payload.logline.trim().slice(0, 1000);
  const cleanSynopsis = payload.synopsis.trim().slice(0, 1500);

  if (cleanTitle.length < 2) {
    throw new Error('Title must be at least 2 characters.');
  }
  if (cleanLogline.length < 20) {
    throw new Error('Logline must be at least 20 characters.');
  }
  if (cleanSynopsis.length < 20) {
    throw new Error('Synopsis must be at least 20 characters.');
  }

  const path = `publicScripts/${payload.scriptId}`;
  try {
    await updateDoc(doc(db, 'publicScripts', payload.scriptId), {
      title: cleanTitle,
      loglineSi: cleanLogline,
      loglineEn: cleanLogline,
      synopsisSi: cleanSynopsis,
      synopsisEn: cleanSynopsis,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateSubmissionAdminReview(
  scriptId: string,
  reviewStatus: ReviewStatus,
  adminNotes: string
): Promise<void> {
  const publicStatus =
    reviewStatus === 'Pitch Deck Ready'
      ? 'Pitch Deck Ready'
      : reviewStatus === 'Archived'
        ? 'Archived'
        : 'Under Review';
  const isPublished = reviewStatus !== 'Archived';
  const sanitizedNotes = adminNotes.trim().slice(0, 2000);

  const batch = writeBatch(db);
  batch.update(doc(db, 'privateSubmissions', scriptId), {
    reviewStatus,
    adminNotes: sanitizedNotes,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'publicScripts', scriptId), {
    status: publicStatus,
    isPublished,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `privateSubmissions/${scriptId}`);
  }
}

export async function deleteSubmissionCompletely(
  scriptId: string,
  chunkCount: number
): Promise<void> {
  const batch = writeBatch(db);
  for (let i = 0; i < chunkCount; i++) {
    const chunkId = `chunk_${i}`;
    batch.delete(doc(db, 'privateSubmissions', scriptId, 'fileChunks', chunkId));
  }
  batch.delete(doc(db, 'privateSubmissions', scriptId));
  batch.delete(doc(db, 'publicScripts', scriptId));

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `privateSubmissions/${scriptId}`);
  }
}
