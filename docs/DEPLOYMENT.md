# Continuous deployment

FirstRead uses [Vercel's GitHub integration](https://vercel.com/docs/git/vercel-for-github)
to deploy `whanyu1212/firstread`. The existing Vercel project is `firstread`, owned by
`whanyu1212s-projects`, with `main` as its production branch.

- Push a feature branch to get a preview deployment, linked from the pull request.
- Merge into `main` to update [production](https://firstread-mu.vercel.app/) automatically
  after the Vercel build succeeds.
- A failed install, typecheck, test, or build leaves the existing production deployment live.

## Build gate

[`apps/web/vercel.json`](../apps/web/vercel.json) defines the deployment commands. Vercel
starts in the project's Root Directory, `apps/web`:

1. Install the workspace dependencies with `pnpm install --frozen-lockfile`.
2. Run `pnpm --workspace-root typecheck` across the library and web app.
3. Run `pnpm --workspace-root test` across both packages.
4. Run `pnpm run build` in the web app to produce the Next.js deployment.

The build command joins these checks with `&&`, so a failure stops deployment. Tests use
fakes; this does not run paid model evaluations or send live chat messages. The same gate
applies to previews and production.

GitHub's [CI workflow](../.github/workflows/ci.yml) also runs typechecking and tests on Node
22 and 24 for pull requests and pushes to `main`. Vercel runs its own gate on Node 24; it
does not wait for the separate GitHub jobs. No GitHub Actions deployment token or second
deployment workflow is needed.

## Project settings

These settings live in Vercel rather than the repository:

| Setting | Value |
| --- | --- |
| Git repository | `whanyu1212/firstread` |
| Production branch | `main` |
| Framework | Next.js |
| Root Directory | `apps/web` |
| Include source files outside Root Directory | Enabled, for `packages/firstread` |
| Node.js | `24.x` |
| Package manager | pnpm, pinned by the root `packageManager` field |
| Automatic production domain assignment | Enabled |
| Git fork protection | Enabled |

The Git connection is a one-time project setting, configured separately from this PR's
build gate. Recreating the project requires connecting the repository and applying the
settings above. `vercel.json` cannot establish the Git connection or set the Root Directory.

Keep API and Redis credentials in Vercel's environment settings, scoped to the intended
environment. A preview without model credentials still supports the deck and recorded
scenarios. See the [README environment table](../README.md#quickstart) for the live demo's
configuration. No credentials belong in `vercel.json` or these notes.

## Verify a release

1. Open the PR's Vercel check and confirm the preview was built from its latest commit.
2. Inspect the build log for the typecheck and test steps before the Next.js build.
3. After merging, check the production deployment's commit against the merge commit.
4. Check `/`, `/deck/1`, and `/demo` on production, including a recorded scenario. A live
   model request is not required for this smoke check.

For a failed deployment, inspect its build log, fix the failed step, and push again. Avoid
manual production deploys during the normal PR flow; Git deployment records which commit
is running. Generated video and browser artifacts remain in the ignored `output/` folder.
