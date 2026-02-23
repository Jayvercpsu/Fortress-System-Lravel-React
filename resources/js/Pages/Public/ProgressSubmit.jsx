import { Head, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const cardStyle = {
    width: '100%',
    maxWidth: 760,
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 14,
    padding: 20,
};

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    boxSizing: 'border-box',
};

export default function ProgressSubmit({ submitToken }) {
    const { flash } = usePage().props;
    const [fileInputKey, setFileInputKey] = useState(0);

    const { data, setData, post, processing, errors, reset } = useForm({
        progress_note: '',
        photo: null,
        caption: '',
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    const submit = (event) => {
        event.preventDefault();
        post(window.location.pathname, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setData('photo', null);
                setFileInputKey((value) => value + 1);
            },
            onError: () => toast.error('Please check the required fields.'),
        });
    };

    return (
        <>
            <Head title="Public Progress Submit" />

            <div
                style={{
                    minHeight: '100vh',
                    background: 'var(--bg-page)',
                    color: 'var(--text-main)',
                    fontFamily: "'DM Sans', sans-serif",
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    padding: '32px 16px',
                    boxSizing: 'border-box',
                }}
            >
                <div style={{ width: '100%', maxWidth: 860, display: 'grid', gap: 16 }}>
                    <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                        <div style={{ fontSize: 22, fontWeight: 700 }}>Progress Submission Form</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            Submit progress update and site photo without opening internal monitoring boards.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Project</div>
                                <div style={{ fontWeight: 600 }}>{submitToken.project_name}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Foreman</div>
                                <div style={{ fontWeight: 600 }}>{submitToken.foreman_name}</div>
                            </div>
                        </div>
                        {submitToken.expires_at && (
                            <div style={{ fontSize: 12, color: '#f59e0b' }}>
                                Link expires at: {submitToken.expires_at}
                            </div>
                        )}
                    </div>

                    <form onSubmit={submit} style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Progress Note</div>
                            <textarea
                                value={data.progress_note}
                                onChange={(event) => setData('progress_note', event.target.value)}
                                placeholder="What was accomplished today?"
                                style={{ ...inputStyle, minHeight: 130, resize: 'vertical' }}
                            />
                            {errors.progress_note && (
                                <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>
                                    {errors.progress_note}
                                </div>
                            )}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Site Photo</div>
                            <input
                                key={fileInputKey}
                                type="file"
                                accept="image/*"
                                onChange={(event) => setData('photo', event.target.files?.[0] ?? null)}
                            />
                            {errors.photo && (
                                <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>
                                    {errors.photo}
                                </div>
                            )}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Photo Caption (optional)</div>
                            <input
                                value={data.caption}
                                onChange={(event) => setData('caption', event.target.value)}
                                placeholder="Short context for the uploaded photo"
                                style={inputStyle}
                            />
                            {errors.caption && (
                                <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>
                                    {errors.caption}
                                </div>
                            )}
                        </label>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="submit"
                                disabled={processing}
                                style={{
                                    background: 'var(--success)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: '10px 16px',
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: processing ? 'not-allowed' : 'pointer',
                                    opacity: processing ? 0.7 : 1,
                                }}
                            >
                                {processing ? 'Submitting...' : 'Submit Progress'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
