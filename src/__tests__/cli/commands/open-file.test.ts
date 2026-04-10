/**
 * @file open-file.test.ts
 * @description Tests for the open-file CLI command
 *
 * Tests the open-file command including:
 * - Opening a valid file path with a session
 * - Error handling for non-existent files
 * - Error handling when Maestro app is not running
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

import { openFile } from '../../../cli/commands/open-file';
import { withMaestroClient, resolveSessionId } from '../../../cli/services/maestro-client';
import { existsSync } from 'fs';

describe('open-file command', () => {
	let consoleSpy: MockInstance;
	let consoleErrorSpy: MockInstance;
	let processExitSpy: MockInstance;

	beforeEach(() => {
		vi.clearAllMocks();
		consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
	});

	it('should open a valid file with specified session', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockReturnValue('session-123');
		vi.mocked(withMaestroClient).mockImplementation(async (action) => {
			const mockClient = {
				sendCommand: vi.fn().mockResolvedValue({ success: true, filePath: '/tmp/test.ts' }),
			};
			return action(mockClient as never);
		});

		await openFile('/tmp/test.ts', { session: 'session-123' });

		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Opened test.ts in Maestro'));
		expect(processExitSpy).not.toHaveBeenCalled();
	});

	it('should error for non-existent file', async () => {
		vi.mocked(existsSync).mockReturnValue(false);

		await openFile('/tmp/nonexistent.ts', { session: 'session-123' });

		expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('File not found'));
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	it('should error gracefully when Maestro is not running', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockReturnValue('session-123');
		vi.mocked(withMaestroClient).mockRejectedValue(
			new Error('Maestro desktop app is not running')
		);

		await openFile('/tmp/test.ts', { session: 'session-123' });

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Maestro desktop app is not running')
		);
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	it('should error when session resolution fails', async () => {
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(resolveSessionId).mockImplementation(() => {
			throw new Error('No sessions found. Create a session in Maestro first.');
		});

		await openFile('/tmp/test.ts', {});

		expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No sessions found'));
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});
});
