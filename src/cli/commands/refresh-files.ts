/**
 * refresh-files command - Refresh the file tree for a session in Maestro
 */

import { withMaestroClient, resolveSessionId } from '../services/maestro-client';

interface RefreshFilesOptions {
	session?: string;
}

export async function refreshFiles(options: RefreshFilesOptions): Promise<void> {
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
				{ type: 'refresh_file_tree', sessionId },
				'refresh_file_tree_result'
			);
		});

		if (result.success) {
			console.log('File tree refreshed');
		} else {
			console.error('Failed to refresh file tree');
			process.exit(1);
		}
	} catch (error) {
		console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}
