"use client";
import Link from "next/link";
import { imagesForColour, isUploadedImage } from "@/lib/product-images";
import { ProductColours } from "./product-colours";
import Image from "next/image";
import { useState } from "react";
import { HeartIcon } from "./icons";
import { useCommerce } from "./commerce-provider";
import { formatPrice, type Product } from "@/lib/catalog";
export function ProductCard({ product: original }: { product: Product }) {
  const photographedColour = original.images.find(
    (image) =>
      image.color &&
      original.variants.some(
        (variant) =>
          variant.color.trim().toLowerCase() ===
          image.color?.trim().toLowerCase(),
      ),
  )?.color;
  const [colour, setColour] = useState(
    photographedColour ?? original.color,
  );
  const [isImageHovered, setIsImageHovered] = useState(false);
  const v =
    original.variants.find((v) => v.color === colour && v.stock > 0) ??
    original.variants.find((v) => v.color === colour);
  const product = v
    ? {
        ...original,
        color: v.color,
        variantId: v.id,
        price: v.price,
        salePrice: v.salePrice,
        stock: v.stock,
        images: imagesForColour(original, colour),
      }
    : original;
  // Never show a photograph belonging to a different colour. If a colour has
  // no assigned image, its card should say so instead of misleading customers
  // with another variant's frame.
  const photos = product.images;
  const detailHref =
    "/products/" +
    product.slug +
    (product.color === original.color
      ? ""
      : `?colour=${encodeURIComponent(product.color)}`);
  const { wishlist, toggleWishlist, addToCart, ready } = useCommerce();
  const [adding, setAdding] = useState(false);
  const saved = wishlist.includes(product.id);
  const available = product.variants.some((v) => v.stock > 0);
  const sale = product.salePrice != null;
  return (
    <article className="product-card">
      <div className="product-visual">
        <Link
          href={detailHref}
          className={
            "product-image " +
            (photos[1] ? "has-alternate " : "") +
            (isImageHovered ? "is-hovered" : "")
          }
          onMouseEnter={() => setIsImageHovered(true)}
          onMouseLeave={() => setIsImageHovered(false)}
        >
          {(sale || product.isNew) && (
            <span className="tag">{sale ? "Sale" : "New"}</span>
          )}
          {photos[0] ? (
            <>
              <Image
                className="product-photo-primary"
                src={photos[0].url}
                alt={photos[0].alt}
                unoptimized={isUploadedImage(photos[0].url)}
                fill
                sizes="(max-width:560px) 48vw, (max-width:1000px) 33vw, 24vw"
              />
              {photos[1] && (
                <Image
                  className="product-photo-alternate"
                  src={photos[1].url}
                  alt=""
                  unoptimized={isUploadedImage(photos[1].url)}
                  fill
                  sizes="(max-width:560px) 48vw, (max-width:1000px) 33vw, 24vw"
                />
              )}
            </>
          ) : (
            <span>No image available</span>
          )}
        </Link>
        <button
          type="button"
          aria-label={
            (saved ? "Remove " : "Save ") +
            product.name +
            (saved ? " from wishlist" : " to wishlist")
          }
          aria-pressed={saved}
          className={"heart " + (saved ? "saved" : "")}
          onClick={() => void toggleWishlist(product.id).catch(() => {})}
        >
          <HeartIcon filled={saved} />
        </button>
      </div>
      <ProductColours
        product={original}
        selected={colour}
        onSelect={(selectedColour) => {
          setIsImageHovered(false);
          setColour(selectedColour);
        }}
      />
      <Link href={detailHref} className="product-meta">
        <div>
          <h3>{product.name}</h3>
          <p>
            {product.material} · {product.color}
          </p>
        </div>
        <div className="price-stack">
          <strong>{formatPrice(product.salePrice ?? product.price)}</strong>
          {sale && <s>{formatPrice(product.price)}</s>}
        </div>
      </Link>
      <div className="card-action">
        {product.variants.length > 1 ? (
          <Link className="button button-outline" href={detailHref}>
            Choose options <span>→</span>
          </Link>
        ) : (
          <button
            className="button button-outline"
            disabled={!ready || !available || adding}
            onClick={async () => {
              setAdding(true);
              try {
                await addToCart(product);
              } catch {
              } finally {
                setAdding(false);
              }
            }}
          >
            {adding ? "Adding…" : available ? "Add to cart" : "Out of stock"}
            {available && !adding && <span aria-hidden="true">+</span>}
          </button>
        )}
      </div>
    </article>
  );
}
