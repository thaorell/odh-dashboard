---
name: upstream-sync
description: Sync upstream changes for a package and open a PR. Pass a package name as the first argument (e.g. model-registry or notebooks) or be prompted to choose. Optionally pass a PR URL to do a temporary test sync.
---

# Upstream Sync

Sync upstream changes for a package and open a PR.

This command orchestrates the entire sync process: branch creation, running the update-subtree script, resolving conflicts, running tests, and opening a PR.

## Arguments

- `$ARGUMENTS` — Optional. Can be:
  - A package name (e.g. `model-registry`, `notebooks`) — runs a normal sync for that package
  - A package name followed by a PR URL (e.g. `model-registry https://github.com/kubeflow/model-registry/pull/1234`) — runs a PR test sync
  - A PR URL alone (e.g. `https://github.com/kubeflow/model-registry/pull/1234`) — infers the package from the URL's repo
  - Empty — prompts the user to choose a package

## Resolving the Package

Packages with upstream subtrees have a `subtree` field in their `package.json` under `packages/<name>/package.json`.

1. If the user provided a package name argument, use it directly as `<package-name>`.
2. If the user provided only a PR URL, infer the package by matching the URL's GitHub owner/repo against the `subtree.repo` field in each package's `package.json`.
3. If no argument was provided, discover all packages with a `subtree` config:
   ```bash
   grep -rl '"subtree"' packages/*/package.json | sed 's|packages/||;s|/package.json||'
   ```
   Present the list to the user and ask which package to sync.

Once the package is identified, read `packages/<package-name>/package.json` to get the `subtree` config. Extract the upstream GitHub `<owner>/<repo>` from the `subtree.repo` URL.

## PR Test Mode

If the user passes a PR URL as an argument (e.g. `/upstream-sync model-registry https://github.com/kubeflow/model-registry/pull/1234`), this is a **temporary test sync** to validate an upstream PR's changes in odh-dashboard before the upstream PR merges. The differences from a normal sync are noted inline below with **[PR Test Mode]** markers.

## Workflow

### Phase 1: Setup

First, check the current branch state:

1. Run `git branch --show-current` to get the current branch name
2. Run `git status` to check for uncommitted changes or unresolved conflicts

**If on a `<pkg>-sync-*` or `tmp-sync-pr-*` branch:**
- Continue with the existing branch (supports resuming a sync in progress)
- If there are unresolved conflicts (files in "Unmerged paths"), proceed to Phase 3
- If there are staged changes ready to continue, proceed to Phase 2 with `--continue`

