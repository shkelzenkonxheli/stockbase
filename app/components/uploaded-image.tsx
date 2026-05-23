type UploadedImageProps = {
  src: string;
  alt: string;
  className: string;
};

export function UploadedImage({ src, alt, className }: UploadedImageProps) {
  return (
    // Uploaded local files are rendered with a plain img to avoid Next image issues in dev/local storage flows.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );
}
