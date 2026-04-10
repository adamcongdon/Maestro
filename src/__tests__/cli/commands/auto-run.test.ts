/**
 * @file auto-run.test.ts
 * @description Tests for the auto-run CLI command
 *
 * Tests the auto-run command including:
 * - Configuring auto-run with valid document paths
 * - Error handling for non-existent documents
 * - Error handling for non-.md files
 * - --save-as flag sends saveAsPlaybook in message
 * - --launch flag sends launch: true
 * - --loop and --max-loops send loop config
 * - --reset-on-completion flag
 */

import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';

// Mock maestro-client
vi.mock('../../../cli/services/maestro-client', () => ({
	withMaestroClient: vi.fn(),
	resolveSessionId: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
	existsSync: vi.fn(),
}));

import { autoRun } from '../../../cli/commands/auto-run';
import { withMaestroClient, resolveSessionId } from '../../../cli/services/maestro-client';
import { existsSync } from 'fs';

describe('auto-run command', () => {
	let consoleSpy: MockInstance;
	let consoleErrorSpy: MockInstance;
	let processExitSpy: MockInstance;

	beforeEach(() => {
		vi.clearAllMocks();
		consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
	});

	it('should configure auto-run with valid document paths', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockReturnValue('session-123');
		vi.mocked(withMaestroClient).mockImplementation(async (action) => {
			const mockClient = {
				sendCommand: vi.fn().mockResolvedValue({ success: true }),
			};
			return action(mockClient as never);
		});

		await autoRun(['/tmp/doc1.md', '/tmp/doc2.md'], { session: 'session-123' });

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('Auto-run configured with 2 document(s)')
		);
		expect(processExitSpy).not.toHaveBeenCalled();
	});

	it('should send correct message shape to WebSocket', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockReturnValue('session-456');
		let sentMessage: Record<string, unknown> | undefined;
		vi.mocked(withMaestroClient).mockImplementation(async (action) => {
			const mockClient = {
				sendCommand: vi.fn().mockImplementation((msg: Record<string, unknown>) => {
					sentMessage = msg;
					return Promise.resolve({ success: true });
				}),
			};
			return action(mockClient as never);
		});

		await autoRun(['/tmp/task.md'], { session: 'session-456' });

		expect(sentMessage).toMatchObject({
			type: 'configure_auto_run',
			sessionId: 'session-456',
			documents: [{ filename: 'task.md', resetOnCompletion: false }],
			launch: false,
		});
	});

	it('should error for non-existent document', async () => {
		vi.mocked(existsSync).mockReturnValue(false);

		await autoRun(['/tmp/nonexistent.md'], { session: 'session-123' });

		expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('File not found'));
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	it('should error for non-.md file', async () => {
		vi.mocked(existsSync).mockReturnValue(true);

		await autoRun(['/tmp/readme.txt'], { session: 'session-123' });

		expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('must be a .md file'));
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	it('should error with no documents provided', async () => {
		await autoRun([], { session: 'session-123' });

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining('At least one document path is required')
		);
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	it('should send saveAsPlaybook when --save-as flag is set', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockReturnValue('session-123');
		let sentMessage: Record<string, unknown> | undefined;
		vi.mocked(withMaestroClient).mockImplementation(async (action) => {
			const mockClient = {
				sendCommand: vi.fn().mockImplementation((msg: Record<string, unknown>) => {
					sentMessage = msg;
					return Promise.resolve({ success: true, playbookId: 'pb-001' });
				}),
			};
			return action(mockClient as never);
		});

		await autoRun(['/tmp/doc.md'], { session: 'session-123', saveAs: 'My Playbook' });

		expect(sentMessage).toMatchObject({
			saveAsPlaybook: 'My Playbook',
		});
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("Playbook 'My Playbook' saved")
		);
	});

	it('should send launch: true when --launch flag is set', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockReturnValue('session-123');
		let sentMessage: Record<string, unknown> | undefined;
		vi.mocked(withMaestroClient).mockImplementation(async (action) => {
			const mockClient = {
				sendCommand: vi.fn().mockImplementation((msg: Record<string, unknown>) => {
					sentMessage = msg;
					return Promise.resolve({ success: true });
				}),
			};
			return action(mockClient as never);
		});

		await autoRun(['/tmp/doc.md'], { session: 'session-123', launch: true });

		expect(sentMessage).toMatchObject({
			launch: true,
		});
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('Auto-run launched with 1 document(s)')
		);
	});

	it('should send loop config with --loop and --max-loops', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockReturnValue('session-123');
		let sentMessage: Record<string, unknown> | undefined;
		vi.mocked(withMaestroClient).mockImplementation(async (action) => {
			const mockClient = {
				sendCommand: vi.fn().mockImplementation((msg: Record<string, unknown>) => {
					sentMessage = msg;
					return Promise.resolve({ success: true });
				}),
			};
			return action(mockClient as never);
		});

		await autoRun(['/tmp/doc.md'], {
			session: 'session-123',
			loop: true,
			maxLoops: '5',
		});

		expect(sentMessage).toMatchObject({
			loopEnabled: true,
			maxLoops: 5,
		});
	});

	it('should imply --loop when --max-loops is provided', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockReturnValue('session-123');
		let sentMessage: Record<string, unknown> | undefined;
		vi.mocked(withMaestroClient).mockImplementation(async (action) => {
			const mockClient = {
				sendCommand: vi.fn().mockImplementation((msg: Record<string, unknown>) => {
					sentMessage = msg;
					return Promise.resolve({ success: true });
				}),
			};
			return action(mockClient as never);
		});

		await autoRun(['/tmp/doc.md'], { session: 'session-123', maxLoops: '3' });

		expect(sentMessage).toMatchObject({
			loopEnabled: true,
			maxLoops: 3,
		});
	});

	it('should set resetOnCompletion on all documents when flag is set', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockReturnValue('session-123');
		let sentMessage: Record<string, unknown> | undefined;
		vi.mocked(withMaestroClient).mockImplementation(async (action) => {
			const mockClient = {
				sendCommand: vi.fn().mockImplementation((msg: Record<string, unknown>) => {
					sentMessage = msg;
					return Promise.resolve({ success: true });
				}),
			};
			return action(mockClient as never);
		});

		await autoRun(['/tmp/doc1.md', '/tmp/doc2.md'], {
			session: 'session-123',
			resetOnCompletion: true,
		});

		expect(sentMessage).toMatchObject({
			documents: [
				{ filename: 'doc1.md', resetOnCompletion: true },
				{ filename: 'doc2.md', resetOnCompletion: true },
			],
		});
	});

	it('should error when --max-loops is not a positive integer', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockReturnValue('session-123');

		await autoRun(['/tmp/doc.md'], { session: 'session-123', maxLoops: 'abc' });

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining('--max-loops must be a positive integer')
		);
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	it('should error when session resolution fails', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockImplementation(() => {
			throw new Error('No sessions found. Create a session in Maestro first.');
		});

		await autoRun(['/tmp/doc.md'], {});

		expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No sessions found'));
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	it('should error gracefully when Maestro is not running', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockReturnValue('session-123');
		vi.mocked(withMaestroClient).mockRejectedValue(
			new Error('Maestro desktop app is not running')
		);

		await autoRun(['/tmp/doc.md'], { session: 'session-123' });

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Maestro desktop app is not running')
		);
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	it('should handle configure_auto_run failure response', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockReturnValue('session-123');
		vi.mocked(withMaestroClient).mockImplementation(async (action) => {
			const mockClient = {
				sendCommand: vi.fn().mockResolvedValue({
					success: false,
					error: 'Session not found',
				}),
			};
			return action(mockClient as never);
		});

		await autoRun(['/tmp/doc.md'], { session: 'session-123' });

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Session not found')
		);
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});
});
