import { useEffect, useState } from 'react';

const panelCardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
    display: 'grid',
    gap: 14,
};

const sectionStyle = {
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: 14,
    background: 'var(--surface-2)',
    display: 'grid',
    gap: 10,
    alignContent: 'start',
};

const sectionTitleStyle = {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
};

const sectionSubtextStyle = {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.45,
};

const metricGridStyle = {
    display: 'grid',
    gap: 2,
};

const metricRowStyle = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 12,
    alignItems: 'start',
    padding: '6px 0',
    borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
};

const metricLabelStyle = {
    color: 'var(--text-muted)',
    fontSize: 13,
    lineHeight: 1.35,
};

const metricValueStyle = {
    fontWeight: 700,
    fontSize: 13,
    lineHeight: 1.35,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
};

const subheadingStyle = {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
};

const infoBoxStyle = {
    border: '1px solid rgba(148, 163, 184, 0.25)',
    background: 'rgba(148, 163, 184, 0.06)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 11,
    color: 'var(--text-muted)',
    lineHeight: 1.4,
};

const warnBoxStyle = {
    border: '1px solid rgba(251, 191, 36, 0.4)',
    background: 'rgba(251, 191, 36, 0.08)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 11,
    color: '#fbbf24',
    lineHeight: 1.4,
};

const chipGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
};

const chipStyle = {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 8,
    padding: '8px 10px',
    background: 'rgba(148, 163, 184, 0.04)',
    display: 'grid',
    gap: 2,
};

const chipLabelStyle = {
    fontSize: 11,
    color: 'var(--text-muted)',
    lineHeight: 1.2,
};

const chipValueStyle = {
    fontSize: 12,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
};

