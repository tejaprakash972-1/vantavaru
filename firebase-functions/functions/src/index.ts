import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

initializeApp();

export const sendTestNotification = onRequest(
    { region: "asia-south1" },
    async (request, response) => {
        try {
            if (request.method !== "POST") {
                response.status(405).json({
                    error: "Method not allowed",
                });
                return;
            }

            const { token } = request.body;

            if (!token) {
                response.status(400).json({
                    error: "FCM token is required",
                });
                return;
            }

            const message = {
                token,
                notification: {
                    title: "New Booking 🍳",
                    body: "A new cooking request is available in your area.",
                },
                data: {
                    type: "new_booking",
                    bookingId: "test-booking",
                },
            };

            const messageId = await getMessaging().send(message);

            response.status(200).json({
                success: true,
                messageId,
            });
        } catch (error) {
            console.error("FCM error:", error);

            response.status(500).json({
                success: false,
                error: String(error),
            });
        }
    }
);