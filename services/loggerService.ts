
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    [key: string]: any;
}

class LoggerService {
    private static instance: LoggerService;

    private constructor() { }

    public static getInstance(): LoggerService {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }

    private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    public debug(message: string, context?: LogContext): void {
        // In production we might want to disable debug logs
        console.debug(this.formatMessage('debug', message), context || '');
    }

    public info(message: string, context?: LogContext): void {
        console.info(this.formatMessage('info', message), context || '');
    }

    public warn(message: string, context?: LogContext): void {
        console.warn(this.formatMessage('warn', message), context || '');
    }

    public error(message: string, error?: any, context?: LogContext): void {
        console.error(this.formatMessage('error', message), error || '', context || '');
    }
}

export const logger = LoggerService.getInstance();
