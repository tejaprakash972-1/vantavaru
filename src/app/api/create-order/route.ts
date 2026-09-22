import { NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST() {
    try {
        const order = await razorpay.orders.create({
            amount: 2500, // ₹25 in paise
            currency: "INR",
            receipt: `vantavaru_${Date.now()}`,
        });
        console.log("Order....", order);

        const response = {
            success: true,
            order,
        };
        console.log("Create order response:", response);

        return NextResponse.json(response);
    } catch (error) {
        console.error("Razorpay order creation failed:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Unable to create payment order",
            },
            { status: 500 }
        );
    }
}
