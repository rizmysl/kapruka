import React, { useState } from 'react';

export const ImageWithFallback = ({ src, alt, className, fallback }: { src?: string, alt?: string, className?: string, fallback: React.ReactNode }) => {
    const [error, setError] = useState(false);
    if (!src || error) return <>{fallback}</>;
    return <img src={src} alt={alt} className={className} onError={() => setError(true)} />;
};
