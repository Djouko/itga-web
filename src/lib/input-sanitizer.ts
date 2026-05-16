/**
 * Utility class for sanitizing user inputs across the app.
 * Mirrors the Flutter InputSanitizer for security parity.
 * Prevents XSS, injection attacks, and ensures clean data is sent to the backend.
 */
export const InputSanitizer = {
  /** Strips HTML tags to prevent XSS in rendered text. */
  stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, "");
  },

  /** Removes null bytes and control characters (except newline/tab). */
  removeControlChars(input: string): string {
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  },

  /** Trims whitespace and collapses multiple spaces into one. */
  normalizeWhitespace(input: string): string {
    return input.trim().replace(/ {2,}/g, " ");
  },

  /** Full sanitization pipeline for general text inputs (posts, comments, messages). */
  sanitizeText(input: string): string {
    if (!input) return input;
    let result = this.stripHtml(input);
    result = this.removeControlChars(result);
    result = this.normalizeWhitespace(result);
    return result;
  },

  /** Sanitize a username — only allow alphanumeric, underscores, and periods. */
  sanitizeUsername(input: string): string {
    return input.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase();
  },

  /** Sanitize a search query — strip dangerous chars but keep spaces and basic punctuation. */
  sanitizeSearch(input: string): string {
    if (!input) return input;
    let result = this.stripHtml(input);
    result = this.removeControlChars(result);
    result = result.trim();
    if (result.length > 200) {
      result = result.substring(0, 200);
    }
    return result;
  },

  /** Validate and sanitize a URL — block javascript: and data: URIs. */
  sanitizeUrl(input: string | null | undefined): string | null {
    if (!input) return null;
    const trimmed = input.trim();
    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith("javascript:") ||
      lower.startsWith("data:") ||
      lower.startsWith("vbscript:")
    ) {
      return null;
    }
    return trimmed;
  },

  /** Limit input length to prevent extremely long strings from being sent. */
  limitLength(input: string, maxLength = 5000): string {
    if (input.length <= maxLength) return input;
    return input.substring(0, maxLength);
  },
};
