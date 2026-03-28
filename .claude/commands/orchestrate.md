# Orchestrate Multi-Agent Task

When this command is invoked, follow these steps:

1. **Parse the user's request** into independent subtasks
2. **Spawn parallel agents** for each subtask:
   - Use `subagent_type: "Explore"` for research/analysis tasks
   - Use `subagent_type: "general-purpose"` for implementation tasks
   - Use `subagent_type: "Plan"` for design/architecture tasks
3. **Give each agent complete context** - include file paths, requirements, constraints
4. **Collect and integrate results** from all agents
5. **Run RALF self-healing** on the integrated output
6. **Report final results** with quality score

## Example Usage

User: "Add authentication to this app"

Agents to spawn:
- Agent 1 (Explore): "Analyze the current codebase structure and find existing auth patterns"
- Agent 2 (Plan): "Design the authentication flow including login, signup, session management"
- Agent 3 (general-purpose): "Implement the authentication middleware"
- Agent 4 (general-purpose): "Create the login/signup UI components"

Always prefer parallel execution over sequential when tasks are independent.
