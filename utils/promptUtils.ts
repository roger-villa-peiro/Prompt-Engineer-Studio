
// Updated to allow capturing empty brackets {{ }} to enable validation errors
export const PROMPT_VAR_REGEX = /{{\s*([^}]*?)\s*}}/g;

/**
 * Extracts unique variable names from a prompt string.
 */
export function extractVariables(content: string): string[] {
  const matches = Array.from(content.matchAll(PROMPT_VAR_REGEX));
  // Filter out empty matches here for the logic that needs actual names, 
  // but the regex itself now catches empty ones for the service to validate.
  return [...new Set(matches.map(m => m[1].trim()).filter(v => v !== ""))];
}

/**
 * Parses variables defined in the context string using {{key}}=value or key=value syntax.
 * Replaces newlines in value to allow multi-line values if indented? 
 * For now simplistic single-line or basic multi-line support.
 */
export function parseContextVariables(context: string): Record<string, string> {
  const vars: Record<string, string> = {};
  // Regex to match {{key}}=value OR key=value
  // We match until the end of the line OR until the next variable definition?
  // Simplest approach: Line by line
  const lines = context.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*(?:{{([\w_]+)}}|([\w_]+))\s*=\s*(.*)$/);
    if (match) {
      const key = match[1] || match[2];
      const value = match[3];
      if (key) {
        vars[key.trim()] = value.trim();
      }
    }
  }
  return vars;
}
