# Rollback runbook

## Before risky work

1. Create a work branch:
   - `git switch -c rebuild/<work-unit>`
2. Create an annotated backup tag:
   - `git tag -a backup-pre-<work-unit>-YYYY-MM-DD -m "Pre-change rollback point"`
3. Push the branch and tag only when explicitly requested for that work unit.
4. Export a current device backup before migration or storage changes.
5. Record the app ID, version code, version name, and signing identity.

## Application identity

The rebuild must preserve:

- Android application ID.
- FileProvider authority.
- Signing certificate for updates over an existing install.
- User-visible filenames and storage locations unless a migration explicitly
  preserves and verifies them.

Never publish a release signed with a debug key.

## Data rollback order

1. Stop and assess; do not run additional migrations.
2. Restore the previous Git commit, branch, or tag for code.
3. Restore user data from the pre-change device backup if storage changed.
4. Reopen:
   - Current scene.
   - Autosave/recovery snapshots.
   - Libraries.
   - Templates.
   - Canvas timelines.
   - Previously restorable backups.
5. If metadata was rewritten, prefer the preserved previous-valid copy over
   automatic regeneration.
6. File a follow-up work unit instead of bundling a fix into the next change.

## Downgrade constraints

- New storage schemas must remain backward readable for at least one release
  unless a migration explicitly versions and preserves the old format.
- Old backup archives must remain restorable.
- Never require uninstall/reinstall as a rollback strategy.
- Never delete legacy source files before their replacements are verified.

## Release rollback

1. Revert or check out the last known-good tag.
2. Rebuild the same artifact type from that source state.
3. Verify app ID, version metadata, and signing certificate.
4. Reinstall over the existing app without clearing app data.
5. Restore from the pre-release device backup only if data was affected.
