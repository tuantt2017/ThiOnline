'use client';

import React, { useState, useEffect } from 'react';

interface RewardImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackEmoji?: string;
  containerClassName?: string;
}

export function RewardImage({
  src,
  alt = 'Quà tặng',
  className = 'w-full h-full object-cover',
  fallbackEmoji = '🎁',
  containerClassName = '',
}: RewardImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string | null>(src || null);
  const [triedProxy, setTriedProxy] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    setCurrentSrc(src || null);
    setTriedProxy(false);
    setHasError(!src);
  }, [src]);

function getProxyUrl(url: string): string {
  let base = process.env.NEXT_PUBLIC_API_URL || '';
  if (typeof window !== 'undefined') {
    const isHttps = window.location.protocol === 'https:';
    const isLocalhostClient =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isHttps && base.startsWith('http://')) {
      base = '';
    } else if (!isLocalhostClient && (base.includes('127.0.0.1') || base.includes('localhost'))) {
      base = '';
    }
  }
  const cleanBase = base.replace(/\/api\/?$/, '').replace(/\/$/, '');
  return `${cleanBase}/api/v1/rewards/image-proxy?url=${encodeURIComponent(url)}`;
}

  const handleError = () => {
    if (!triedProxy && src && src.startsWith('http')) {
      // Automatic fallback to backend image proxy (omits referer headers)
      setTriedProxy(true);
      setCurrentSrc(getProxyUrl(src));
    } else {
      setHasError(true);
    }
  };

  if (hasError || !currentSrc) {
    return (
      <div className={`w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-slate-800 to-slate-900 text-cyan-400 select-none ${containerClassName}`}>
        {fallbackEmoji}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={handleError}
      className={className}
    />
  );
}
