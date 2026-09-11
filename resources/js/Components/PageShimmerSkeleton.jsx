const containerStyle = {
    display: 'grid',
    gap: 12,
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

function ShimmerLine({ width = '100%', height = 12, radius = 8 }) {
    return (
        <div
            style={{
                ...shimmerStyle,
                width,
                height,
                borderRadius: radius,
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
        <div style={containerStyle}>
            <div style={cardStyle}>
                <ShimmerLine width="22%" height={18} radius={8} />
                <div style={{ marginTop: 8 }}>
                    <ShimmerLine width="48%" height={12} />
                </div>
                <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
                    {['Overview', 'PM Submissions', 'Foreman Submissions', 'Comparison'].map((tab) => (
                        <ShimmerLine key={`accomp-tab-${tab}`} width={90} height={12} radius={6} />
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 14 }}>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={`accomp-card-${index}`} style={{ ...cardStyle, margin: 0, display: 'flex', gap: 12, alignItems: 'center' }}>
                            <ShimmerLine width={36} height={36} radius={10} />
                            <div style={{ flex: 1, display: 'grid', gap: 8 }}>
                                <ShimmerLine width="60%" height={11} radius={6} />
                                <ShimmerLine width="40%" height={24} radius={8} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                <ShimmerLine width="28%" height={15} radius={8} />
                <div style={{ display: 'grid', gap: 8 }}>
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={`accomp-row-${index}`} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <ShimmerLine width="18%" height={12} />
                            <ShimmerLine width="100%" height={10} radius={999} />
                            <ShimmerLine width="44px" height={12} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function PageShimmerSkeleton({ variant = 'data' }) {
    return (
        <div style={containerStyle}>
            <style>{'@keyframes pageSkeletonShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}'}</style>
            {variant === 'dashboard' ? <DashboardSkeleton /> : variant === 'accomplishments' ? <AccomplishmentsSkeleton /> : <DataSkeleton />}
        </div>
    );
}
