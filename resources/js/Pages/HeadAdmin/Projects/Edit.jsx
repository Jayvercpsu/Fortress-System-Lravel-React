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

const PROJECT_PHASES = ['Design', 'ForBuild', 'Construction', 'Turnover', 'Completed'];
const PROJECT_STATUS_OPTIONS = ['PLANNING', 'ACTIVE', 'ONGOING', 'ON_HOLD', 'DELAYED', 'COMPLETED', 'CANCELLED'];
const PROJECT_ASSIGNED_ROLE_OPTIONS = ['Architect', 'Engineer', 'PM'];
const PROJECT_TYPE_OPTIONS = ['2Storey', '3Storey', 'w/ Roofdeck', 'Bungalow', 'Commercial', 'Renovation'];
const OTHER_PROJECT_TYPE_OPTION = '__OTHER__';

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

const normalizeAssignedRoleOption = (value) => {
    const key = String(value || '').trim().toLowerCase();
    return PROJECT_ASSIGNED_ROLE_OPTIONS.find((option) => option.toLowerCase() === key) || null;
};

const splitAssignedRoleEntries = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return [];

    return raw
        .split(raw.includes(';') ? /[;]+/ : /[,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
};

const parseAssignedRoleEntry = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const match = raw.match(/^(.+?)\s*[:\-]\s*(.+)$/);
    const role = normalizeAssignedRoleOption(match ? match[1] : raw);
    if (!role) return null;

    const name = String(match?.[2] || '').trim();
    const key = `${role.toLowerCase()}::${name.toLowerCase()}`;

    return {
        role,
        name,
        key,
        label: name ? `${role}: ${name}` : role,
    };
};

const parseAssignedRoles = (value) => splitAssignedRoleEntries(value).map(parseAssignedRoleEntry).filter(Boolean);

const normalizeAssignedRoles = (entries) => {
    const seen = new Set();

    return entries
        .map((entry) => {
            const role = normalizeAssignedRoleOption(entry?.role);
            if (!role) return null;

            const name = String(entry?.name || '').trim();
            const key = `${role.toLowerCase()}::${name.toLowerCase()}`;

            return {
                role,
                name,
                key,
                label: name ? `${role}: ${name}` : role,
            };
        })
        .filter((entry) => {
            if (!entry) return false;
            if (seen.has(entry.key)) return false;
            seen.add(entry.key);
            return true;
        });
};

const serializeAssignedRoles = (entries) => normalizeAssignedRoles(entries).map((entry) => entry.label).join('; ');

