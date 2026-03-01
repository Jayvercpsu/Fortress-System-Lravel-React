import { Head } from '@inertiajs/react';
import { useState } from 'react';
import Modal from '../../Components/Modal';

const formatMoney = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const headerRowStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 20,
};

const summaryGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
    marginBottom: 20,
};

const panelStyle = {
    border: '1px solid #d1c7b4',
    borderRadius: 12,
    padding: 16,
    background: '#faf6f0',
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    marginBottom: 16,
};

const thTdStyle = {
    padding: '10px 8px',
    borderBottom: '1px solid #d1c7b4',
    textAlign: 'left',
};

const photoGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
    gap: 6,
};

export default function ProgressReceipt({
    project,
    foreman_name: foremanName,
    scopes = [],
    totals = {},
    issue_summary: issueSummary = { open: 0, resolved: 0 },
    token,
    expires_at: expiresAt,
}) {
    const [previewPhoto, setPreviewPhoto] = useState(null);
    const scopeRows = Array.isArray(scopes) ? scopes : [];

    return (
        <>
            <Head title={`Progress Receipt - ${project?.name || 'Project'}`} />
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px 40px' }}>
                <div style={{ ...headerRowStyle, alignItems: 'baseline' }}>
                    <div>
                        <div style={{ textTransform: 'uppercase', fontSize: 12, color: '#7c6e57' }}>Project</div>
                        <div style={{ fontSize: 26, fontWeight: 700 }}>{project?.name || '-'}</div>
                        <div style={{ fontSize: 14, color: '#444' }}>
                            {project?.client ? `Client: ${project.client}` : 'Client unknown'} · {project?.phase || 'Phase TBD'} · {project?.status || 'Status TBD'}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: '#7c6e57' }}>Foreman</div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{foremanName || 'N/A'}</div>
                        <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>Access link: {token}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>Expires: {expiresAt || 'No expiry'}</div>
                    </div>
                </div>
                <div style={summaryGrid}>
                    <div style={panelStyle}>
                        <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b7761' }}>Total Contract</div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{formatMoney(totals.contract_total)}</div>
                    </div>
                    <div style={panelStyle}>
                        <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b7761' }}>Total Weight</div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{totals.weight_total?.toFixed(2) ?? '0.00'}%</div>
                    </div>
                    <div style={panelStyle}>
                        <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b7761' }}>Weighted Progress</div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{totals.weighted_progress_percent?.toFixed(2) ?? '0.00'}%</div>
                    </div>
                    <div style={panelStyle}>
                        <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#8b7761' }}>Computed Amount</div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{formatMoney(totals.computed_amount_total)}</div>
                    </div>
                </div>

                <table style={tableStyle}>
                    <thead style={{ background: '#f1ebe1' }}>
                        <tr>
                            {[
                                'Scope of Works',
                                'Contract',
                                'Weight %',
                                'Progress %',
                                'Computed %',
                                'Amount',
                                'Start',
                                'Target',
                                'Assignee',
                                'Photos',
                                'Issues',
                            ].map((label) => (
                                <th key={label} style={{ ...thTdStyle, fontSize: 11, color: '#6a5d46', letterSpacing: 0.4 }}>
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {scopeRows.map((scope) => (
                            <tr key={scope.id}>
                                <td style={thTdStyle}>{scope.scope_name}</td>
                                <td style={thTdStyle}>{formatMoney(scope.contract_amount)}</td>
                                <td style={thTdStyle}>{Number(scope.weight_percent).toFixed(2)}%</td>
                                <td style={thTdStyle}>{`${scope.progress_percent}%`}</td>
                                <td style={thTdStyle}>{`${scope.computed_percent.toFixed(2)}%`}</td>
                                <td style={thTdStyle}>{formatMoney(scope.amount_to_date)}</td>
                                <td style={thTdStyle}>{scope.start_date || '-'}</td>
                                <td style={thTdStyle}>{scope.target_completion || '-'}</td>
                                <td style={thTdStyle}>{scope.assigned_personnel || '-'}</td>
                                <td style={{ ...thTdStyle, width: 160 }}>
                                    {scope.photos.length === 0 ? (
                                        '-'
                                    ) : (
                                        <div style={photoGrid}>
                                            {scope.photos.map((photo) => (
                                                <button
                                                    key={photo.id}
                                                    type="button"
                                                    onClick={() =>
                                                        setPreviewPhoto({
                                                            ...photo,
                                                            caption: photo.caption || scope.scope_name,
                                                            meta: scope.scope_name,
                                                            created_at: photo.created_at,
                                                        })
                                                    }
                                                    style={{
                                                        border: 'none',
                                                        background: 'transparent',
                                                        padding: 0,
                                                        cursor: 'pointer',
                                                        borderRadius: 6,
                                                        overflow: 'hidden',
                                                        border: '1px solid #d1c7b4',
                                                    }}
                                                >
                                                    <img
                                                        src={`/storage/${photo.photo_path}`}
                                                        alt={photo.caption || 'Scope photo'}
                                                        style={{ width: '100%', height: 60, objectFit: 'cover', display: 'block' }}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td style={thTdStyle}>
                                    <div style={{ fontSize: 11, color: '#7c7c7c' }}>Open: {issueSummary.open}</div>
                                    <div style={{ fontSize: 11, color: '#7c7c7c' }}>Resolved: {issueSummary.resolved}</div>
                                </td>
                            </tr>
                        ))}
                        {scopeRows.length === 0 && (
                            <tr>
                                <td colSpan={11} style={{ ...thTdStyle, textAlign: 'center', color: '#9b8f7c' }}>
                                    No scope data available yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#6c5a41' }}>
                    <div>
                        Issue log: {issueSummary.open ?? 0} open · {issueSummary.resolved ?? 0} resolved
                    </div>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        style={{
                            border: 'none',
                            background: '#2f70d4',
                            color: '#fff',
                            padding: '8px 14px',
                            borderRadius: 8,
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        Print Receipt
                    </button>
                </div>
                <Modal
                    open={!!previewPhoto}
                    onClose={() => setPreviewPhoto(null)}
                    title={previewPhoto?.caption || 'Photo preview'}
                    maxWidth={900}
                >
                    {previewPhoto && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            <img
                                src={`/storage/${previewPhoto.photo_path}`}
                                alt={previewPhoto.caption || 'Scope photo'}
                                style={{
                                    width: '100%',
                                    maxHeight: '70vh',
                                    objectFit: 'contain',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    background: 'var(--surface-2)',
                                }}
                            />
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {previewPhoto.meta ? `${previewPhoto.meta}` : null}
                                {previewPhoto.created_at ? ` | ${previewPhoto.created_at}` : ''}
                            </div>
                        </div>
                    )}
                </Modal>
            </div>
        </>
    );
}
