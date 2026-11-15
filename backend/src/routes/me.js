const express = require("express");

module.exports = function meRouter() {
    const router = express.Router();

    // WHO AM I (used by the front-end to decide which pages to show)
    router.get("/", (req, res) => {
        const metadata = req.user.user_metadata || {};

        res.status(200).json({
            id: req.user.id,
            email: req.user.email,
            name: metadata.name || req.user.email,
            role: req.role
        });
    });

    return router;
};
