import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(relativePath, dependencies, globals = {}) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    const output = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
        }
    }).outputText;
    const compiledModule = { exports: {} };
    vm.runInNewContext(output, {
        module: compiledModule, exports: compiledModule.exports, Error, setTimeout, clearTimeout, URL,
        process: { env: {} }, require: (name) => {
            assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
            return dependencies[name];
        }, ...globals,
    });
    return compiledModule.exports;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const webCapacitor = { isNativePlatform: () => false, getPlatform: () => "web" };

test("cook home shows push opt-in before availability even when profile lookup fails", async () => {
    const states = [];
    const effects = [];
    let stateIndex = 0;
    const client = {
        auth: { getUser: async () => ({ data: { user: { id: "cook-user" } }, error: null }) },
        from() {
            const query = {
                select() { return query; },
                eq() { return query; },
                maybeSingle: async () => ({ data: null, error: new Error("Profile unavailable") }),
            };
            return query;
        },
    };
    const element = (type, props) => ({ type, props });
    const component = load("../src/app/cook-home/page.tsx", {
        react: {
            useState(initial) {
                const index = stateIndex++;
                if (!(index in states)) states[index] = initial;
                return [states[index], (next) => { states[index] = next; }];
            },
            useRef: (initial) => ({ current: initial }),
            useEffect: (callback) => effects.push(callback),
        },
        "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
        "next/navigation": { useRouter: () => ({ push() {} }) },
        "lucide-react": {},
        "@/components/BottomNav": { default: "bottom-nav" },
        "@/components/CookPushOptIn": { default: "push-opt-in" },
        "@/lib/supabase/client": { getSupabaseBrowserClient: () => client },
        "@/lib/cook/availability": { setCookAvailability: async () => true },
        "@/lib/cook/use-language": { useCookLanguage: () => ({ language: "en", t: (text) => text }) },
    }).default;
    component();
    effects[0]();
    await tick();
    stateIndex = 0;
    const main = component().props.children[0];
    const children = main.props.children;
    const panelIndex = children.findIndex((child) => child?.type === "push-opt-in");
    const availabilityIndex = children.findIndex((child) => child?.props?.className?.startsWith("cook-availability"));
    assert.ok(panelIndex > 0 && panelIndex < availabilityIndex);
    assert.equal(children[panelIndex].props.userId, "cook-user");
});

test("web detects default, denied, granted and unsupported permission honestly", async () => {
    const notification = { permission: "default", requestPermission: () => Promise.resolve("granted") };
    const push = load("../src/lib/cook/push.ts", { "@capacitor/core": { Capacitor: webCapacitor } }, {
        Notification: notification, isSecureContext: true, navigator: { serviceWorker: {} }, PushManager: {},
    });
    assert.equal(await push.getPushPermission(), "prompt");
    notification.permission = "denied";
    assert.equal(await push.getPushPermission(), "denied");
    notification.permission = "granted";
    assert.equal(await push.getPushPermission(), "granted");
    const unsupported = load("../src/lib/cook/push.ts", { "@capacitor/core": { Capacitor: webCapacitor } });
    assert.equal(await unsupported.getPushPermission(), "unsupported");
});

test("registration dedupes per user, saves actual token and retries persistence failure", async () => {
    let acquisitions = 0;
    let saves = 0;
    let successful = false;
    const push = load("../src/lib/cook/push.ts", {
        "@capacitor/core": { Capacitor: webCapacitor },
        "@/lib/firebase": { async getWebPushToken() { acquisitions++; await tick(); return "actual-token"; } },
    }, {
        async fetch(_url, options) {
            saves++;
            assert.equal(options.headers.Authorization, "Bearer session-token");
            assert.deepEqual(JSON.parse(options.body), { push_token: "actual-token", platform: "web" });
            return { ok: successful, json: async () => successful ? { enabled: true } : { error: "secret" } };
        }
    });
    const client = { auth: { getSession: async () => ({ data: { session: { user: { id: "owner" }, access_token: "session-token" } }, error: null }) } };
    const first = push.registerCookPush(client, "owner");
    assert.equal(first, push.registerCookPush(client, "owner"));
    await assert.rejects(first, /Unable to save notification device/);
    successful = true;
    await push.registerCookPush(client, "owner");
    assert.equal(acquisitions, 2);
    assert.equal(saves, 2);
    await assert.rejects(push.registerCookPush(client, "different-user"), /Please sign in again/);
    assert.equal(saves, 2);
});

