/**
 * status command - Check if Maestro desktop app is running and reachable
 */

import { readCliServerInfo, isCliServerRunning } from '../../shared/cli-server-discovery';
import { withMaestroClient } from '../services/maestro-client';

interface SessionsListResponse {
	type: string;
	sessions: Array<{ id: string; name: string }>;
}

export async function status(): Promise<void> {
	const info = readCliServerInfo();
	if (!info) {
		console.log('Maestro desktop app is not running');
		process.exit(1);
	}

	if (!isCliServerRunning()) {
		console.log('Maestro discovery file is stale (app may have crashed)');
		process.exit(1);
	}

	try {
		const sessionsResult = await withMaestroClient(async (client) => {
			// Ping first to verify connection
			await client.sendCommand({ type: 'ping' }, 'pong', 5000);
			// Get session count
			return client.sendCommand<SessionsListResponse>(
				{ type: 'get_sessions' },
				'sessions_list',
				5000
			);
		});

		const sessionCount = sessionsResult.sessions?.length ?? 0;
		console.log(`Maestro is running on port ${info.port} with ${sessionCount} sessions`);
	} catch (error) {
		console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}
