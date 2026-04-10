/**
 * CLI WebSocket Client for Maestro Desktop App
 *
 * Connects to the running Maestro desktop app via WebSocket for real-time IPC.
 * Uses the discovery file (cli-server-discovery.ts) to find the running instance.
 */

import WebSocket from 'ws';
import { readCliServerInfo, isCliServerRunning } from '../../shared/cli-server-discovery';
import { readSessions } from './storage';

/**
 * WebSocket client for communicating with the Maestro desktop app.
 */
export class MaestroClient {
	private ws: WebSocket | null = null;
	private pendingRequests: Map<
		string,
		{
			resolve: (value: unknown) => void;
			reject: (reason: Error) => void;
			timeout: ReturnType<typeof setTimeout>;
			responseType: string;
		}
	> = new Map();
	private messageHandler: ((data: WebSocket.Data) => void) | null = null;

	/**
	 * Connect to the running Maestro app.
	 * Throws if the app is not running or connection fails.
	 */
	async connect(): Promise<void> {
		const info = readCliServerInfo();
		if (!info) {
			throw new Error('Maestro desktop app is not running');
		}

		if (!isCliServerRunning()) {
			throw new Error('Maestro discovery file is stale (app may have crashed)');
		}

		return new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				if (this.ws) {
					this.ws.close();
					this.ws = null;
				}
				reject(new Error('Connection to Maestro timed out'));
			}, 5000);

			const url = `ws://localhost:${info.port}/${info.token}/ws`;
			this.ws = new WebSocket(url);

			this.ws.on('open', () => {
				clearTimeout(timeout);
				this.setupMessageListener();
				resolve();
			});

			this.ws.on('error', (err) => {
				clearTimeout(timeout);
				this.ws = null;
				reject(new Error(`Failed to connect to Maestro: ${err.message}`));
			});
		});
	}

	/**
	 * Set up the message listener that routes responses to pending requests.
	 */
	private setupMessageListener(): void {
		if (!this.ws) return;

		this.messageHandler = (data: WebSocket.Data) => {
			try {
				const message = JSON.parse(data.toString());
				const type = message.type as string;

				// Check all pending requests for a matching response type
				for (const [id, pending] of this.pendingRequests) {
					if (pending.responseType === type) {
						clearTimeout(pending.timeout);
						this.pendingRequests.delete(id);
						if (message.type === 'error') {
							pending.reject(new Error(message.message || 'Unknown error'));
						} else {
							pending.resolve(message);
						}
						return;
					}
				}
			} catch {
				// Ignore unparseable messages
			}
		};

		this.ws.on('message', this.messageHandler);
	}

	/**
	 * Send a message and wait for a typed response.
	 */
	async sendCommand<T>(
		message: Record<string, unknown>,
		responseType: string,
		timeoutMs: number = 10000
	): Promise<T> {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			throw new Error('Not connected to Maestro');
		}

		const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		return new Promise<T>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(requestId);
				reject(new Error(`Request timed out waiting for '${responseType}'`));
			}, timeoutMs);

			this.pendingRequests.set(requestId, {
				resolve: resolve as (value: unknown) => void,
				reject,
				timeout,
				responseType,
			});

			this.ws!.send(JSON.stringify(message));
		});
	}

	/**
	 * Disconnect gracefully.
	 */
	disconnect(): void {
		// Clear all pending requests
		for (const [id, pending] of this.pendingRequests) {
			clearTimeout(pending.timeout);
			pending.reject(new Error('Client disconnected'));
		}
		this.pendingRequests.clear();

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}
}

/**
 * Helper: create client, connect, run action, disconnect.
 * Handles the connect/disconnect lifecycle for one-shot commands.
 */
export async function withMaestroClient<T>(action: (client: MaestroClient) => Promise<T>): Promise<T> {
	const client = new MaestroClient();
	try {
		await client.connect();
		return await action(client);
	} finally {
		client.disconnect();
	}
}

/**
 * Resolve the session ID from command options.
 * If --session is provided, uses it directly.
 * Otherwise, falls back to the first available session.
 */
export function resolveSessionId(options: { session?: string }): string {
	if (options.session) {
		return options.session;
	}

	const sessions = readSessions();
	if (sessions.length === 0) {
		throw new Error('No sessions found. Create a session in Maestro first.');
	}

	return sessions[0].id;
}
