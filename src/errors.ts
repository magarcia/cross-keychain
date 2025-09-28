/**
 *
 */
export class KeyringError extends Error {}
/**
 *
 */
export class PasswordSetError extends KeyringError {}
/**
 *
 */
export class PasswordDeleteError extends KeyringError {}
/**
 *
 */
export class InitError extends KeyringError {}
/**
 *
 */
export class KeyringLockedError extends KeyringError {}
/**
 *
 */
export class NoKeyringError extends KeyringError {}
