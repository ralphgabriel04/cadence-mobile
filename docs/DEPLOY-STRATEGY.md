# Deploy Strategy — cadence-mobile

> Related: [#37 CI/CD Pipeline](https://github.com/ralphgabriel04/cadence-mobile/issues/37)

## Overview

The mobile deploy strategy is rolled out in **three phases** to match the project timeline (pre-launch → beta → release). Earlier phases are cheap and fast; later phases require paid developer accounts and manual store reviews.

| Phase | What ships | Prereqs | Sprint |
|-------|------------|---------|--------|
| **1** | OTA updates via `eas update` | `EXPO_TOKEN` + `eas init` | Sprint 2 ✅ |
| **2** | Internal preview builds (TestFlight / APK) | Apple Dev Program + Google Play Console + API credentials | Sprint 10 |
| **3** | Automated store submission on tag `v*` | Phase 2 complete + first manual store submission | Sprint 11 |

---

## Phase 1 — OTA updates (current)

Publishes JavaScript-only updates to the Expo update service. Does **not** produce new native binaries.

**What it can update:** JS/TS code, assets bundled with Metro, React components, static content.
**What it cannot update:** Native modules, `app.json` permissions/plugins, bundle identifier, icon, splash screen.

### Workflow trigger

- **Push to `develop`** → publishes to the `preview` branch on Expo → delivered to builds on the `preview` channel
- **Push to `main`** → publishes to the `production` branch on Expo → delivered to builds on the `production` channel

See `.github/workflows/deploy-ota.yml`.

### Configuration

- `app.json` — `expo.runtimeVersion.policy = "appVersion"` ensures the update is only served to builds with the same native app version
- `eas.json` — `build.preview.channel = "preview"` and `build.production.channel = "production"` map build profiles to channels

### One-time setup (manual, solo dev)

1. Create Expo account → https://expo.dev/signup
2. `pnpm dlx eas-cli@latest login` (locally)
3. `pnpm dlx eas-cli@latest init` → injects `expo.extra.eas.projectId` into `app.json`, commit the change
4. `pnpm dlx eas-cli@latest update:configure` → wires up the update service URL
5. Create a token at https://expo.dev/accounts/{account}/settings/access-tokens
6. Add it to GitHub: Settings → Secrets and variables → Actions → new secret `EXPO_TOKEN`
7. Push a commit to `develop` — the `EAS OTA Update` workflow should run and publish

Until step 6 is done, the workflow skips gracefully with a `::notice::` warning instead of failing.

### How testers receive updates

An OTA update only reaches devices that already have a native build of the app. For Phase 1 the intended consumers are:

- **Dev client builds** you have installed locally via Expo Go / dev-client APK
- **Preview / production builds** once Phases 2-3 land

There are **no end-users yet** in Phase 1 — it's purely a dev convenience.

---

## Phase 2 — Internal preview builds (Sprint 10)

Builds real `.ipa` (iOS) and `.apk` (Android) artifacts via `eas build --profile preview` and distributes them to internal testers.

### What unblocks this phase

| Prereq | Cost | Time |
|--------|------|------|
| Apple Developer Program enrollment | $99 USD/year | 1-2 business days (verification) |
| App Store Connect app record created | included | 15 min |
| TestFlight internal testing setup | included | 15 min |
| Google Play Console account | $25 USD one-time | 2-3 business days (verification) |
| Google Play internal testing track | included | 15 min |
| Apple Team ID + App Store Connect API key | included | 10 min |

### Workflow addition

New `.github/workflows/build-preview.yml` triggered on:

- Manual dispatch (`workflow_dispatch`)
- Push of a tag matching `v*-rc.*` (release candidate tags)

The workflow runs `eas build --profile preview --platform all --non-interactive`. Output: build artifacts uploaded to Expo, TestFlight (iOS), and downloadable APK (Android).

### Acceptance criteria for Phase 2

- [ ] Apple Dev Program active + app record exists in App Store Connect
- [ ] Google Play Console active + internal testing track configured
- [ ] ASC API key stored as GH secret `ASC_API_KEY_BASE64` + `ASC_API_KEY_ID` + `ASC_API_ISSUER_ID`
- [ ] Google Play service account JSON stored as GH secret `GOOGLE_SERVICE_ACCOUNT_JSON`
- [ ] Tag `v0.1.0-rc.1` triggers a successful preview build on both platforms
- [ ] Internal testers receive TestFlight invite within 1 hour of build completion

---

## Phase 3 — Automated store submission (Sprint 11)

Adds `eas submit` after `eas build` on release tags to push new versions to the App Store and Google Play automatically.

### Prerequisites beyond Phase 2

- [ ] At least **one successful manual store submission** has been completed (Apple requires human review on first submission, Google requires data safety / content rating forms to be filled out interactively)
- [ ] App listing metadata, screenshots, privacy policy, and review notes are complete on both stores
- [ ] `eas.json` `submit.production` block populated with ASC app info and Play track

### Workflow addition

New `.github/workflows/release.yml` triggered on:

- Push of a tag matching `v*` (excluding `v*-rc.*`)

Runs `eas build --profile production --platform all --auto-submit --non-interactive`. Output: new version uploaded to App Store Connect (pending Apple review) and Google Play (internal → closed → production progression configured in Play Console).

### Acceptance criteria for Phase 3

- [ ] First manual submission (`eas build --profile production` + `eas submit --profile production`) completed successfully on both stores
- [ ] Tagging `v1.0.0` triggers build + submit end-to-end
- [ ] Release notes sourced from `CHANGELOG.md` or `git log v0.x..HEAD` automatically
- [ ] `autoIncrement` in `eas.json` production profile handles build numbers

---

## FAQ

**Q: Why not use `eas update --auto`?**
We map `main` → `production` channel and `develop` → `preview` channel explicitly, so the branch name in Expo matches the channel name on the build. `--auto` would use the git branch name `main`, which wouldn't match the `production` channel without an extra mapping in the Expo dashboard.

**Q: What happens if someone force-pushes to `main`?**
Force push is blocked by the `protect-main-develop` ruleset on the repo. The OTA workflow still runs on any push that lands on the branch, so rollbacks happen by pushing a revert commit — **not** by force push.

**Q: Can a broken update brick user devices?**
No. Expo's update mechanism is atomic: a failed update falls back to the last known-good embedded bundle. You can also roll back on the Expo dashboard by pointing the channel at a prior update.

**Q: Why not publish on PR merge instead of push?**
PR merges ARE pushes on the target branch. The `push` trigger covers both direct commits and merge commits — the ruleset ensures only PR merges can land.
