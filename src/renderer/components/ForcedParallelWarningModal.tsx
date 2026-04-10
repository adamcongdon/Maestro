import React, { memo, useRef, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Theme } from '../types';
import { MODAL_PRIORITIES } from '../constants/modalPriorities';
import { Modal, ModalFooter } from './ui/Modal';

interface ForcedParallelWarningModalProps {
	isOpen: boolean;
	onConfirm: () => void;
	onCancel: () => void;
	theme: Theme;
}

export const ForcedParallelWarningModal = memo(function ForcedParallelWarningModal({
	isOpen,
	onConfirm,
	onCancel,
	theme,
}: ForcedParallelWarningModalProps) {
	const confirmButtonRef = useRef<HTMLButtonElement>(null);

	const handleConfirm = useCallback(() => {
		onConfirm();
	}, [onConfirm]);

	if (!isOpen) return null;

	return (
		<Modal
			theme={theme}
			title="Forced Parallel Execution"
			priority={MODAL_PRIORITIES.FORCED_PARALLEL_WARNING}
			onClose={onCancel}
			headerIcon={
				<AlertTriangle className="w-4 h-4" style={{ color: theme.colors.warning }} />
			}
			width={450}
			zIndex={10000}
			initialFocusRef={confirmButtonRef}
			footer={
				<ModalFooter
					theme={theme}
					onCancel={onCancel}
					onConfirm={handleConfirm}
					confirmLabel="I understand, enable it"
					confirmButtonRef={confirmButtonRef}
				/>
			}
		>
			<div className="flex flex-col gap-4">
				<div className="flex gap-4">
					<div
						className="flex-shrink-0 p-2 rounded-full h-fit"
						style={{ backgroundColor: `${theme.colors.warning}20` }}
					>
						<AlertTriangle className="w-5 h-5" style={{ color: theme.colors.warning }} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="text-sm leading-relaxed" style={{ color: theme.colors.textMain }}>
							This sends messages immediately, even when the agent is already working.
							If two operations modify the same files simultaneously, one may overwrite
							the other's changes.
						</p>
						<p className="text-sm leading-relaxed" style={{ color: theme.colors.textDim }}>
							This is intended for advanced users who understand the risks. Use the
							assigned shortcut key to force-send while the agent is busy. Regular send
							keys will continue to queue normally.
						</p>
					</div>
				</div>
			</div>
		</Modal>
	);
});
