# Use your own folders

Keep AGENTS.md, ONBOARDING.md, paths.json, and the CLI at the repository root. The rest can follow your existing structure.

1. Open paths.json and set the board and holds file paths and your task, project, agent, checkpoint, snapshot, and knowledge folders. Use repo-relative paths with letters, numbers, slashes, dots, dashes, or underscores.
2. Move the board, holds, and snapshot guide to those locations. Keep each task at its configured task folder plus `project/task.json`. Keep `SOURCES.json` and `SYNTHESIS.md` in each configured project folder. Update links in your prose and any tracked checkpoint or receipt paths you move.
3. Commit the path map and moved files together and update main. Boot once to register, then run `node hars-mem.mjs rebuild --agent YOUR-ID` to regenerate the board. Verify the result with `node hars-mem.mjs check` and, once a task exists, `brief`.

For an existing repository, integrate Hars-Mem on a branch and keep your own rules and project notes. Keep other formats in your existing folders and link to them as sources. Work in flight keeps its saved paths, so preserve or update those references before moving files.

## Link project sources

`SOURCES.json` is an array. For a tracked source, use `kind: repo` and a repository-relative `path`. For a source you verify separately, use `kind: live` and a credential-free `url`. Give each entry an `id`, `owner`, and `use` describing what to verify. The task brief reads tracked sources at its current commit and marks live pointers unverified. Read the live source and record the evidence and observation time before relying on it.

## Find written knowledge

~~~sh
node hars-mem.mjs recall "project scope"
node hars-mem.mjs recall "project scope" --backend git
~~~

Recall searches the fetched main commit. Where Node includes the built-in SQLite module, recall caches an index in the checkout's Git metadata and refreshes it at each new commit. With the Git backend, recall scans the same tracked files directly.