const dividerStyle = {
    height: 1,
    background: 'rgba(148, 163, 184, 0.18)',
    margin: '2px 0',
};

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const percent = (value) =>
    `${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;

function MetricRow({ label, value, valueColor, valueStyle, noBorder = false }) {
    return (
        <div style={{ ...metricRowStyle, ...(noBorder ? { borderBottom: 'none' } : null) }}>
            <div style={metricLabelStyle}>{label}</div>
            <div style={{ ...metricValueStyle, ...(valueColor ? { color: valueColor } : null), ...(valueStyle || null) }}>{value}</div>
        </div>
    );
}

function StatusBadge({ value }) {
    const normalized = String(value || '').toLowerCase();
    const tone =
        normalized === 'approved'
            ? { border: '1px solid rgba(74, 222, 128, 0.35)', background: 'rgba(74, 222, 128, 0.12)', color: '#22c55e' }
            : normalized === 'rejected'
              ? { border: '1px solid rgba(248, 113, 113, 0.35)', background: 'rgba(248, 113, 113, 0.12)', color: '#ef4444' }
              : { border: '1px solid rgba(251, 191, 36, 0.35)', background: 'rgba(251, 191, 36, 0.10)', color: '#f59e0b' };

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'capitalize',
                ...tone,
            }}
        >
            {normalized || 'pending'}
        </span>
    );
}

export default function ProjectComputationsPanel({ project }) {
    const [isDesktopTwoColumn, setIsDesktopTwoColumn] = useState(() =>
        typeof window === 'undefined' ? true : window.innerWidth >= 1180
    );

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleResize = () => setIsDesktopTwoColumn(window.innerWidth >= 1180);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const computationSources = project?.computation_sources || {};
    const designTracker = computationSources.design_tracker || {};
    const buildTracker = computationSources.build_tracker || {};
    const financeActuals = computationSources.finance_actuals || {};
    const financialsSnapshot = computationSources.project_financials_snapshot || {};
    const syncChecks = computationSources.sync_checks || {};
    const deductions = computationSources.deductions || {};

    const totalBudget = Number(financialsSnapshot.total_budget_contract_amount ?? project?.contract_amount ?? 0);
    const manualDesignFee = Number(financialsSnapshot.design_fee_manual ?? project?.design_fee ?? 0);
    const snapshotConstructionCost = Number(financialsSnapshot.construction_cost ?? project?.construction_cost ?? 0);
    const snapshotTotalClientPayment = Number(financialsSnapshot.total_client_payment ?? project?.total_client_payment ?? 0);
    const snapshotRemainingBalance = Number(financialsSnapshot.remaining_balance ?? project?.remaining_balance ?? 0);
    const snapshotLastPaidDate = financialsSnapshot.last_paid_date || project?.last_paid_date || '-';

    const designTrackerContractAmount = Number(designTracker.design_contract_amount ?? 0);
    const designDownpayment = Number(designTracker.downpayment ?? 0);
    const designTotalReceived = Number(designTracker.total_received ?? 0);
    const designOfficePayrollDeduction = Number(designTracker.office_payroll_deduction ?? 0);
    const designNetAfterDeduction = Number(designTracker.net_after_office_payroll_deduction ?? (designTotalReceived - designOfficePayrollDeduction));
    const designRemainingBalance = Number(designTracker.remaining_design_balance ?? (designTrackerContractAmount - designTotalReceived));
    const designProgressPct = Number(designTracker.design_progress ?? 0);
    const designApprovalStatus = String(designTracker.client_approval_status || 'pending');
    const designTrackerSharePct = Number(
        designTracker.share_of_total_budget_pct ?? (totalBudget > 0 ? (designTrackerContractAmount / totalBudget) * 100 : 0)
    );
    const manualDesignFeeSharePct = Number(
        financialsSnapshot.design_fee_share_of_total_budget_pct ?? (totalBudget > 0 ? (manualDesignFee / totalBudget) * 100 : 0)
    );

    const buildTrackerContractAmount = Number(buildTracker.construction_contract ?? 0);
    const buildTrackerRecordedClientPayment = Number(buildTracker.recorded_total_client_payment ?? 0);
    const buildTrackerMaterialsCost = Number(buildTracker.materials_cost ?? 0);
    const buildTrackerLaborCost = Number(buildTracker.labor_cost ?? 0);
    const buildTrackerEquipmentCost = Number(buildTracker.equipment_cost ?? 0);
    const buildTrackerCostSubtotal = Number(
        buildTracker.tracker_cost_subtotal ?? (buildTrackerMaterialsCost + buildTrackerLaborCost + buildTrackerEquipmentCost)
    );
    const actualExpensesTotal = Number(buildTracker.actual_expenses_total ?? project?.construction_cost ?? 0);
    const buildVarianceVsActualExpenses = Number(
        buildTracker.variance_vs_actual_expenses ?? (buildTrackerContractAmount - actualExpensesTotal)
    );
    const buildCollectionProgressPct =
        buildTrackerContractAmount > 0 ? (buildTrackerRecordedClientPayment / buildTrackerContractAmount) * 100 : 0;

    const financePaymentsTotal = Number(financeActuals.payments_total ?? project?.total_client_payment ?? 0);
    const financeCollectionProgressPct = Number(
        financeActuals.collection_progress_pct ?? (totalBudget > 0 ? (financePaymentsTotal / totalBudget) * 100 : 0)
    );
    const financeRemainingBalance = Number(financeActuals.remaining_balance ?? project?.remaining_balance ?? 0);
    const financeLastPaidDate = financeActuals.last_paid_date || project?.last_paid_date || '-';

    const manualDerivedBuildBudget = Number(syncChecks.manual_derived_build_budget ?? (totalBudget - manualDesignFee));
    const designFeeGap = Number(
        syncChecks.design_fee_manual_minus_design_tracker_contract ?? (manualDesignFee - designTrackerContractAmount)
    );
    const buildBudgetGap = Number(
        syncChecks.tracker_build_budget_minus_manual_derived_build_budget ?? (buildTrackerContractAmount - manualDerivedBuildBudget)
    );

    const hasDesignFeeGap = Math.abs(designFeeGap) > 0.009;
    const hasBuildBudgetGap = Math.abs(buildBudgetGap) > 0.009;
    const hasSyncMismatch = hasDesignFeeGap || hasBuildBudgetGap;

    return (
        <div style={panelCardStyle}>
            <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontWeight: 700 }}>Project Computations</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Tracker, payments, and project financial snapshot values are grouped by source so you can compare them more easily.
                </div>
            </div>

            {hasSyncMismatch && (
                <div style={warnBoxStyle}>
                    Mismatch detected between manual Financials values and tracker values. Review the <strong>Design Fee Gap</strong> and{' '}
                    <strong>Build Budget Gap</strong> in the Project Financials section before finalizing reports.
                </div>
            )}

            <div
                style={{
                    display: 'grid',
                    gap: 12,
                    gridTemplateColumns: isDesktopTwoColumn ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                    alignItems: 'start',
                }}
            >
                <div style={sectionStyle}>
                    <div style={sectionTitleStyle}>Design Department</div>
                    <div style={sectionSubtextStyle}>Design Tracker values (`design_projects`) including design-only office deduction.</div>
                    <div style={metricGridStyle}>
                        <MetricRow label="Design Contract Amount" value={money(designTrackerContractAmount)} />
                        <MetricRow label="Downpayment" value={money(designDownpayment)} />
                        <MetricRow label="Total Received" value={money(designTotalReceived)} />
                        <MetricRow label="Office Payroll Deduction" value={money(designOfficePayrollDeduction)} valueColor="#ef4444" />
                        <MetricRow label="Net After Office Deduction" value={money(designNetAfterDeduction)} />
                        <MetricRow label="Design Remaining Balance" value={money(designRemainingBalance)} />
                        <MetricRow label="Design Progress" value={percent(designProgressPct)} />
                        <MetricRow label="Client Approval" value={<StatusBadge value={designApprovalStatus} />} valueStyle={{ whiteSpace: 'normal' }} />
                        <MetricRow label="Share of Total Budget (Tracker)" value={percent(designTrackerSharePct)} noBorder />
                    </div>
                    <div style={infoBoxStyle}>
                        Design office payroll deduction is shown here for design profitability tracking only. It is not subtracted from project-wide totals below.
                    </div>
                </div>

                <div style={sectionStyle}>
                    <div style={sectionTitleStyle}>Build Department</div>
                    <div style={sectionSubtextStyle}>Build Tracker budget compared to actual expense transactions from the Expenses module.</div>
                    <div style={metricGridStyle}>
                        <MetricRow label="Construction Contract (Tracker)" value={money(buildTrackerContractAmount)} />
                        <MetricRow label="Build Tracker Client Payment" value={money(buildTrackerRecordedClientPayment)} />
                        <MetricRow label="Build Collection Progress" value={percent(buildCollectionProgressPct)} />
                        <MetricRow label="Tracker Cost Subtotal" value={money(buildTrackerCostSubtotal)} noBorder />
                    </div>

                    <div style={subheadingStyle}>Tracker Cost Breakdown</div>
                    <div style={chipGridStyle}>
                        <div style={chipStyle}>
                            <div style={chipLabelStyle}>Materials</div>
                            <div style={chipValueStyle}>{money(buildTrackerMaterialsCost)}</div>
                        </div>
                        <div style={chipStyle}>
                            <div style={chipLabelStyle}>Labor</div>
                            <div style={chipValueStyle}>{money(buildTrackerLaborCost)}</div>
                        </div>
                        <div style={chipStyle}>
                            <div style={chipLabelStyle}>Equipment</div>
                            <div style={chipValueStyle}>{money(buildTrackerEquipmentCost)}</div>
                        </div>
                    </div>

                    <div style={metricGridStyle}>
                        <MetricRow label="Actual Expenses (Expenses module)" value={money(actualExpensesTotal)} />
                        <MetricRow
                            label="Variance vs Actual Expenses"
                            value={money(buildVarianceVsActualExpenses)}
                            valueColor={buildVarianceVsActualExpenses < 0 ? '#ef4444' : '#22c55e'}
                            noBorder
                        />
                    </div>
                </div>

                <div style={sectionStyle}>
                    <div style={sectionTitleStyle}>Finance (Payments Module)</div>
                    <div style={sectionSubtextStyle}>Actual client payment transactions from the Payments page.</div>
                    <div style={metricGridStyle}>
                        <MetricRow label="Payments Total (Actual)" value={money(financePaymentsTotal)} />
                        <MetricRow label="Collection Progress (Actual)" value={percent(financeCollectionProgressPct)} />
                        <MetricRow label="Remaining Balance (Actual)" value={money(financeRemainingBalance)} />
                        <MetricRow label="Last Paid Date (Actual)" value={financeLastPaidDate} />
                        <MetricRow label="Payroll Deductions in Project Totals" value="Not included" valueColor="#f59e0b" noBorder />
                    </div>
                    <div style={warnBoxStyle}>
                        {deductions.payroll_deductions_note ||
                            'Payroll deductions are not included in Project Computations because payroll entries are not linked to project_id.'}
                    </div>
                </div>

                <div style={sectionStyle}>
                    <div style={sectionTitleStyle}>Overall Computations (Project Financials)</div>
                    <div style={sectionSubtextStyle}>Project-level snapshot plus manual Financials values and sync-check comparisons.</div>

                    <div style={subheadingStyle}>Project Financials Snapshot</div>
                    <div style={metricGridStyle}>
                        <MetricRow label="Total Budget (Contract Amount)" value={money(totalBudget)} />
                        <MetricRow label="Design Fee (Manual in Financials)" value={money(manualDesignFee)} />
                        <MetricRow label="Design Fee Share (Manual)" value={percent(manualDesignFeeSharePct)} />
                        <MetricRow label="Construction Cost (Snapshot)" value={money(snapshotConstructionCost)} />
                        <MetricRow label="Total Client Payment (Snapshot)" value={money(snapshotTotalClientPayment)} />
                        <MetricRow label="Remaining Balance (Snapshot)" value={money(snapshotRemainingBalance)} />
                        <MetricRow label="Last Paid Date (Snapshot)" value={snapshotLastPaidDate} noBorder />
                    </div>

                    <div style={dividerStyle} />

                    <div style={subheadingStyle}>Sync Checks</div>
                    <div style={metricGridStyle}>
                        <MetricRow label="Manual Derived Build Budget" value={money(manualDerivedBuildBudget)} />
                        <MetricRow
                            label="Design Fee Gap vs Design Tracker"
                            value={money(designFeeGap)}
                            valueColor={hasDesignFeeGap ? '#f59e0b' : '#22c55e'}
                        />
                        <MetricRow
                            label="Build Budget Gap (Tracker vs Manual-Derived)"
                            value={money(buildBudgetGap)}
                            valueColor={hasBuildBudgetGap ? '#f59e0b' : '#22c55e'}
                            noBorder
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
