description: Pull latest from Github and push all relevant changes
allowed-tools: Bash
argument-hint: []
---

# Command: /push

Perform a safe sync-and-publish: pull the latest changes from the remote main branch and push all local work.

Recommended workflow:
- Verify you are on the main branch.
- Stage and commit all local changes for this session.
- Pull the latest changes from the remote main branch (prefer a fast-forward or rebase when possible).
- If merge conflicts occur during pull, resolve them automatically in the most reliable way possible to maintain a clean working state.
- Push the updated main branch to the remote.

Important notes:
- Only perform this operation on the main branch.
- Ensure there are no unpushed commits left behind after the pull; complete the push to finish the session.