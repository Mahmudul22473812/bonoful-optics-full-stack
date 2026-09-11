import type { Product } from "./catalog";
export function imagesForColour(product: Product, colour: string) {
  const match = product.images.filter(
    (image) =>
      image.color?.trim().toLowerCase() === colour.trim().toLowerCase(),
  );
  return match.length ? match : product.images.filter((image) => !image.color);
}

// Uploaded product files are already normalised to WebP by the API. Serving
// them directly also avoids Next's optimiser rejecting same-origin API routes.
export function isUploadedImage(url: string) {
  return url.startsWith("/api/v1/files/");
}
