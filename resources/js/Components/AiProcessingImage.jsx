import { Loader2 } from 'lucide-react';

const STYLES = `
    @keyframes aiScan {
        0% { top: -2px; }
        100% { top: calc(100% - 2px); }
    }
    @keyframes aiPulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
    }
    @keyframes aiGlow {
        0%, 100% { box-shadow: 0 0 8px 2px rgba(59,130,246,0.4); }
        50% { box-shadow: 0 0 16px 4px rgba(59,130,246,0.7); }
    }
`;

const SCAN_LINE_STYLE = {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #3b82f6, #60a5fa, #3b82f6, transparent)',
    animation: 'aiScan 1.8s linear infinite',
    pointerEvents: 'none',
    zIndex: 2,
};

const OVERLAY_STYLE = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(59,130,246,0.08)',
    borderRadius: '0.375rem',
    pointerEvents: 'none',
};

const LABEL_STYLE = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(59,130,246,0.85)',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '9999px',
    animation: 'aiPulse 1.5s ease-in-out infinite',
    pointerEvents: 'none',
    zIndex: 3,
    whiteSpace: 'nowrap',
};

export default function AiProcessingImage({
    src,
    alt,
    processing = false,
    className = '',
    label = 'Analyzing...',
    icon = null,
    onClick,
    children,
}) {
    return (
        <div className={`relative ${className}`}>
            {processing && <style>{STYLES}</style>}

            <img
                src={src}
                alt={alt}
                className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                style={processing ? {
                    animation: 'aiGlow 1.5s ease-in-out infinite',
                    borderColor: '#3b82f6',
                } : {}}
                onClick={onClick}
            />

            {processing && (
                <>
                    <div style={SCAN_LINE_STYLE} />
                    <div style={OVERLAY_STYLE} />
                    <div style={LABEL_STYLE}>
                        {icon || '✨'} {label}
                    </div>
                </>
            )}

            {children}
        </div>
    );
}
