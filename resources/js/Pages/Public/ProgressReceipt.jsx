import { Head } from '@inertiajs/react';
import { ArrowLeft, Printer, UserRound } from 'lucide-react';

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const shortDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

const fullStamp = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
});

function formatCurrency(value) {
    return currency.format(Number(value || 0));
}

function formatPercent(value) {
    return `${percent.format(Number(value || 0))}%`;
}

function parseDate(value) {
    if (!value) return null;

    const raw = String(value).trim();
    const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const date = new Date(normalized);

    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
    if (!value) return '-';
    const date = parseDate(value);
    if (!date) return value;
    return shortDate.format(date);
}

function formatStamp(value) {
    if (!value) return '-';
    const date = parseDate(value);
    if (!date) return value;
    return fullStamp.format(date);
}

function assigneeInitials(name) {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) {
        return '';
    }

    return parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('');
}

function assigneeTone(name) {
    const value = String(name || '').trim();
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = value.charCodeAt(index) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;

    return {
        background: `linear-gradient(135deg, hsl(${hue} 62% 82%), hsl(${(hue + 28) % 360} 68% 62%))`,
        shadow: `0 10px 24px hsla(${hue}, 60%, 40%, 0.22)`,
    };
}

function SummaryCard({ label, value }) {
    return (
        <div className="pr-summary-card">
            <div className="pr-summary-label">{label}</div>
            <div className="pr-summary-value">{value}</div>
        </div>
    );
}

function AssigneeCell({ name }) {
    const cleanName = String(name || '').trim();

    if (!cleanName) {
        return <span className="pr-muted">-</span>;
    }

    const initials = assigneeInitials(cleanName);
    const tone = assigneeTone(cleanName);

    return (
        <div className="pr-assignee">
            <span className="pr-assignee-avatar" style={{ backgroundImage: tone.background, boxShadow: tone.shadow }}>
                {initials || <UserRound size={13} strokeWidth={2.2} />}
            </span>
            <span>{cleanName}</span>
        </div>
    );
}

function PhotosCell({ photos = [] }) {
    if (!Array.isArray(photos) || photos.length === 0) {
        return <span className="pr-muted">-</span>;
    }

    return (
        <div className="pr-photo-strip">
            {photos.map((photo) => (
                <a
                    key={photo.id}
                    href={`/storage/${photo.photo_path}`}
                    target="_blank"
                    rel="noreferrer"
                    className="pr-photo-thumb"
                    title={photo.caption || 'Scope photo'}
                >
                    <img src={`/storage/${photo.photo_path}`} alt={photo.caption || 'Scope photo'} />
                </a>
            ))}
        </div>
    );
}

