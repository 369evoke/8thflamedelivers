import { describe, expect, it, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");
let db: PGlite;
const ids = { alice: "11111111-1111-4111-8111-111111111111", bob: "22222222-2222-4222-8222-222222222222", driver: "33333333-3333-4333-8333-333333333333", dispatcher: "44444444-4444-4444-8444-444444444444", bizUser: "55555555-5555-4555-8555-555555555555" };

async function as(uid: string | null, fn: () => Promise<unknown>) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); select set_config('request.jwt.claim.role', 'authenticated', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false);`); }
}
const count = async (sql: string) => Number(((await db.query<{ n: number }>(sql)).rows[0] as { n: number }).n);

function shipmentSql(id: string, tn: string, owner: string | null, business: string | null = null) {
  return `insert into public.shipments (id, reference, tracking_number, customer_profile_id, business_id, service_code, status, payment_status, sender_name, sender_phone, sender_email, pickup_street, pickup_city, pickup_province, pickup_postal, pickup_date, pickup_window, recipient_name, recipient_phone, delivery_street, delivery_city, delivery_province, delivery_postal, distance_km, package_count, total_weight_kg, billable_weight_kg, price_breakdown, subtotal_cents, total_cents)
  values ('${id}', 'REF-${tn}', '${tn}', ${owner ? `'${owner}'` : "null"}, ${business ? `'${business}'` : "null"}, 'standard', 'confirmed', 'paid', 'S', '4165550100', 's@x.ca', '1 A St', 'Toronto', 'ON', 'M5V 1A1', current_date, '08:00-10:00', 'R', '4165550101', '2 B St', 'Hamilton', 'ON', 'L8P 1A1', 70, 1, 2, 2, '{}', 2000, 2260);`;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(path.join(root, "tests/supabase-stub.sql"), "utf8"));
  for (const f of readdirSync(path.join(root, "supabase/migrations")).sort()) await db.exec(readFileSync(path.join(root, "supabase/migrations", f), "utf8"));
  await db.exec(readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;`);
  for (const [k, id] of Object.entries(ids)) await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${id}', '${k}@example.com', '{"full_name":"${k}"}');`);
  await db.exec(`update public.profiles set role = 'driver' where id = '${ids.driver}'; update public.profiles set role = 'dispatcher' where id = '${ids.dispatcher}';`);
  await db.exec(`insert into public.drivers (id, profile_id, status) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '${ids.driver}', 'approved');`);
  await db.exec(`insert into public.businesses (id, name, email, contact_name, phone, address, city, province, status) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Acme', 'a@acme.ca', 'A', '1', '1 St', 'Toronto', 'ON', 'approved');
    insert into public.business_members (business_id, profile_id, member_role) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '${ids.bizUser}', 'member');`);
  await db.exec(shipmentSql("c1111111-1111-4111-8111-111111111111", "8F000000000011", ids.alice));
  await db.exec(shipmentSql("c2222222-2222-4222-8222-222222222222", "8F000000000022", ids.bob));
  await db.exec(shipmentSql("c3333333-3333-4333-8333-333333333333", "8F000000000033", null, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"));
  await db.exec(`insert into public.shipment_assignments (shipment_id, driver_id) values ('c2222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    insert into public.shipment_events (shipment_id, status, notes, is_public) values ('c1111111-1111-4111-8111-111111111111', 'confirmed', 'ok', true), ('c1111111-1111-4111-8111-111111111111', 'exception', 'staff only', false);`);
});

