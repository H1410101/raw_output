---
trigger: always_on
---

When generating implementation plan artifacts, start with a section called the **Gist**. The gist is a big-picture overview of the overarching goal, all the moving parts, and one-liners introducing each part and how it connects to the goal.
Additionally, use lots of diagrams scattered throughout the artifact, especially when there are three or more interconnected pieces.
When the user is looking to be briefed about your plan of action, make such an artifact.

Prefer against using the terminal. If it has to be used, note that it is running Powershell, and use appropriate commands. Do not run multiple commands at once; strictly use one command at a time.
When completing a task given by the user, always run all tests, to check against regressions. If the tests are expected to fail due to the nature of the task and the user has not explicitly acknowledged this possibility, proceed, but still highlight this to the user. If the tests are expected to pass, fix them first.
Never force any command unless you have obtained the developer's explicit permission.
Strongly prefer the following list of allowed commands, and avoid anything outside of it:
git add
git status
git diff
git log
git show
git ls-tree
npm run
npm run dev
npm run lint
npm run build
npm run test
If the functionality you want is not in this list, check the available tools. One of them might suit your needs.
If there are no suitable tools, ask the user for explicit written permission to run a terminal command that is not on this list.