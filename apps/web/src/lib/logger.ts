/**
 * Represents the color names used for logging.
 */
export type ColorName =
  | 'bold'
  | 'green'
  | 'yellow'
  | 'red'
  | 'magentaBright'
  | 'cyanBright'
  | 'cyan'
  | 'gray'
  | 'plain';

/**
 * Represents the log levels.
 */
export type LogLevel = 'verbose' | 'debug' | 'info' | 'log' | 'error' | 'warn' | 'fatal';

/**
 * Represents the severity levels of log messages.
 */
export type Severity = 'verbose' | 'debug' | 'info' | 'error' | 'warn' | 'fatal';

/**
 * Represents the format of log messages.
 *
 * `text` is the default for local development; `json` is used on Cloud Run so
 * logs are picked up by Google Cloud Logging as structured entries.
 */
export type LogFormat = 'text' | 'json';

/**
 * Represents the arguments for printing a log message.
 */
export interface PrintMessageArgs {
  /**
   * The log message.
   */
  message: string;
  /**
   * Additional parameters for the log message.
   */
  params: unknown[];
  /**
   * The context of the log message.
   */
  context: LogContext | null;
  /**
   * The severity level of the log message.
   */
  severity: Severity;
  /**
   * The stack trace of the log message.
   */
  stack?: string | null;
}

/**
 * Represents the options for configuring a logger.
 */
export interface LoggerOptions {
  /**
   * The name of the logger.
   */
  name?: string;
  /**
   * The logging level.
   */
  level?: LogLevel;
  /**
   * The format of the log messages.
   * @default 'text'
   */
  format?: LogFormat;
  /**
   * Whether the logger is enabled.
   * @default true
   */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Cloud Run / GCP Logging extensions
// ---------------------------------------------------------------------------

export interface SourceLocation {
  /**
   * The file where the log entry was generated.
   */
  file: string;

  /**
   * The line number in the file where the log entry was generated.
   */
  line: string;

  /**
   * The function name where the log entry was generated.
   */
  function: string;
}

export interface HttpRequest {
  /**
   * The HTTP method of the request (e.g., GET, POST).
   */
  requestMethod: string;

  /**
   * The URL of the request.
   */
  requestUrl: string;

  /**
   * The size of the request in bytes.
   */
  requestSize: number;

  /**
   * The HTTP status code of the response.
   */
  status: number;

  /**
   * The size of the response in bytes.
   */
  responseSize: number;

  /**
   * The user agent string of the client making the request.
   */
  userAgent: string;

  /**
   * The IP address of the client making the request.
   */
  remoteIp: string;

  /**
   * The IP address of the server handling the request.
   */
  serverIp: string;

  /**
   * The latency of the request in seconds.
   */
  latency: string;

  /**
   * Whether the response was served from cache.
   */
  cacheLookup: boolean;

  /**
   * Whether the response was a cache hit.
   */
  cacheHit: boolean;

  /**
   * Whether the response was validated with the origin server.
   */
  cacheValidatedWithOriginServer: boolean;

  /**
   * The number of bytes returned from cache.
   */
  cacheFillBytes: number;

  /**
   * The protocol used for the request (e.g., HTTP/1.1, HTTP/2).
   */
  protocol: string;
}

export interface Operation {
  /**
   * The unique identifier for the operation.
   */
  id: string;

  /**
   * The producer of the operation.
   */
  producer: string;

  /**
   * Indicates if this is the first operation.
   */
  first: boolean;

  /**
   * Indicates if this is the last operation.
   */
  last: boolean;
}

/**
 * Represents the context of a log message.
 *
 * The base is a free-form record; the optional fields below map to Google
 * Cloud Logging structured-log keys and to the proxy/middleware log shape.
 */
export interface LogContext {
  /**
   * HTTP request information.
   */
  httpRequest?: HttpRequest;

  /**
   * Source location information.
   */
  sourceLocation?: SourceLocation;

  /**
   * Trace information.
   */
  trace?: string;

  /**
   * Span ID information.
   */
  spanId?: string;

  /**
   * Indicates if the trace is sampled.
   */
  trace_sampled?: boolean;

  /**
   * Timestamp of the log entry.
   */
  time?: string;

