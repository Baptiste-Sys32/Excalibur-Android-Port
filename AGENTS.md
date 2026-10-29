# Excalibur Android port

- Fully offline on-device. No runtime CDN, remote font, analytics or config.
- Do not edit vendor/. It is pinned at 1caec99b290c75cda05385e637138998807a65ae.
  Record engine-only fixes in docs/audit/ instead.
- No new remotes, fetch or push. Work locally on codex/stabilize from main.
- Small reversible commits, one concern each. Keep app ID and data intact.
- Metric measurements. No em or en dashes. Never print secrets or environment dumps.
- Read docs/, MIGRATION.md and affected source before writing. Keep audit LOG.md
  and DEVICE-CHECKLIST.md current. Do not claim physical S Pen tests from simulation.

After every change run:

```
npx tsc -b
npm run lint
npm run build
(cd android && ./gradlew :app:compileDebugJavaWithJavac)
git diff --check
```

Full debug: `npm run android:build:debug`. Check `adb devices`; install and run
when available. Do not wait for a device. Record unavailable checks.

Commit format: follow `git show -s c064001a 607f12c1`: imperative subject,
prose paragraphs explaining the problem, change and measured evidence, then
`test:`, `device:`, `rollback:` trailer lines. Never invent measurements.

Before committing verify .gitignore and .opencodeignore cover .env*, *.pem,
*.key, *secret*, *token*, auth.json, credentials and *.keystore. Scan tracked
files for credential markers without printing matching contents.
