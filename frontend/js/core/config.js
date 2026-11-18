/**
 * App settings. Change values here instead of editing each page.
 *
 * The Supabase "publishable" key is meant to be public. Never put the
 * secret / service-role key in this file.
 */
// If the pages are opened from another local server (like VS Code Live Server), the API is
// on port 3000. Otherwise the backend is serving these pages and the API is at the same address.
const usingSeparateDevServer =
    ["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port !== "3000";

const CONFIG = Object.freeze({
    API_URL: usingSeparateDevServer ? "http://localhost:3000" : window.location.origin,
    SUPABASE_URL: "https://oqkopxleknoqmlfchjxt.supabase.co",
    SUPABASE_KEY: "sb_publishable_gWwh3zPPncyDM0y45aWiYA_41ih3qH6",
    LOCALE: "en-NG",
    CURRENCY: "₦",

    // Shown on the About, Contact and Support pages. Replace with your real details.
    SITE: {
        name: "Chidosky Electronics",
        email: "support@example.com",
        phone: "+234 800 000 0000",
        address: "Your shop address, City, Nigeria",
        hours: "Mon - Sat, 8:00am - 6:00pm"
    }
});
