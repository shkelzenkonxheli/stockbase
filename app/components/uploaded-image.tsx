type UploadedImageProps = {
  src: string;
  alt: string;
  className: string;
  loading?: "eager" | "lazy";
  decoding?: "async" | "sync" | "auto";
  crossOrigin?: "anonymous" | "use-credentials";
};

export function UploadedImage({
  src,
  alt,
  className,
  loading,
  decoding,
  crossOrigin,
}: UploadedImageProps) {
  return (
    // Uploaded local files are rendered with a plain img to avoid Next image issues in dev/local storage flows.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      crossOrigin={crossOrigin}
    />
  );
}
