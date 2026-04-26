import { forwardRef, useEffect, useState } from 'react';

const SHIMMER_STYLE_ID = 'optimized-image-shimmer-style';
const SHIMMER_KEYFRAMES = `
@keyframes optimizedImageShimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}
`;

const ensureShimmerStyle = () => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(SHIMMER_STYLE_ID)) return;

    const styleEl = document.createElement('style');
    styleEl.id = SHIMMER_STYLE_ID;
    styleEl.textContent = SHIMMER_KEYFRAMES;
    document.head.appendChild(styleEl);
};

const OptimizedImage = forwardRef(function OptimizedImage(
    {
        loading = 'lazy',
        decoding = 'async',
        fetchPriority,
        priority = false,
        alt = '',
        style = {},
        className,
        onLoad,
        onError,
        ...props
    },
    ref
) {
    const [loaded, setLoaded] = useState(false);

    // For priority images, skip shimmer entirely and show immediately
    const skipShimmer = priority;

    useEffect(() => {
        ensureShimmerStyle();
    }, []);

    const handleLoad = (event) => {
        setLoaded(true);
        if (typeof onLoad === 'function') {
            onLoad(event);
        }
    };

    const handleError = (event) => {
        setLoaded(true);
        if (typeof onError === 'function') {
            onError(event);
        }
    };

    const resolvedLoading = priority ? 'eager' : loading;
    const resolvedFetchPriority = fetchPriority ?? (priority ? 'high' : 'auto');

    const { width, height, ...restStyle } = style ?? {};
    const baseClassName = className || '';
    const wrapperClassName = baseClassName ? `${baseClassName} optimized-image-wrapper` : 'optimized-image-wrapper';
    const skeletonAnimation = `optimizedImageShimmer 1.3s linear infinite`;
    const combinedAnimation =
        !loaded && !skipShimmer && restStyle.animation
            ? `${restStyle.animation}, ${skeletonAnimation}`
            : !loaded && !skipShimmer
                ? skeletonAnimation
                : restStyle.animation;

    // Always show with full opacity for priority images, shimmer otherwise
    const combinedStyle = {
        ...restStyle,
        display: restStyle.display ?? 'block',
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        opacity: skipShimmer || loaded ? 1 : 0.01,
        transition: skipShimmer ? 'none' : 'opacity 0.25s ease',
        animation: combinedAnimation,
        backgroundImage: skipShimmer || !loaded
            ? restStyle.backgroundImage
            : !loaded
                ? 'linear-gradient(90deg, rgba(239, 243, 248, 0.95) 0%, rgba(220, 227, 235, 0.95) 40%, rgba(239, 243, 248, 0.95) 100%)'
                : restStyle.backgroundImage,
        backgroundSize: !loaded && !skipShimmer ? '200% 100%' : restStyle.backgroundSize,
        backgroundPosition: !loaded && !skipShimmer ? '0 0' : restStyle.backgroundPosition,
        backgroundColor: !loaded && !skipShimmer ? restStyle.backgroundColor ?? 'var(--surface-2, #f5f6fb)' : restStyle.backgroundColor,
    };

    const skeletonBorderRadius = restStyle.borderRadius ?? 0;

    return (
        <span
            className={wrapperClassName}
            style={{
                display: 'inline-flex',
                position: 'relative',
                overflow: 'hidden',
                ...(width !== undefined ? { width } : {}),
                ...(height !== undefined ? { height } : {}),
            }}
        >
            {!loaded && !skipShimmer && (
                <span
                    aria-hidden
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                            'linear-gradient(90deg, rgba(239, 243, 248, 0.95) 0%, rgba(220, 227, 235, 0.95) 40%, rgba(239, 243, 248, 0.95) 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'optimizedImageShimmer 1.3s linear infinite',
                        pointerEvents: 'none',
                        borderRadius: skeletonBorderRadius,
                    }}
                />
            )}
            <img
                ref={ref}
                className={className}
                alt={alt}
                loading={resolvedLoading}
                decoding={decoding}
                fetchPriority={resolvedFetchPriority}
                onLoad={handleLoad}
                onError={handleError}
                {...props}
                style={combinedStyle}
            />
        </span>
    );
});

export default OptimizedImage;
