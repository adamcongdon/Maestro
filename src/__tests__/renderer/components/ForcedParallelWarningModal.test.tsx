import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { ForcedParallelWarningModal } from '../../../renderer/components/ForcedParallelWarningModal';
import { LayerStackProvider } from '../../../renderer/contexts/LayerStackContext';
import type { Theme } from '../../../renderer/types';

const testTheme: Theme = {
	id: 'test-theme',
	name: 'Test Theme',
	mode: 'dark',
	colors: {
		bgMain: '#1e1e1e',
		bgSidebar: '#252526',
		bgActivity: '#333333',
		textMain: '#d4d4d4',
		textDim: '#808080',
		accent: '#007acc',
		border: '#404040',
		error: '#f14c4c',
		warning: '#cca700',
		success: '#89d185',
		info: '#3794ff',
		textInverse: '#000000',
	},
};

const renderWithLayerStack = (ui: React.ReactElement) => {
	return render(<LayerStackProvider>{ui}</LayerStackProvider>);
};

describe('ForcedParallelWarningModal', () => {
	const mockOnConfirm = vi.fn();
	const mockOnCancel = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it('renders when isOpen is true', () => {
		renderWithLayerStack(
			<ForcedParallelWarningModal
				isOpen={true}
				onConfirm={mockOnConfirm}
				onCancel={mockOnCancel}
				theme={testTheme}
			/>
		);

		expect(screen.getByText('Forced Parallel Execution')).toBeTruthy();
		expect(
			screen.getByText(/This sends messages immediately/i)
		).toBeTruthy();
	});

	it('does not render when isOpen is false', () => {
		renderWithLayerStack(
			<ForcedParallelWarningModal
				isOpen={false}
				onConfirm={mockOnConfirm}
				onCancel={mockOnCancel}
				theme={testTheme}
			/>
		);

		expect(screen.queryByText('Forced Parallel Execution')).toBeNull();
	});

	it('calls onConfirm when confirm button is clicked', () => {
		renderWithLayerStack(
			<ForcedParallelWarningModal
				isOpen={true}
				onConfirm={mockOnConfirm}
				onCancel={mockOnCancel}
				theme={testTheme}
			/>
		);

		const confirmButton = screen.getByText('I understand, enable it');
		fireEvent.click(confirmButton);

		expect(mockOnConfirm).toHaveBeenCalledTimes(1);
	});

	it('calls onCancel when cancel button is clicked', () => {
		renderWithLayerStack(
			<ForcedParallelWarningModal
				isOpen={true}
				onConfirm={mockOnConfirm}
				onCancel={mockOnCancel}
				theme={testTheme}
			/>
		);

		const cancelButton = screen.getByText('Cancel');
		fireEvent.click(cancelButton);

		expect(mockOnCancel).toHaveBeenCalledTimes(1);
	});
});
