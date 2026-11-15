const express = require("express");
const HttpError = require("../utils/httpError");
const { unwrap } = require("../utils/db");
const { parseId } = require("../utils/validate");
const { createRateLimiter } = require("../utils/rateLimit");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseMessage(body) {
    const input = body && typeof body === "object" ? body : {};
    const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

    const name = text(input.name, 80);
    const email = text(input.email, 120).toLowerCase();
    const topic = text(input.topic, 80) || "Other";
    const message = text(input.message, 2000);

    if (!name) throw new HttpError(400, "Please enter your name");
    if (!EMAIL.test(email)) throw new HttpError(400, "Please enter a valid email address");
    if (message.length < 5) throw new HttpError(400, "Please write a message");

    return { name, email, topic, message };
}

/** Public: the Contact page form posts here. No login needed. */
function contactRouter(supabase) {
    const router = express.Router();

    // 5 messages per hour from one address
    const allow = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

    router.post("/", async (req, res) => {
        // Hidden form field that real people leave empty; bots fill it in
        if (req.body && req.body.website) {
            return res.status(201).json({ message: "Message sent" });
        }

        if (!allow(req.ip)) {
            throw new HttpError(429, "You've sent a few messages already. Please try again later.");
        }

        const entry = parseMessage(req.body);

        unwrap(await supabase.from("contact_messages").insert([entry]), "Could not send your message");

        res.status(201).json({ message: "Thanks, your message has been sent." });
    });

    return router;
}

/** Admin only: read, mark and delete the messages. */
function messagesRouter(supabase) {
    const router = express.Router();

    router.get("/", async (req, res) => {
        const messages = unwrap(
            await supabase.from("contact_messages").select("*").order("created_at", { ascending: false }),
            "Failed to retrieve messages"
        );

        res.status(200).json({ messages });
    });

    router.patch("/:id", async (req, res) => {
        const id = parseId(req.params.id, "message ID");
        const isRead = req.body && req.body.is_read;

        if (typeof isRead !== "boolean") throw new HttpError(400, "is_read must be true or false");

        const rows = unwrap(
            await supabase.from("contact_messages").update({ is_read: isRead }).eq("id", id).select("id"),
            "Failed to update message"
        );

        if (!rows || rows.length === 0) throw new HttpError(404, "Message not found");

        res.status(200).json({ message: "Message updated" });
    });

    router.delete("/:id", async (req, res) => {
        const id = parseId(req.params.id, "message ID");

        unwrap(await supabase.from("contact_messages").delete().eq("id", id), "Failed to delete message");

        res.status(200).json({ message: "Message deleted" });
    });

    return router;
}

module.exports = { contactRouter, messagesRouter };
