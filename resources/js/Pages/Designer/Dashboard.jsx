import Layout from '../../Components/Layout';
import ActionButton from '../../Components/ActionButton';
import DatePickerInput from '../../Components/DatePickerInput';
import TextInput from '../../Components/TextInput';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { toastMessages } from '../../constants/toastMessages';

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 14,
};

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
};

const pct = (value) => `${Math.max(0, Math.min(100, Number(value || 0)))}%`;

const buildDrafts = (rows) =>
    Object.fromEntries(
        (Array.isArray(rows) ? rows : []).map((row) => [
            String(row.id),
            {
                work_started_at: row.work_started_at || '',
                work_completed_at: row.work_completed_at || '',
            },
        ])
    );

export default function DesignerDashboard({ projects = [], filters = {} }) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [drafts, setDrafts] = useState(() => buildDrafts(projects));
    const [savingProjectId, setSavingProjectId] = useState(null);

    useEffect(() => {
        setSearch(filters?.search ?? '');
    }, [filters?.search]);

    useEffect(() => {
        setDrafts(buildDrafts(projects));
    }, [projects]);

    const activeRows = useMemo(() => (Array.isArray(projects) ? projects : []), [projects]);

    const applySearch = (event) => {
        event.preventDefault();
        router.get(
            '/designer',
            { search: String(search || '').trim() || undefined },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        );
    };

    const clearSearch = () => {
        setSearch('');
        router.get(
            '/designer',
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        );
    };

    const setDraftDate = (projectId, field, value) => {
        const key = String(projectId);
        setDrafts((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] || { work_started_at: '', work_completed_at: '' }),
                [field]: value || '',
            },
        }));
    };

    const saveTracking = (projectId) => {
        const key = String(projectId);
        const draft = drafts[key] || { work_started_at: '', work_completed_at: '' };
        const params = new URLSearchParams(window.location.search);
        const query = params.toString();

        setSavingProjectId(projectId);
        router.patch(
            `/designer/projects/${projectId}/design-tracking${query ? `?${query}` : ''}`,
            {
                work_started_at: draft.work_started_at || null,
                work_completed_at: draft.work_completed_at || null,
            },
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => toast.success(toastMessages.designer.trackingUpdateSuccess),
                onError: (errors) => {
                    toast.error(
                        errors?.work_completed_at
                        || errors?.work_started_at
                        || errors?.project
                        || toastMessages.designer.trackingUpdateError
                    );
                },
                onFinish: () => setSavingProjectId(null),
            }
        );
    };

    return (
        <>
            <Head title="Designer Dashboard" />
            <Layout title="Designer Dashboard">
                <div style={{ display: 'grid', gap: 14 }}>
                    <form onSubmit={applySearch} style={{ ...cardStyle, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <TextInput
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search assigned design projects..."
                            style={{ ...inputStyle, maxWidth: 420 }}
                        />
                        <ActionButton type="submit" variant="success" style={{ padding: '10px 14px' }}>
                            Search
                        </ActionButton>
                        <ActionButton type="button" onClick={clearSearch} style={{ padding: '10px 14px' }}>
                            Clear
                        </ActionButton>
                    </form>

                    {activeRows.length === 0 ? (
                        <div style={{ ...cardStyle, color: 'var(--text-muted)', fontSize: 13 }}>
                            No assigned Design projects yet.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 10 }}>
                            {activeRows.map((row) => {
                                const draft = drafts[String(row.id)] || {
                                    work_started_at: row.work_started_at || '',
                                    work_completed_at: row.work_completed_at || '',
                                };
                                const saving = savingProjectId === row.id;

                                return (
                                    <div key={row.id} style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                            <div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Project</div>
                                                <div style={{ fontWeight: 700 }}>{row.name}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Client</div>
                                                <div style={{ fontWeight: 600 }}>{row.client || '-'}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Progress</div>
                                                <div style={{ fontWeight: 600 }}>{pct(row.design_progress)}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Speed</div>
                                                <div style={{ fontWeight: 600 }}>
                                                    {row.completed_days !== null
                                                        ? `${row.completed_days} day(s) finished`
                                                        : row.ongoing_days !== null
                                                            ? `${row.ongoing_days} day(s) ongoing`
                                                            : 'Not started'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <label>
                                                <div style={{ fontSize: 12, marginBottom: 6 }}>Design Start Date</div>
                                                <DatePickerInput
                                                    value={draft.work_started_at}
                                                    onChange={(value) => setDraftDate(row.id, 'work_started_at', value)}
                                                    style={inputStyle}
                                                />
                                            </label>
                                            <label>
                                                <div style={{ fontSize: 12, marginBottom: 6 }}>Design Completed Date</div>
                                                <DatePickerInput
                                                    value={draft.work_completed_at}
                                                    onChange={(value) => setDraftDate(row.id, 'work_completed_at', value)}
                                                    style={inputStyle}
                                                />
                                            </label>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                Location: {row.location || '-'} | Target: {row.target || '-'} | Status: {row.status || '-'}
                                            </div>
                                            <ActionButton
                                                type="button"
                                                variant="success"
                                                onClick={() => saveTracking(row.id)}
                                                disabled={saving}
                                                loading={saving}
                                                style={{ padding: '9px 14px' }}
                                            >
                                                {saving ? 'Saving...' : 'Save Tracking'}
                                            </ActionButton>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Layout>
        </>
    );
}