  /**
   * Additional labels for the log entry.
   */
  labels?: Record<string, string>;

  /**
   * Unique identifier for the log entry.
   */
  insertId?: string;

  /**
   * Operation information.
   */
  operation?: Operation;

  operationName?: string;

  method?: string;

  url?: string;

  status?: number;

  agent?: string | null;

  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Logger interfaces
// ---------------------------------------------------------------------------

/**
 * Interface for a structured logger.
 */
export interface IStructuredLogger {
  log(message: string, context?: LogContext): void;
  error(message: string | Error, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  verbose(message: string, context?: LogContext): void;
  fatal(message: string | Error, context?: LogContext): void;
}

const logLevels: Record<LogLevel, number> = {
  verbose: 0,
  debug: 1,
  log: 2,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return obj != null && Object.getPrototypeOf(obj) === Object.prototype;
}

/**
 * Google Cloud Logging key prefixes for structured logging
 */
const GCP_LOGGING_KEYS = {
  SOURCE_LOCATION: 'logging.googleapis.com/sourceLocation',
  TRACE: 'logging.googleapis.com/trace',
  SPAN_ID: 'logging.googleapis.com/spanId',
  TRACE_SAMPLED: 'logging.googleapis.com/trace_sampled',
  LABELS: 'logging.googleapis.com/labels',
  INSERT_ID: 'logging.googleapis.com/insertId',
  OPERATION: 'logging.googleapis.com/operation',
} as const;

/**
 * ANSI color codes for terminal output
 */
const ANSI_COLORS = {
  bold: '\x1B[1m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  red: '\x1B[31m',
  magentaBright: '\x1B[95m',
  cyanBright: '\x1B[96m',
  cyan: '\x1B[36m',
  gray: '\x1B[90m',
  reset: '\x1B[0m',
  resetForeground: '\x1B[39m',
} as const;

export abstract class BaseLogger {
  /**
   * The logging level.
   */
  protected logLevel: LogLevel;

  /**
   * The format of the log messages.
   */
  protected format: LogFormat;

  /**
   * The name of the logger.
   */
  protected name: string;

  /**
   * Creates an instance of the logger.
   * @param options - The options for the logger.
   * @param options.logLevel - The logging level.
   * @param options.format - The format of the log messages.
   * @param options.name - The name of the logger.
   */
  constructor(options: { logLevel: LogLevel; format: LogFormat; name: string }) {
    this.logLevel = options.logLevel;
    this.format = options.format;
    this.name = options.name;
  }

  /**
   * Checks if the specified log level is enabled.
   * @param level - The log level to check.
   * @returns True if the log level is enabled, false otherwise.
   */
  protected isLevelEnabled(level: LogLevel): boolean {
    return logLevels[level] >= logLevels[this.logLevel];
  }

  /**
   * Prints the log message based on the specified format.
   * @param args - The arguments for the log message.
   */
  protected printMessage(args: PrintMessageArgs): void {
    switch (this.format) {
      case 'json':
        this.printJson(args);
        break;
      case 'text':
        this.printText(args);
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Cloud Run / GCP JSON output
  // -------------------------------------------------------------------------

  /**
   * Maps known logging context keys to their GCP logging equivalents.
   */
  private mapGcpLoggingParam(
    key: string,
    value: unknown,
    output: Record<string, unknown>,
  ): boolean {
    switch (key) {
      case 'sourceLocation':
        if (isPlainObject(value)) {
          output[GCP_LOGGING_KEYS.SOURCE_LOCATION] = value as unknown as SourceLocation;
          return true;
        }
        break;
      case 'trace':
        if (typeof value === 'string') {
          output[GCP_LOGGING_KEYS.TRACE] = value;
          return true;
        }
        break;
      case 'spanId':
        if (typeof value === 'string') {
          output[GCP_LOGGING_KEYS.SPAN_ID] = value;
          return true;
        }
        break;
      case 'trace_sampled':
        if (typeof value === 'boolean') {
          output[GCP_LOGGING_KEYS.TRACE_SAMPLED] = value;
          return true;
        }
        break;
      case 'labels':
        if (isPlainObject(value)) {
          output[GCP_LOGGING_KEYS.LABELS] = value as Record<string, string>;
          return true;
        }
        break;
      case 'insertId':
        if (typeof value === 'string') {
          output[GCP_LOGGING_KEYS.INSERT_ID] = value;
          return true;
        }
        break;
      case 'operation':
        if (isPlainObject(value)) {
          output[GCP_LOGGING_KEYS.OPERATION] = value as unknown as Operation;
          return true;
        }
        break;
      case 'httpRequest':
        if (isPlainObject(value)) {
          output.httpRequest = value as unknown as HttpRequest;
          return true;
        }
        break;
    }
    return false;
  }

  protected printJson({ message, params, context, severity, stack }: PrintMessageArgs) {
    const output: Record<string, unknown> = {
      severity: severity.toUpperCase(),
      time: new Date().toISOString(),
      name: this.name,
      message,
    };

    if (stack) {
      output.stack_trace = stack;
    }
    if (context) {
      output.context = context;
    }

    this.processJsonParams(params, output);
    this.print(this.formatJson(output));
  }

  /**
   * Processes parameters for JSON logging output.
   */
  private processJsonParams(params: unknown[], output: Record<string, unknown>): void {
    for (const param of params) {
      if (isPlainObject(param)) {
        for (const [k, v] of Object.entries(param)) {
          if (!this.mapGcpLoggingParam(k, v, output)) {
            output[k] = v;
          }
        }
      } else if (param) {
        if (!Array.isArray(output.params)) {
          output.params = [];
        }
        (output.params as unknown[]).push(param);
      }
    }
  }

  /**
   * Formats the JSON output as a string.
   */
  protected formatJson(output: Record<string, unknown>): string {
    return JSON.stringify(output);
  }

  // -------------------------------------------------------------------------
  // Text output (shared with the generic upstream logger)
  // -------------------------------------------------------------------------

  /**
   * Prints the log message in text format.
   * @param message - The log message.
   * @param params - Additional parameters for the log message.
   * @param context - The context of the log message.
   * @param severity - The severity level of the log message.
   * @param stack - The stack trace of the log message.
   */
  protected printText({ message, params, context, severity, stack }: PrintMessageArgs) {
    const output: string[] = [
      this.colorize(severity.toUpperCase(), this.getColorNameByLogLevel(severity)),
      this.colorize(`[${this.name}]`, 'gray'),
    ];

    // Add message
    if (severity === 'error') {
      output.push(this.colorize(message, this.getColorNameByLogLevel(severity)));
    } else if (message) {
      output.push(message);
    }

    // Add context if it exists
    if (context) {
      const contextStr = this.formatObject(context);
      output.push(this.colorize(`[${contextStr}]`, 'yellow'));
    }

    // Add params
    for (const param of params) {
      if (isPlainObject(param)) {
        output.push(`${this.formatObject(param)}`);
      } else if (param) {
        output.push(`${this.colorize(`${param}`, 'bold')}`);
      }
    }

    this.print(output.filter((t) => t).join(' '));

    if (severity === 'error' && stack) {
      this.print(stack);
    }
  }

  protected print(str: string) {
    process.stdout.write(str + '\n');
  }

  /**
   * Formats an object into a string representation.
   * @param obj - The object to format.
   * @param parentKey - The parent key for nested objects.
   * @returns The formatted string representation of the object.
   */
  protected formatObject(obj: Record<string, unknown>, parentKey = ''): string {
    const values: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (isPlainObject(value)) {
        values.push(this.formatObject(value, `${parentKey}${key}.`));
      } else {
        const k = this.colorize(`${parentKey}${key}`, 'cyan');
        if (value === null) {
          values.push(`${k}=${this.colorize('null', 'gray')}`);
        } else if (value !== undefined) {
          values.push(`${k}=${value}`);
        }
      }
    }

    return values.join(' ');
  }

  protected extractMessages(messages: unknown[]): {
    message: string;
    params: unknown[];
    context: LogContext | null;
  } {
    let message = '';
    let params: unknown[] = [];
    if (typeof messages[0] === 'string') {
      message = messages[0];
      params = messages.slice(1);
    } else {
      params = messages;
    }

    if (params.length === 0) {
      return { message, params, context: null };
    }

    const last = params[params.length - 1];
    if (isPlainObject(last)) {
      return {
        message,
        params: params.slice(0, params.length - 1),
        context: last as LogContext,
      };
    } else {
      return { message, params, context: null };
    }
  }

  /**
   * Extracts the message, parameters, and context from the provided messages.
   * @param args - The array of messages to extract from.
   * @returns An object containing the extracted message, parameters, and context.
   */
  protected extractMessagesWithStack(args: unknown[]): {
    message: string;
    params: unknown[];
    context: LogContext | null;
    stack?: string | null;
  } {
    // Handle: Error, ...params, [context]
    if (args[0] instanceof Error) {
      return this.extractFromError(args[0], args.slice(1));
    }

    // Handle: message, Error, ...params, [context]
    if (args.length > 1 && typeof args[0] === 'string' && args[1] instanceof Error) {
      return this.extractFromErrorWithMessage(args[0], args[1], args.slice(2));
    }

    // Handle: message, stack OR value, stack
    if (args.length === 2 && this.isStackFormat(args[1])) {
      return this.extractFromStack(args[0], args[1]);
    }

    // Handle: message/value, stack, context
    if (args.length === 3 && this.isStackFormat(args[1])) {
      return this.extractFromStackWithContext(args[0], args[1], args[2]);
    }

    // Fallback: standard message extraction
    return this.extractMessages(args);
  }

  /**
   * Extracts message, stack, and context from an Error object and additional parameters.
   */
  private extractFromError(
    err: Error,
    params: unknown[],
  ): {
    message: string;
    params: unknown[];
    context: LogContext | null;
    stack?: string;
  } {
    const last = params[params.length - 1];
    if (isPlainObject(last)) {
      return {
        message: err.message,
        stack: err.stack,
        context: last as LogContext,
        params: params.slice(0, -1),
      };
    }
    return {
      message: err.message,
      stack: err.stack,
      context: null,
      params,
    };
  }

  /**
   * Extracts message, stack, and context when message precedes an Error object.
   */
  private extractFromErrorWithMessage(
    message: string,
    err: Error,
    params: unknown[],
  ): {
    message: string;
    params: unknown[];
    context: LogContext | null;
    stack?: string;
  } {
    const last = params[params.length - 1];
    if (isPlainObject(last)) {
      return {
        message,
        stack: err.stack,
        context: last as LogContext,
        params: params.slice(0, -1).concat([{ error: err.toString() }]),
      };
    }
    return {
      message,
      stack: err.stack,
      context: null,
      params: params.concat([{ error: err.toString() }]),
    };
  }

  /**
   * Extracts message and stack when args contain stack trace.
   */
  private extractFromStack(
    first: unknown,
    stack: string,
  ): {
    message: string;
    params: unknown[];
    context: LogContext | null;
    stack: string;
  } {
    if (typeof first === 'string') {
      return {
        message: first,
        params: [],
        context: null,
        stack,
      };
    }
    return {
      message: '',
      params: [first],
      context: null,
      stack,
    };
  }

  /**
   * Extracts message, stack, and context from three arguments where second is stack.
   */
  private extractFromStackWithContext(
    first: unknown,
    stack: string,
    last: unknown,
  ): {
    message: string;
    params: unknown[];
    context: LogContext | null;
    stack?: string;
  } {
    let message = '';
    let params: unknown[] = [];

    if (typeof first === 'string') {
      message = first;
    } else {
      params = [first];
    }

    if (isPlainObject(last)) {
      return {
        message,
        params,
        context: last as LogContext,
        stack,
      };
    }

    if (last === undefined) {
      return {
        message,
        params,
        context: null,
        stack,
      };
    }

    // If none of the above conditions, fall back to standard extraction
    return this.extractMessages([first, stack, last]);
  }

  protected isStackFormat(stack: unknown): stack is string {
    if (typeof stack !== 'string') {
      return false;
    }

    return /^(.)+\n\s+at .+:\d+:\d+/.test(stack);
  }

  protected colorize(text: string, colorName: ColorName): string {
    if (!text) return '';

    const colorMap: Record<ColorName, string> = {
      bold: `${ANSI_COLORS.bold}${text}${ANSI_COLORS.reset}`,
      green: `${ANSI_COLORS.green}${text}${ANSI_COLORS.resetForeground}`,
      yellow: `${ANSI_COLORS.yellow}${text}${ANSI_COLORS.resetForeground}`,
      red: `${ANSI_COLORS.red}${text}${ANSI_COLORS.resetForeground}`,
      magentaBright: `${ANSI_COLORS.magentaBright}${text}${ANSI_COLORS.resetForeground}`,
      cyanBright: `${ANSI_COLORS.cyanBright}${text}${ANSI_COLORS.resetForeground}`,
      cyan: `${ANSI_COLORS.cyan}${text}${ANSI_COLORS.resetForeground}`,
      gray: `${ANSI_COLORS.gray}${text}${ANSI_COLORS.resetForeground}`,
      plain: text,
    };

    return colorMap[colorName];
  }

  protected getColorNameByLogLevel(severity: Severity): ColorName {
    switch (severity) {
      case 'verbose':
        return 'cyanBright';
      case 'info':
        return 'green';
      case 'debug':
        return 'magentaBright';
      case 'warn':
        return 'yellow';
      case 'error':
        return 'red';
      case 'fatal':
        return 'bold';
      default:
        return 'plain';
    }
  }
}

/**
 * A structured logger for Next.js applications.
 *
 * Reads `LOG_LEVEL` and `LOG_FORMAT` from the environment. Output is colorized
 * text for local development (`LOG_FORMAT=text`, the default) or JSON for
 * Cloud Run (`LOG_FORMAT=json`).
 */
export class StructuredLogger extends BaseLogger {
  protected print(str: string) {
    console.log(str);
  }

  /**
   * Creates an instance of StructuredLogger.
   * @param options - The options for the logger.
   */
  constructor(options: LoggerOptions = {}) {
    super({
      name: options.name || 'NextJS',
      logLevel: options.level || (process.env.LOG_LEVEL as LogLevel) || 'info',
      format: options.format || (process.env.LOG_FORMAT as LogFormat) || 'text',
    });
  }

  // -------------------------------------------------------------------------
  // Proxy / middleware log shaping (Cloud Run with-proxy variant)
  // -------------------------------------------------------------------------

  private sanitizeContextForOutput(
    context: LogContext | null | undefined,
    shown: {
      hasOperationName: boolean;
      hasAgent: boolean;
      hasMethod: boolean;
      hasStatus: boolean;
      hasUrl: boolean;
    },
  ): LogContext | null {
    if (!context) return null;

    const sanitized: LogContext = { ...context };

    if (shown.hasOperationName) {
      delete sanitized.operationName;
    }

    if (shown.hasAgent) {
      delete sanitized.agent;
    }

    if (shown.hasMethod) {
      delete sanitized.method;
    }

    if (shown.hasStatus) {
      delete sanitized.status;
    }

    if (shown.hasUrl) {
      delete sanitized.url;
    }

    return sanitized;
  }

  private formatOperationLabel(context: LogContext | undefined): string | null {
    if (context?.operationName) {
      return context.operationName;
    }

    const url = context?.url ?? context?.httpRequest?.requestUrl;

    if (url) {
      return `"${url}"`;
    }

    return null;
  }

  private formatLogLine(message: string, context: LogContext | undefined): string {
    const label = this.formatOperationLabel(context);
    const agent = context?.agent ? this.formatUserAgent(context.agent) : null;
    const method = context?.method ?? context?.httpRequest?.requestMethod;
    const status = context?.status;
    const parts = [label, agent].filter((part): part is string => Boolean(part));
    const suffix = [method, status, message].filter(Boolean).join(' ');

    if (!message) {
      return [parts.join(' '), [method, status].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(' - ');
    }

    if (parts.length === 0) {
      return suffix;
    }

    return `${parts.join(' ')} - ${suffix}`;
  }

  /**
   * Logs a message with the specified severity level.
   */
  private logMessage(
    message: string | Error,
    context: LogContext | undefined,
    severity: Severity,
    logLevel: LogLevel,
  ): void {
    if (!this.isLevelEnabled(logLevel)) return;

    const operationName = context?.operationName;

    const shown = {
      hasOperationName: Boolean(operationName),
      hasAgent: context?.agent != null,
      hasMethod: context?.method != null || context?.httpRequest?.requestMethod != null,
      hasStatus: context?.status != null,
      hasUrl: !operationName && (context?.url != null || context?.httpRequest?.requestUrl != null),
    };

    if (message instanceof Error) {
      const {
        message: msg,
        stack,
        params,
        context: ctx,
      } = this.extractMessagesWithStack([message, context]);
      const sanitizedContext = this.sanitizeContextForOutput(ctx, shown);
      this.printMessage({
        message: this.formatLogLine(msg, ctx ?? context),
        stack,
        params,
        context: sanitizedContext,
        severity,
      });
    } else {
      const { message: msg, params, context: ctx } = this.extractMessages([message, context]);
      const sanitizedContext = this.sanitizeContextForOutput(ctx, shown);
      this.printMessage({
        message: this.formatLogLine(msg, ctx ?? context),
        params,
        context: sanitizedContext,
        severity,
      });
    }
  }

  formatUserAgent(userAgent?: string | null) {
    if (!userAgent) return 'Unknown';

    // Priority regex for well-known tokens and version capture
    const priorityRegex = new RegExp(
      '\\b(Chrome|CriOS|Firefox|FxiOS|Safari|Version|Edg|Edge|OPR|Opera|PostmanRuntime|Postman|curl|Axios|Insomnia|Node|Node-fetch|Googlebot|Bingbot|Twitterbot)[/\\s_]?([0-9]+)',
      'i',
    );

    // Generic Name/Version fallback
    const genericRegex = new RegExp('([A-Za-z0-9\\-\\.]+)[/ ]([0-9]+)');

    const normalize: Record<string, string> = {
      CriOS: 'Chrome',
      FxiOS: 'Firefox',
      Edg: 'Edge',
      OPR: 'Opera',
      PostmanRuntime: 'Postman',
      'Node-fetch': 'Node',
      Node: 'Node',
    };

    const pMatch = userAgent.match(priorityRegex);
    if (pMatch) {
      let name = pMatch[1];
      const ver = pMatch[2];
      if (normalize[name]) name = normalize[name];

      // Special case: when 'Version' token is present alongside 'Safari', prefer Version as major
      if (/\bVersion\//i.test(userAgent) && /Safari/i.test(userAgent)) {
        const v = userAgent.match(/Version\/([0-9]+)/i);
        if (v && v[1]) return `Safari ${v[1]}`;
      }

      return ver ? `${name} ${ver}` : name;
    }

    const gMatch = userAgent.match(genericRegex);
    if (gMatch) {
      return `${gMatch[1]} ${gMatch[2]}`;
    }

    // Final fallback: first token
    return userAgent.split(' ')[0];
  }

  /**
   * Logs a message with 'info' severity.
   * @param message - The message to log.
   * @param context - The context of the log message.
   */
  log(message: string, context?: LogContext): void {
    this.logMessage(message, context, 'info', 'log');
  }

  /**
   * Logs a debug message.
   * @param message - The debug message.
   * @param context - The context of the log message.
   */
  debug(message: string, context?: LogContext): void {
    this.logMessage(message, context, 'debug', 'debug');
  }

  /**
   * Logs an info message.
   * @param message - The info message.
   * @param context - The context of the log message.
   */
  info(message: string, context?: LogContext): void {
    this.logMessage(message, context, 'info', 'info');
  }

  /**
   * Logs a warning message.
   * @param message - The warning message.
   * @param context - The context of the log message.
   */
  warn(message: string, context?: LogContext): void {
    this.logMessage(message, context, 'warn', 'warn');
  }

  /**
   * Logs an error message.
   * @param message - The error message or Error object.
   * @param context - The context of the log message.
   */
  error(message: string | Error, context?: LogContext): void {
    this.logMessage(message, context, 'error', 'error');
  }

  /**
   * Logs a fatal error message.
   * @param message - The fatal error message or Error object.
   * @param context - The context of the log message.
   */
  fatal(message: string | Error, context?: LogContext): void {
    this.logMessage(message, context, 'fatal', 'fatal');
  }
}