**If on `main`:**
- Ensure working directory is clean (no uncommitted changes)
- Run `git pull` to ensure main is up to date before starting the sync
- **[PR Test Mode]** Generate branch name: `tmp-sync-pr-<number>` (extract the PR number from the URL)
- **[Normal Mode]** Generate branch name: `<pkg>-sync-YYYY-MM-DD` (use today's date; `<pkg>` is a short prefix like `mr` for model-registry, `nb` for notebooks, etc.)
- Check if this branch already exists with `git branch --list <branch-name>`
  - If it exists, ask user if they want to create `<branch-name>-2` (or find next available suffix)
- Create and switch to the branch: `git checkout -b <branch-name>`

**If on any other branch:**
- Ask user if they want to switch to main and start a fresh sync, or abort

### Phase 2: Run Sync Script

Run the update-subtree script from the `packages/<package-name>` directory:

```bash
cd packages/<package-name> && npm run update-subtree
```

**[PR Test Mode]** Pass the `--pr` flag with the PR URL:
```bash
cd packages/<package-name> && npm run update-subtree -- --pr=<pr-url>
```

Or if continuing after conflict resolution:
```bash
cd packages/<package-name> && npm run update-subtree -- --continue
```

Parse the output to detect:
- **Success messages** like "Applied commit X/Y: ..."
- **Conflict detection**: Look for "Conflict detected" in output
- **Completion**: Look for "Already up-to-date" or successful completion of all commits
- **Upstream commit SHA**: The commit hash being synced to (appears in output and commit messages)

### Phase 3: Conflict Resolution

When conflicts are detected:

1. **Identify conflicting files**: Run `git status` and look for files under "Unmerged paths"

2. **Record conflict info** for later use in PR description:
   - The PR number and title (from the script's output message, e.g., "Commit message: Add tensor type filter (#2135)")
   - The specific file paths that have conflicts
   - The nature of the conflict (what caused it - e.g., import path conventions differ between upstream and downstream, overlapping changes to the same code section, etc.)
   - How the conflict was resolved (e.g., kept both features, maintained downstream conventions while incorporating upstream changes, etc.)

3. **For each conflicting file**:
   - Read the file to find conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
   - Analyze what "ours" (HEAD) contains vs what "theirs" (incoming) contains
   - Explain the conflict to the user and suggest a resolution strategy
   - Offer to apply the suggested resolution OR let the user handle it manually

4. **After resolution**:
   - Stage the resolved files: `git add <file1> <file2> ...`
   - Continue the sync: `cd packages/<package-name> && npm run update-subtree -- --continue`
   - Repeat this phase if more conflicts are encountered

### Phase 4: Lint and Tests

After the sync completes successfully, run lint and tests. Check which scripts are available in the package's upstream frontend:

```bash
cd packages/<package-name>/upstream/frontend && cat package.json | grep -E '"test:|"type-check'
```

**Step 1: Lint (required before creating a PR)**

Run lint first — CI will reject the PR if this fails:

```bash
cd packages/<package-name>/upstream/frontend && npm run test:lint
```

If lint fails, try auto-fixing:

```bash
cd packages/<package-name>/upstream/frontend && npm run test:fix
```

After auto-fix, re-run `test:lint` to confirm all issues are resolved. If issues remain that can't be auto-fixed, fix them manually. Stage and commit any lint fixes:

```bash
git add packages/<package-name> && git commit -m "Fix lint issues from upstream sync"
```

**Step 2: Unit tests**

```bash
cd packages/<package-name>/upstream/frontend && npm run test:unit
```

**Step 3: Type check**

```bash
cd packages/<package-name>/upstream/frontend && npm run test:type-check
```

Report results to the user. If there are failures, let the user decide how to proceed.

### Phase 5: Create PR

Ask the user if they're ready to open a PR. If not, exit gracefully.

**Extract PR information:**

1. Get all sync commits since main:
   ```bash
   git log main..HEAD --oneline
   ```

2. Extract PR numbers from commit messages - look for patterns like `(#XXXX)` in messages that contain "Update @odh-dashboard/<package-name>:"

3. Filter to only include commits with actual file changes (exclude commits that say "tracking" or "no file changes")

4. Get the upstream commit SHA from the latest sync commit or from `packages/<package-name>/package.json`

**Build PR content:**

First, read the PR template at `.github/pull_request_template.md` to get the current structure and "Request review criteria" checklist. The PR body should follow this template's structure.

**[Normal Mode]** Title format:
```text
Sync from <owner>/<repo> <7-char-sha>
```

**[PR Test Mode]** Title format:
```text
[DO NOT MERGE] Test sync for <owner>/<repo>#<pr-number>
```

Body sections (following the PR template structure):

**[PR Test Mode] Description section:**
```markdown
## Description

**This is a temporary test sync and should not be merged.**

This PR syncs the changes from [<owner>/<repo>#<pr-number>](https://github.com/<owner>/<repo>/pull/<pr-number>) into odh-dashboard so they can be tested before the upstream PR merges. The branch is available for local testing or CI validation.
```

Then include the "Conflicts Resolved" subsection (if any), "How Has This Been Tested?", "Test Impact", and "Request review criteria" sections as normal.

**[Normal Mode] Description section:**
```markdown
## Description

Sync to pull in changes from:
* https://github.com/<owner>/<repo>/pull/<PR1>
* https://github.com/<owner>/<repo>/pull/<PR2>
...

### Conflicts Resolved

The following conflicts were resolved during this sync:

**[#<PR> - <title>](https://github.com/<owner>/<repo>/pull/<PR>)**
- `<file path>`
- `<file path>`

*Nature of conflict:* <Brief explanation of what caused the conflict - e.g., import path differences, overlapping code changes, etc.>

*Resolution:* <Brief explanation of how the conflict was resolved - e.g., kept both features, maintained downstream conventions while adding upstream changes, etc.>
```

**If there were no conflicts**, omit the "Conflicts Resolved" subsection entirely.

**How Has This Been Tested? section:**
```markdown
## How Has This Been Tested?

Tested by running the federated <package-name> package locally, verifying existing behavior in the files this diff touches, and verifying the incoming changes.

Also ran available test scripts in `packages/<package-name>/upstream/frontend`.
```

**Test Impact section:**
```markdown
## Test Impact

Upstream changes include their own tests.
```

**Request review criteria section:**
Copy the "Request review criteria" section exactly as it appears in `.github/pull_request_template.md`, including all checklist items. It is not hard-coded here, read it from the template file to ensure it stays current.

**Push and create PR:**

1. Detect the upstream repo and fork owner:
   - Run `git remote get-url upstream` to extract `<upstream-owner>/<upstream-repo>`
   - Run `git remote get-url origin` to extract `<fork-owner>`
2. Ask user for confirmation before pushing
3. Push the branch to the fork: `git push -u origin <branch-name>`
4. Create a cross-fork PR against the upstream repo:
   ```bash
   gh pr create --repo <upstream-owner>/<upstream-repo> --head <fork-owner>:<branch-name> --base main --title "<title>" --body "<body>"
   ```
5. Report the PR URL to the user
6. **Only if in PR Test Mode** (the user passed a PR URL argument — the branch name starts with `tmp-sync-pr-`): immediately close the PR after creating it, since it exists only to share the branch and trigger CI:
   ```bash
   gh pr close <pr-number> --repo <upstream-owner>/<upstream-repo>
   ```
   **Do NOT close the PR in normal mode.** Normal sync PRs are meant to be reviewed and merged.

## Package-Specific: Notebooks

The notebooks package (`packages/notebooks`) syncs from `opendatahub-io/workbenches` and has unique challenges due to local ODH modifications, a Go backend, and generated TypeScript types.

### Known Local ODH Modifications

These files intentionally diverge from upstream. Preserve the local modifications when resolving conflicts.

| File (relative to `upstream/`) | Local Modification | Why |
|---|---|---|
| `workspaces/frontend/src/app/pages/Workspaces/Form/WorkspaceForm.tsx` | `/* eslint-disable @cspell/spellchecker */` at line 1; `navigate(-1)` instead of `navigate('workspaces')` | cspell config doesn't resolve from upstream path; go-back behavior in federated mode |
| `workspaces/frontend/src/odh/NotebooksWrapper.tsx` | Entire file is ODH-only | Federated module entry point with ModularArchContextProvider |
| `workspaces/frontend/src/odh/extensions.ts` | Entire file is ODH-only | Federated module extension definitions |
| `workspaces/frontend/src/app/components/NamespaceSelector.tsx` | ODH-only component | Federated namespace selection UI |
| `workspaces/frontend/src/app/pages/Workspaces/Workspaces.tsx` | NamespaceSelector integration, PF import paths | ODH federated integration |
| `workspaces/frontend/config/moduleFederation.js` | `@odh-dashboard/plugin-core` shared singleton, `exposes: {'./extensions': ...}`, `dts: true` | Module Federation ODH integration (see Post-Sync Module Federation Patch) |
| `workspaces/backend/cmd/main.go` | `StaticAssetsDir` flag and config field | Frontend static asset serving in federated mode |
| `workspaces/backend/internal/config/environment.go` | `StaticAssetsDir` struct field | Companion to main.go change |
| `workspaces/backend/api/app.go` | `StaticAssetsDir` / Module Federation static file serving via `http.NewServeMux()` | Static asset serving combined with upstream API handler; mux wraps both API routes and file server |
| `workspaces/controller/internal/controller/workspace_controller.go` | Kube-rbac-proxy constants (lines ~73-84), `odhComponentLabelKey`/`odhNamespaceLabelKey`/`odhComponentWorkspace` label constants, deferred StatefulSet reconcile via `reconcileOwnedStatefulSet()` helper method, `generateWorkspaceSuffixedName` function, `maxGatewayNameLength` constant | Downstream refactored inline StatefulSet reconciliation into a helper; kube-rbac-proxy sidecar support; ODH-specific labels |
| `Dockerfile.workspace` | `ENV GOTOOLCHAIN=auto` in BFF build stage | UBI9 go-toolset image lags behind upstream go.mod version |

### Upstream Reference Clone

**Set up an upstream clone at the target commit early** — this is the single most important tool for conflict resolution. Keep it throughout the entire sync as a reference for wholesale replacements and post-sync verification:

```bash
git clone -q --depth=1 https://github.com/opendatahub-io/workbenches.git /tmp/nb-upstream-files
cd /tmp/nb-upstream-files && git log --oneline -1  # verify at expected HEAD
```

Use this clone to:
- Replace any file that has no ODH modifications (faster than manual merge)
- Verify files match the target after sync completes
- Check file existence (files added/removed upstream)

**Do not delete this clone until the PR is created.** Post-sync verification depends on it.

### Wholesale Replacement Strategy

For files with **no ODH modifications** (not in the Known Local ODH Modifications table), always prefer replacing wholesale from the upstream reference clone over manual patch merging. This is faster and eliminates merge artifacts:

```bash
cp /tmp/nb-upstream-files/<path> packages/notebooks/upstream/<path>
```

Files that should almost always be replaced wholesale on conflict:
- `go.mod`, `go.sum` — dependency version differences cause repeated conflicts
- `package-lock.json` — too complex to merge
- `docs.go`, `swagger.json` — generated OpenAPI files
- `src/generated/*.ts` — generated TypeScript types
- Test files, mock files — no ODH modifications
- Any file not in the ODH modifications table

After replacing, clean up patch artifacts:
```bash
find packages/notebooks/upstream -name "*.patch" -o -name "*.patch-info.txt" | xargs rm -f 2>/dev/null
```

### Known Conflict Patterns

**CODEOWNERS-only commits** — Upstream commits touching only CODEOWNERS produce no local file changes. The script exits with "No staged changes found". Fix: manually advance the tracking commit:
```bash
jq --arg commit "<sha>" '.subtree.commit = $commit' packages/notebooks/package.json > packages/notebooks/package.json.tmp \
  && mv packages/notebooks/package.json.tmp packages/notebooks/package.json \
  && git add packages/notebooks/package.json \
  && SKIP_LINT_HOOK=true git commit -q -m "Update @odh-dashboard/notebooks tracking to <short-sha> (CODEOWNERS only, no file changes)"
```
Then re-run `npm run update-subtree` (not `--continue`).

**package-lock.json conflicts** — Always conflicts on dependency bumps. Replace wholesale from the upstream reference clone:
```bash
cp /tmp/nb-upstream-files/workspaces/frontend/package-lock.json packages/notebooks/upstream/workspaces/frontend/package-lock.json
```

**Go dependency version mismatches** (`go.mod`, `go.sum`) — Downstream may pin different k8s.io versions than upstream. These files conflict on nearly every dependency-related commit. Replace wholesale from the upstream reference clone — version reconciliation happens separately.

**Generated files** (`docs.go`, `swagger.json`, `src/generated/*.ts`) — Auto-generated from the backend API. Always replace wholesale from the upstream reference clone.

**`workspace_controller.go` conflicts** — This file has extensive ODH modifications and conflicts frequently. When resolving:
1. Keep all kube-rbac-proxy constants (lines ~73-84)
2. Keep `odhComponentLabelKey`/`odhNamespaceLabelKey`/`odhComponentWorkspace` label constants
3. Keep the deferred StatefulSet reconcile via `reconcileOwnedStatefulSet()` helper method (do NOT inline it back)
4. Keep `generateWorkspaceSuffixedName` function and `maxGatewayNameLength` constant
5. Accept all new upstream functions, constants, and imports
6. Watch for `listOpts :=` vs `listOpts =` — if there's a prior declaration, the service section should use `=` not `:=`

**`app.go` conflicts** — ODH adds static file serving; upstream may add middleware (e.g., gzip compression). Combine both: the mux handles API routes + static file serving, and the entire mux gets wrapped in the upstream middleware:
```go
mux.Handle(constants.PathPrefix+"/", router)
// ... static file serving block ...
return a.recoverPanic(a.enableCORS(gzhttp.GzipHandler(mux)))
```

**Files stuck at intermediate commits** — When patches are rejected and files are replaced from an intermediate commit during conflict resolution, they end up out of date with the final target. This is common and affects many files — not just the ones that had explicit conflicts. The post-sync verification step (below) catches these.

**`set -e` crash on no-op patches** — The `package-subtree.sh` script uses `set -e`. When a patch applies cleanly but produces no file changes (because files are already at the target state), `safe_git_commit_if_changes` returns exit code 2, which `set -e` treats as a failure. The script silently exits with no error message. If the sync stops after "Applying commit X/Y" with no conflict output, this is likely the cause. Workaround: temporarily add `|| commit_exit_code=$?` on the `safe_git_commit_if_changes` call line (~line 849), or advance the tracking commit past the problematic range.

### Post-Sync Module Federation Patch

After the sync completes, check `moduleFederation.js` — it may have been overwritten with the midstream version which lacks ODH-specific entries. Verify and patch if needed:

1. `@odh-dashboard/plugin-core` must be a shared singleton
2. `exposes` must expose `./extensions`
3. `dts` must be `true`

The required state of `moduleFederation.js` after patching:
```js
shared: {
  // ... existing shared deps from midstream ...
  '@odh-dashboard/plugin-core': {
    singleton: true,
    requiredVersion: '*',
  },
},
exposes: {
  './extensions': './src/odh/extensions',
},
// ...
dts: true,
```

The midstream version has `exposes: {}` and `dts: false` — these must be changed. If the file already has the ODH entries (e.g., from a previous sync that preserved them), no patching is needed — just verify. The ODH-only files in `src/odh/` (`extensions.ts`, `NotebooksWrapper.tsx`) are unaffected by the sync since they don't exist in midstream.

### Post-Sync Validation

After the sync completes, run these checks before creating the PR. **This is critical** — many files silently end up at intermediate commit states during the patch-based sync.

**Step 0: Comprehensive file verification against upstream target**

This is the most important post-sync step. Compare ALL files (not just known conflict files) against the upstream reference clone:

```bash
# Check for files that exist locally but were deleted upstream (excluding ODH-only files)
diff <(cd packages/notebooks/upstream && find workspaces/frontend/src -name "*.ts" -o -name "*.tsx" | sort) \
     <(cd /tmp/nb-upstream-files && find workspaces/frontend/src -name "*.ts" -o -name "*.tsx" | sort) | grep '^<'
```

Remove any stale local-only files (EXCEPT ODH-only files like `src/odh/extensions.ts`, `src/odh/NotebooksWrapper.tsx`, `src/app/components/NamespaceSelector.tsx`).

```bash
# Check for files that exist upstream but are missing locally
diff <(cd packages/notebooks/upstream && find workspaces/frontend/src -name "*.ts" -o -name "*.tsx" | sort) \
     <(cd /tmp/nb-upstream-files && find workspaces/frontend/src -name "*.ts" -o -name "*.tsx" | sort) | grep '^>'
```

Copy any missing files from the upstream reference clone.

```bash
# Check ALL frontend source files for content differences
for f in $(cd /tmp/nb-upstream-files && find workspaces/frontend/src -name "*.ts" -o -name "*.tsx" | sort); do
  # Skip known ODH-only files
  case "$f" in
    */odh/extensions.ts|*/odh/NotebooksWrapper.tsx|*/components/NamespaceSelector.tsx) continue ;;
  esac
  diff "packages/notebooks/upstream/$f" "/tmp/nb-upstream-files/$f" >/dev/null 2>&1
  if [ $? -ne 0 ]; then echo "DIFFERS: $f"; fi
done
```

For files that differ and are NOT in the Known Local ODH Modifications table, replace from the upstream reference clone. For ODH-modified files (e.g., `Workspaces.tsx`), check the diff carefully and apply only the upstream changes while preserving ODH modifications.

```bash
# Also check Go files (backend + controller)
for f in $(cd /tmp/nb-upstream-files && find workspaces/backend workspaces/controller -name "*.go" | sort); do
  case "$f" in
    */cmd/main.go|*/config/environment.go|*/workspace_controller.go|*/app.go) continue ;;
  esac
  diff "packages/notebooks/upstream/$f" "/tmp/nb-upstream-files/$f" >/dev/null 2>&1
  if [ $? -ne 0 ]; then echo "DIFFERS: $f"; fi
done
```

Replace any stale Go files from the upstream reference clone.

Commit all fixes:
```bash
git add packages/notebooks/upstream/
SKIP_LINT_HOOK=true git commit -m "Post-sync fixes: replace stale intermediate-commit files with upstream target"
```

**Step 1: Install updated dependencies** (if `mod-arch-core` or other deps were bumped):
```bash
cd packages/notebooks/upstream/workspaces/frontend && npm install
```

**Step 2: Go backend build**:
```bash
cd packages/notebooks/upstream/workspaces/backend && go build ./...
```
Common issues: missing constants after refactors (e.g., constants moved to `api/constants/` package), struct fields added upstream that conflict with local `StaticAssetsDir`.

**Step 3: Frontend type check**:
```bash
cd packages/notebooks/upstream/workspaces/frontend && npx tsc --noEmit
```
Common issues: renamed generated types (e.g., `WorkspacekindsRedirectMessageLevel` → `V1Beta1RedirectMessageLevel`), `useGenericObjectState` tuple length changes after `mod-arch-core` bumps. **If type-check fails, it usually means files are stuck at intermediate commits** — go back to Step 0 and replace the offending files from the upstream reference clone.

**Step 4: Frontend lint**:
```bash
cd packages/notebooks/upstream/workspaces/frontend && npm run test:lint
```
Note: the root-level lint hook will report cspell errors for upstream files (cspell config path doesn't resolve from `upstream/`). These are false positives — use `SKIP_LINT_HOOK=true` when committing upstream files.

### Dockerfile

After syncing, check if the Go version requirement changed:
```bash
grep '^go ' packages/notebooks/upstream/workspaces/backend/go.mod
```
If the required version exceeds what's in the UBI9 `go-toolset` image (check `ARG GOLANG_BASE_IMAGE` in `Dockerfile.workspace`), ensure `ENV GOTOOLCHAIN=auto` is set in the BFF build stage.
