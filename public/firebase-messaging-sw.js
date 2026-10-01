importScripts(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"
);

importScripts(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"
);

firebase.initializeApp({
    apiKey: "AIzaSyCMuxrus6QjXhzxbTM3TSIA7l-Q1r8Yob0",
    authDomain: "vantavaru.firebaseapp.com",
    projectId: "vantavaru",
    storageBucket: "vantavaru.firebasestorage.app",
    messagingSenderId: "192660516815",
    appId: "1:192660516815:web:bff4f6fb3e4f768cae6cba",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log(
        "[firebase-messaging-sw.js] Background message:",
        payload
    );

    const notificationTitle =
        payload.notification?.title || "New Vantavaru Booking";

    const notificationOptions = {
        body:
            payload.notification?.body ||
            "You have a new cooking request.",
        icon: "/icon-192.png",
        data: payload.data || {},
    };

    self.registration.showNotification(
        notificationTitle,
        notificationOptions
    );
});