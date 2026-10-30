/**
 * Production Structured JSON Logger with Automated PII & Secret Redaction
 *
 * Prevents accidental disclosure of Indian citizen phone numbers, emails, session
 * tokens, passwords, and sensitive system secrets into logs.
 */

import { maskPhoneNumber, maskEmail } from './pii';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /cookie/i,
  /authorization/i,
  /credential/i,
  /api[_-]?key/i,
  /session/i,
];

/**
 * Recursively redacts PII and sensitive credentials from any data structure.
 */
export function redactSensitiveData(data: any, seen = new WeakSet()): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Check for phone number pattern
    const phoneRegex = /(?:\+91|91)?[\s-]?[6-9]\d{4}[\s-]?\d{5}/g;
    let redacted = data.replace(phoneRegex, (match) => {
      const clean = match.replace(/[\s-]/g, '');
      return maskPhoneNumber(clean);
    });

    // Check for email pattern
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    redacted = redacted.replace(emailRegex, (match) => maskEmail(match));

    return redacted;
  }

  if (typeof data !== 'object') {
    return data;
  }

  // Handle circular references
  if (seen.has(data)) {
    return '[Circular]';
  }
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, seen));
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: redactSensitiveData(data.message, seen),
      stack: data.stack ? redactSensitiveData(data.stack, seen) : undefined,
    };
  }

  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pat) => pat.test(key));
    if (isSensitiveKey) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactSensitiveData(val, seen);
    }
  }

  return result;
}

export class Logger {
  private formatEntry(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: redactSensitiveData(message),
    };

    if (context) {
      entry.context = redactSensitiveData(context);
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: redactSensitiveData(error.message),
        stack: error.stack ? redactSensitiveData(error.stack) : undefined,
      };
    }

    return JSON.stringify(entry);
  }

  debug(message: string, context?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
      console.debug(this.formatEntry('debug', message, context));
    }
  }

  info(message: string, context?: Record<string, any>) {
    console.info(this.formatEntry('info', message, context));
  }

  warn(message: string, context?: Record<string, any>, error?: Error) {
    console.warn(this.formatEntry('warn', message, context, error));
  }

  error(message: string, context?: Record<string, any>, error?: Error) {
    console.error(this.formatEntry('error', message, context, error));
  }
}

export const logger = new Logger();
