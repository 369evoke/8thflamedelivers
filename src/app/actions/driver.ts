"use server";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { assertDriver, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { BookingError, recordEvent } from "@/lib/shipment-service";
import { DRIVER_SETTABLE, isShipmentStatus } from "@/lib/status";
import { normalizeTracking } from "@/lib/identifiers";
import { audit } from "@/lib/audit";
import type { FormState } from "./auth";

async function guard(shipmentId: string) {
  const d = await assertDriver();
  const { count } = await createAdminClient()
    .from("shipment_assignments")
    .select("id", { count: "exact", head: true })
    .eq("shipment_id", shipmentId)
    .eq("driver_id", d.driverId)
    .eq("is_active", true);
  if (!count) throw new AuthError("This shipment isn't assigned to you.");
  return d;
}

function fail(e: unknown): FormState {
  if (e instanceof AuthError || e instanceof BookingError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

export async function driverStatusAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const id = String(fd.get("shipment_id"));
    const status = String(fd.get("status"));
    const d = await guard(id);
    if (!isShipmentStatus(status) || !DRIVER_SETTABLE.includes(status) || status === "delivered") return { error: "Use the delivery form to complete a delivery." };

    // Scan check: when a barcode value is submitted it must match this shipment
    const scanned = String(fd.get("scanned") ?? "").trim();
    if (scanned) {
      const { data } = await createAdminClient().from("shipments").select("tracking_number").eq("id", id).single();
      if (normalizeTracking(scanned) !== data?.tracking_number) return { error: "Scanned barcode doesn't match this shipment." };
    }
    const notes = String(fd.get("notes") ?? "").trim().slice(0, 1000) || null;
    if (["delivery_attempted", "exception", "delayed"].includes(status) && !notes) return { error: "Please add a short note explaining what happened." };

    await recordEvent(id, status, { actor: d, location: String(fd.get("location") ?? "").slice(0, 120) || null, notes: status === "exception" ? "An issue was reported with this shipment." : notes, internalNotes: status === "exception" ? notes : null });
    if (status === "picked_up") await createAdminClient().from("route_stops").update({ completed_at: new Date().toISOString() }).eq("shipment_id", id).eq("stop_type", "pickup");
    await audit(d, "driver.status", "shipment", id, { status, scanned: !!scanned });
    revalidatePath(`/driver/shipments/${id}`);
    revalidatePath("/driver");
    return { success: "Status updated." };
  } catch (e) {
    return fail(e);
  }
}

const IMG = ["image/jpeg", "image/png", "image/webp"];

export async function completeDeliveryAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const id = String(fd.get("shipment_id"));
    const d = await guard(id);
    const recipient = String(fd.get("recipient_name") ?? "").trim();
    if (recipient.length < 2) return { error: "Enter the name of the person who received the package." };
    if (fd.get("confirm") !== "on") return { error: "Confirm the package was handed over or left securely." };

    const admin = createAdminClient();
    const { data: s } = await admin.from("shipments").select("tracking_number, shipment_packages(special_handling)").eq("id", id).single();
    const needsSig = (s?.shipment_packages ?? []).some((p: { special_handling: string[] }) => p.special_handling.includes("signature_required"));

    let photoPath: string | null = null;
    const photo = fd.get("photo");
    if (photo instanceof File && photo.size > 0) {
      if (!IMG.includes(photo.type) || photo.size > 8 * 1024 * 1024) return { error: "Photo must be a JPG/PNG/WEBP under 8 MB." };
      photoPath = `${id}/photo-${randomUUID()}.${photo.type.split("/")[1]}`;
      const { error } = await admin.storage.from("proof-of-delivery").upload(photoPath, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type });
      if (error) return { error: "Photo upload failed. Try again." };
    }

    let sigPath: string | null = null;
    const sig = String(fd.get("signature") ?? "");
    if (sig.startsWith("data:image/png;base64,")) {
      const buf = Buffer.from(sig.split(",")[1], "base64");
      if (buf.length > 2 * 1024 * 1024) return { error: "Signature image too large." };
      sigPath = `${id}/signature-${randomUUID()}.png`;
      const { error } = await admin.storage.from("proof-of-delivery").upload(sigPath, buf, { contentType: "image/png" });
      if (error) return { error: "Signature upload failed. Try again." };
    }
    if (needsSig && !sigPath) return { error: "This shipment requires a recipient signature." };

    await recordEvent(id, "delivered", {
      actor: d,
      location: String(fd.get("location") ?? "").slice(0, 120) || null,
      notes: String(fd.get("notes") ?? "").trim().slice(0, 500) || null,
      pod: { recipientName: recipient, photoPath, signaturePath: sigPath },
    });
    await admin.from("route_stops").update({ completed_at: new Date().toISOString() }).eq("shipment_id", id).eq("stop_type", "delivery");
    await admin.from("shipment_assignments").update({ is_active: false }).eq("shipment_id", id).eq("driver_id", d.driverId);
    await audit(d, "driver.delivered", "shipment", id, { photo: !!photoPath, signature: !!sigPath });
    revalidatePath("/driver");
    return { success: "Delivery completed. Proof of delivery saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function availabilityAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const d = await assertDriver();
    await createAdminClient()
      .from("drivers")
      .update({ is_available: fd.get("is_available") === "on", availability_notes: String(fd.get("availability_notes") ?? "").slice(0, 500) })
      .eq("id", d.driverId);
    revalidatePath("/driver/availability");
    return { success: "Availability updated." };
  } catch (e) {
    return fail(e);
  }
}
