
import { logger } from "./loggerService";
import { z } from "zod";

/**
 * REF: SKILL error-handling-patterns, systematic-debugging
 * Parser Service — Nuclear Hardened
 * 
 * Multi-stage cleaning pipeline for LLM outputs, which are often malformed JSON.
 * Applies progressive transformations before attempting Zod validation.
 * 
 * Pipeline: Strip Fences → Strip Preamble → Fix Commas → Fix Quotes → 
 *           Fix Newlines → Remove Control Chars → Candidate Search → Relaxed Schema → Regex Extraction
 */
export class ParserService {

    /**
     * Safely parses a potential JSON string from an LLM response.
     * Uses a multi-stage cleaning pipeline to handle common LLM output issues.
     */
    static parseJson<T>(text: string | undefined, schema: z.ZodType<T, any, any>): T {
        if (!text || text.trim().length === 0) {
            throw new Error("PARSER_ERROR: Received empty response from model.");
        }

        // ═══════════════════════════════════════════════════════════
        // STAGE 0: Strip Markdown Code Fences
        // Models frequently wrap JSON in ```json ... ``` blocks
        // ═══════════════════════════════════════════════════════════
        let cleaned = text;
        const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
        if (fenceMatch) {
            cleaned = fenceMatch[1].trim();
        }

        // ═══════════════════════════════════════════════════════════
        // STAGE 1: Strip Preamble / Thinking Text
        // Models sometimes prepend "Here's the JSON:" or thinking traces
        // ═══════════════════════════════════════════════════════════
        const firstBrace = cleaned.indexOf('{');
        if (firstBrace > 0) {
            // Check if there's non-whitespace text before the first brace
            const preamble = cleaned.substring(0, firstBrace).trim();
            if (preamble.length > 0 && !preamble.startsWith('{')) {
                cleaned = cleaned.substring(firstBrace);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // STAGE 2: Fix Trailing Commas
        // LLMs love to leave trailing commas: {"key": "val",}
        // ═══════════════════════════════════════════════════════════
        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

        // ═══════════════════════════════════════════════════════════
        // STAGE 3: Normalize Quotes
        // Some models return {'key': 'val'} or use backticks
        // Context-aware: only replace outside of already-valid double-quoted strings
        // ═══════════════════════════════════════════════════════════
        // Simple heuristic: if no double quotes found but single quotes exist, swap them
        if (!cleaned.includes('"') && cleaned.includes("'")) {
            cleaned = cleaned.replace(/'/g, '"');
        }

        // ═══════════════════════════════════════════════════════════
        // STAGE 4: Handle Escaped Newlines in String Values
        // Literal \n (two chars) that should be \\n in JSON strings
        // Also normalize actual newlines inside string values
        // ═══════════════════════════════════════════════════════════
        // Replace literal carriage returns and tabs with their JSON escaped forms
        cleaned = cleaned.replace(/\r\n/g, '\\n').replace(/\r/g, '\\n');
        // Note: We DON'T replace \n globally because JSON uses \n as line separators between fields

        // ═══════════════════════════════════════════════════════════
        // STAGE 5: Remove Control Characters
        // ASCII 0x00-0x1F (except \n, \r, \t which are handled above)
        // ═══════════════════════════════════════════════════════════
        cleaned = cleaned.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");

        // ═══════════════════════════════════════════════════════════
        // STAGE 6: Fix NaN/Infinity
        // JSON doesn't support NaN or Infinity
        // ═══════════════════════════════════════════════════════════
        cleaned = cleaned.replace(/:\s*NaN\b/g, ': 0');
        cleaned = cleaned.replace(/:\s*Infinity\b/g, ': 999999');
        cleaned = cleaned.replace(/:\s*-Infinity\b/g, ': -999999');

        // ═══════════════════════════════════════════════════════════
        // STAGE 7: Fix HTML entities in values
        // Models occasionally output &quot; etc.
        // ═══════════════════════════════════════════════════════════
        cleaned = cleaned
            .replace(/&quot;/g, '\\"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'");

        // ═══════════════════════════════════════════════════════════
        // ATTEMPT 1: Direct Parse of Cleaned Text
        // ═══════════════════════════════════════════════════════════
        try {
            const json = JSON.parse(cleaned);
            return schema.parse(json);
        } catch (e) {
            // Continue to candidate search
        }

        // ═══════════════════════════════════════════════════════════
        // ATTEMPT 2: Robust Candidate Search (Brace Matching)
        // Find all valid JSON objects, validate from LAST to FIRST
        // (final output is usually the correct one)
        // ═══════════════════════════════════════════════════════════
        const candidates: { json: any; index: number }[] = [];
        let startIndex = cleaned.indexOf('{');

        while (startIndex !== -1) {
            let balance = 1;
            let endIndex = startIndex + 1;
            let inString = false;
            let escaped = false;

            // Improved: Respect string boundaries to avoid false brace matches
            while (endIndex < cleaned.length && balance > 0) {
                const char = cleaned[endIndex];

                if (escaped) {
                    escaped = false;
                } else if (char === '\\') {
                    escaped = true;
                } else if (char === '"') {
                    inString = !inString;
                } else if (!inString) {
                    if (char === '{') balance++;
                    else if (char === '}') balance--;
                }

                if (balance === 0) {
                    const candidateStr = cleaned.substring(startIndex, endIndex + 1);
                    try {
                        const json = JSON.parse(candidateStr);
                        candidates.push({ json, index: startIndex });
                    } catch (e) {
                        // Also try with trailing comma fix on this specific substring
                        try {
                            const fixedStr = candidateStr.replace(/,\s*([}\]])/g, '$1');
                            const json = JSON.parse(fixedStr);
                            candidates.push({ json, index: startIndex });
                        } catch (e2) {
                            // Not valid JSON, skip
                        }
                    }
                    break;
                }
                endIndex++;
            }
            startIndex = cleaned.indexOf('{', startIndex + 1);
        }

        // Validate candidates from LAST to FIRST (strict schema)
        for (let i = candidates.length - 1; i >= 0; i--) {
            try {
                return schema.parse(candidates[i].json);
            } catch (e) {
                // Schema mismatch, try next candidate
            }
        }

        // ═══════════════════════════════════════════════════════════
        // ATTEMPT 3: Relaxed Schema (strip strict requirements)
        // Try all candidates with a passthrough schema
        // ═══════════════════════════════════════════════════════════
        for (let i = candidates.length - 1; i >= 0; i--) {
            try {
                // Try with passthrough() if schema supports it
                if (schema instanceof z.ZodObject) {
                    const relaxed = (schema as any).passthrough();
                    const result = relaxed.parse(candidates[i].json);

                    if (result && typeof result === 'object') {
                        logger.warn("[Parser] Used RELAXED schema with passthrough", {
                            candidateKeys: Object.keys(candidates[i].json)
                        });
                        return result as T;
                    }
                }
            } catch (e) {
                // Continue
            }
        }

        // ═══════════════════════════════════════════════════════════
        // ATTEMPT 4: Regex Extraction (Last Resort)
        // Try to pull specific key-value pairs via regex
        // ═══════════════════════════════════════════════════════════
        try {
            // Try to extract from the original text with aggressive cleanup
            const aggressiveClean = text
                .replace(/```(?:json)?\s*\n?/g, '')
                .replace(/```/g, '')
                .replace(/,\s*([}\]])/g, '$1')
                .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");

            const start = aggressiveClean.indexOf('{');
            const end = aggressiveClean.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                const json = JSON.parse(aggressiveClean.substring(start, end + 1));
                return schema.parse(json);
            }
        } catch (e) {
            // Last resort failed
        }

        // ═══════════════════════════════════════════════════════════
        // DIAGNOSTIC: Log everything for debugging
        // ═══════════════════════════════════════════════════════════
        logger.error("PARSER DIAGNOSTIC — ALL ATTEMPTS FAILED:", undefined, {
            textLength: text.length,
            first500: text.substring(0, 500),
            last500: text.substring(Math.max(0, text.length - 500)),
            candidatesFound: candidates.length,
            candidateKeys: candidates.map(c => Object.keys(c.json)),
            cleanedFirst200: cleaned.substring(0, 200)
        });

        throw new Error("SYNTAX_ERROR: Failed to decode model output. No valid JSON found matching schema. This is usually a transient model error — try again.");
    }
}
