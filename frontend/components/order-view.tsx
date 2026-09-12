"use client";
import { useState } from "react";
import Link from "next/link";
import type { Order } from "@/lib/orders";
import { money } from "@/lib/catalog";
import { errorMessage, send } from "@/lib/api";
import { Alert, Status } from "./ui";
import { useCommerce } from "./commerce-provider";
const next: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
};
const reachable = (current: string) => {
  const found: string[] = [];
  const visit = (value: string) =>
    (next[value] ?? []).forEach((candidate) => {
      if (!found.includes(candidate)) {
        found.push(candidate);
        visit(candidate);
      }
    });
  visit(current);
  return found;
};
export function OrderView({ order, onChange, admin = false }: { order: Order; onChange: () => void; admin?: boolean }) {
  const { user } = useCommerce();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [note, setNote] = useState(""),
    [tracking, setTracking] = useState(order.trackingNumber ?? ""),
    [restock, setRestock] = useState(false);
  const canUpdate = admin && user?.permissions.includes("orders.update");
  async function change(selectedStatus = "CANCELLED") {
    if (selectedStatus === "REFUNDED" && !note.trim()) {
      setError("Enter a refund reason before selecting Refunded.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await send(
        admin ? `admin/orders/${order.id}/status` : `orders/${order.id}/cancel`,
        admin
          ? {
              status: selectedStatus,
              note: note || undefined,
              trackingNumber: tracking || undefined,
              restock,
            }
          : {},
      );
      onChange();
      setConfirm(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="order-detail">
      <div className="order-heading">
        <div>
          <p className="eyebrow">{new Date(order.createdAt).toLocaleDateString("en-GB")}</p>
          <h1>{order.number}</h1>
        </div>
        <Status value={order.status} />
        <button className="button button-outline no-print" onClick={() => window.print()}>
          Print receipt
        </button>
      </div>
      <div className="order-columns">
        <div>
          <h2>Items</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Frame</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>
                        {item.sku} · {item.color} · {item.size}
                      </small>
                      {admin && item.prescriptionId && (
                        <Link className="text-link" href={`/admin/prescriptions/${item.prescriptionId}`}>
                          View prescription →
                        </Link>
                      )}
                    </td>
                    <td>{item.quantity}</td>
                    <td>{money(item.unitPrice * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Order history</h2>
          <ol className="timeline">
            {order.histories.map((h, i) => (
              <li key={i}>
                <strong>{h.status.replaceAll("_", " ").toLowerCase()}</strong>
                <span>{new Date(h.createdAt).toLocaleString("en-GB")}</span>
                {h.note && <p>{h.note}</p>}
              </li>
            ))}
          </ol>
        </div>
        <aside className="summary-card">
          <h2>Delivery details</h2>
          <p>
            {order.shippingAddress.name}
            <br />
            {order.shippingAddress.line1}
            <br />
            {order.shippingAddress.line2}
            <br />
            {order.shippingAddress.city} {order.shippingAddress.postalCode}
            <br />
            {order.shippingAddress.phone}
          </p>
          <p>{order.deliveryMethod === "pickup" ? "Store collection" : "Home delivery"}</p>
          {order.trackingNumber && <p>Tracking: {order.trackingNumber}</p>}
          <div>
            <span>Subtotal</span>
            <span>{money(order.subtotal)}</span>
          </div>
          <div>
            <span>Discount</span>
            <span>−{money(order.discount)}</span>
          </div>
          <div>
            <span>Delivery</span>
            <span>{money(order.shipping)}</span>
          </div>
          <div>
            <span>Tax</span>
            <span>{money(order.tax)}</span>
          </div>
          <div className="summary-total">
            <strong>Total</strong>
            <strong>{money(order.total)}</strong>
          </div>
          {order.payments.map((p) => (
            <p key={p.id}>
              {p.provider} · <Status value={p.status} />
            </p>
          ))}
          {!admin && ["PENDING", "CONFIRMED"].includes(order.status) && (
            <div className="no-print">
              <button className="button button-outline" disabled={busy} onClick={() => (confirm ? void change("CANCELLED") : setConfirm(true))}>
                {confirm ? "Confirm cancellation" : "Cancel order"}
              </button>
              {confirm && (
                <button className="link-button" onClick={() => setConfirm(false)}>
                  Keep order
                </button>
              )}
            </div>
          )}
          {error && <Alert>{error}</Alert>}
        </aside>
      </div>
      {canUpdate && reachable(order.status).length > 0 && (
        <section className="admin-action-form no-print">
          <h2>Update order</h2>
          <p className="small-note">Selecting a status saves it immediately and updates the customer’s order history.</p>
          <div className="form-grid">
            <label>
              Current status
              <select value={order.status} disabled={busy} onChange={(e) => void change(e.target.value)}>
                <option value={order.status} disabled>
                  {order.status}
                </option>
                {reachable(order.status)
                  .filter((s) => s !== "REFUNDED" || user?.permissions.includes("orders.refund"))
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </label>
            <label>
              Tracking reference
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={100} />
            </label>
            <label className="span-two">
              Customer-visible note
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional, except when issuing a refund" />
            </label>
            {user?.permissions.includes("orders.refund") && (
              <label className="checkbox-label span-two">
                <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
                Restock inspected items if Refunded is selected
              </label>
            )}
          </div>
          {busy && <p role="status">Updating order status…</p>}
        </section>
      )}
      {canUpdate && (
        <form
          className="admin-action-form no-print"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await send(
                `admin/orders/${order.id}/notes`,
                {
                  internalNote: new FormData(e.currentTarget).get("internalNote"),
                },
                "PATCH",
              );
              onChange();
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          <label>
            Internal note
            <textarea name="internalNote" defaultValue={order.internalNote} maxLength={2000} />
          </label>
          <button className="button button-outline">Save internal note</button>
        </form>
      )}
      {admin &&
        user?.permissions.includes("orders.refund") &&
        order.payments
          .flatMap((p) => p.refunds)
          .filter((r) => r.status === "REQUESTED")
          .map((refund) => (
            <div key={refund.id} className="admin-action-form no-print">
              <p>Cash refund pending: {money(refund.amount)}</p>
              <button
                className="button button-outline"
                onClick={async () => {
                  if (!window.confirm("Confirm the cash has been returned to the customer?")) return;
                  try {
                    await send(`admin/refunds/${refund.id}/settle`, {});
                    onChange();
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                Record cash repayment
              </button>
            </div>
          ))}
    </div>
  );
}
