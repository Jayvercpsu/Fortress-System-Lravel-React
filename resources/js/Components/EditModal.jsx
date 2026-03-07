import Modal from './Modal';
import ActionButton from './ActionButton';

export default function EditModal({
    open,
    onClose,
    title,
    description,
    onSubmit,
    submitLabel = 'Save',
    cancelLabel = 'Cancel',
    processing = false,
    maxWidth = 720,
    children,
}) {
    return (
        <Modal open={open} onClose={onClose} title={title} maxWidth={maxWidth}>
            <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
                {description ? <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{description}</div> : null}
                {children}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <ActionButton type="button" variant="neutral" onClick={onClose} disabled={processing}>
                        {cancelLabel}
                    </ActionButton>
                    <ActionButton type="submit" variant="success" disabled={processing}>
                        {processing ? 'Saving...' : submitLabel}
                    </ActionButton>
                </div>
            </form>
        </Modal>
    );
}
