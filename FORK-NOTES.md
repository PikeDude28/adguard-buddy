# PikeDude28 AdGuard Buddy Fork Notes

This repository is a personal fork of:

https://github.com/chrizzo84/adguard-buddy

The purpose of this fork is to maintain a known-good AdGuard Buddy build for my Unraid environment while preserving several local fixes.

## Current deployment

Docker image:

`ghcr.io/pikedude28/adguard-buddy:latest`

Unraid container:

`AdGuardBuddy`

Persistent Data Dir mapping:

Host:
`/mnt/user/appdata/adguard-buddy`

Container:
`/app/.data`

## Local changes that must be preserved

### 1. Configurable request timeout

AdGuard Buddy originally used a fixed HTTP timeout.

This fork supports:

`ADGUARD_BUDDY_REQUEST_TIMEOUT_MS`

Current Unraid value:

`300000`

This allows long AdGuard Home Filtering operations to finish without Buddy reporting a timeout.

Relevant code:

`src/lib/httpRequest.ts`

Do not remove this behavior when merging upstream changes unless upstream has implemented an equivalent or better configurable timeout.

---

### 2. Persistent Auto-Sync configuration

Upstream originally stored the Auto-Sync configuration outside the persistent Data Dir.

This fork stores it at:

`/app/.data/auto-sync-config.json`

Host equivalent:

`/mnt/user/appdata/adguard-buddy/auto-sync-config.json`

This allows Auto-Sync settings to survive container recreation, image updates, stop/start, and Unraid reboot.

Relevant code:

`src/app/lib/auto-sync-scheduler.ts`

---

### 3. Persistent Auto-Sync history

Auto-Sync history is stored at:

`/app/.data/logs/auto-sync-logs.json`

Host equivalent:

`/mnt/user/appdata/adguard-buddy/logs/auto-sync-logs.json`

The `/app/.data` directory is already mapped persistently in Unraid.

The host `logs` directory must remain writable by the Buddy container user (UID 1000).

---

### 4. Filtering refresh behavior

The original Filtering sync refreshed filter lists on both the master and the replica.

This fork does not automatically issue `filtering/refresh` to the replica after a Filtering sync.

The master refresh remains enabled.

This was changed because replica refreshes could take a long time and because each AdGuard Home instance may use a different provider/API key.

Relevant code:

`src/app/api/sync-category/sync-logic.ts`

IMPORTANT:

This change prevents the immediate replica refresh, but it does not necessarily prevent a master-specific filter URL/API key from being copied to the replica.

If Q-Feeds begins rejecting requests because both AdGuard instances are using the same API key, Filtering URL synchronization will need further modification to preserve per-replica Q-Feeds URLs/API keys.

---

## Known-good behavior

As of September 2026:

- Auto-Sync scheduler persists across container restart.
- Auto-Sync history persists across container restart.
- Sync history is written under `/app/.data/logs`.
- Filtering sync completes successfully with a 300000 ms request timeout.
- Other sync categories complete normally.
- Docker image is built by GitHub Actions from this fork.

## Upstream update policy

Do NOT automatically replace this fork with upstream `main`.

Before taking an upstream update:

1. Review what changed upstream.
2. Determine whether the update is needed.
3. Create a temporary update branch.
4. Merge upstream into the temporary branch.
5. Resolve conflicts while preserving the local changes documented above.
6. Run GitHub Actions / CI.
7. Test the resulting Docker image.
8. Merge into this fork's `main` only after verification.

Never use an option that says to discard this fork's commits unless the intention is to permanently remove these customizations.

## Reasons to consider an upstream update

Consider updating only when useful, such as:

- AdGuard Home API compatibility changes
- security fixes
- Docker / Node / dependency compatibility fixes
- Unraid or Docker changes that break the current image
- a feature that is specifically wanted
- a bug that affects this deployment

If the existing fork continues to work correctly, remaining on the current version is acceptable.
