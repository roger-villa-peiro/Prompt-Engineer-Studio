
import { logger } from "./loggerService";
import { z } from "zod";

/**
 * REF: SKILL error-handling-patterns
 * Parser Service
 * 
 * Handles robust parsing of LLM outputs, which are often malformed JSON.
 * Includes cleaning strategies and Zod validation.
 */
export class ParserService {

    /**
     * Safely parses a potential JSON string from an LLM response.
     * Uses heuristics to extract JSON from surrounding text (thinking traces, markdown).
     */
    static parseJson<T>(text: string | undefined, schema: z.ZodType<T, any, any>): T {
        if (!text) throw new Error("PARSER_ERROR: Received empty response.");

        // Strategy 1: Attempt direct extract of JSON block
        let jsonString = text;
        const jsonStartIndex = text.indexOf('{');
        const jsonEndIndex = text.lastIndexOf('}');

        if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
            jsonString = text.substring(jsonStartIndex, jsonEndIndex + 1);
        }

        // Strategy 2: Cleanup Markdown code blocks
        // regex matches ```json ... ``` or just ``` ... ```
        const sanitized = jsonString.replace(/```(?:json)?\n?([\s\S]*?)\n?```/g, "$1").trim();

        try {
            const json = JSON.parse(sanitized);
            return schema.parse(json);
        } catch (error) {
            // First Failure: Try aggressive cleanup (control characters)
            try {
                const aggressiveClean = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
                const json = JSON.parse(aggressiveClean);
                return schema.parse(json);
            } catch (e2) {
                // Logging for debugging (could be connected to a logger service)
                if (error instanceof z.ZodError) {
                    logger.error("ZOD VALIDATION ERROR:", error, { formatted: error.format() });
                } else {
                    logger.error("JSON PARSE ERROR:", error);
                }
                logger.error("RAW TEXT WAS:", undefined, { text: text?.substring(0, 500) + '...' });

                throw new Error("SYNTAX_ERROR: Failed to decode model output.");
            }
        }
    }
}
