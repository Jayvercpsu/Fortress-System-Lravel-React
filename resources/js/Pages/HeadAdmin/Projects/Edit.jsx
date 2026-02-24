import Layout from '../../../Components/Layout';
import DatePickerInput from '../../../Components/DatePickerInput';
import SearchableDropdown from '../../../Components/SearchableDropdown';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
};

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const parseAssignedForemen = (value) =>
    String(value || '')
        .split(/[,;]+/)
        .map((name) => name.trim())
        .filter(Boolean);

const normalizeAssignedForemen = (names) => {
    const seen = new Set();

    return names
        .map((name) => String(name || '').trim())
        .filter((name) => {
            if (!name) return false;
            const key = name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

export default function HeadAdminProjectsEdit({ project, foremen = [] }) {
    const { data, setData, patch, processing, errors } = useForm({
        name: project.name ?? '',
        client: project.client ?? '',
        type: project.type ?? '',
        location: project.location ?? '',
        assigned: project.assigned ?? '',
        target: project.target ?? '',
        status: project.status ?? 'PLANNING',
        phase: project.phase ?? 'DESIGN',
    });
    const [pendingAssignedForeman, setPendingAssignedForeman] = useState('');
    const [assignedForemen, setAssignedForemen] = useState(() => parseAssignedForemen(project.assigned ?? ''));

    const submit = (e) => {
        e.preventDefault();
        patch(`/projects/${project.id}`, {
            onError: () => toast.error('Please check required fields.'),
        });
    };

    const handleBackToProject = (e) => {
        if (typeof window === 'undefined') return;

        const hasHistory = window.history.length > 1;
        const sameOriginReferrer = document.referrer && document.referrer.startsWith(window.location.origin);

        if (hasHistory && sameOriginReferrer) {
            e.preventDefault();
            window.history.back();
        }
    };

    const remainingBalance = Number(project.contract_amount || 0) - Number(project.total_client_payment || 0);
    const syncAssignedForemen = (nextNames) => {
        const normalized = normalizeAssignedForemen(nextNames);
        setAssignedForemen(normalized);
        setData('assigned', normalized.join(', '));
    };

    const addAssignedForeman = () => {
        if (!pendingAssignedForeman) return;
        syncAssignedForemen([...assignedForemen, pendingAssignedForeman]);
        setPendingAssignedForeman('');
    };

    const removeAssignedForeman = (nameToRemove) => {
        syncAssignedForemen(assignedForemen.filter((name) => name !== nameToRemove));
    };

    return (
        <>
            <Head title={`Edit Project #${project.id}`} />
            <Layout title={`Edit Project - ${project.name}`}>
                <div style={{ marginBottom: 12 }}>
                    <Link
                        href={`/projects/${project.id}`}
                        onClick={handleBackToProject}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            color: 'var(--text-main)',
                            textDecoration: 'none',
                            border: '1px solid var(--border-color)',
                            background: 'var(--button-bg)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            fontSize: 13,
                        }}
                    >
                        <ArrowLeft size={16} />
                        Back to Project
                    </Link>
                </div>

                <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    {[
                        ['name', 'Project Name'],
                        ['client', 'Client'],
                        ['type', 'Type'],
                        ['location', 'Location'],
                    ].map(([key, label]) => (
                        <label key={key}>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>{label}</div>
                            <input value={data[key]} onChange={(e) => setData(key, e.target.value)} style={inputStyle} />
                            {errors[key] && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors[key]}</div>}
                        </label>
                    ))}

                    <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, marginBottom: 0 }}>Assigned Foremen</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
                            <SearchableDropdown
                                options={foremen}
                                value={pendingAssignedForeman}
                                onChange={(value) => setPendingAssignedForeman(value || '')}
                                getOptionLabel={(option) => option.fullname}
                                getOptionValue={(option) => option.fullname}
                                placeholder={foremen.length === 0 ? 'No foreman users available' : 'Select foreman'}
                                searchPlaceholder="Search foremen..."
                                emptyMessage="No foremen found"
                                disabled={foremen.length === 0}
                                clearable
                                style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                dropdownWidth={340}
                            />
                            <button
                                type="button"
                                onClick={addAssignedForeman}
                                disabled={!pendingAssignedForeman}
                                style={{
                                    background: 'var(--button-bg)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    padding: '10px 12px',
                                    cursor: !pendingAssignedForeman ? 'not-allowed' : 'pointer',
                                    opacity: !pendingAssignedForeman ? 0.65 : 1,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                Add Foreman
                            </button>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            One project can have multiple foremen.
                        </div>
                        {foremen.length === 0 && (
                            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                                No active foreman users found. Existing assigned names are preserved below.
                            </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {assignedForemen.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No foremen selected yet.</div>
                            ) : (
                                assignedForemen.map((name) => (
                                    <div
                                        key={name}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '6px 10px',
                                            borderRadius: 999,
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--surface-2)',
                                            fontSize: 12,
                                        }}
                                    >
                                        <span>{name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeAssignedForeman(name)}
                                            style={{
                                                border: 'none',
                                                background: 'transparent',
                                                color: 'var(--text-muted)',
                                                cursor: 'pointer',
                                                fontSize: 12,
                                                padding: 0,
                                            }}
                                            aria-label={`Remove ${name}`}
                                        >
                                            x
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        {errors.assigned && <div style={{ color: '#f87171', fontSize: 12 }}>{errors.assigned}</div>}
                    </div>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Target Date</div>
                        <DatePickerInput value={data.target ?? ''} onChange={(value) => setData('target', value)} style={inputStyle} />
                        {errors.target && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.target}</div>}
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                        <input value={data.status} onChange={(e) => setData('status', e.target.value)} style={inputStyle} />
                        {errors.status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.status}</div>}
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Phase</div>
                        <input value={data.phase} onChange={(e) => setData('phase', e.target.value)} style={inputStyle} />
                        {errors.phase && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.phase}</div>}
                    </label>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" disabled={processing} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px' }}>
                            {processing ? 'Saving...' : 'Save Project'}
                        </button>
                    </div>
                </form>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
                    <div style={{ gridColumn: '1 / -1', fontSize: 14, fontWeight: 700 }}>Financial Overview</div>
                    <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-muted)' }}>
                        Auto-calculated from Design Tracker, Build Tracker, and Expenses.
                    </div>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Contract Amount</div>
                        <input type="text" value={money(project.contract_amount)} readOnly style={inputStyle} />
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Design Fee</div>
                        <input type="text" value={money(project.design_fee)} readOnly style={inputStyle} />
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Construction Cost</div>
                        <input type="text" value={money(project.construction_cost)} readOnly style={inputStyle} />
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Total Client Payment</div>
                        <input type="text" value={money(project.total_client_payment)} readOnly style={inputStyle} />
                    </label>

                    <div style={{ gridColumn: '1 / -1', fontWeight: 700 }}>
                        Remaining Balance: {money(remainingBalance)}
                    </div>
                </div>
            </Layout>
        </>
    );
}
