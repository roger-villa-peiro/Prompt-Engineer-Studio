
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
