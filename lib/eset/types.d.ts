import type { Result } from 'neverthrow';

interface RuntimeError {
  type: string;
  message: string | undefined;
  error: unknown;
}

interface MessageInfo<T = string> {
  id: T;
  from: string;
  subject: string;
}

interface EmailService<T> {
  createEmailAddress(): Promise<Result<void, RuntimeError>>;
  getInbox(): Promise<Result<MessageInfo<T>[], RuntimeError>>;
  readMessage(messageId: string): Promise<Result<string, RuntimeError>>;
  getEmailAddress(): string;

  deleteEmailAddress?: () => Promise<Result<void, RuntimeError>>;
}

interface EsetLicenseInfo {
  licenseKey: string;
  product: string;
  expirationDate: string;
}
