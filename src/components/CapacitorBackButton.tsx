"use client";

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

export default function CapacitorBackButton() {
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const listener = App.addListener("backButton", ({ canGoBack }) => {
            if (canGoBack) {
                window.history.back();
                return;
            }

            void App.exitApp();
        });

        return () => {
            void listener.then((handle) => handle.remove());
        };
    }, []);

    return null;
}