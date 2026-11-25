# Security Specification for School of Technology (SOT)

## Data Invariants
1. A student's profile at `/users/{userId}` can only be read and modified by the authenticated user whose `request.auth.uid == userId`.
2. A matric registry entry at `/matric_registry/{matricId}` can only be reserved if the caller owns the record (`incoming().uid == request.auth.uid`) and does not overwrite an existing entry registered to a different user.
3. Profile completeness (`profileComplete == true`) requires valid non-empty department belonging to the allowed 7 departments and a valid non-empty matric number.
4. User IDs must be valid identifiers matching `^[a-zA-Z0-9_-]+$`.
5. Matric identifiers must match safe character sets `^[a-zA-Z0-9_\\-]+$`.

## The Dirty Dozen Payloads (Rejection Targets)
1. **Unauthenticated Read on User Profile**: Guest reads `/users/user123` -> PERMISSION_DENIED.
2. **Cross-User Profile Read**: User A (`auth.uid == userA`) reads `/users/userB` -> PERMISSION_DENIED.
3. **Cross-User Profile Write**: User A attempts to write `/users/userB` -> PERMISSION_DENIED.
4. **UID Spoofing**: User A attempts to set `incoming().uid = 'userB'` in `/users/userA` -> PERMISSION_DENIED.
5. **Junk ID Poisoning**: Writing to document ID with oversized characters `/users/$$$malicious$$$` -> PERMISSION_DENIED.
6. **Matric Steal/Overwrite**: User B tries to overwrite an existing `/matric_registry/SOT-2024-001` owned by User A -> PERMISSION_DENIED.
7. **Foreign Matric Reservation**: User A tries to create `/matric_registry/SOT-2024-002` with `uid = 'userB'` -> PERMISSION_DENIED.
8. **Invalid Department Injection**: User attempts to set `department: 'Hacking 101'` -> PERMISSION_DENIED.
9. **Oversized String Payload**: User attempts to inject 2MB matric string into matricNumber -> PERMISSION_DENIED.
10. **Shadow Fields Injection**: Writing arbitrary rogue fields like `isAdmin: true` or `role: 'dean'` into `/users/{userId}` -> PERMISSION_DENIED.
11. **Blanket Collection Scrape**: Attempting unbounded query without user UID isolation -> PERMISSION_DENIED.
12. **Unauthenticated Matric Check/Write**: Guest writes to `/matric_registry/{matricId}` -> PERMISSION_DENIED.
13. **Zero-PII Voice Phrase Logs**: `/unrecognizedVoicePhrases/{phraseId}` allows signed-in creation ONLY with fields `['phrase', 'normalizedPhrase', 'pageContext', 'createdAt']` (`phrase.size() <= 300`). Any PII fields (`uid`, `name`, `email`, `audio`), updates, or non-admin reads are rejected -> PERMISSION_DENIED.

