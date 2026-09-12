"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { api, errorMessage, send } from "@/lib/api";
import type { Facets } from "@/lib/catalog";
import { Alert } from "../ui";
import { Dialog } from "./dialog";
type EditVariant = {
  id?: string;
  sku: string;
  color: string;
  size: string;
  tone: string;
  price: number | null;
  salePrice: number | null;
  active: boolean;
};
export type EditableProduct = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  brandId: string;
  gender: string;
  shape: string;
  material: string;
  lens: string;
  measurements: string;
  prescriptionAllowed: boolean;
  featured: boolean;
  active: boolean;
  seoTitle?: string;
  seoDescription?: string;
  variants: EditVariant[];
  images: { url: string; alt: string; color?: string | null }[];
};
const newVariant = (): EditVariant => ({
  sku: "",
  color: "",
  size: "Medium",
  tone: "black",
  price: null,
  salePrice: null,
  active: true,
});
export function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product?: EditableProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [variants, setVariants] = useState<EditVariant[]>(
      product?.variants ?? [newVariant()],
    ),
    [images, setImages] = useState(product?.images ?? []),
    [uploadColour, setUploadColour] = useState(
      product?.variants.at(-1)?.color ?? "",
    ),
    [categoryId, setCategoryId] = useState(product?.categoryId ?? ""),
    [brandId, setBrandId] = useState(product?.brandId ?? ""),
    [facets, setFacets] = useState<Facets | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<Facets>("catalog/facets")
      .then(setFacets)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  function change(
    index: number,
    key: keyof EditVariant,
    value: string | number | boolean | null,
  ) {
    setVariants((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }
  return (
    <Dialog title={product ? "Edit product" : "New product"} onClose={onClose}>
      <form
        className="product-editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const seenVariants = new Set<string>();
          const duplicate = variants.find((variant) => {
            const key = `${variant.color.trim().toLocaleLowerCase()}::${variant.size.trim().toLocaleLowerCase()}`;
            if (seenVariants.has(key)) return true;
            seenVariants.add(key);
            return false;
          });
          if (duplicate) {
            setError(
              `${duplicate.color || "This colour"} in ${duplicate.size || "this size"} is listed more than once. Edit the existing row or choose a different size.`,
            );
            document
              .getElementById("product-variants")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          const invalidPrice = variants.find(
            (variant) => variant.price == null || variant.price < 100,
          );
          if (invalidPrice) {
            setError("Enter a regular price of at least ৳1.00 for every variant.");
            document
              .getElementById("product-variants")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          setBusy(true);
          const form = new FormData(e.currentTarget);
          const fields = Object.fromEntries(form);
          const payload = {
            name: fields.name,
            slug: fields.slug,
            description: fields.description,
            categoryId,
            brandId,
            gender: fields.gender,
            shape: fields.shape,
            material: fields.material,
            lens: fields.lens,
            measurements: fields.measurements,
            prescriptionAllowed: form.get("prescriptionAllowed") === "on",
            featured: form.get("featured") === "on",
            active: form.get("active") === "on",
            seoTitle: fields.seoTitle || undefined,
            seoDescription: fields.seoDescription || undefined,
            variants: variants.map((v) => ({
              id: v.id,
              sku: v.sku,
              color: v.color,
              size: v.size,
              tone: v.tone,
              price: v.price!,
              salePrice: v.salePrice,
              active: v.active,
            })),
            images: images.map((i) => ({
              url: i.url,
              alt: i.alt,
              color: i.color || null,
            })),
          };
          try {
            await send(
              product ? `admin/products/${product.id}` : "admin/products",
              payload,
              product ? "PATCH" : "POST",
            );
            onSaved();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div
          className="product-editor-guide"
          aria-label="Product editor sections"
        >
          <a href="#product-basics">
            <span>1</span>Basic details
          </a>
          <a href="#product-variants">
            <span>2</span>Colours & pricing
          </a>
          <a href="#product-images">
            <span>3</span>Product images
          </a>
          <a href="#product-search">
            <span>4</span>Search details
          </a>
        </div>
        <section className="product-editor-section" id="product-basics">
          <div className="product-editor-section-heading">
            <span>1</span>
            <div>
              <h3>Basic details</h3>
              <p>Name, category and frame information.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Name
              <input
                name="name"
                defaultValue={product?.name}
                required
                minLength={2}
              />
            </label>
            <label>
              URL slug
              <input
                name="slug"
                defaultValue={product?.slug}
                placeholder="arden-black"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
              />
            </label>
            <label>
              Category
              <select
                name="categoryId"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
              >
                <option value="">Choose category</option>
                {facets?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Brand
              <select name="brandId" value={brandId} onChange={(event) => setBrandId(event.target.value)} required>
                <option value="">Choose brand</option>
                {facets?.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="span-two">
              Description
              <textarea
                name="description"
                defaultValue={product?.description}
                required
                minLength={10}
                rows={4}
              />
            </label>
            <label>
              For
              <select name="gender" defaultValue={product?.gender ?? "Unisex"}>
                {["Unisex", "Women", "Men", "Kids"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {(["shape", "material", "lens", "measurements"] as const).map(
              (key) => (
                <label key={key}>
                  {key}
                  <input name={key} defaultValue={product?.[key]} required />
                </label>
              ),
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="prescriptionAllowed"
                defaultChecked={product?.prescriptionAllowed ?? true}
              />
              Accept prescriptions
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="active"
                defaultChecked={product?.active ?? true}
              />
              Active in storefront
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="featured"
                defaultChecked={product?.featured}
              />
              Featured product
            </label>
          </div>
        </section>
        <section className="product-editor-section" id="product-variants">
          <div className="product-editor-section-heading">
            <span>2</span>
            <div>
              <h3>Colours, sizes and pricing</h3>
              <p>Add one row for every colour and size customers can choose.</p>
            </div>
          </div>
          {variants.map((variant, i) => (
            <fieldset className="variant-editor" key={variant.id ?? i}>
              <legend>Variant {i + 1}</legend>
              <div className="form-grid">
                <label>
                  SKU
                  <input
                    value={variant.sku}
                    required
                    minLength={3}
                    onChange={(e) => change(i, "sku", e.target.value)}
                  />
                </label>
                <label>
                  Colour
                  <input
                    value={variant.color}
                    required
                    onChange={(e) => change(i, "color", e.target.value)}
                  />
                </label>
                <label>
                  Size
                  <input
                    value={variant.size}
                    required
                    onChange={(e) => change(i, "size", e.target.value)}
                  />
                </label>
                <label>
                  Price (৳)
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={variant.price == null ? "" : variant.price / 100}
                    required
                    onChange={(e) =>
                      change(
                        i,
                        "price",
                        e.target.value === ""
                          ? null
                          : Math.round(Number(e.target.value) * 100),
                      )
                    }
                  />
                </label>
                <label>
                  Sale price (৳, optional)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      variant.salePrice == null ? "" : variant.salePrice / 100
                    }
                    onChange={(e) =>
                      change(
                        i,
                        "salePrice",
                        e.target.value === ""
                          ? null
                          : Math.round(Number(e.target.value) * 100),
                      )
                    }
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={variant.active}
                    onChange={(e) => change(i, "active", e.target.checked)}
                  />
                  Available variant
                </label>
              </div>
              {variants.length > 1 && (
                <button
                  type="button"
                  className="link-button danger"
                  onClick={() =>
                    setVariants((v) => v.filter((_, index) => index !== i))
                  }
                >
                  Remove variant
                </button>
              )}
            </fieldset>
          ))}
          <button
            type="button"
            className="button button-outline"
            onClick={() => setVariants((v) => [...v, newVariant()])}
          >
            + Add another colour or size
          </button>
        </section>
        <section className="product-editor-section" id="product-images">
          <div className="product-editor-section-heading">
            <span>3</span>
            <div>
              <h3>Product images</h3>
              <p>
                Assign images to a colour. The first image becomes its main
                photo.
              </p>
            </div>
          </div>
          {!images.length && (
            <div className="product-image-empty">
              No images added yet. Choose a colour and upload the first photo
              below.
            </div>
          )}
          {images.map((image, i) => (
            <div className="form-row product-image-row" key={i}>
              <Image
                className="product-image-preview"
                src={image.url}
                alt={image.alt || `Product image ${i + 1}`}
                width={120}
                height={100}
              />
              <div className="product-image-position">
                <strong>{image.color || "All colours"}</strong>
                <small>
                  Image {i + 1}
                  {i === 0 ? " · Main image" : ""}
                </small>
              </div>
              <label>
                Image description
                <input
                  value={image.alt}
                  required
                  onChange={(e) =>
                    setImages((values) =>
                      values.map((v, index) =>
                        index === i ? { ...v, alt: e.target.value } : v,
                      ),
                    )
                  }
                />
                <small>{image.url}</small>
              </label>
              <label>
                Photo colour
                <select
                  value={image.color ?? ""}
                  onChange={(e) =>
                    setImages((values) =>
                      values.map((v, index) =>
                        index === i
                          ? { ...v, color: e.target.value || null }
                          : v,
                      ),
                    )
                  }
                >
                  <option value="">General photo (all colours)</option>
                  {[
                    ...new Set(variants.map((v) => v.color).filter(Boolean)),
                  ].map((colour) => (
                    <option key={colour}>{colour}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="link-button"
                onClick={() =>
                  setImages((values) =>
                    values.filter((_, index) => index !== i),
                  )
                }
              >
                Remove
              </button>
              {i > 0 && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    setImages((values) => {
                      const updated = [...values];
                      [updated[i - 1], updated[i]] = [
                        updated[i],
                        updated[i - 1],
                      ];
                      return updated;
                    })
                  }
                >
                  Move up
                </button>
              )}
            </div>
          ))}
          <div className="image-upload-panel">
            <label>
              Upload for colour
              <select
                value={uploadColour}
                onChange={(e) => setUploadColour(e.target.value)}
              >
                <option value="">General image (all colours)</option>
                {[...new Set(variants.map((v) => v.color).filter(Boolean))].map(
                  (colour) => (
                    <option key={colour}>{colour}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Add one or more images
              <input
                type="file"
                accept=".jpg,.jpeg,.jfif,.png,.webp,image/jpeg,image/png,image/webp"
                multiple
                disabled={busy}
                onChange={async (e) => {
                  const input = e.currentTarget;
                  const files = Array.from(input.files ?? []);
                  if (!files.length) return;
                  const oversized = files.find(
                    (file) => file.size > 5 * 1024 * 1024,
                  );
                  if (oversized) {
                    setError(
                      `${oversized.name} is larger than 5 MB. Choose a smaller JPEG, PNG or WebP image.`,
                    );
                    input.value = "";
                    return;
                  }
                  setBusy(true);
                  setError("");
                  setNotice("");
                  try {
                    const uploaded = [] as { url: string; alt: string; color: string | null }[];
                    for (const file of files) {
                      const form = new FormData();
                      form.set("file", file);
                      form.set("purpose", "product");
                      const result = await api<{ url: string }>("files", {
                        method: "POST",
                        body: form,
                      });
                      uploaded.push({
                        url: result.url,
                        alt: `${uploadColour || "General"} ${product?.name ?? "optical frame"}`,
                        color: uploadColour || null,
                      });
                    }
                    setImages((values) => [
                      ...values,
                      ...uploaded,
                    ]);
                    if (uploadColour) {
                      setVariants((values) =>
                        values.map((variant) =>
                          variant.color.trim().toLowerCase() ===
                          uploadColour.trim().toLowerCase()
                            ? { ...variant, active: true }
                            : variant,
                        ),
                      );
                    }
                    setNotice(
                      `${uploaded.length} ${uploaded.length === 1 ? "image" : "images"} added for ${uploadColour || "all colours"}.${uploadColour ? ` ${uploadColour} is enabled for customers.` : ""} Select Save product to publish ${uploaded.length === 1 ? "it" : "them"}.`,
                    );
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    input.value = "";
                    setBusy(false);
                  }
                }}
              />
            </label>
            <p className="small-note span-two">
              Choose the matching colour before uploading. Each colour can have
              several images, and all of them will appear in its product
              gallery.
            </p>
          </div>
          {notice && (
            <p className="success-message" role="status">
              {notice}
            </p>
          )}
        </section>
        <section className="product-editor-section" id="product-search">
          <div className="product-editor-section-heading">
            <span>4</span>
            <div>
              <h3>Search details</h3>
              <p>Optional text used by search engines.</p>
            </div>
          </div>
          <label>
            SEO title
            <input
              name="seoTitle"
              defaultValue={product?.seoTitle}
              maxLength={70}
            />
          </label>
          <label>
            SEO description
            <textarea
              name="seoDescription"
              defaultValue={product?.seoDescription}
              maxLength={180}
            />
          </label>
          <p className="small-note">
            New variants start with zero stock. Receive stock or record an
            adjustment after saving.
          </p>
        </section>
        {error && <Alert>{error}</Alert>}
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-outline"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button button-dark" disabled={busy || !facets}>
            {busy ? "Saving…" : "Save product"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
