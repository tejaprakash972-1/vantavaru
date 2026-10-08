import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadTypeScript(relativePath, dependencies = {}, environment = {}) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const compiledModule = { exports: {} };
    vm.runInNewContext(output, {
        module: compiledModule,
        exports: compiledModule.exports,
        process: { env: environment },
        require: (name) => {
            if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
            return dependencies[name];
        },
    });
    return compiledModule.exports;
}

const dictionary = loadTypeScript("../src/lib/cook/language.ts");

test("English remains the default and Hindi and Telugu translate cook controls", () => {
    assert.equal(dictionary.parseCookLanguage(undefined), "en");
    assert.equal(dictionary.parseCookLanguage("unsupported"), "en");
    assert.equal(dictionary.parseCookLanguage("hindi"), "hi");
    assert.equal(dictionary.parseCookLanguage("telugu"), "te");
    for (const language of ["hi", "te"]) {
        for (const phrase of ["My Profile", "App Language", "Service Areas", "Accept", "Reject", "Save & Continue"]) {
            assert.notEqual(dictionary.translateCook(language, phrase), phrase);
        }
    }
    assert.equal(dictionary.translateCook("en", "My Profile"), "My Profile");
    assert.equal(dictionary.translateCook("te", "Customer-entered content"), "Customer-entered content");
});

function createRoute() {
    const profiles = new Map([
        ["cook-one", { id: "profile-one", preferred_language: "en" }],
        ["cook-two", { id: "profile-two", preferred_language: "en" }],
    ]);
    const database = {
        from(table) {
            assert.equal(table, "cook_profiles");
            let values;
            let owner;
            const query = {
                select() { return query; },
                update(next) { values = next; return query; },
                eq(column, value) { assert.equal(column, "user_id"); owner = value; return query; },
                async maybeSingle() {
                    assert.ok(owner, "Query must constrain the authenticated user");
                    const profile = profiles.get(owner);
                    if (profile && values) Object.assign(profile, values);
                    return { data: profile ?? null, error: null };
                },
            };
            return query;
        },
    };
    const auth = {
        auth: {
            async getUser(token) {
                return token === "invalid"
                    ? { data: { user: null }, error: new Error("Invalid session") }
                    : { data: { user: { id: token } }, error: null };
            },
        },
    };
    const route = loadTypeScript("../src/app/api/cook/language/route.ts", {
        "@supabase/supabase-js": { createClient: (_url, key) => key === "service-key" ? database : auth },
        "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    }, {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-key",
    });
    return { route, profiles };
}

function request(method, owner, language) {
    const headers = { "Content-Type": "application/json" };
    if (owner) headers.Authorization = `Bearer ${owner}`;
    return new Request("https://example.invalid/api/cook/language", {
        method,
        headers,
        ...(method === "PUT" ? { body: JSON.stringify({ language }) } : {}),
    });
}

test("selected language persists for the authenticated cook only and loads on another request", async () => {
    const { route, profiles } = createRoute();
    for (const language of ["hi", "te", "en"]) {
        const response = await route.PUT(request("PUT", "cook-one", language));
        assert.equal(response.status, 200);
        assert.equal(profiles.get("cook-one").preferred_language, language);
        assert.equal(profiles.get("cook-two").preferred_language, "en");
        const loaded = await route.GET(request("GET", "cook-one"));
        assert.deepEqual(await loaded.json(), { language });
    }
});

test("invalid sessions, unsupported languages, and missing cook profiles cannot save", async () => {
    const { route, profiles } = createRoute();
    assert.equal((await route.PUT(request("PUT", null, "te"))).status, 401);
    assert.equal((await route.PUT(request("PUT", "invalid", "te"))).status, 401);
    assert.equal((await route.PUT(request("PUT", "cook-one", "fr"))).status, 400);
    assert.equal((await route.PUT(request("PUT", "customer", "te"))).status, 404);
    assert.equal(profiles.get("cook-one").preferred_language, "en");
});