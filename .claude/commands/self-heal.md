# RALF Self-Healing Algorithm

Execute the RALF self-healing loop on the current codebase or recent changes:

## Steps

### R - Review (Spawn Agent: Explore)
- Scan all recently modified files for bugs
- Check for type errors, missing imports, undefined variables
- Look for logic errors and off-by-one mistakes
- Verify all function signatures match their call sites

### A - Analyze (Spawn Agent: Explore)
- Check for performance issues (unnecessary loops, memory leaks)
- Review code quality (DRY violations, naming conventions)
- Identify edge cases that aren't handled
- Score the code quality out of 100

### L - List (Use TodoWrite)
- Compile all discovered issues into a prioritized todo list
- Critical bugs first, then quality improvements
- Include file paths and line numbers

### F - Fix (Spawn parallel Agents: general-purpose)
- Launch one agent per issue (or group related issues)
- Each agent gets the issue description + file context
- Agents fix issues independently

## Quality Target
- Target score: **95/100**
- Security checks are excluded from scoring
- Repeat loop until target is met (max 3 iterations)
- Report final score and any remaining issues
