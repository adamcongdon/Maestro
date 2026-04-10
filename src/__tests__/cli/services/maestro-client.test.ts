/**
 * @file maestro-client.test.ts
 * @description Tests for the CLI WebSocket client service
 *
 * Tests the MaestroClient class and withMaestroClient helper including:
 * - Connection lifecycle (connect, disconnect)
 * - Error handling for missing/stale discovery file
 * - Command sending and response matching
 * - Timeout handling
 * - resolveSessionId helper
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock cli-server-discovery
vi.mock('../../../shared/cli-server-discovery', () => ({
	readCliServerInfo: vi.fn(),
	isCliServerRunning: vi.fn(),
}));

// Mock storage
vi.mock('../../../cli/services/storage', () => ({
	readSessions: vi.fn(),
}));

// Hoisted mock state — accessible inside vi.mock factory
const { mockWsModule, getLastMockWs, setWsFactory } = vi.hoisted(() => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { EventEmitter } = require('events');

	type MockWs = InstanceType<typeof EventEmitter> & {
		close: ReturnType<typeof vi.fn>;
		send: ReturnType<typeof vi.fn>;
		readyState: number;
	};

	let lastMockWs: MockWs;
	let emitMode: 'open' | 'error' | null = null;

	function createDefaultWs(): MockWs {
		const ws = new EventEmitter() as MockWs;
		ws.close = vi.fn();
		ws.send = vi.fn();
		ws.readyState = 1; // OPEN
		lastMockWs = ws;
		setTimeout(() => ws.emit('open'), 0);
		return ws;
	}

	// Use a real class so `new MockWebSocket()` works
	class MockWebSocket extends EventEmitter {
		static OPEN = 1;
		close: ReturnType<typeof vi.fn>;
		send: ReturnType<typeof vi.fn>;
		readyState: number;

		constructor() {
			super();
			this.close = vi.fn();
			this.send = vi.fn();
			this.readyState = 1;
			lastMockWs = this as unknown as MockWs;

			if (emitMode === 'error') {
				setTimeout(() => this.emit('error', new Error('Connection refused')), 0);
				emitMode = null; // Reset after use
			} else {
				setTimeout(() => this.emit('open'), 0);
			}
		}
	}

	return {
		mockWsModule: { default: MockWebSocket, __esModule: true },
		getLastMockWs: () => lastMockWs,
		setWsFactory: (mode: 'error' | null) => { emitMode = mode; },
	};
});

vi.mock('ws', () => mockWsModule);

import { MaestroClient, withMaestroClient, resolveSessionId } from '../../../cli/services/maestro-client';
import { readCliServerInfo, isCliServerRunning } from '../../../shared/cli-server-discovery';
import { readSessions } from '../../../cli/services/storage';

describe('MaestroClient', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(readCliServerInfo).mockReturnValue({
			port: 12345,
			token: 'test-token',
			pid: 1234,
			startedAt: Date.now(),
		});
		vi.mocked(isCliServerRunning).mockReturnValue(true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('connect()', () => {
		it('should throw when no discovery file exists', async () => {
			vi.mocked(readCliServerInfo).mockReturnValue(null);

			const client = new MaestroClient();
			await expect(client.connect()).rejects.toThrow('Maestro desktop app is not running');
		});

		it('should throw when PID is stale', async () => {
			vi.mocked(isCliServerRunning).mockReturnValue(false);

			const client = new MaestroClient();
			await expect(client.connect()).rejects.toThrow('Maestro discovery file is stale');
		});

		it('should connect successfully when Maestro is running', async () => {
			const client = new MaestroClient();
			await expect(client.connect()).resolves.toBeUndefined();
			client.disconnect();
		});

		it('should throw on WebSocket error', async () => {
			// Use setWsFactory to signal: emit 'error' instead of 'open'
			setWsFactory('error');

			const client = new MaestroClient();
			await expect(client.connect()).rejects.toThrow('Failed to connect to Maestro');
			setWsFactory(null);
		});
	});

	describe('sendCommand()', () => {
		it('should throw if not connected', async () => {
			const client = new MaestroClient();
			await expect(
				client.sendCommand({ type: 'ping' }, 'pong')
			).rejects.toThrow('Not connected to Maestro');
		});

		it('should resolve on matching response type', async () => {
			const client = new MaestroClient();
			await client.connect();

			const promise = client.sendCommand<{ type: string }>({ type: 'ping' }, 'pong');

			// Simulate server response using the tracked mock instance
			getLastMockWs().emit('message', JSON.stringify({ type: 'pong', timestamp: Date.now() }));

			const result = await promise;
			expect(result.type).toBe('pong');

			client.disconnect();
		});

		it('should reject on timeout', async () => {
			const client = new MaestroClient();
			await client.connect();

			const promise = client.sendCommand({ type: 'ping' }, 'pong', 50);

			await expect(promise).rejects.toThrow("Request timed out waiting for 'pong'");

			client.disconnect();
		});
	});

	describe('disconnect()', () => {
		it('should clean up pending requests on disconnect', async () => {
			const client = new MaestroClient();
			await client.connect();

			const promise = client.sendCommand({ type: 'ping' }, 'pong');
			client.disconnect();

			await expect(promise).rejects.toThrow('Client disconnected');
		});
	});
});

describe('withMaestroClient()', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(readCliServerInfo).mockReturnValue({
			port: 12345,
			token: 'test-token',
			pid: 1234,
			startedAt: Date.now(),
		});
		vi.mocked(isCliServerRunning).mockReturnValue(true);
	});

	it('should connect, run action, and disconnect', async () => {
		const action = vi.fn().mockResolvedValue('result');

		const result = await withMaestroClient(action);

		expect(result).toBe('result');
		expect(action).toHaveBeenCalledTimes(1);
	});

	it('should disconnect even if action throws', async () => {
		const action = vi.fn().mockRejectedValue(new Error('action failed'));

		await expect(withMaestroClient(action)).rejects.toThrow('action failed');
	});

	it('should throw if connect fails', async () => {
		vi.mocked(readCliServerInfo).mockReturnValue(null);

		await expect(
			withMaestroClient(async () => 'result')
		).rejects.toThrow('Maestro desktop app is not running');
	});
});

describe('resolveSessionId()', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return session from options if provided', () => {
		expect(resolveSessionId({ session: 'my-session-id' })).toBe('my-session-id');
	});

	it('should return first session if no option provided', () => {
		vi.mocked(readSessions).mockReturnValue([
			{ id: 'first-session', name: 'First', toolType: 'claude-code', cwd: '/tmp', projectRoot: '/tmp' },
			{ id: 'second-session', name: 'Second', toolType: 'claude-code', cwd: '/tmp', projectRoot: '/tmp' },
		] as ReturnType<typeof readSessions>);

		expect(resolveSessionId({})).toBe('first-session');
	});

	it('should throw if no sessions exist', () => {
		vi.mocked(readSessions).mockReturnValue([]);

		expect(() => resolveSessionId({})).toThrow('No sessions found');
	});
});
