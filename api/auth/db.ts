import type { User } from '../../types';

// This is our in-memory "database".
// Exporting it allows it to be a shared module across different serverless functions,
// preserving state for the lifetime of the environment.
export const users: (User & { password?: string })[] = [];
export let userIdCounter = 1;

export function incrementUserId() {
    userIdCounter++;
}
