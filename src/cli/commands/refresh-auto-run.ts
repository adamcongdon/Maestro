/**
 * refresh-auto-run command - Refresh auto-run documents for a session in Maestro
 */

import { withMaestroClient, resolveSessionId } from '../services/maestro-client';

interface RefreshAutoRunOptions {
	session?: string;
}

export async function refreshAutoRun(options: RefreshAutoRunOptions): Promise<void> {
	let sessionId: string;
	try {
		sessionId = resolveSessionId(options);
	} catch (error) {
		console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}

	try {
		const result = await withMaestroClient(async (client) => {
			return client.sendCommand<{ success: boolean }>(
				{ type: 'refresh_auto_run_docs', sessionId },
				'refresh_auto_run_docs_result'
			);
		});

		if (result.success) {
			console.log('Auto Run documents refreshed');
		} else {
			console.error('Failed to refresh Auto Run documents');
			process.exit(1);
		}
	} catch (error) {
		console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}
