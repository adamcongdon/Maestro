/**
 * Tests for src/shared/cli-server-discovery.ts
 *
 * This module provides functions for reading/writing the CLI server discovery file.
 * Tests mock Node.js fs and os modules to isolate behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Node.js modules before importing the module under test
vi.mock('fs', () => ({
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	existsSync: vi.fn(),
	mkdirSync: vi.fn(),
	renameSync: vi.fn(),
	unlinkSync: vi.fn(),
}));

vi.mock('os', () => ({
	platform: vi.fn(),
	homedir: vi.fn(),
}));

// Now import after mocks are set up
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
	writeCliServerInfo,
	readCliServerInfo,
	deleteCliServerInfo,
	isCliServerRunning,
} from '../../shared/cli-server-discovery';
import type { CliServerInfo } from '../../shared/cli-server-discovery';

// Type assertions for mocked modules
const mockFs = {
	readFileSync: fs.readFileSync as ReturnType<typeof vi.fn>,
	writeFileSync: fs.writeFileSync as ReturnType<typeof vi.fn>,
	existsSync: fs.existsSync as ReturnType<typeof vi.fn>,
	mkdirSync: fs.mkdirSync as ReturnType<typeof vi.fn>,
	renameSync: fs.renameSync as ReturnType<typeof vi.fn>,
	unlinkSync: fs.unlinkSync as ReturnType<typeof vi.fn>,
};

const mockOs = {
	platform: os.platform as ReturnType<typeof vi.fn>,
	homedir: os.homedir as ReturnType<typeof vi.fn>,
};

describe('cli-server-discovery', () => {
	const sampleInfo: CliServerInfo = {
		port: 3456,
		token: 'abc-123-def-456',
		pid: 12345,
		startedAt: 1700000000000,
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Default mock implementations
		mockOs.platform.mockReturnValue('darwin');
		mockOs.homedir.mockReturnValue('/Users/testuser');
		mockFs.existsSync.mockReturnValue(true);
		mockFs.writeFileSync.mockReturnValue(undefined);
		mockFs.renameSync.mockReturnValue(undefined);
		mockFs.mkdirSync.mockReturnValue(undefined);
		mockFs.unlinkSync.mockReturnValue(undefined);

		// Mock console.error for error handling
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('writeCliServerInfo', () => {
		it('should write the file with correct content', () => {
			writeCliServerInfo(sampleInfo);

			// Should write to .tmp file first
			const expectedDir = path.join(
				'/Users/testuser',
				'Library',
				'Application Support',
				'maestro'
			);
			const expectedFile = path.join(expectedDir, 'cli-server.json');
			const expectedTmp = expectedFile + '.tmp';

			expect(mockFs.writeFileSync).toHaveBeenCalledWith(
				expectedTmp,
				JSON.stringify(sampleInfo, null, 2),
				'utf-8'
			);
			// Should rename .tmp to final file (atomic write)
			expect(mockFs.renameSync).toHaveBeenCalledWith(expectedTmp, expectedFile);
		});

		it('should create the directory if it does not exist', () => {
			mockFs.existsSync.mockReturnValue(false);

			writeCliServerInfo(sampleInfo);

			expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
		});

		it('should not create the directory if it already exists', () => {
			mockFs.existsSync.mockReturnValue(true);

			writeCliServerInfo(sampleInfo);

			expect(mockFs.mkdirSync).not.toHaveBeenCalled();
		});

		it('should handle write errors gracefully', () => {
			mockFs.writeFileSync.mockImplementation(() => {
				throw new Error('Permission denied');
			});

			// Should not throw
			expect(() => writeCliServerInfo(sampleInfo)).not.toThrow();
			expect(console.error).toHaveBeenCalledWith(
				'[CLI Server Discovery] Failed to write discovery file:',
				expect.any(Error)
			);
		});
	});

	describe('readCliServerInfo', () => {
		it('should return null for missing file', () => {
			mockFs.readFileSync.mockImplementation(() => {
				throw new Error('ENOENT: no such file or directory');
			});

			const result = readCliServerInfo();
			expect(result).toBeNull();
		});

		it('should return parsed data for valid file', () => {
			mockFs.readFileSync.mockReturnValue(JSON.stringify(sampleInfo));

			const result = readCliServerInfo();
			expect(result).toEqual(sampleInfo);
			expect(result!.port).toBe(3456);
			expect(result!.token).toBe('abc-123-def-456');
			expect(result!.pid).toBe(12345);
			expect(result!.startedAt).toBe(1700000000000);
		});

		it('should return null for invalid JSON', () => {
			mockFs.readFileSync.mockReturnValue('not valid json');

			const result = readCliServerInfo();
			expect(result).toBeNull();
		});

		it('should return null for missing required fields', () => {
			mockFs.readFileSync.mockReturnValue(JSON.stringify({ port: 3456 }));

			const result = readCliServerInfo();
			expect(result).toBeNull();
		});

		it('should return null for wrong field types', () => {
			mockFs.readFileSync.mockReturnValue(
				JSON.stringify({
					port: 'not-a-number',
					token: 'abc',
					pid: 123,
					startedAt: 1700000000000,
				})
			);

			const result = readCliServerInfo();
			expect(result).toBeNull();
		});

		it('should read from the correct path on macOS', () => {
			mockOs.platform.mockReturnValue('darwin');
			mockOs.homedir.mockReturnValue('/Users/testuser');
			mockFs.readFileSync.mockReturnValue(JSON.stringify(sampleInfo));

			readCliServerInfo();

			expect(mockFs.readFileSync).toHaveBeenCalledWith(
				path.join(
					'/Users/testuser',
					'Library',
					'Application Support',
					'maestro',
					'cli-server.json'
				),
				'utf-8'
			);
		});

		it('should read from the correct path on Windows', () => {
			mockOs.platform.mockReturnValue('win32');
			mockOs.homedir.mockReturnValue('C:\\Users\\testuser');
			const originalAppdata = process.env.APPDATA;
			process.env.APPDATA = 'C:\\Users\\testuser\\AppData\\Roaming';

			mockFs.readFileSync.mockReturnValue(JSON.stringify(sampleInfo));

			readCliServerInfo();

			expect(mockFs.readFileSync).toHaveBeenCalledWith(
				path.join('C:\\Users\\testuser\\AppData\\Roaming', 'maestro', 'cli-server.json'),
				'utf-8'
			);

			process.env.APPDATA = originalAppdata;
		});

		it('should read from the correct path on Linux', () => {
			mockOs.platform.mockReturnValue('linux');
			mockOs.homedir.mockReturnValue('/home/testuser');
			const originalXdg = process.env.XDG_CONFIG_HOME;
			delete process.env.XDG_CONFIG_HOME;

			mockFs.readFileSync.mockReturnValue(JSON.stringify(sampleInfo));

			readCliServerInfo();

			expect(mockFs.readFileSync).toHaveBeenCalledWith(
				path.join('/home/testuser', '.config', 'maestro', 'cli-server.json'),
				'utf-8'
			);

			process.env.XDG_CONFIG_HOME = originalXdg;
		});
	});

	describe('deleteCliServerInfo', () => {
		it('should remove the file', () => {
			deleteCliServerInfo();

			const expectedFile = path.join(
				'/Users/testuser',
				'Library',
				'Application Support',
				'maestro',
				'cli-server.json'
			);
			expect(mockFs.unlinkSync).toHaveBeenCalledWith(expectedFile);
		});

		it('should not throw when file does not exist', () => {
			mockFs.unlinkSync.mockImplementation(() => {
				throw new Error('ENOENT: no such file or directory');
			});

			expect(() => deleteCliServerInfo()).not.toThrow();
		});
	});

	describe('isCliServerRunning', () => {
		it('should return true for current PID', () => {
			mockFs.readFileSync.mockReturnValue(
				JSON.stringify({ ...sampleInfo, pid: process.pid })
			);

			const originalKill = process.kill;
			process.kill = vi.fn().mockReturnValue(true) as unknown as typeof process.kill;

			const result = isCliServerRunning();
			expect(result).toBe(true);
			expect(process.kill).toHaveBeenCalledWith(process.pid, 0);

			process.kill = originalKill;
		});

		it('should return false for non-existent PID', () => {
			mockFs.readFileSync.mockReturnValue(
				JSON.stringify({ ...sampleInfo, pid: 999999 })
			);

			const originalKill = process.kill;
			process.kill = vi.fn().mockImplementation(() => {
				throw new Error('ESRCH: No such process');
			}) as unknown as typeof process.kill;

			const result = isCliServerRunning();
			expect(result).toBe(false);

			process.kill = originalKill;
		});

		it('should clean up stale discovery file when PID is dead', () => {
			mockFs.readFileSync.mockReturnValue(
				JSON.stringify({ ...sampleInfo, pid: 999999 })
			);

			const originalKill = process.kill;
			process.kill = vi.fn().mockImplementation(() => {
				throw new Error('ESRCH: No such process');
			}) as unknown as typeof process.kill;

			isCliServerRunning();

			// Should have called unlinkSync to delete stale file
			expect(mockFs.unlinkSync).toHaveBeenCalled();

			process.kill = originalKill;
		});

		it('should return false when no discovery file exists', () => {
			mockFs.readFileSync.mockImplementation(() => {
				throw new Error('ENOENT: no such file or directory');
			});

			const result = isCliServerRunning();
			expect(result).toBe(false);
		});

		it('should return false for invalid discovery file', () => {
			mockFs.readFileSync.mockReturnValue('not valid json');

			const result = isCliServerRunning();
			expect(result).toBe(false);
		});
	});
});
