import Layout from '../../../Components/Layout';
import ActionButton from '../../../Components/ActionButton';
import TextInput from '../../../Components/TextInput';
import SelectInput from '../../../Components/SelectInput';
import { Head, useForm } from '@inertiajs/react';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import {
    computeDesignCollectionPercent,
    computeDesignMilestoneBreakdown,
    computeDesignProgressFromMilestones,
} from '../../../Utils/designComputation';

const money = (value) =>
    `P ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
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

const basisTableHeaderStyle = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    gap: 10,
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    padding: '4px 0',
};

const basisRowStyle = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    gap: 10,
    alignItems: 'center',
    fontSize: 12,
    padding: '6px 0',
    borderTop: '1px solid rgba(148, 163, 184, 0.12)',
};

const milestoneTextStyle = {
    lineHeight: 1.35,
};

export default function HeadAdminDesignShow({ projectId, design }) {
    const { data, setData, patch, processing, errors } = useForm({
        design_contract_amount: design.design_contract_amount ?? 0,
        downpayment: design.downpayment ?? 0,
        total_received: design.total_received ?? 0,
        office_payroll_deduction: design.office_payroll_deduction ?? 0,
        client_approval_status: design.client_approval_status ?? 'pending',
    });
    const projectStatus = String(design.project_status || '').trim().toLowerCase();
    const isLocked = projectStatus === 'completed' || projectStatus === 'cancelled';

    const remaining = Number(data.design_contract_amount || 0) - Number(data.total_received || 0);
    const netIncome = Number(data.total_received || 0) - Number(data.office_payroll_deduction || 0);
    const designProgress = computeDesignProgressFromMilestones({
        designContractAmount: data.design_contract_amount,
        totalReceived: data.total_received,
        clientApprovalStatus: data.client_approval_status,
    });
    const collectionProgress = computeDesignCollectionPercent({
        designContractAmount: data.design_contract_amount,
        totalReceived: data.total_received,
    });
    const milestoneBreakdown = computeDesignMilestoneBreakdown(data.design_contract_amount);

    const submit = (e) => {
        e.preventDefault();
        if (isLocked) return;
        if (isLocked) return;
        patch(`/projects/${projectId}/design`, {
            preserveScroll: true,
            onSuccess: () => toast.success('Design tracker updated successfully.'),
            onError: () => toast.error('Please fix the highlighted fields and try again.'),
        });
    };

    return (
        <>
            <Head title={`Design Tracker #${projectId}`} />
            <Layout title={`Design Tracker - Project #${projectId}`}>
                <div style={{ marginBottom: 12 }}>
                    <ActionButton
                        href={`/projects/${projectId}`}
                        style={{ padding: '8px 12px', fontSize: 13 }}
                    >
                        <ArrowLeft size={16} />
                        Back to Project
                    </ActionButton>
                </div>

                <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
                    <fieldset disabled={isLocked} style={{ border: 'none', padding: 0, margin: 0, display: 'contents' }}>
                    <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Design Contract Amount</div>
                            <div style={{ fontWeight: 700 }}>{money(data.design_contract_amount)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Design Remaining</div>
                            <div style={{ fontWeight: 700, color: remaining < 0 ? '#f87171' : '#4ade80' }}>{money(remaining)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Net Income</div>
                            <div style={{ fontWeight: 700, color: netIncome < 0 ? '#f87171' : '#4ade80' }}>{money(netIncome)}</div>
                        </div>
                    </div>

                    <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                        <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-muted)' }}>
                            Saving here automatically updates Project Overview / Edit financial totals.
                        </div>
                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Design Contract Amount</div>
                            <TextInput type="number" step="0.01" min="0" value={data.design_contract_amount} onChange={(e) => setData('design_contract_amount', e.target.value)} style={inputStyle} />
                            {errors.design_contract_amount && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.design_contract_amount}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Downpayment</div>
                            <TextInput type="number" step="0.01" min="0" value={data.downpayment} onChange={(e) => setData('downpayment', e.target.value)} style={inputStyle} />
                            {errors.downpayment && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.downpayment}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Total Received</div>
                            <TextInput type="number" step="0.01" min="0" value={data.total_received} onChange={(e) => setData('total_received', e.target.value)} style={inputStyle} />
                            {errors.total_received && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.total_received}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Office Payroll Deduction</div>
                            <TextInput type="number" step="0.01" min="0" value={data.office_payroll_deduction} onChange={(e) => setData('office_payroll_deduction', e.target.value)} style={inputStyle} />
                            {errors.office_payroll_deduction && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.office_payroll_deduction}</div>}
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Design Progress (%) (Automatic)</div>
                            <TextInput type="number" min="0" max="100" value={designProgress} readOnly style={{ ...inputStyle, opacity: 0.9, cursor: 'not-allowed' }} />
                            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                                Milestone-based auto-compute. Total Received unlocks the milestone percentages; client approval = Approved forces 100%.
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                                Current collection ratio: {collectionProgress.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%
                            </div>
                        </label>

                        <label>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>Client Approval Status</div>
                            <SelectInput value={data.client_approval_status} onChange={(e) => setData('client_approval_status', e.target.value)} style={inputStyle}>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </SelectInput>
                            {errors.client_approval_status && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errors.client_approval_status}</div>}
                        </label>
                    </div>

                    <div style={{ ...cardStyle, display: 'grid', gap: 8 }}>
                        <div style={{ fontWeight: 700 }}>Design Computation Basis</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            Progress follows this fixed milestone schedule totaling 100%. Amounts are auto-derived from the current Design Contract Amount.
                        </div>
                        <div style={basisTableHeaderStyle}>
                            <div>Milestone</div>
                            <div>Weight</div>
                            <div>Amount</div>
                        </div>
                        {milestoneBreakdown.map((milestone) => (
                            <div key={milestone.key} style={basisRowStyle}>
                                <div style={milestoneTextStyle}>{milestone.label}</div>
                                <div>{milestone.percent}%</div>
                                <div>{money(milestone.amount)}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <ActionButton
                            type="submit"
                            variant="success"
                            disabled={processing || isLocked}
                            style={{ padding: '10px 16px', fontSize: 13 }}
                        >
                            {processing ? 'Saving...' : 'Save Design Tracker'}
                        </ActionButton>
                    </div>
                    </fieldset>
                </form>
            </Layout>
        </>
    );
}

