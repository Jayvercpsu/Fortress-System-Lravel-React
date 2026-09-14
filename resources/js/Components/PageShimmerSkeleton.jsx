const containerStyle = {
    display: 'grid',
    gap: 12,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    '--page-skeleton-base': 'var(--surface-2, #f1f5f9)',
    '--page-skeleton-highlight': 'var(--border-color, #e2e8f0)',
};

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 14,
};

const shimmerStyle = {
    width: '100%',
    borderRadius: 8,
    background: 'linear-gradient(90deg, var(--page-skeleton-base) 25%, var(--page-skeleton-highlight) 37%, var(--page-skeleton-base) 63%)',
    backgroundSize: '300% 100%',
    animation: 'pageSkeletonShimmer 1.3s ease-in-out infinite',
};

function ShimmerLine({ width = '100%', height = 12, radius = 8, style = {} }) {
    return (
        <div
            style={{
                ...shimmerStyle,
                width,
                height,
                borderRadius: radius,
                flexShrink: 0,
                minWidth: 0,
                maxWidth: '100%',
                boxSizing: 'border-box',
                ...style,
            }}
        />
    );
}

function DashboardSkeleton() {
    return (
        <div style={containerStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={`dash-card-${index}`} style={cardStyle}>
                        <ShimmerLine width="45%" height={11} radius={6} />
                        <div style={{ marginTop: 12 }}>
                            <ShimmerLine width="35%" height={28} radius={10} />
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                <ShimmerLine width="30%" height={13} />
                <ShimmerLine width="100%" height={42} radius={10} />
                <div style={{ display: 'grid', gap: 8 }}>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <ShimmerLine key={`dash-row-${index}`} width={index % 2 === 0 ? '100%' : '88%'} height={14} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function DataSkeleton() {
    return (
        <div style={containerStyle}>
            <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                <ShimmerLine width="26%" height={13} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    <ShimmerLine width="100%" height={36} radius={10} />
                    <ShimmerLine width="100%" height={36} radius={10} />
                    <ShimmerLine width="100%" height={36} radius={10} />
                </div>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                <ShimmerLine width="20%" height={13} />
                <div style={{ display: 'grid', gap: 8 }}>
                    {Array.from({ length: 8 }).map((_, index) => (
                        <ShimmerLine key={`table-row-${index}`} width={index % 2 === 0 ? '100%' : '94%'} height={14} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function AccomplishmentsSkeleton() {
    return (
        <div data-testid="accomplishments-skeleton" style={{ ...containerStyle, minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'clip' }}>
            <style>{`
                .accomp-skel-card { min-width: 0; box-sizing: border-box; }
                .accomp-skel-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
                .accomp-skel-filters > * { flex: 0 1 auto; min-width: 0; }
                .accomp-skel-tabs { display: flex; gap: 18px; margin-top: 12px; overflow-x: auto; flex-wrap: nowrap; scrollbar-width: thin; padding-bottom: 2px; max-width: 100%; }
                .accomp-skel-tabs > * { flex-shrink: 0; }
                .accomp-skel-stats { display: grid; gap: 12px; margin-top: 14px; grid-template-columns: 1fr; }
                @media (min-width: 640px) { .accomp-skel-stats { grid-template-columns: repeat(2, 1fr); } }
                @media (min-width: 1024px) { .accomp-skel-stats { grid-template-columns: repeat(4, 1fr); } }
                .accomp-skel-row { display: flex; gap: 10px; align-items: center; min-width: 0; }
                .accomp-skel-row-label { flex-shrink: 0; width: clamp(52px, 18%, 140px); min-width: 52px; }
                .accomp-skel-row-bar { flex: 1 1 auto; min-width: 0; }
                .accomp-skel-row-value { flex-shrink: 0; width: 44px; }
                @media (max-width: 640px) {
                    .accomp-skel-card { padding: 12px !important; }
                    .accomp-skel-tabs { gap: 14px; }
                    .accomp-skel-filters > * { flex: 1 1 100% !important; max-width: none !important; width: 100%; }
                }
            `}</style>
            <div className="accomp-skel-card" style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
                    <div style={{ flex: '1 1 200px', minWidth: 0, display: 'grid', gap: 8 }}>
                        <ShimmerLine width="min(220px, 55%)" height={18} radius={8} style={{ flexShrink: 1 }} />
                        <ShimmerLine width="min(360px, 80%)" height={12} style={{ flexShrink: 1 }} />
                    </div>
                    <div className="accomp-skel-filters" style={{ flex: '1 1 220px', justifyContent: 'flex-end', minWidth: 0 }}>
                        <ShimmerLine width={150} height={36} radius={10} />
                        <ShimmerLine width={130} height={36} radius={10} />
                    </div>
                </div>
                <div className="accomp-skel-tabs" data-testid="accomp-skel-tabs">
                    {['Overview', 'PM Submissions', 'Foreman Submissions', 'Comparison'].map((tab) => (
                        <ShimmerLine key={`accomp-tab-${tab}`} width={tab.length > 10 ? 130 : 90} height={12} radius={6} />
                    ))}
                </div>
                <div className="accomp-skel-stats" data-testid="accomp-skel-stats">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={`accomp-card-${index}`} className="accomp-skel-card" style={{ ...cardStyle, margin: 0, display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                            <ShimmerLine width={36} height={36} radius={10} />
                            <div style={{ flex: 1, display: 'grid', gap: 8, minWidth: 0 }}>
                                <ShimmerLine width="60%" height={11} radius={6} style={{ flexShrink: 1 }} />
                                <ShimmerLine width="40%" height={24} radius={8} style={{ flexShrink: 1 }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="accomp-skel-card" style={{ ...cardStyle, display: 'grid', gap: 10, minWidth: 0 }}>
                <ShimmerLine width="min(220px, 60%)" height={15} radius={8} style={{ flexShrink: 1 }} />
                <div style={{ display: 'grid', gap: 8, minWidth: 0 }} data-testid="accomp-skel-rows">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={`accomp-row-${index}`} className="accomp-skel-row">
                            <div className="accomp-skel-row-label">
                                <ShimmerLine width="100%" height={12} />
                            </div>
                            <div className="accomp-skel-row-bar">
                                <ShimmerLine width="100%" height={10} radius={999} />
                            </div>
                            <div className="accomp-skel-row-value">
                                <ShimmerLine width="100%" height={12} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function PageShimmerSkeleton({ variant = 'data' }) {
    return (
        <div data-testid="page-skeleton" style={containerStyle}>
            <style>{'@keyframes pageSkeletonShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}'}</style>
            {variant === 'dashboard' ? <DashboardSkeleton /> : variant === 'accomplishments' ? <AccomplishmentsSkeleton /> : <DataSkeleton />}
        </div>
    );
}
