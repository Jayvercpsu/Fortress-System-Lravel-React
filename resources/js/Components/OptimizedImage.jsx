import { forwardRef } from 'react';

const OptimizedImage = forwardRef(function OptimizedImage(
    {
        loading = 'lazy',
        decoding = 'async',
        fetchPriority,
        priority = false,
        alt = '',
        ...props
    },
    ref
) {
    const resolvedLoading = priority ? 'eager' : loading;
    const resolvedFetchPriority = fetchPriority ?? (priority ? 'high' : 'auto');

    return (
        <img
            ref={ref}
            alt={alt}
            loading={resolvedLoading}
            decoding={decoding}
            fetchPriority={resolvedFetchPriority}
            {...props}
        />
    );
});

export default OptimizedImage;
