import { Head } from '@inertiajs/react';
import OptimizedImage from '../../Components/OptimizedImage';
import {
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    Download,
    FolderKanban,
    ImageIcon,
    Link2,
    Printer,
} from 'lucide-react';
import { useState } from 'react';
import ActionButton from '../../Components/ActionButton';
import Modal from '../../Components/Modal';

const formatMoney = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const formatPercent = (value, digits = 2) => `${Number(value || 0).toFixed(digits)}%`;

const normalizeDateValue = (value) => {
    const text = String(value || '').trim();
    if (text === '') return '';
    return text.includes(' ') ? text.replace(' ', 'T') : text;
};

const formatDate = (value) => {
    const normalized = normalizeDateValue(value);
    if (!normalized) return '-';

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
    });
};

const formatDateTime = (value) => {
    const normalized = normalizeDateValue(value);
    if (!normalized) return 'No expiry';

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const humanize = (value) =>
    String(value || '')
        .trim()
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');

const getInitials = (value) => {
    const parts = String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    if (parts.length === 0) return 'NA';
    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
};

const parseAssignees = (value) =>
    String(value || '')
        .split(/[;,|]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);

const progressTone = (value) => {
    if (value >= 100) {
        return {
            bar: 'linear-gradient(90deg, #2f8a4c 0%, #4fb36f 100%)',
            badgeBackground: 'rgba(47, 138, 76, 0.14)',
            badgeColor: '#23653a',
        };
    }

    if (value >= 60) {
        return {
            bar: 'linear-gradient(90deg, #2f6fc9 0%, #5a95e6 100%)',
            badgeBackground: 'rgba(47, 111, 201, 0.14)',
            badgeColor: '#24508f',
        };
    }

    if (value >= 25) {
        return {
            bar: 'linear-gradient(90deg, #b7792e 0%, #d89b4d 100%)',
            badgeBackground: 'rgba(183, 121, 46, 0.14)',
            badgeColor: '#8a5a21',
        };
    }

    return {
        bar: 'linear-gradient(90deg, #8f9399 0%, #b2b8c0 100%)',
        badgeBackground: 'rgba(107, 114, 128, 0.12)',
        badgeColor: '#4b5563',
    };
};

const normalizeScopeRow = (scope, index) => {
    const assignees = Array.isArray(scope?.assignees)
        ? scope.assignees
        : parseAssignees(scope?.assigned_personnel || scope?.assignee).map((name) => ({
              name,
              photo_path: null,
          }));

    return {
        id: scope?.id ?? `scope-${index}`,
        scopeName: String(scope?.scope_name || scope?.scopeName || `Scope ${index + 1}`),
        contractAmount: Number(scope?.contract_amount ?? 0),
        weightPercent: Number(scope?.weight_percent ?? 0),
        progressPercent: Number(scope?.progress_percent ?? 0),
        computedPercent: Number(scope?.computed_percent ?? 0),
        amountToDate: Number(scope?.amount_to_date ?? scope?.computed_amount ?? 0),
        startDate: scope?.start_date || '-',
        targetDate: scope?.target_completion || scope?.target_date || '-',
        assignees,
        photos: Array.isArray(scope?.photos) ? scope.photos : [],
        issues: scope?.issues && typeof scope.issues === 'object' ? scope.issues : null,
        status: String(scope?.status || '').trim(),
    };
};

export default function ProgressReceipt({
    receipt,
    project,
    scopes = [],
    totals = {},
    issue_summary: issueSummary = { open: 0, resolved: 0 },
    token,
    expires_at: expiresAt,
}) {
    const [previewPhoto, setPreviewPhoto] = useState(null);

    const projectName = project?.name || receipt?.project_name || 'Project Receipt';
    const clientName = project?.client || receipt?.client_name || 'Client unavailable';
    const projectPhase = project?.phase || receipt?.project_phase || 'Phase TBD';
    const projectStatus = project?.status || receipt?.project_status || 'Status TBD';
    const projectLocation = project?.location || receipt?.project_location || 'Location unavailable';
    const submittedDate = receipt?.submitted_at ? formatDate(receipt.submitted_at) : '-';
    const scopeRowsSource =
        Array.isArray(scopes) && scopes.length > 0
            ? scopes
            : Array.isArray(receipt?.scopes)
              ? receipt.scopes
              : [];
    const scopeRows = scopeRowsSource.map((scope, index) => normalizeScopeRow(scope, index));
    const summaryTotals = {
        contractTotal: Number(totals?.contract_total ?? receipt?.total_contract_amount ?? 0),
        weightTotal: Number(totals?.weight_total ?? receipt?.total_weight_percent ?? 0),
        weightedProgress: Number(totals?.weighted_progress_percent ?? receipt?.weighted_progress_percent ?? 0),
        computedAmount: Number(totals?.computed_amount_total ?? receipt?.computed_amount ?? 0),
    };
    const projectIssueTotals = {
        open: Number(issueSummary?.open ?? 0),
        resolved: Number(issueSummary?.resolved ?? 0),
    };
    const accessText = String(token || receipt?.access_link || '').trim() || 'Unavailable';

    return (
        <>
            <Head title={`Progress Receipt - ${projectName}`} />
            <div className="receipt-page">
                <style>{`
                    .receipt-page{
                        --border-color:#d8cfbf;
                        --button-bg:#fbf6ec;
                        --text-main:#1f1b16;
                        --text-muted:#736654;
                        --active-text:#214c7a;
                        --active-bg:#ddeafb;
                        --success:#245f3b;
                        min-height:100vh;
                        padding:32px 18px 44px;
                        background:
                            radial-gradient(circle at top left, rgba(255,248,232,0.92) 0%, rgba(255,248,232,0) 32%),
                            linear-gradient(180deg, #f6f2ea 0%, #efe8dc 100%);
                        color:var(--text-main);
                        font-family:'DM Sans', sans-serif;
                    }
                    .receipt-shell{max-width:1380px;margin:0 auto}
                    .receipt-screen{display:block}
                    .receipt-print-layout{display:none}
                    .receipt-hero{
                        display:grid;
                        grid-template-columns:minmax(0, 1.75fr) minmax(300px, 1fr);
                        gap:18px;
                        padding:24px;
                        border:1px solid var(--border-color);
                        border-radius:28px;
                        background:rgba(255,252,246,0.92);
                        box-shadow:0 24px 60px rgba(117,93,54,0.08);
                    }
                    .receipt-eyebrow{
                        display:inline-flex;
                        align-items:center;
                        gap:8px;
                        margin-bottom:12px;
                        color:#8b7352;
                        font-size:12px;
                        font-weight:700;
                        letter-spacing:0.14em;
                        text-transform:uppercase;
                    }
                    .receipt-title{
                        margin:0;
                        font-size:42px;
                        line-height:1;
                        letter-spacing:-0.03em;
                    }
                    .receipt-subtitle{
                        margin:12px 0 0;
                        font-size:15px;
                        line-height:1.65;
                        color:var(--text-muted);
                    }
                    .receipt-access-panel{
                        display:grid;
                        gap:14px;
                        align-content:start;
                        padding:18px;
                        border-radius:22px;
                        background:linear-gradient(180deg, rgba(245,239,226,0.95) 0%, rgba(252,247,238,0.98) 100%);
                        border:1px solid var(--border-color);
                    }
                    .receipt-access-label{
                        font-size:11px;
                        color:#8b7352;
                        letter-spacing:0.12em;
                        font-weight:700;
                        text-transform:uppercase;
                    }
                    .receipt-meta-line{
                        display:flex;
                        align-items:flex-start;
                        gap:10px;
                        color:var(--text-muted);
                        font-size:13px;
                        line-height:1.45;
                    }
                    .receipt-meta-line svg{margin-top:1px;flex:0 0 auto}
                    .receipt-token{
                        font-family:'DM Mono', monospace;
                        font-size:12px;
                        word-break:break-all;
                    }
                    .receipt-kpi-grid{
                        display:grid;
                        grid-template-columns:repeat(4, minmax(0, 1fr));
                        gap:14px;
                        margin:18px 0;
                    }
                    .receipt-kpi{
                        padding:18px 20px;
                        border-radius:22px;
                        border:1px solid var(--border-color);
                        background:rgba(255,252,246,0.92);
                        box-shadow:0 14px 32px rgba(117,93,54,0.05);
                    }
                    .receipt-kpi-label{
                        font-size:12px;
                        font-weight:700;
                        letter-spacing:0.12em;
                        text-transform:uppercase;
                        color:#8b7352;
                    }
                    .receipt-kpi-value{
                        margin-top:10px;
                        font-size:32px;
                        line-height:1;
                        font-weight:800;
                        letter-spacing:-0.03em;
                    }
                    .receipt-kpi-note{
                        margin-top:10px;
                        font-size:12px;
                        color:var(--text-muted);
                    }
                    .receipt-board{
                        border:1px solid var(--border-color);
                        border-radius:28px;
                        background:rgba(255,252,246,0.96);
                        overflow:hidden;
                        box-shadow:0 18px 42px rgba(117,93,54,0.06);
                    }
                    .receipt-board-head{
                        display:flex;
                        align-items:center;
                        justify-content:space-between;
                        gap:14px;
                        padding:22px 22px 18px;
                        border-bottom:1px solid rgba(216, 207, 191, 0.65);
                    }
                    .receipt-board-title{
                        margin:0;
                        font-size:24px;
                        letter-spacing:-0.02em;
                    }
                    .receipt-board-copy{
                        margin:6px 0 0;
                        color:var(--text-muted);
                        font-size:13px;
                    }
                    .receipt-table-wrap{overflow:auto}
                    .receipt-table{
                        width:100%;
                        min-width:1320px;
                        border-collapse:separate;
                        border-spacing:0;
                    }
                    .receipt-table th,
                    .receipt-table td{
                        padding:14px 10px;
                        border-bottom:1px solid rgba(216, 207, 191, 0.78);
                        text-align:left;
                        vertical-align:middle;
                    }
                    .receipt-table th{
                        position:sticky;
                        top:0;
                        z-index:1;
                        background:#efe7d8;
                        color:#6d5b42;
                        font-size:11px;
                        font-weight:800;
                        letter-spacing:0.1em;
                        text-transform:uppercase;
                    }
                    .receipt-table tbody tr:hover{background:rgba(33, 76, 122, 0.035)}
                    .receipt-scope-cell{
                        display:grid;
                        grid-template-columns:auto 1fr;
                        gap:10px;
                        align-items:flex-start;
                    }
                    .receipt-scope-index{
                        min-width:30px;
                        height:30px;
                        padding:0 8px;
                        border-radius:999px;
                        display:inline-flex;
                        align-items:center;
                        justify-content:center;
                        background:#f2eadb;
                        border:1px solid var(--border-color);
                        color:#7b6c57;
                        font-size:12px;
                        font-weight:700;
                    }
                    .receipt-scope-name{
                        font-size:14px;
                        font-weight:700;
                        color:#17130f;
                    }
                    .receipt-scope-meta{
                        margin-top:4px;
                        font-size:12px;
                        color:var(--text-muted);
                    }
                    .receipt-pill{
                        display:inline-flex;
                        align-items:center;
                        justify-content:center;
                        padding:5px 9px;
                        border-radius:999px;
                        border:1px solid rgba(33, 76, 122, 0.12);
                        background:rgba(33, 76, 122, 0.07);
                        color:#214c7a;
                        font-size:12px;
                        font-weight:700;
                        white-space:nowrap;
                    }
                    .receipt-progress-cell{
                        min-width:150px;
                        display:grid;
                        gap:8px;
                    }
                    .receipt-progress-track{
                        height:8px;
                        overflow:hidden;
                        border-radius:999px;
                        background:#e7e0d2;
                    }
                    .receipt-progress-fill{
                        display:block;
                        height:100%;
                        min-width:8px;
                        border-radius:inherit;
                    }
                    .receipt-progress-pill{
                        width:fit-content;
                        display:inline-flex;
                        align-items:center;
                        justify-content:center;
                        padding:3px 8px;
                        border-radius:999px;
                        font-size:11px;
                        font-weight:800;
                    }
                    .receipt-assignee{
                        display:inline-flex;
                        align-items:center;
                        gap:8px;
                        padding:6px 10px;
                        border-radius:999px;
                        border:1px solid var(--border-color);
                        background:#fbf6ed;
                        font-size:13px;
                        font-weight:600;
                        white-space:nowrap;
                    }
                    .receipt-assignee-avatar{
                        width:24px;
                        height:24px;
                        border-radius:999px;
                        display:inline-flex;
                        align-items:center;
                        justify-content:center;
                        background:#ead8c1;
                        color:#7c5728;
                        font-size:11px;
                        font-weight:700;
                        letter-spacing:0.04em;
                        position:relative;
                        overflow:hidden;
                        flex:0 0 auto;
                    }
                    .receipt-assignee-avatar img{
                        position:absolute;
                        inset:0;
                        width:100%;
                        height:100%;
                        object-fit:cover;
                    }
                    .receipt-photo-strip{
                        display:flex;
                        gap:6px;
                        flex-wrap:wrap;
                    }
                    .receipt-photo-thumb{
                        width:46px;
                        height:46px;
                        border:1px solid rgba(216, 207, 191, 0.92);
                        border-radius:12px;
                        padding:0;
                        overflow:hidden;
                        background:#f4ecdf;
                        cursor:pointer;
                        box-shadow:0 8px 18px rgba(77, 63, 43, 0.08);
                    }
                    .receipt-photo-thumb img{
                        width:100%;
                        height:100%;
                        object-fit:cover;
                        display:block;
                    }
                    .receipt-photo-empty{
                        display:inline-flex;
                        align-items:center;
                        gap:6px;
                        color:var(--text-muted);
                        font-size:12px;
                        white-space:nowrap;
                    }
                    .receipt-issue-pill{
                        display:inline-flex;
                        align-items:center;
                        gap:6px;
                        padding:6px 10px;
                        border-radius:999px;
                        font-size:12px;
                        font-weight:700;
                        white-space:nowrap;
                    }
                    .receipt-issue-pill.clear{
                        background:rgba(47, 138, 76, 0.14);
                        color:#23653a;
                    }
                    .receipt-issue-pill.warning{
                        background:rgba(183, 121, 46, 0.14);
                        color:#8a5a21;
                    }
                    .receipt-help-text{
                        margin-top:6px;
                        font-size:11px;
                        color:var(--text-muted);
                    }
                    .receipt-muted{
                        color:var(--text-muted);
                        font-size:12px;
                    }
                    .receipt-footer{
                        display:flex;
                        align-items:center;
                        justify-content:space-between;
                        gap:14px;
                        padding:18px 22px 24px;
                    }
                    .receipt-footer-actions{
                        display:flex;
                        align-items:center;
                        gap:12px;
                        flex-wrap:wrap;
                    }
                    .receipt-footer-note{
                        display:flex;
                        flex-wrap:wrap;
                        gap:14px;
                        color:var(--text-muted);
                        font-size:12px;
                    }
                    .receipt-print,
                    .receipt-download{
                        border-radius:999px;
                        padding:10px 18px;
                        font-size:13px;
                        font-weight:700;
                        gap:8px;
                        border:1px solid rgba(35, 73, 50, 0.18);
                        background:linear-gradient(180deg, #f6efe1 0%, #efe3d1 100%);
                        color:#234932;
                        box-shadow:0 10px 22px rgba(95, 77, 49, 0.12);
                        transition:transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
                        white-space:nowrap;
                    }
                    .receipt-print span,
                    .receipt-download span{
                        display:inline-flex;
                        align-items:center;
                        gap:8px;
                        white-space:nowrap;
                    }
                    .receipt-print svg,
                    .receipt-download svg{flex:0 0 auto}
                    .receipt-print:hover,
                    .receipt-download:hover{
                        background:linear-gradient(180deg, #f1e6d4 0%, #eadbca 100%);
                        box-shadow:0 14px 28px rgba(95, 77, 49, 0.16);
                        transform:translateY(-1px);
                    }
                    .receipt-print:active,
                    .receipt-download:active{
                        transform:translateY(0);
                        box-shadow:0 8px 18px rgba(95, 77, 49, 0.12);
                    }
                    .receipt-modal-image{
                        width:100%;
                        max-height:70vh;
                        object-fit:contain;
                        border-radius:16px;
                        border:1px solid var(--border-color);
                        background:#fff;
                    }
                    @media (max-width: 1080px){
                        .receipt-hero{grid-template-columns:1fr}
                        .receipt-kpi-grid{grid-template-columns:repeat(2, minmax(0, 1fr))}
                    }
                    @media (max-width: 640px){
                        .receipt-page{padding:18px 12px 32px}
                        .receipt-hero{padding:18px;border-radius:22px}
                        .receipt-title{font-size:31px}
                        .receipt-kpi-grid{grid-template-columns:1fr}
                        .receipt-board-head,
                        .receipt-footer{flex-direction:column;align-items:flex-start}
                        .receipt-print{width:100%;justify-content:center}
                    }
                    @media print{
                        .receipt-page{padding:0;background:#fff}
                        .receipt-shell{max-width:none}
                        .receipt-screen{display:none}
                        .receipt-print-layout{
                            display:block;
                            padding:8px 12px 0;
                            color:#000;
                            font-family:'Arial', sans-serif;
                        }
                        .receipt-print-meta{
                            display:grid;
                            grid-template-columns:90px 1fr;
                            gap:4px 12px;
                            font-size:11px;
                            margin-bottom:10px;
                        }
                        .receipt-print-meta-label{font-weight:700;text-transform:uppercase}
                        .receipt-print-title{
                            margin:0 0 6px;
                            font-size:12px;
                            font-weight:700;
                            text-transform:uppercase;
                        }
                        .receipt-print-table{
                            width:100%;
                            border-collapse:collapse;
                            font-size:10px;
                        }
                        .receipt-print-table th,
                        .receipt-print-table td{
                            border:1px solid #000;
                            padding:4px 6px;
                            vertical-align:top;
                        }
                        .receipt-print-table thead th{
                            font-weight:700;
                            text-transform:uppercase;
                            text-align:center;
                        }
                        .receipt-print-table thead tr:first-child th{
                            border-bottom:2px solid #000;
                        }
                        .receipt-print-table tbody td{
                            text-align:right;
                        }
                        .receipt-print-table tbody td:first-child{
                            text-align:left;
                        }
                        .receipt-print-table tbody tr{
                            break-inside:avoid;
                            page-break-inside:avoid;
                        }
                        .receipt-hero,
                        .receipt-kpi,
                        .receipt-board{
                            box-shadow:none;
                            background:#fff;
                        }
                        .receipt-print{display:none !important}
                        .receipt-download{display:none !important}
                        .receipt-table-wrap{overflow:visible}
                        .receipt-table{min-width:0;width:100%;table-layout:fixed}
                        .receipt-table th,
                        .receipt-table td{
                            padding:6px 4px;
                            font-size:9px;
                            word-break:break-word;
                        }
                        .receipt-table th{letter-spacing:0.06em}
                        .receipt-table thead{display:table-header-group}
                        .receipt-table tfoot{display:table-footer-group}
                        .receipt-table tbody tr{break-inside:avoid;page-break-inside:avoid}
                        .receipt-scope-cell{grid-template-columns:22px 1fr}
                        .receipt-scope-index{min-width:22px;height:22px;font-size:9px}
                        .receipt-scope-name{font-size:11px}
                        .receipt-pill,
                        .receipt-progress-pill,
                        .receipt-issue-pill,
                        .receipt-assignee{
                            font-size:9px;
                            padding:2px 6px;
                        }
                        .receipt-assignee{max-width:100%}
                        .receipt-assignee span:last-child{
                            display:inline-block;
                            max-width:90px;
                            overflow:hidden;
                            text-overflow:ellipsis;
                            white-space:nowrap;
                        }
                        .receipt-assignee-avatar{width:18px;height:18px;font-size:8px}
                        .receipt-photo-thumb{width:26px;height:26px;border-radius:6px}
                        .receipt-progress-cell{min-width:90px}
                        .receipt-page{-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    }
                    @page{
                        margin:8mm;
                    }
                `}</style>
                <div className="receipt-shell">
                    <div className="receipt-screen">
                    <section className="receipt-hero">
                        <div>
                            <div className="receipt-eyebrow">
                                <FolderKanban size={15} />
                                Progress Receipt
                            </div>
                            <h1 className="receipt-title">{projectName}</h1>
                            <p className="receipt-subtitle">
                                Client: {clientName} | Phase: {humanize(projectPhase)} | Status: {humanize(projectStatus)}
                            </p>
                        </div>

                        <div className="receipt-access-panel">
                            <div className="receipt-access-label">Receipt Access</div>
                            <div className="receipt-muted">
                                {receipt?.submission_count ? `${receipt.submission_count} submission(s)` : 'Public receipt access'}
                            </div>
                            <div className="receipt-meta-line">
                                <Link2 size={14} />
                                <div>
                                    <div style={{ fontWeight: 700, color: '#5d503e' }}>Access key</div>
                                    <div className="receipt-token">{accessText}</div>
                                </div>
                            </div>
                            <div className="receipt-meta-line">
                                <CalendarDays size={14} />
                                <div>
                                    <div style={{ fontWeight: 700, color: '#5d503e' }}>Expires</div>
                                    <div>{formatDateTime(expiresAt || receipt?.expires_at)}</div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="receipt-kpi-grid">
                        <article className="receipt-kpi">
                            <div className="receipt-kpi-label">Total Contract</div>
                            <div className="receipt-kpi-value">{formatMoney(summaryTotals.contractTotal)}</div>
                            <div className="receipt-kpi-note">Combined contract value across captured scopes.</div>
                        </article>
                        <article className="receipt-kpi">
                            <div className="receipt-kpi-label">Total Weight</div>
                            <div className="receipt-kpi-value">{formatPercent(summaryTotals.weightTotal, 2)}</div>
                            <div className="receipt-kpi-note">Weight allocation currently represented in the receipt.</div>
                        </article>
                        <article className="receipt-kpi">
                            <div className="receipt-kpi-label">Weighted Progress</div>
                            <div className="receipt-kpi-value">{formatPercent(summaryTotals.weightedProgress, 2)}</div>
                            <div className="receipt-kpi-note">Weighted accomplishment based on reported scope progress.</div>
                        </article>
                        <article className="receipt-kpi">
                            <div className="receipt-kpi-label">Computed Amount</div>
                            <div className="receipt-kpi-value">{formatMoney(summaryTotals.computedAmount)}</div>
                            <div className="receipt-kpi-note">Estimated amount earned from the reported progress.</div>
                        </article>
                    </section>

                    <section className="receipt-board">
                        <div className="receipt-board-head">
                            <div>
                                <h2 className="receipt-board-title">Scope Breakdown</h2>
                                <p className="receipt-board-copy">
                                    Receipt view based on the current submitted scope list, matching the compact visual direction from your reference.
                                </p>
                            </div>
                        </div>
                        <div className="receipt-table-wrap">
                            <table className="receipt-table">
                                <thead>
                                    <tr>
                                        <th>Scope of Works</th>
                                        <th>Contract</th>
                                        <th>Weight %</th>
                                        <th>Progress %</th>
                                        <th>Computed %</th>
                                        <th>Amount</th>
                                        <th>Start Date</th>
                                        <th>Target Completion</th>
                                        <th>Assignee</th>
                                        <th>Photos</th>
                                        <th>Issues</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scopeRows.map((scope, index) => {
                                        const tone = progressTone(scope.progressPercent);
                                        const rowIssueTotals = scope.issues || projectIssueTotals;
                                        const assignees = Array.isArray(scope.assignees) ? scope.assignees : [];
                                        const primaryAssignee = assignees[0]?.name || '';
                                        const primaryPhoto = assignees[0]?.photo_path || '';
                                        const extraAssignees = assignees.length > 1 ? assignees.length - 1 : 0;
                                        const assigneeLabel = primaryAssignee
                                            ? `${primaryAssignee}${extraAssignees ? ` +${extraAssignees}` : ''}`
                                            : '';
                                        const openIssues = Number(rowIssueTotals?.open ?? 0);
                                        const resolvedIssues = Number(rowIssueTotals?.resolved ?? 0);
                                        const issueHasOpen = openIssues > 0;
                                        const issueLabel = issueHasOpen
                                            ? `${openIssues} open`
                                            : resolvedIssues > 0
                                              ? `${resolvedIssues} resolved`
                                              : 'Clear';
                                        const progressWidth = Math.max(6, Math.min(scope.progressPercent, 100));

                                        return (
                                            <tr key={scope.id}>
                                                <td>
                                                    <div className="receipt-scope-cell">
                                                        <span className="receipt-scope-index">{index + 1}</span>
                                                        <div>
                                                            <div className="receipt-scope-name">{scope.scopeName}</div>
                                                            <div className="receipt-scope-meta">
                                                                {scope.status ? humanize(scope.status) : 'Scope status not set'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>{formatMoney(scope.contractAmount)}</td>
                                                <td>
                                                    <span className="receipt-pill">{formatPercent(scope.weightPercent, 2)}</span>
                                                </td>
                                                <td>
                                                    <div className="receipt-progress-cell">
                                                        <div className="receipt-progress-track">
                                                            <span
                                                                className="receipt-progress-fill"
                                                                style={{
                                                                    width: `${progressWidth}%`,
                                                                    background: tone.bar,
                                                                }}
                                                            />
                                                        </div>
                                                        <span
                                                            className="receipt-progress-pill"
                                                            style={{
                                                                background: tone.badgeBackground,
                                                                color: tone.badgeColor,
                                                            }}
                                                        >
                                                            {formatPercent(scope.progressPercent, 0)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>{formatPercent(scope.computedPercent, 2)}</td>
                                                <td>{formatMoney(scope.amountToDate)}</td>
                                                <td>{formatDate(scope.startDate)}</td>
                                                <td>{formatDate(scope.targetDate)}</td>
                                                <td>
                                                    {assigneeLabel ? (
                                                        <div
                                                            className="receipt-assignee"
                                                            title={assignees.length > 1 ? assignees.map((entry) => entry.name).join(', ') : undefined}
                                                        >
                                                            <span className="receipt-assignee-avatar" aria-hidden="true">
                                                                {getInitials(primaryAssignee)}
                                                                {primaryPhoto ? (
                                                                    <OptimizedImage
                                                                        src={`/storage/${primaryPhoto}`}
                                                                        alt={primaryAssignee}
                                                                        onError={(event) => event.currentTarget.remove()}
                                                                    />
                                                                ) : null}
                                                            </span>
                                                            <span>{assigneeLabel}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="receipt-muted">Unassigned</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {scope.photos.length === 0 ? (
                                                        <div className="receipt-photo-empty">
                                                            <ImageIcon size={14} />
                                                            No photos
                                                        </div>
                                                    ) : (
                                                        <div className="receipt-photo-strip">
                                                            {scope.photos.slice(0, 4).map((photo) => (
                                                                <button
                                                                    key={photo.id}
                                                                    type="button"
                                                                    className="receipt-photo-thumb"
                                                                    onClick={() =>
                                                                        setPreviewPhoto({
                                                                            ...photo,
                                                                            caption: photo.caption || scope.scopeName,
                                                                            meta: scope.scopeName,
                                                                        })
                                                                    }
                                                                >
                                                                    <OptimizedImage
                                                                        src={`/storage/${photo.photo_path}`}
                                                                        alt={photo.caption || scope.scopeName}
                                                                    />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className={`receipt-issue-pill ${issueHasOpen ? 'warning' : 'clear'}`}>
                                                        {issueHasOpen ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                                                        <span>{issueLabel}</span>
                                                    </div>
                                                    {!scope.issues ? <div className="receipt-help-text">Project level log</div> : null}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {scopeRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} style={{ textAlign: 'center', color: '#8b7352', padding: '28px 18px' }}>
                                                No scope data available yet.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                        <div className="receipt-footer">
                            <div className="receipt-footer-note">
                                <span>Issue log: {projectIssueTotals.open} open | {projectIssueTotals.resolved} resolved</span>
                                {receipt?.submitted_at ? <span>Last submitted: {formatDateTime(receipt.submitted_at)}</span> : null}
                                <span>{scopeRows.length} scope row(s)</span>
                            </div>
                            <div className="receipt-footer-actions">
                                <ActionButton
                                    href={`/progress-receipt/${token}/export`}
                                    external
                                    variant="neutral"
                                    className="receipt-download"
                                >
                                    <Download size={16} />
                                    Download Excel
                                </ActionButton>
                                <ActionButton
                                    type="button"
                                    variant="neutral"
                                    onClick={() => window.print()}
                                    className="receipt-print"
                                >
                                    <Printer size={16} />
                                    Print Receipt
                                </ActionButton>
                            </div>
                        </div>
                    </section>
                    </div>
                    <div className="receipt-print-layout">
                        <div className="receipt-print-title">Progress Billing Statement</div>
                        <div className="receipt-print-meta">
                            <div className="receipt-print-meta-label">Owner</div>
                            <div>{clientName}</div>
                            <div className="receipt-print-meta-label">Project</div>
                            <div>{projectName}</div>
                            <div className="receipt-print-meta-label">Location</div>
                            <div>{projectLocation}</div>
                            <div className="receipt-print-meta-label">Subject</div>
                            <div>Weight Percentage</div>
                            <div className="receipt-print-meta-label">Date</div>
                            <div>{submittedDate}</div>
                        </div>
                        <table className="receipt-print-table">
                            <thead>
                                <tr>
                                    <th rowSpan={2}>Scope of Works and Materials</th>
                                    <th rowSpan={2}>Contract Amount</th>
                                    <th rowSpan={2}>WT %</th>
                                    <th colSpan={3}>Accomplishment to Date</th>
                                </tr>
                                <tr>
                                    <th>% Accomp</th>
                                    <th>Amount</th>
                                    <th>WT %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scopeRows.map((scope, index) => (
                                    <tr key={`print-${scope.id}`}>
                                        <td>{`${index + 1}. ${scope.scopeName}`}</td>
                                        <td>{formatMoney(scope.contractAmount)}</td>
                                        <td>{formatPercent(scope.weightPercent, 2)}</td>
                                        <td>{formatPercent(scope.progressPercent, 0)}</td>
                                        <td>{formatMoney(scope.amountToDate)}</td>
                                        <td>{formatPercent(scope.computedPercent, 2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <Modal
                    open={!!previewPhoto}
                    onClose={() => setPreviewPhoto(null)}
                    title={previewPhoto?.caption || 'Photo preview'}
                    maxWidth={920}
                >
                    {previewPhoto ? (
                        <div style={{ display: 'grid', gap: 12 }}>
                            <OptimizedImage
                                src={`/storage/${previewPhoto.photo_path}`}
                                alt={previewPhoto.caption || 'Scope photo'}
                                className="receipt-modal-image"
                            />
                            <div className="receipt-muted">
                                {previewPhoto.meta ? `${previewPhoto.meta}` : ''}
                                {previewPhoto.created_at ? ` | ${formatDateTime(previewPhoto.created_at)}` : ''}
                            </div>
                        </div>
                    ) : null}
                </Modal>
            </div>
        </>
    );
}
