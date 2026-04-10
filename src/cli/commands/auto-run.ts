/**
 * auto-run command - Configure and optionally launch an auto-run session in Maestro
 */

import * as fs from 'fs';
import * as path from 'path';
import { withMaestroClient, resolveSessionId } from '../services/maestro-client';

interface AutoRunOptions {
	session?: string;
	prompt?: string;
	loop?: boolean;
	maxLoops?: string;
	saveAs?: string;
	launch?: boolean;
	resetOnCompletion?: boolean;
}

export async function autoRun(docs: string[], options: AutoRunOptions): Promise<void> {
	if (!docs || docs.length === 0) {
		console.error('Error: At least one document path is required');
		process.exit(1);
	}

	// Resolve and validate each document path
	const resolvedDocs: Array<{ filename: string; resetOnCompletion: boolean }> = [];
	for (const doc of docs) {
		const absolutePath = path.resolve(doc);

		if (!fs.existsSync(absolutePath)) {
			console.error(`Error: File not found: ${absolutePath}`);
			process.exit(1);
		}

		if (path.extname(absolutePath).toLowerCase() !== '.md') {
			console.error(`Error: File must be a .md file: ${absolutePath}`);
			process.exit(1);
		}

		resolvedDocs.push({
			filename: path.basename(absolutePath),
			resetOnCompletion: options.resetOnCompletion || false,
		});
	}

	let sessionId: string;
	try {
		sessionId = resolveSessionId(options);
	} catch (error) {
		console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}

	// Parse maxLoops if provided (implies --loop)
	const loopEnabled = options.loop || !!options.maxLoops;
	let maxLoops: number | undefined;
	if (options.maxLoops) {
		maxLoops = parseInt(options.maxLoops, 10);
		if (isNaN(maxLoops) || maxLoops < 1) {
			console.error('Error: --max-loops must be a positive integer');
			process.exit(1);
		}
	}

	try {
		const result = await withMaestroClient(async (client) => {
			return client.sendCommand<{
				success: boolean;
				playbookId?: string;
				error?: string;
			}>(
				{
					type: 'configure_auto_run',
					sessionId,
					documents: resolvedDocs,
					prompt: options.prompt,
					loopEnabled,
					maxLoops,
					saveAsPlaybook: options.saveAs,
					launch: options.launch || false,
				},
				'configure_auto_run_result'
			);
		});

		if (result.success) {
			if (options.saveAs) {
				console.log(
					`Playbook '${options.saveAs}' saved${result.playbookId ? ` (${result.playbookId})` : ''}`
				);
			} else if (options.launch) {
				console.log(`Auto-run launched with ${resolvedDocs.length} document(s)`);
			} else {
				console.log(`Auto-run configured with ${resolvedDocs.length} document(s)`);
			}
		} else {
			console.error(`Failed to configure auto-run: ${result.error || 'Unknown error'}`);
			process.exit(1);
		}
	} catch (error) {
		console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}
