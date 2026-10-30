/** Browser clipboard writes cannot be canceled; every application flow shares this lock. */
export const clipboardWriteLock = { pending: false };
