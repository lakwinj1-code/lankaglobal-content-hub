# Security Specification — LankaGlobal Content Hub & Filmmaker Community

## 1. Data Invariants
1. **Member Account PII & Zero Self-Assigned Roles (`/users/{userId}`)**: Registered member profiles contain `uid`, `displayName`, `email`, `creatorType` (`Screenwriter` | `Producer` | `Reader`), `createdAt`, and `updatedAt`. `read` (`get`) is strictly isolated to `request.auth.uid == userId || isAdmin()`; `list` is `false`. No admin/privilege boolean exists on `/users/{userId}`.
2. **Split-Collection Public Creator Profile (`/creatorProfiles/{userId}`)**: Public LinkedIn/Facebook-style filmmaker profiles contain strictly zero PII (no email, phone, or physical address). Fields are bounded (`uid`, `displayName`, `creativeRole`, `headline`, `bio`, `location`, `openToCollab`, `followersCount`, `followingCount`, `isPublic`, `createdAt`, `updatedAt`). `followersCount` can only change by `+1` or `-1` when atomically paired (`exists` / `existsAfter`) with creating or deleting `/follows/$(request.auth.uid + '_' + userId)`.
3. **Deterministic Social Follow Graph (`/follows/{followId}`)**: `followId` must strictly match `followerUid + '_' + followingUid`, `followerUid` must equal `request.auth.uid`, and `followerUid != followingUid`. `list` strictly enforces `existing().followerUid == request.auth.uid || existing().followingUid == request.auth.uid || isBootstrappedAdmin()`.
4. **Open Filmmaker Stage & Subcollections (`/communityPosts/{postId}`, `likes`, `comments`)**: Posts require a verified creator identity (`authorUid == request.auth.uid`). `likesCount` increments/decrements by 1 only when atomically paired with creating/deleting `/communityPosts/$(postId)/likes/$(request.auth.uid)`. Subcollections `likes` and `comments` enforce the Master Gate against parent `/communityPosts/$(postId)`.
5. **Private Creator Collaboration & Story Inquiries (`/collabRequests/{requestId}`)**: Contains optional voluntary contact handle (`senderContact`) and collaboration messages. `get` and `list` are strictly isolated to `existing().senderUid == request.auth.uid || existing().recipientUid == request.auth.uid` (plus admin). Terminal State Locking prevents non-admin updates once `status` reaches `'Accepted'` or `'Declined'`.
6. **Split-Collection Screenplay PII & IP Isolation**: `/publicScripts/{scriptId}` NEVER contains writer PII (`email`, `phone`) or confidential screenplay files/URLs (`scriptUrl`, `dataBase64`). All PII and screenplay binary chunks live exclusively in `/privateSubmissions/{scriptId}` and `/privateSubmissions/{scriptId}/fileChunks/{chunkId}`.
7. **Atomic Dual-Record Creation**: Neither `/publicScripts/{scriptId}` nor `/privateSubmissions/{scriptId}` can be created in isolation; `existsAfter()` mandates both records be committed in the same atomic batch.
8. **Bootstrapped Verified Admin & Temporal Integrity**: Administrator privileges (`isAdmin()`) require `request.auth != null && request.auth.token.email_verified == true` AND either `request.auth.token.email.lower() == 'lakwinj1@gmail.com'` or an existing `/admins/$(request.auth.uid)` document. All `createdAt` and `updatedAt` fields must equal `request.time`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unverified Admin Email Spoof**: `{ auth: { uid: "attacker", email: "lakwinj1@gmail.com", email_verified: false }, op: "list", path: "/privateSubmissions" }`
2. **Shadow Field Injection on Create**: `/creatorProfiles/uid_1` payload containing extra key `"isVerifiedBadge": true`.
3. **Orphaned Public Script Create**: Creating `/publicScripts/scr_orphan` without atomically creating `/privateSubmissions/scr_orphan`.
4. **Identity Spoofing on Community Post**: Authenticated `uid_A` setting `authorUid: "uid_B"` in `/communityPosts/post_1`.
5. **PII Leak via Direct Get on Private Collaboration Request**: Authenticated `uid_C` calling `get` on `/collabRequests/req_1` between `uid_A` and `uid_B`.
6. **Unauthorized Query Scraping on CollabRequests**: Authenticated `uid_C` calling `list` on `/collabRequests` without sender/recipient ownership.
7. **Fake Follower Inflation Attack (+1000)**: Authenticated user updating `/creatorProfiles/uid_target` with `followersCount: 1000` or without atomic `/follows/` creation.
8. **Value Poisoning on Update**: Creator updating `bio` on `/creatorProfiles/uid_1` with a 50,000-character string or boolean.
9. **ID Poisoning Attack**: Creating `/communityPosts/` with a 300-character ID or special characters (`post$bad/id`).
10. **Forged Client Timestamp**: Creating `/communityPosts/post_1` with `createdAt: Timestamp(2020, 1, 1)` instead of `request.time`.
11. **Terminal State Bypass on Accepted CollabRequest**: Recipient attempting to mutate `status` or `replyNote` on `/collabRequests/req_accepted` after `status == 'Accepted'`.
12. **Self-Follow Injection**: Authenticated `uid_A` creating `/follows/uid_A_uid_A` where `followerUid == followingUid`.
