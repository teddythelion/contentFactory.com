import type { User } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			userId: string | null;
			user: Partial<User> | null;
		}
	}
}

export {};