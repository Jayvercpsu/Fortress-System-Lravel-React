import { Settings } from 'lucide-react';
import { useState } from 'react';
import OptimizedImage from './OptimizedImage';

const DEFAULT_LOGO_PATH = '/images/logo.jpg';

export default function BrandIcon({
    size = 36,
    borderRadius = 8,
    background = '#1b8a7a',
    imagePath = DEFAULT_LOGO_PATH,
    priority = false,
}) {
    const [hasImageError, setHasImageError] = useState(false);

    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius,
                background,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            {!hasImageError ? (
                <OptimizedImage
                    src={imagePath}
                    alt="Fortress logo"
                    priority={priority}
                    onError={() => setHasImageError(true)}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                    }}
                />
            ) : (
                <Settings size={Math.max(16, Math.floor(size * 0.5))} strokeWidth={2.25} color="#fff" />
            )}
        </div>
    );
}
