export function trustedProductImageKey(imagePath: string, productId: number, appFolder: string) {
  if (!imagePath.startsWith("/api/assets/")) return null;
  const segments = imagePath.slice("/api/assets/".length).split("/");
  try {
    const decoded = segments.map(decodeURIComponent);
    if (decoded.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\"))) return null;
    const key = decoded.join("/");
    return key.startsWith(`${appFolder}/products/${productId}/`) ? key : null;
  } catch {
    return null;
  }
}