export default function ProgressReceipt({ receipt }) {
    const rows = Array.isArray(receipt?.scopes) ? receipt.scopes : [];
    const projectMeta = [
        receipt?.project_client || 'Client unknown',
        receipt?.project_phase || 'Phase TBD',
        receipt?.project_status || 'Status TBD',
    ].join(' . ');

    const handlePrint = () => {
        if (typeof window !== 'undefined') {
            window.print();
        }
    };

    return (
        <>
            <Head title={`Progress Receipt - ${receipt?.project_name || 'Project'}`} />
            <div className="pr-page">
                <style>{`
                    .pr-page{min-height:100vh;background:linear-gradient(180deg,#0c1118 0%,#17202a 24%,#edf0eb 24%,#edf0eb 100%);padding:18px 14px 32px;color:#201a15;font-family:'DM Sans',sans-serif}
                    .pr-toolbar{max-width:1180px;margin:0 auto 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
                    .pr-toolbar-link,.pr-toolbar-button{border:none;border-radius:10px;min-height:44px;padding:0 16px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:13px;font-weight:800;text-decoration:none;cursor:pointer}
                    .pr-toolbar-link{background:rgba(255,255,255,0.14);color:#f8f5ef;border:1px solid rgba(255,255,255,0.16)}
                    .pr-toolbar-button{background:#2f70d4;color:#fff;box-shadow:0 14px 32px rgba(47,112,212,0.24)}
                    .pr-paper{max-width:1180px;margin:0 auto;background:#fbfaf6;border:1px solid #d9d0c2;border-radius:22px;box-shadow:0 26px 80px rgba(16,24,40,0.14);padding:28px 28px 18px}
                    .pr-header{display:flex;justify-content:space-between;gap:22px;align-items:flex-start;margin-bottom:24px}
                    .pr-kicker{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#b18a5e;margin-bottom:6px}
                    .pr-title{font-size:40px;line-height:1;font-weight:800;letter-spacing:-.04em;margin:0}
                    .pr-subtitle{margin-top:8px;font-size:14px;color:#6b6257}
                    .pr-meta{text-align:right;max-width:420px}
                    .pr-meta-title{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#9d8b75}
                    .pr-meta-name{margin-top:4px;font-size:24px;font-weight:800}
                    .pr-meta-note{margin-top:8px;font-size:12px;line-height:1.6;color:#7a7165}
                    .pr-meta-note a{color:#8f6438;word-break:break-all}
                    .pr-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}
                    .pr-summary-card{background:#f3eee5;border:1px solid #d8cebf;border-radius:14px;padding:14px 16px}
                    .pr-summary-label{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#9d8b75;margin-bottom:8px}
                    .pr-summary-value{font-size:26px;line-height:1;font-weight:800;letter-spacing:-.04em}
                    .pr-table-wrap{overflow:auto;border:1px solid #d9d0c2;border-radius:16px}
                    .pr-table{width:100%;border-collapse:collapse;min-width:1080px}
                    .pr-table thead th{background:#ede6d7;color:#675945;font-size:11px;text-transform:uppercase;letter-spacing:.08em;padding:12px 10px;text-align:left;border-bottom:1px solid #d9d0c2;white-space:nowrap}
                    .pr-table tbody td{padding:12px 10px;border-bottom:1px solid #e5dccf;font-size:13px;vertical-align:top}
                    .pr-table tbody tr:last-child td{border-bottom:none}
                    .pr-scope-name{font-weight:700}
                    .pr-scope-note{margin-top:5px;font-size:11px;color:#8b8072;line-height:1.45}
                    .pr-date-cell,.pr-number-cell{white-space:nowrap}
                    .pr-assignee{display:inline-flex;align-items:center;gap:9px;min-width:0}
                    .pr-assignee-avatar{width:28px;height:28px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;letter-spacing:.04em;flex:0 0 auto}
                    .pr-photo-strip{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:112px}
                    .pr-photo-thumb{display:inline-flex;border-radius:8px;overflow:hidden;border:1px solid #d4c9bb;width:34px;height:34px;box-shadow:0 8px 18px rgba(30,41,59,0.08)}
                    .pr-photo-thumb img{display:block;width:100%;height:100%;object-fit:cover}
                    .pr-issues{font-size:11px;line-height:1.5;color:#7b7064;white-space:nowrap}
                    .pr-footer{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-top:14px}
                    .pr-footnote{font-size:12px;color:#7a7165}
                    .pr-footnote strong{color:#4f463c}
                    .pr-muted{color:#9b9083}
                    @media (max-width:920px){
                        .pr-page{padding-top:14px}
                        .pr-paper{padding:20px 18px 16px;border-radius:18px}
                        .pr-header{display:grid}
                        .pr-meta{text-align:left;max-width:none}
                        .pr-title{font-size:32px}
                        .pr-summary{grid-template-columns:repeat(2,minmax(0,1fr))}
                    }
                    @media (max-width:640px){
                        .pr-summary{grid-template-columns:1fr}
                        .pr-toolbar{align-items:stretch}
                        .pr-toolbar-link,.pr-toolbar-button{width:100%}
                    }
                    @media print{
                        body{background:#fff}
                        .pr-page{background:#fff;padding:0}
                        .pr-paper{max-width:none;border:none;border-radius:0;box-shadow:none;padding:0}
                        .pr-toolbar{display:none}
                        .pr-photo-thumb{box-shadow:none}
                    }
                `}</style>

                <div className="pr-toolbar">
                    <a href={receipt?.access_link || '#'} className="pr-toolbar-link">
                        <ArrowLeft size={15} />
                        Back to Form
                    </a>
                    <button type="button" className="pr-toolbar-button" onClick={handlePrint}>
                        <Printer size={15} />
                        Print Receipt
                    </button>
                </div>

                <section className="pr-paper">
                    <div className="pr-header">
                        <div>
                            <div className="pr-kicker">Project</div>
                            <h1 className="pr-title">{receipt?.project_name || 'Progress Receipt'}</h1>
                            <div className="pr-subtitle">{projectMeta}</div>
                        </div>

                        <div className="pr-meta">
                            <div className="pr-meta-title">Foreman</div>
                            <div className="pr-meta-name">{receipt?.foreman_name || '-'}</div>
                            <div className="pr-meta-note">
                                <div>
                                    Access link:{' '}
                                    {receipt?.access_link ? (
                                        <a href={receipt.access_link} target="_blank" rel="noreferrer">
                                            {receipt.access_link}
                                        </a>
                                    ) : (
                                        '-'
                                    )}
                                </div>
                                <div>Expires: {formatStamp(receipt?.expires_at)}</div>
                                <div>Last submitted: {formatStamp(receipt?.submitted_at)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="pr-summary">
                        <SummaryCard label="Total Contract" value={formatCurrency(receipt?.total_contract_amount)} />
                        <SummaryCard label="Total Weight" value={formatPercent(receipt?.total_weight_percent)} />
                        <SummaryCard label="Weighted Progress" value={formatPercent(receipt?.weighted_progress_percent)} />
                        <SummaryCard label="Computed Amount" value={formatCurrency(receipt?.computed_amount)} />
                    </div>

                    <div className="pr-table-wrap">
                        <table className="pr-table">
                            <thead>
                                <tr>
                                    <th>Scope of Works</th>
                                    <th>Contract</th>
                                    <th>Weight %</th>
                                    <th>Progress %</th>
                                    <th>Computed %</th>
                                    <th>Amount</th>
                                    <th>Start</th>
                                    <th>Target</th>
                                    <th>Assignee</th>
                                    <th>Photos</th>
                                    <th>Issues</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="pr-muted">
                                            No scope rows have been added to this project yet.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row) => (
                                        <tr key={row.id}>
                                            <td>
                                                <div className="pr-scope-name">{row.scope_name || '-'}</div>
                                                {row.remarks ? <div className="pr-scope-note">{row.remarks}</div> : null}
                                            </td>
                                            <td className="pr-number-cell">{formatCurrency(row.contract_amount)}</td>
                                            <td className="pr-number-cell">{formatPercent(row.weight_percent)}</td>
                                            <td className="pr-number-cell">{formatPercent(row.progress_percent)}</td>
                                            <td className="pr-number-cell">{formatPercent(row.computed_percent)}</td>
                                            <td className="pr-number-cell">{formatCurrency(row.computed_amount)}</td>
                                            <td className="pr-date-cell">{formatDate(row.start_date)}</td>
                                            <td className="pr-date-cell">{formatDate(row.target_date)}</td>
                                            <td><AssigneeCell name={row.assignee} /></td>
                                            <td><PhotosCell photos={row.photos} /></td>
                                            <td>
                                                <div className="pr-issues">
                                                    <div>Open: {Number(row?.issues?.open || 0)}</div>
                                                    <div>Resolved: {Number(row?.issues?.resolved || 0)}</div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="pr-footer">
                        <div className="pr-footnote">
                            Issue log: <strong>0 open</strong> . <strong>0 resolved</strong>
                        </div>
                        <div className="pr-footnote">
                            Receipt runs on current scope data. Submission count: <strong>{Number(receipt?.submission_count || 0)}</strong>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}