test("native installs listeners before register and removes them on success, error and timeout", async () => {
    for (const outcome of ["success", "error", "timeout", "throw"]) {
        const callbacks = {};
        const removed = [];
        let timeout;
        const plugin = {
            checkPermissions: async () => ({ receive: "granted" }),
            async addListener(name, callback) {
                callbacks[name] = callback;
                return { async remove() { removed.push(name); } };
            },
            async register() {
                assert.deepEqual(Object.keys(callbacks), ["registration", "registrationError"]);
                if (outcome === "success") callbacks.registration({ value: "native-token" });
                if (outcome === "error") callbacks.registrationError({ error: "secret" });
                if (outcome === "timeout") timeout();
                if (outcome === "throw") throw new Error("secret");
            },
        };
        const push = load("../src/lib/cook/push.ts", {
            "@capacitor/core": { Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" } },
            "@capacitor/push-notifications": { PushNotifications: plugin },
        }, { setTimeout(callback) { timeout = callback; return 1; }, clearTimeout() { } });
        if (outcome === "success") assert.equal(await push.getAndroidPushToken(false), "native-token");
        else await assert.rejects(push.getAndroidPushToken(false), outcome === "timeout" ? /timed out/ : /Unable to enable/);
        assert.deepEqual(removed, ["registration", "registrationError"]);
    }
});

test("Android permission is only requested through explicit opt-in", async () => {
    let prompts = 0;
    const plugin = {
        checkPermissions: async () => ({ receive: "prompt" }),
        requestPermissions: async () => { prompts++; return { receive: "denied" }; },
    };
    const push = load("../src/lib/cook/push.ts", {
        "@capacitor/core": { Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" } },
        "@capacitor/push-notifications": { PushNotifications: plugin },
    });
    assert.equal(await push.getPushPermission(), "prompt");
    assert.equal(prompts, 0);
    await assert.rejects(push.getAndroidPushToken(false), /blocked/);
    assert.equal(prompts, 0);
    await assert.rejects(push.getAndroidPushToken(true), /blocked/);
    assert.equal(prompts, 1);
});

test("web token waits for activation and shares exact public config with worker", async () => {
    const worker = { state: "installing", addEventListener(_name, callback) { this.listener = callback; }, removeEventListener() { } };
    let tokenCalls = 0;
    const firebase = load("../src/lib/firebase.ts", {
        "firebase/app": { getApps: () => [], initializeApp: (config) => config },
        "firebase/messaging": {
            isSupported: async () => true, getMessaging: (app) => app,
            async getToken(_messaging, options) { assert.equal(options.vapidKey, "public-test-vapid"); tokenCalls++; return "web-token"; }
        },
    }, {
        process: { env: { NEXT_PUBLIC_FIREBASE_VAPID_KEY: "public-test-vapid" } },
        navigator: {
            serviceWorker: {
                async register(url) {
                    assert.deepEqual(JSON.parse(new URL(url, "https://example.invalid").searchParams.get("config")), JSON.parse(JSON.stringify(firebase.firebaseConfig)));
                    return { installing: worker, active: { state: "activated" } };
                }
            }
        },
    });
    const result = firebase.getWebPushToken();
    await tick();
    assert.equal(tokenCalls, 0);
    worker.state = "activated";
    worker.listener();
    assert.equal(await result, "web-token");
    assert.equal(tokenCalls, 1);
});

test("background notification payload displays once; data-only displays manually", async () => {
    let callback;
    const displayed = [];
    vm.runInNewContext(readFileSync(new URL("../public/firebase-messaging-sw.js", import.meta.url), "utf8"), {
        importScripts() { }, URL,
        self: { addEventListener() { }, location: { href: "https://example.invalid/firebase-messaging-sw.js?config=%7B%7D" }, registration: { showNotification: async (...args) => displayed.push(args) } },
        firebase: { initializeApp() { }, messaging: () => ({ onBackgroundMessage(next) { callback = next; } }) },
    });
    await callback({ notification: { title: "Already displayed by FCM" } });
    assert.equal(displayed.length, 0);
    await callback({ data: { title: "Booking", body: "Request" } });
    assert.equal(displayed.length, 1);
    assert.equal(displayed[0][0], "Booking");
});

function createUI(permission, fails = false) {
    const states = [];
    const refs = [];
    const effects = [];
    let stateIndex = 0;
    let refIndex = 0;
    const events = [];
    const react = {
        useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = initial; return [states[index], (next) => { states[index] = next; }]; },
        useRef(initial) { const index = refIndex++; refs[index] ??= { current: initial }; return refs[index]; },
        useEffect(callback) { if (!effects.length) effects.push(callback); },
    };
    const element = (type, props) => ({ type, props });
    const component = load("../src/components/CookPushOptIn.tsx", {
        react, "react/jsx-runtime": { jsx: element, jsxs: element }, "lucide-react": { Bell: "bell" },
        "@/lib/cook/push": {
            getPushPermission: async () => permission,
            isNativePush: () => false,
            requestWebPushPermission() { events.push("permission-request"); return Promise.resolve("granted"); },
            async registerCookPush() { events.push("register"); if (fails) throw new Error("Unable to save notification device."); },
        },
    }).default;
    const render = () => { stateIndex = 0; refIndex = 0; return component({ client: {}, userId: "owner", t: (text) => text }); };
    return { render, effects, events };
}

test("opt-in UI requests web permission synchronously on click and enables only after save", async () => {
    for (const fails of [false, true]) {
        const ui = createUI("prompt", fails);
        ui.render();
        ui.effects[0]();
        await tick();
        assert.equal(ui.events.length, 0);
        const button = ui.render().props.children[1];
        button.props.onClick();
        assert.deepEqual(ui.events, ["permission-request"]);
        await tick();
        const rendered = ui.render();
        assert.equal(rendered.props.children[0].props.children[2], fails ? "Booking notifications" : "Notifications enabled");
        assert.equal(Boolean(rendered.props.children[2]), fails);
    }
});

test("UI automatically registers granted permission and gives denied/unsupported guidance", async () => {
    for (const permission of ["granted", "denied", "unsupported"]) {
        const ui = createUI(permission);
        ui.render();
        ui.effects[0]();
        await tick();
        const rendered = ui.render();
        assert.deepEqual(ui.events, permission === "granted" ? ["register"] : []);
        assert.equal(rendered.props.children[1], false);
        assert.match(rendered.props.children[0].props.children[2], permission === "granted" ? /enabled/ : permission === "denied" ? /settings/ : /not supported/);
    }
});