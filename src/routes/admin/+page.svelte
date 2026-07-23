<script lang="ts">
	import type { PageData } from './$types';
	import type { AdminUserRow } from './+page.server';

	let { data }: { data: PageData } = $props();

	let users = $state<AdminUserRow[]>(data.users as AdminUserRow[]);
	let savingUid = $state<string | null>(null);
	let errorMsg = $state('');

	const PLANS = ['free', 'starter', 'pro', 'elite'] as const;

	function gb(bytes: number): string {
		return `${(bytes / 1073741824).toFixed(2)} GB`;
	}

	async function patchUser(uid: string, body: Record<string, unknown>) {
		savingUid = uid;
		errorMsg = '';
		try {
			const res = await fetch(`/api/admin/users/${uid}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const json = await res.json();
			if (!res.ok) {
				errorMsg = `⚠️ Failed to update ${uid}: ${json.error ?? 'unknown error'}`;
				console.warn(errorMsg);
				return;
			}
			users = users.map((u) => (u.uid === uid ? { ...u, ...body } : u));
		} catch (e) {
			errorMsg = `⚠️ Failed to update ${uid}: ${e instanceof Error ? e.message : String(e)}`;
			console.warn(errorMsg);
		} finally {
			savingUid = null;
		}
	}
</script>

<svelte:head>
	<title>Admin — Content Factory</title>
</svelte:head>

<div class="mx-auto max-w-6xl">
	<h1 class="mb-1 text-3xl font-bold">Admin</h1>
	<p class="mb-6 text-sm text-base-content/50">{users.length} users. Plan changes here are a direct override — they don't touch Stripe.</p>

	{#if errorMsg}
		<div class="alert alert-error mb-4 text-sm">{errorMsg}</div>
	{/if}

	<div class="overflow-x-auto rounded-lg border border-base-300">
		<table class="table">
			<thead>
				<tr>
					<th>Email</th>
					<th>Plan</th>
					<th>Admin</th>
					<th>Storage</th>
					<th>Images</th>
					<th>Videos</th>
					<th>Sub status</th>
				</tr>
			</thead>
			<tbody>
				{#each users as u (u.uid)}
					<tr class={savingUid === u.uid ? 'opacity-50' : ''}>
						<td>
							<div class="font-medium">{u.email}</div>
							{#if u.displayName}<div class="text-xs text-base-content/40">{u.displayName}</div>{/if}
						</td>
						<td>
							<select
								class="select select-sm select-bordered"
								value={u.plan}
								disabled={savingUid === u.uid}
								onchange={(e) => patchUser(u.uid, { plan: (e.target as HTMLSelectElement).value })}
							>
								{#each PLANS as p}
									<option value={p}>{p}</option>
								{/each}
							</select>
						</td>
						<td>
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={u.isAdmin}
								disabled={savingUid === u.uid}
								onchange={(e) => patchUser(u.uid, { isAdmin: (e.target as HTMLInputElement).checked })}
							/>
						</td>
						<td class="text-xs text-base-content/60">{gb(u.storageUsed)} / {gb(u.storageLimit)}</td>
						<td class="text-xs text-base-content/60">{u.imagesGenerated}</td>
						<td class="text-xs text-base-content/60">{u.videosGenerated}</td>
						<td class="text-xs text-base-content/60">{u.subscriptionStatus ?? '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