export default function HeadAdminProjectsEdit({ project, foremen = [] }) {
    const initialProjectType = String(project.type ?? '');
    const initialProjectTypeIsPreset = PROJECT_TYPE_OPTIONS.includes(initialProjectType);

    const { data, setData, patch, processing, errors } = useForm({
        name: project.name ?? '',
        client: project.client ?? '',
        type: project.type ?? '',
        location: project.location ?? '',
        assigned_role: project.assigned_role ?? '',
        assigned: project.assigned ?? '',
        target: project.target ?? '',
        status: project.status ?? 'PLANNING',
        phase: project.phase ?? 'Design',
    });
    const [pendingAssignedForeman, setPendingAssignedForeman] = useState('');
    const [assignedForemen, setAssignedForemen] = useState(() => parseAssignedForemen(project.assigned ?? ''));
    const [pendingAssignedRole, setPendingAssignedRole] = useState('');
    const [pendingAssignedRoleName, setPendingAssignedRoleName] = useState('');
    const [assignedRoles, setAssignedRoles] = useState(() => parseAssignedRoles(project.assigned_role ?? ''));
    const [projectTypeOption, setProjectTypeOption] = useState(() => (initialProjectTypeIsPreset ? initialProjectType : OTHER_PROJECT_TYPE_OPTION));
    const [customProjectType, setCustomProjectType] = useState(() => (initialProjectTypeIsPreset ? '' : initialProjectType));

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
    const syncAssignedRoles = (nextRoles) => {
        const normalized = normalizeAssignedRoles(nextRoles);
        setAssignedRoles(normalized);
        setData('assigned_role', serializeAssignedRoles(normalized));
    };

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

    const addAssignedRole = () => {
        const role = normalizeAssignedRoleOption(pendingAssignedRole);
        const name = String(pendingAssignedRoleName || '').trim();
        if (!role || !name) return;
        syncAssignedRoles([...assignedRoles, { role, name }]);
        setPendingAssignedRole('');
        setPendingAssignedRoleName('');
    };

    const removeAssignedRole = (entryToRemove) => {
        syncAssignedRoles(assignedRoles.filter((entry) => entry.key !== entryToRemove.key));
    };

    const handleProjectTypeOptionChange = (value) => {
        setProjectTypeOption(value);
        if (value === OTHER_PROJECT_TYPE_OPTION) {
            setData('type', customProjectType.trim());
            return;
        }
        setData('type', value);
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
                        ['location', 'Location'],
                    ].map(([key, label]) => (
                        <label key={key}>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>{label}</div>
                            <input value={data[key]} onChange={(e) => setData(key, e.target.value)} style={inputStyle} />
                            {errors[key] && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors[key]}</div>}
                        </label>
                    ))}

                    <label style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, marginBottom: 0 }}>Project Type</div>
                        <select
                            value={projectTypeOption}
                            onChange={(e) => handleProjectTypeOptionChange(e.target.value)}
                            style={inputStyle}
                        >
                            {PROJECT_TYPE_OPTIONS.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                            <option value={OTHER_PROJECT_TYPE_OPTION}>Other (manual)</option>
                        </select>
                        {projectTypeOption === OTHER_PROJECT_TYPE_OPTION ? (
                            <input
                                value={customProjectType}
                                onChange={(e) => {
                                    setCustomProjectType(e.target.value);
                                    setData('type', e.target.value);
                                }}
                                placeholder="Enter project type"
                                style={inputStyle}
                            />
                        ) : null}
                        {errors.type && <div style={{ color: '#f87171', fontSize: 12 }}>{errors.type}</div>}
                    </label>

                    <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, marginBottom: 0 }}>Assigned</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr auto', gap: 8, alignItems: 'end' }}>
                            <select
                                value={pendingAssignedRole}
                                onChange={(e) => setPendingAssignedRole(e.target.value)}
                                style={inputStyle}
                            >
                                <option value="">Select role</option>
                                {PROJECT_ASSIGNED_ROLE_OPTIONS.map((role) => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                            <input
                                value={pendingAssignedRoleName}
                                onChange={(e) => setPendingAssignedRoleName(e.target.value)}
                                placeholder="Enter name"
                                style={inputStyle}
                            />
                            <button
                                type="button"
                                onClick={addAssignedRole}
                                disabled={!pendingAssignedRole || !String(pendingAssignedRoleName || '').trim()}
                                style={{
                                    background: 'var(--button-bg)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    padding: '10px 12px',
                                    cursor: !pendingAssignedRole || !String(pendingAssignedRoleName || '').trim() ? 'not-allowed' : 'pointer',
                                    opacity: !pendingAssignedRole || !String(pendingAssignedRoleName || '').trim() ? 0.65 : 1,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                Add
                            </button>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            Add role + name. Multiple entries are allowed, including multiple Engineers.
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {assignedRoles.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No assigned Architect / Engineer / PM yet.</div>
                            ) : (
                                assignedRoles.map((entry) => (
                                    <div
                                        key={entry.key}
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
                                        <span>{entry.label}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeAssignedRole(entry)}
                                            style={{
                                                border: 'none',
                                                background: 'transparent',
                                                color: 'var(--text-muted)',
                                                cursor: 'pointer',
                                                fontSize: 12,
                                                padding: 0,
                                            }}
                                            aria-label={`Remove ${entry.label}`}
                                        >
                                            x
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        {errors.assigned_role && <div style={{ color: '#f87171', fontSize: 12 }}>{errors.assigned_role}</div>}
                    </div>

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
                        <select value={data.status} onChange={(e) => setData('status', e.target.value)} style={inputStyle}>
                            {PROJECT_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                        {errors.status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.status}</div>}
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Phase</div>
                        <select value={data.phase} onChange={(e) => setData('phase', e.target.value)} style={inputStyle}>
                            {PROJECT_PHASES.map((phase) => (
                                <option key={phase} value={phase}>{phase}</option>
                            ))}
                        </select>
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
