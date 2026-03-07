import ActionButton from './ActionButton';
import Modal from './Modal';

export default function ConfirmationModal({
    open,
    title = 'Confirm Action',
    message = 'Are you sure you want to continue?',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onClose,
    processing = false,
    danger = false,
}) {
    return (
        <Modal open={open} onClose={processing ? undefined : onClose} title={title} maxWidth={520}>
            <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{message}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <ActionButton type="button" onClick={onClose} disabled={processing}>
                        {cancelLabel}
                    </ActionButton>
                    <ActionButton
                        type="button"
                        variant={danger ? 'danger' : 'success'}
                        onClick={onConfirm}
                        disabled={processing}
                        loading={processing}
                    >
                        {confirmLabel}
                    </ActionButton>
                </div>
            </div>
        </Modal>
    );
}
