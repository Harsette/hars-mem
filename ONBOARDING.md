# Set up Hars-Mem

## Prepare the repository

1. Install Git and Node.js 20 or newer. Sign in to GitHub with your normal Git credentials.
2. Create an empty private GitHub repository. Skip the prefilled README, license, and ignore file.
3. Open a terminal in the Hars-Mem folder and run setup with your new repository URL.

~~~sh
node setup.mjs https://github.com/YOUR-ACCOUNT/YOUR-REPO.git
~~~

Setup reads back the initial commit. Give agents the private repository URL and tell them to read this file. Give direct write access to a trusted runtime for task writes to `main`. Agents with read-only access can use [the hosted handoff](HOSTED.md).

## Register and open the board

Run the commands inside the cloned repository. Choose a stable agent ID and reuse it when rejoining. Use role `outer` for the agent that talks to the owner and `worker` for an agent assigned a task.

~~~sh
git clone https://github.com/YOUR-ACCOUNT/YOUR-REPO.git
cd YOUR-REPO
node hars-mem.mjs boot --agent desk-agent --role outer --scope all --capabilities shell,git-read,git-write
node hars-mem.mjs board
~~~

Boot returns the rules, the commit they came from, the saved registration path, and the first task within scope if one exists. An empty board returns an empty task list and boot returns `task: null`. Read the rules and report their commit, your registration path, and a rule that applies to the work. When you have older shared rules in your harness, pass a temporary text export with `--memory PATH` and compare its claims against the current rules.

## Create your first project and task

Run `node hars-mem.mjs sync` before editing. Choose a lowercase project slug, such as `your-project`. In the configured projects folder, create `projects/your-project/SYNTHESIS.md` and write what the project is for, who owns it, and where its facts can be verified. Add `projects/your-project/SOURCES.json` with an empty JSON array `[]` to start, or add entries in [the source map format](ADAPT.md#link-project-sources). Set your normal Git name and email if Git asks for them, then save the project and record the task.

~~~sh
git add -- projects/your-project/SYNTHESIS.md projects/your-project/SOURCES.json
git commit -m "Create the project"
git push origin main
node hars-mem.mjs add your-project/first-task --agent desk-agent --goal "Write the project scope" --done-when "The owner has reviewed the scope and the reviewed file is saved"
node hars-mem.mjs brief your-project/first-task
~~~

Use your own project and task slugs, goal, and completion condition. The task stays on the board and its brief includes the current project source pointers and synthesis path. Use [the work loop](WORKFLOW.md) to claim it, save a checkpoint, and hand it off to a second checkout.

## Rejoin

Run boot with your stable ID. Boot and start fetch main, fast-forward a clean checkout if needed, and run the current tool. If tracked edits or divergence prevent the update, save work on a separate branch and reconcile. When the remote is unavailable, report the last known commit and preserve any pending input. Hosted readers open AGENTS.md at the latest main commit they can verify.

Use [the path map](ADAPT.md) for an existing folder layout. The three portable skills cover [onboarding and routing](skills/onboard-and-route/SKILL.md), [claiming and updating work](skills/claim-and-progress/SKILL.md), and [saving checkpoints and syntheses](skills/checkpoint-and-synthesize/SKILL.md).
