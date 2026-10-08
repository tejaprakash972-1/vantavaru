import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function createRoute({ failedTable, notificationFailure } = {}) {
    const events = [];
    const notifications = [];
    const client = {
        auth: { getUser: async () => ({ data: { user: { id: "customer-id" } }, error: null }) },
        from(table) {
            const result = () => {
                events.push(table);
                if (table === failedTable) return { data: null, error: new Error("Write failed") };
                if (table === "customer_addresses") return { data: { id: "address-id" }, error: null };
                if (table === "bookings") return { data: { id: "created-booking-id" }, error: null };
                if (table === "dishes") return { data: [{ id: "dish-id", name: "Idli", meal_type_id: "meal-id" }], error: null };
                return { data: null, error: null };
            };
            const query = {
                insert() { return query; },
                select() { return query; },
                eq() { return query; },
                in() { return query; },
                maybeSingle: async () => result(),
                single: async () => result(),
                then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
            };
            return query;
        },
        functions: {
            async invoke(name, options) {
                events.push("notification");
                notifications.push({ name, body: JSON.parse(JSON.stringify(options.body)) });
                if (notificationFailure === "throw") throw new Error("Network unavailable");
                return { error: notificationFailure === "error" ? new Error("Function rejected request") : null };
            },
        },
    };
    const dependencies = {
        "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
        crypto,
        "@supabase/supabase-js": { createClient: () => client },
    };
    const source = readFileSync(new URL("../src/app/api/verify-payment/route.ts", import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    const compiledModule = { exports: {} };
    vm.runInNewContext(outputText, {
        module: compiledModule,
        exports: compiledModule.exports,
        require: (name) => {
            assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
            return dependencies[name];
        },
        process: {
            env: {
                RAZORPAY_KEY_SECRET: "test-secret",
                NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
                SUPABASE_SERVICE_ROLE_KEY: "test-key",
            }
        },
        console: { log() { }, error() { } },
    });
    return { route: compiledModule.exports, notifications, events };
}

function bookingRequest({ withDishes = true, invalidPayment = false } = {}) {
    const signature = crypto.createHmac("sha256", "test-secret").update("order-id|payment-id").digest("hex");
    return new Request("https://example.invalid/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer customer-session" },
        body: JSON.stringify({
            razorpay_order_id: "order-id",
            razorpay_payment_id: "payment-id",
            razorpay_signature: invalidPayment ? "invalid" : signature,
            booking: {
                addressId: "address-id", date: "2026-10-10", time: "10:00", duration: "1 Hour",
                people: 2, price: 100, platformFee: 25, cookFee: 75,
                meals: ["meal-id"], dishes: withDishes ? { "meal-id": ["Idli"] } : {},
            },
        }),
    });
}

test("notifies with the created ID after all booking records are saved", async () => {
    const { route, notifications, events } = createRoute();
    const response = await route.POST(bookingRequest());
    assert.equal(response.status, 200);
    assert.deepEqual(notifications, [{ name: "notify-new-booking", body: { booking_id: "created-booking-id" } }]);
    assert.deepEqual(events, ["customer_addresses", "bookings", "booking_meals", "dishes", "booking_dishes", "notification"]);
});

test("notifies for a successful booking without selected dishes", async () => {
    const { route, notifications } = createRoute();
    assert.equal((await route.POST(bookingRequest({ withDishes: false }))).status, 200);
    assert.equal(notifications.length, 1);
});

test("does not notify when payment or booking creation fails", async () => {
    const invalid = createRoute();
    assert.equal((await invalid.route.POST(bookingRequest({ invalidPayment: true }))).status, 400);
    assert.equal(invalid.notifications.length, 0);
    for (const failedTable of ["bookings", "booking_meals", "dishes", "booking_dishes"]) {
        const { route, notifications } = createRoute({ failedTable });
        assert.equal((await route.POST(bookingRequest())).status, 500);
        assert.equal(notifications.length, 0);
    }
});

test("notification errors do not fail a successfully created booking", async () => {
    for (const notificationFailure of ["error", "throw"]) {
        const { route } = createRoute({ notificationFailure });
        const response = await route.POST(bookingRequest());
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { success: true, booking: { id: "created-booking-id" } });
    }
});