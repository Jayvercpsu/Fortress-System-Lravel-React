export const DESIGN_COMPUTATION_BASIS = [
    {
        key: 'second_page_title_intro_floorplan',
        label: 'Second page title / intro / floorplan',
        percent: 10,
    },
    {
        key: 'first_dp',
        label: 'First, DP 50%',
        percent: 5,
    },
    {
        key: 'floor_plan_requirements',
        label: 'Floor plan requirements',
        percent: 10,
    },
    {
        key: 'floor_plan',
        label: 'Floor plan',
        percent: 10,
    },
    {
        key: 'extension_design',
        label: 'Extension design',
        percent: 10,
    },
    {
        key: 'interior_design',
        label: 'Interior design',
        percent: 10,
    },
    {
        key: 'rendering_walkthrough',
        label: '3D rendering / walkthrough',
        percent: 10,
    },
    {
        key: 'cad',
        label: 'CAD',
        percent: 10,
    },
    {
        key: 'initial_printing',
        label: 'Initial 10K for printing (blueprint press)',
        percent: 5,
    },
    {
        key: 'sign_and_sealed',
        label: 'Sign & sealed',
        percent: 10,
    },
    {
        key: 'turnover_final_payment',
        label: 'Turnover / final payment',
        percent: 10,
    },
];

export const DESIGN_COMPUTATION_TOTAL_PERCENT = DESIGN_COMPUTATION_BASIS.reduce(
    (total, milestone) => total + Number(milestone.percent || 0),
    0
);

export const computeDesignCollectionPercent = ({ designContractAmount, totalReceived }) => {
    const contractAmount = Number(designContractAmount || 0);
    const received = Number(totalReceived || 0);

    if (contractAmount <= 0 || received <= 0) return 0;

    return Math.max(0, Math.min(100, (received / contractAmount) * 100));
};

export const computeDesignProgressFromMilestones = ({ designContractAmount, totalReceived, clientApprovalStatus }) => {
    if (String(clientApprovalStatus || '').trim().toLowerCase() === 'approved') {
        return DESIGN_COMPUTATION_TOTAL_PERCENT;
    }

    const collectionPercent = computeDesignCollectionPercent({ designContractAmount, totalReceived });
    if (collectionPercent <= 0) return 0;

    let progress = 0;
    let cumulativePercent = 0;

    DESIGN_COMPUTATION_BASIS.forEach((milestone) => {
        cumulativePercent += Number(milestone.percent || 0);
        if (collectionPercent + 0.000001 >= cumulativePercent) {
            progress = cumulativePercent;
        }
    });

    return Math.max(0, Math.min(DESIGN_COMPUTATION_TOTAL_PERCENT, Math.round(progress)));
};

export const computeDesignMilestoneBreakdown = (designContractAmount) => {
    const contractAmount = Math.max(0, Number(designContractAmount || 0));
    let cumulativePercent = 0;
    let cumulativeAmount = 0;

    return DESIGN_COMPUTATION_BASIS.map((milestone) => {
        const percent = Number(milestone.percent || 0);
        const amount = (contractAmount * percent) / 100;
        cumulativePercent += percent;
        cumulativeAmount += amount;

        return {
            ...milestone,
            amount,
            cumulative_percent: cumulativePercent,
            cumulative_amount: cumulativeAmount,
        };
    });
};
