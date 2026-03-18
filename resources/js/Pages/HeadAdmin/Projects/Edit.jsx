import Layout from '../../../Components/Layout';
import DatePickerInput from '../../../Components/DatePickerInput';
import SearchableDropdown from '../../../Components/SearchableDropdown';
import ActionButton from '../../../Components/ActionButton';
import SelectInput from '../../../Components/SelectInput';
import TextInput from '../../../Components/TextInput';
import ClientSelectInput from '../../../Components/ClientSelectInput';
import { Head, useForm } from '@inertiajs/react';
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

const PROJECT_PHASES = ['Design', 'Construction', 'Completed'];
const PROJECT_STATUS_OPTIONS = ['PLANNING', 'ACTIVE', 'ONGOING', 'ON_HOLD', 'DELAYED', 'COMPLETED', 'CANCELLED'];
const PROJECT_ASSIGNED_ROLE_OPTIONS = ['Architect', 'Engineer', 'PM'];
const PROJECT_TYPE_OPTIONS = ['2Storey', '3Storey', 'w/ Roofdeck', 'Bungalow', 'Commercial', 'Renovation'];
const OTHER_PROJECT_TYPE_OPTION = '__OTHER__';

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const assignedChipStyle = {
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(52,211,153,0.12)',
    border: '1px solid rgba(16,185,129,0.35)',
    fontSize: 12,
    color: '#0f766e',
    fontWeight: 600,
    lineHeight: 1.1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
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

export default function HeadAdminProjectsEdit({ project, foremen = [], clientOptions = [] }) {
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
    const projectStatus = String(project.status || '').trim().toLowerCase();
    const isLocked = projectStatus === 'completed' || projectStatus === 'cancelled';

    const submit = (e) => {
        e.preventDefault();
        if (isLocked) return;
        patch(`/projects/${project.id}`, {
            onError: () => toast.error('Please check required fields.'),
            onSuccess: () => toast.success('Project saved successfully.'),
            preserveScroll: true,
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
                    <ActionButton
                        href={`/projects/${project.id}`}
                        onClick={handleBackToProject}
                        style={{ padding: '8px 12px', fontSize: 13 }}
                    >
                        <ArrowLeft size={16} />
                        Back to Project
                    </ActionButton>
                </div>

                <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <fieldset disabled={isLocked} style={{ border: 'none', padding: 0, margin: 0, gridColumn: '1 / -1', display: 'contents' }}>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Project Name</div>
                        <TextInput value={data.name} onChange={(e) => setData('name', e.target.value)} style={inputStyle} />
                        {errors.name && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.name}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Client</div>
                        <ClientSelectInput
                            clients={clientOptions}
                            value={data.client}
                            onChange={(value) => setData('client', value)}
                            style={inputStyle}
                        />
                        {errors.client && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.client}</div>}
                    </label>

                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Location</div>
                        <TextInput value={data.location} onChange={(e) => setData('location', e.target.value)} style={inputStyle} />
                        {errors.location && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.location}</div>}
                    </label>

                    <label style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, marginBottom: 0 }}>Project Type</div>
                        <SelectInput
                            value={projectTypeOption}
                            onChange={(e) => handleProjectTypeOptionChange(e.target.value)}
                            style={inputStyle}
                        >
                            {PROJECT_TYPE_OPTIONS.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                            <option value={OTHER_PROJECT_TYPE_OPTION}>Other (manual)</option>
                        </SelectInput>
                        {projectTypeOption === OTHER_PROJECT_TYPE_OPTION ? (
                            <TextInput
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
                            <SelectInput
                                value={pendingAssignedRole}
                                onChange={(e) => setPendingAssignedRole(e.target.value)}
                                style={inputStyle}
                                disabled={isLocked}
                            >
                                <option value="">Select role</option>
                                {PROJECT_ASSIGNED_ROLE_OPTIONS.map((role) => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </SelectInput>
                            <TextInput
                                value={pendingAssignedRoleName}
                                onChange={(e) => setPendingAssignedRoleName(e.target.value)}
                                placeholder="Enter name"
                                style={inputStyle}
                                disabled={isLocked}
                            />
                            <ActionButton
                                type="button"
                                onClick={addAssignedRole}
                                disabled={isLocked || !pendingAssignedRole || !String(pendingAssignedRoleName || '').trim()}
                                style={{ padding: '10px 12px' }}
                            >
                                Add
                            </ActionButton>
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
                                                style={assignedChipStyle}
                                            >
                                                <span>{entry.label}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeAssignedRole(entry)}
                                                    disabled={isLocked}
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
                                disabled={isLocked || foremen.length === 0}
                                clearable
                                style={{ ...inputStyle, minHeight: 40, padding: '8px 10px' }}
                                dropdownWidth={340}
                            />
                        <ActionButton
                            type="button"
                            onClick={addAssignedForeman}
                                disabled={isLocked || !pendingAssignedForeman}
                            style={{ padding: '10px 12px' }}
                        >
                            Add Foreman
                        </ActionButton>
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
                                    <div key={name} style={assignedChipStyle}>
                                        <span>{name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeAssignedForeman(name)}
                                disabled={isLocked}
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
                        <SelectInput value={data.status} onChange={(e) => setData('status', e.target.value)} style={inputStyle}>
                            {PROJECT_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </SelectInput>
                        {errors.status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.status}</div>}
                    </label>
                    <label>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>Phase</div>
                        <SelectInput value={data.phase} onChange={(e) => setData('phase', e.target.value)} style={inputStyle} disabled>
                            {PROJECT_PHASES.map((phase) => (
                                <option key={phase} value={phase}>{phase}</option>
                            ))}
                        </SelectInput>
                        {errors.phase && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.phase}</div>}
                    </label>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <ActionButton type="submit" variant="success" disabled={processing || isLocked} style={{ padding: '10px 16px', fontSize: 13 }}>
                            {processing ? 'Saving...' : 'Save Project'}
                        </ActionButton>
                    </div>
                    </fieldset>
                </form>

            </Layout>
        </>
    );
}
