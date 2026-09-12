import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { Product } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
const mock = vi.hoisted(() => ({
  addToCart: vi.fn(),
  toggleWishlist: vi.fn(),
  ready: true,
}));
vi.mock("@/components/commerce-provider", () => ({
  useCommerce: () => ({ ...mock, wishlist: [] }),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock("next/image", () => ({
  default: ({ fill, sizes, ...props }: any) => <img {...props} />,
}));
const product = {
  id: "p1",
  slug: "arden",
  name: "Arden",
  material: "Acetate",
  color: "Black",
  price: 4850,
  variantId: "v1",
  images: [],
  variants: [{ id: "v1", stock: 3 }],
} as unknown as Product;
beforeEach(() => {
  vi.clearAllMocks();
  mock.ready = true;
  mock.addToCart.mockResolvedValue(undefined);
});
test("adds the selected product and restores the action", async () => {
  render(<ProductCard product={product} />);
  fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
  await waitFor(() => expect(mock.addToCart).toHaveBeenCalledWith(product));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled(),
  );
});
test("out-of-stock products cannot be added", () => {
  render(
    <ProductCard
      product={{ ...product, variants: [{ ...product.variants[0], stock: 0 }] }}
    />,
  );
  expect(screen.getByRole("button", { name: "Out of stock" })).toBeDisabled();
});
test("multi-variant products ask customers to choose options", () => {
  render(
    <ProductCard
      product={{
        ...product,
        variants: [...product.variants, { ...product.variants[0], id: "v2" }],
      }}
    />,
  );
  expect(screen.getByRole("link", { name: /Choose options/ })).toHaveAttribute(
    "href",
    "/products/arden",
  );
  expect(
    screen.queryByRole("button", { name: "Add to cart" }),
  ).not.toBeInTheDocument();
});
test("waits for the shopping session before enabling purchase", () => {
  mock.ready = false;
  render(<ProductCard product={product} />);
  expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
});
test("failed add does not leave a permanently disabled action", async () => {
  mock.addToCart.mockRejectedValue(new Error("Unavailable"));
  render(<ProductCard product={product} />);
  fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled(),
  );
});
test("uses a second colour-matched photo as the stable hover image", () => {
  const images = [
    {
      id: "front",
      url: "/media/front.jpg",
      alt: "Black frame front",
      color: "Black",
    },
    {
      id: "side",
      url: "/media/side.jpg",
      alt: "Black frame side",
      color: "Black",
    },
  ];
  const { container } = render(
    <ProductCard
      product={{
        ...product,
        images,
        variants: [
          {
            ...product.variants[0],
            color: "Black",
            size: "Medium",
            price: 4850,
          },
        ] as Product["variants"],
      }}
    />,
  );
  expect(container.querySelector(".product-image")).toHaveClass(
    "has-alternate",
  );
  expect(container.querySelector(".product-photo-primary")).toHaveAttribute(
    "src",
    "/media/front.jpg",
  );
  expect(container.querySelector(".product-photo-alternate")).toHaveAttribute(
    "src",
    "/media/side.jpg",
  );
  const imageArea = container.querySelector(".product-image")!;
  expect(imageArea).not.toHaveClass("is-hovered");
  fireEvent.mouseEnter(imageArea);
  expect(imageArea).toHaveClass("is-hovered");
  fireEvent.mouseLeave(imageArea);
  expect(imageArea).not.toHaveClass("is-hovered");
});
test("colour selection updates the product link without navigation", () => {
  const variants = [
    { ...product.variants[0], color: "Black", size: "Medium", price: 4850 },
    {
      ...product.variants[0],
      id: "v2",
      color: "Gold",
      size: "Medium",
      price: 5100,
    },
  ] as Product["variants"];
  render(<ProductCard product={{ ...product, variants }} />);
  fireEvent.click(screen.getByRole("button", { name: "Select Gold" }));
  expect(screen.getByRole("link", { name: /Arden Acetate/ })).toHaveAttribute(
    "href",
    "/products/arden?colour=Gold",
  );
});
test("colour selection replaces the card photo with that colour's uploaded image", () => {
  const variants = [
    { ...product.variants[0], color: "Black", size: "Medium", price: 4850 },
    {
      ...product.variants[0],
      id: "v2",
      color: "Gold",
      size: "Medium",
      price: 5100,
    },
  ] as Product["variants"];
  const images = [
    { id: "black", url: "/api/v1/files/black", alt: "Black Ray-Ban", color: "Black" },
    { id: "gold", url: "/api/v1/files/gold", alt: "Gold Ray-Ban", color: "Gold" },
  ];
  const { container } = render(
    <ProductCard product={{ ...product, images, variants }} />,
  );
  expect(container.querySelector(".product-photo-primary")).toHaveAttribute(
    "src",
    "/api/v1/files/black",
  );
  fireEvent.click(screen.getByRole("button", { name: "Select Gold" }));
  expect(container.querySelector(".product-photo-primary")).toHaveAttribute(
    "src",
    "/api/v1/files/gold",
  );
});

test("colour selection resets hover and shows the selected colour primary image", () => {
  const variants = [
    { ...product.variants[0], color: "Black", size: "Medium", price: 4850 },
    { ...product.variants[0], id: "v2", color: "White", size: "Medium", price: 5100 },
  ] as Product["variants"];
  const images = [
    { id: "black-front", url: "/black-front.jpg", alt: "Black front", color: "Black" },
    { id: "black-side", url: "/black-side.jpg", alt: "Black side", color: "Black" },
    { id: "white-front", url: "/white-front.jpg", alt: "White front", color: "White" },
    { id: "white-side", url: "/white-side.jpg", alt: "White side", color: "White" },
  ];
  const { container } = render(
    <ProductCard product={{ ...product, images, variants }} />,
  );
  const imageArea = container.querySelector(".product-image")!;
  fireEvent.mouseEnter(imageArea);
  expect(imageArea).toHaveClass("is-hovered");

  fireEvent.click(screen.getByRole("button", { name: "Select White" }));

  expect(imageArea).not.toHaveClass("is-hovered");
  expect(container.querySelector(".product-photo-primary")).toHaveAttribute(
    "src",
    "/white-front.jpg",
  );
  expect(container.querySelector(".product-photo-alternate")).toHaveAttribute(
    "src",
    "/white-side.jpg",
  );
});

test("a single-image product remains stable while hovering", () => {
  const { container } = render(
    <ProductCard
      product={{
        ...product,
        images: [{ id: "only", url: "/only.jpg", alt: "Only view", color: "Black" }],
        variants: [
          { ...product.variants[0], color: "Black", size: "Medium", price: 4850 },
        ] as Product["variants"],
      }}
    />,
  );
  const imageArea = container.querySelector(".product-image")!;
  fireEvent.mouseEnter(imageArea);
  expect(container.querySelector(".product-photo-primary")).toHaveAttribute(
    "src",
    "/only.jpg",
  );
  expect(container.querySelector(".product-photo-alternate")).toBeNull();
});
