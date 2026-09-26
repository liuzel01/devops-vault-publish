# devops-vault-publish

OpenClaw skill for publishing reviewed DevOps knowledge to the private `devops-vault` Git repository through guarded local scripts and Draft Pull Requests.

The skill deliberately does not replace the existing personal Obsidian archive workflow.

It also contains the approved `scripts/openclaw-weekly-adapter.mjs` implementation for the optional Weekly `launchd` Draft PR flow. The adapter may only summarize merged Daily documents and never performs Git writes itself.
