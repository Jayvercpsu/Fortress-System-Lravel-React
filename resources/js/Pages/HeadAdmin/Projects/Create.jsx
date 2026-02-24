import Layout from '../../../Components/Layout';
import DatePickerInput from '../../../Components/DatePickerInput';
import SearchableDropdown from '../../../Components/SearchableDropdown';
import { Head, useForm } from '@inertiajs/react';
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

export default function HeadAdminProjectsCreate({ foremen = [] }) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        client: '',
        type: '',
        location: '',
        assigned: '',
        target: '',
        status: 'PLANNING',
        phase: 'DESIGN',
    });
    const [pendingAssignedForeman, setPendingAssignedForeman] = useState('');
    const [assignedForemen, setAssignedForemen] = useState(() => parseAssignedForemen(''));

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

    const submit = (e) => {
        e.preventDefault();
        post('/projects', {
            onError: () => toast.error('Please check required fields.'),
        });
    };

    return (
        <>
            <Head title="Create Project" />
            <Layout title="Create Project">
                <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
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
                                Add a user with role `foreman` first to assign this project.
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
                        <DatePickerInput value={data.target} onChange={(value) => setData('target', value)} style={inputStyle} />
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
                        <button type="submit" disabled={processing} style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.7 : 1 }}>
                            {processing ? 'Saving...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </Layout>
        </>
    );
}