describe("database migrations", () => {
  it("creates all required tables", async () => {
    const required = ["profiles", "customers", "drivers", "driver_applications", "employees", "businesses", "business_members", "shipments", "shipment_packages", "shipment_events", "shipment_assignments", "delivery_routes", "route_stops", "pickup_schedules", "addresses", "service_areas", "shipping_services", "pricing_rules", "payments", "refunds", "invoices", "shipping_labels", "notifications", "support_tickets", "support_messages", "promo_codes", "audit_logs", "platform_settings"];
    const { rows } = await db.query<{ tablename: string }>(`select tablename from pg_tables where schemaname='public'`);
    const have = new Set(rows.map((r) => r.tablename));
    required.forEach((t) => expect(have.has(t), t).toBe(true));
  });
  it("enables RLS on every public table", async () => {
    expect(await count(`select count(*)::int n from pg_tables where schemaname='public' and not rowsecurity`)).toBe(0);
  });
  it("creates a profile and customer row on signup", async () => {
    expect(await count(`select count(*)::int n from public.profiles`)).toBe(5);
    expect(await count(`select count(*)::int n from public.customers`)).toBe(5);
  });
  it("seeds services but no active service areas", async () => {
    expect(await count(`select count(*)::int n from public.shipping_services`)).toBe(4);
    expect(await count(`select count(*)::int n from public.service_areas where is_active`)).toBe(0);
  });
  it("enforces constraints", async () => {
    await expect(db.exec(`insert into public.addresses (profile_id, contact_name, street, city, province, postal_code) values ('${ids.alice}', 'x', 'y', 'z', 'ON', 'BAD')`)).rejects.toThrow();
    await expect(db.exec(`insert into public.shipping_services (code, name, base_price_cents) values ('Bad Code', 'x', 1)`)).rejects.toThrow();
  });
});

describe("row level security", () => {
  it("customers only see their own shipments", async () => {
    await as(ids.alice, async () => {
      const { rows } = await db.query<{ tracking_number: string }>(`select tracking_number from public.shipments`);
      expect(rows.map((r) => r.tracking_number)).toEqual(["8F000000000011"]);
    });
  });
  it("customers don't see internal (non-public) events", async () => {
    await as(ids.alice, async () => expect(await count(`select count(*)::int n from public.shipment_events`)).toBe(1));
  });
  it("drivers only see assigned shipments", async () => {
    await as(ids.driver, async () => {
      const { rows } = await db.query<{ tracking_number: string }>(`select tracking_number from public.shipments`);
      expect(rows.map((r) => r.tracking_number)).toEqual(["8F000000000022"]);
    });
  });
  it("business members see only their business's shipments", async () => {
    await as(ids.bizUser, async () => {
      const { rows } = await db.query<{ tracking_number: string }>(`select tracking_number from public.shipments`);
      expect(rows.map((r) => r.tracking_number)).toEqual(["8F000000000033"]);
    });
  });
  it("dispatchers see operational data", async () => {
    await as(ids.dispatcher, async () => expect(await count(`select count(*)::int n from public.shipments`)).toBe(3));
  });
  it("anonymous users see nothing private", async () => {
    await as(null, async () => {
      expect(await count(`select count(*)::int n from public.shipments`)).toBe(0);
      expect(await count(`select count(*)::int n from public.profiles`)).toBe(0);
    });
  });
  it("users cannot write shipments directly", async () => {
    await as(ids.alice, async () => {
      await db.exec(`update public.shipments set status = 'delivered' where tracking_number = '8F000000000011'`);
    });
    expect(((await db.query<{ status: string }>(`select status from public.shipments where tracking_number='8F000000000011'`)).rows[0] as { status: string }).status).toBe("confirmed");
  });
  it("users cannot promote themselves to admin", async () => {
    await as(ids.alice, async () => {
      await expect(db.exec(`update public.profiles set role = 'super_admin' where id = '${ids.alice}'`)).rejects.toThrow(/Not permitted/);
    });
  });
  it("users can only read their own profile", async () => {
    await as(ids.alice, async () => expect(await count(`select count(*)::int n from public.profiles`)).toBe(1));
  });
  it("pricing rules and settings are hidden from customers", async () => {
    await as(ids.alice, async () => {
      expect(await count(`select count(*)::int n from public.pricing_rules`)).toBe(0);
      expect(await count(`select count(*)::int n from public.platform_settings`)).toBe(0);
    });
  });
});
