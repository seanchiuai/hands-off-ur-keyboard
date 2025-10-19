---
description: Implement all plans in the /plans folder using agents in the /agents folder
allowed-tools: Bash, Edit
argument-hint: []
---

# Command: /cook

Before you start, ensure there are existing markdown files in `/spec`, `/plans`, and `/agents`. After confirming this, execute all the plans located in the `/plans` folder using the specs provided in `/spec`.

For each plan:
1. Identify the corresponding agent from the `/agents` folder required to execute the plan.
2. Assign the task to the correct agent.
3. Execute each plan step by step, using the agent's specified expertise and tools.
4. Collect and summarize the execution results.

Ensure proper delegation to agents optimized for the specific tasks stated in each plan.

Upon completion:
- Remove the todolist app from the template.
- Update the routes so that the homepage is correct (reflecting the main feature).
- Output a summary report of all executed plans, including any issues or next steps required.