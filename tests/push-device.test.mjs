import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function createRoute(failure = "") {
    const devices = new Map();
    const database = {
        from(table) {
            if (table === "cook_devices") return {
                async upsert(device, options) {
                    assert.equal(options.onConflict, "push_token");
                    if (failure === "save") return { error: { message: "secret database details" } };
                    devices.set(device.push_token, device);
                    return { error: null };
                }
            };
            assert.equal(table, "cook_profiles");
            let owner;
            const query = {
                select() { return query; },
                eq(column, value) { assert.equal(column, "user_id"); owner = value; return query; },
                async maybeSingle() {
                    assert.equal(owner, "user-one");
                    return { data: failure === "missing" ? null : { id: "own-profile" }, error: failure === "profile" ? {} : null };
                },
            };
            return query;
        }
    };
    const dependencies = {
        "@supabase/supabase-js": {
            createClient: (_url, key) => key === "service" ? database : {
                auth: {
                    async getUser(token) {
                        return { data: { user: token === "valid" ? { id: "user-one" } : null }, error: null };
                    }
                }
            }
        },
        "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    };
    const compiledModule = { exports: {} };
    const output = ts.transpileModule(readFileSync(new URL("../src/app/api/cook/push-device/route.ts", import.meta.url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(output, {
        module: compiledModule, exports: compiledModule.exports,
        process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public", SUPABASE_SERVICE_ROLE_KEY: "service" } },
        require: (name) => dependencies[name],
    });
    return { devices, post: compiledModule.exports.POST };
}

function request(body, token = "valid") {
    return new Request("https://example.invalid/api/cook/push-device", {
        method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
    });
}

test("device registration derives ownership and preserves multiple devices", async () => {
    const { post, devices } = createRoute();
    for (const [push_token, platform] of [["first", "web"], ["second", "android"], ["first", "web"]]) {
        const response = await post(request({ push_token, platform, cook_profile_id: "someone-else" }));
        assert.equal(response.status, 200);
        assert.equal((await response.json()).enabled, true);
    }
    assert.equal(devices.size, 2);
    for (const device of devices.values()) {
        assert.equal(device.cook_profile_id, "own-profile");
        assert.equal(device.is_active, true);
        assert.ok(Date.parse(device.last_seen_at));
    }
});

test("registration rejects missing authentication, invalid tokens and invalid input", async () => {
    const { post, devices } = createRoute();
    assert.equal((await post(request({}, ""))).status, 401);
    assert.equal((await post(request({}, "invalid"))).status, 401);
    for (const body of [null, {}, { push_token: "", platform: "web" }, { push_token: "token", platform: "ios" }]) {
        assert.equal((await post(request(body))).status, 400);
    }
    assert.equal(devices.size, 0);
});

test("profile and persistence failures never return secret details or enabled", async () => {
    for (const failure of ["missing", "profile", "save"]) {
        const { post } = createRoute(failure);
        const response = await post(request({ push_token: "token", platform: "web" }));
        assert.equal(response.status, failure === "missing" ? 403 : 500);
        const body = await response.json();
        assert.equal(body.enabled, undefined);
        assert.ok(body.error);
        assert.ok(!body.error.includes("secret"));
    }
});