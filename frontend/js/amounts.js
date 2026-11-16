/**
 * Keeps money amounts (₦12,500) in the site's original font while the rest of the text uses Roboto Mono.
 * It wraps each amount in <span class="amount"> as pages draw their tables, cards and messages.
 */
(function () {
    "use strict";

    // A ₦ followed by digits (₦12,500 or ₦12,500.00), or a lone ₦ such as in "Price (₦)"
    const MONEY = /₦\s?\d[\d,]*(?:\.\d+)?|₦/g;
    const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CANVAS", "NOSCRIPT"]);

    function wrapAmounts(textNode) {
        const text = textNode.nodeValue;

        if (!text || text.indexOf("₦") === -1) return;

        const parent = textNode.parentElement;

        if (!parent || SKIP.has(parent.tagName.toUpperCase()) || parent.closest(".amount")) return;

        const fragment = document.createDocumentFragment();
        let last = 0;
        let match;

        MONEY.lastIndex = 0;

        while ((match = MONEY.exec(text))) {
            if (match.index > last) {
                fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
            }

            const span = document.createElement("span");
            span.className = "amount";
            span.textContent = match[0];
            fragment.appendChild(span);

            last = match.index + match[0].length;
        }

        if (!fragment.hasChildNodes()) return;

        if (last < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(last)));
        }

        textNode.replaceWith(fragment);
    }

    function scan(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            wrapAmounts(node);
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const found = [];

        while (walker.nextNode()) found.push(walker.currentNode);

        found.forEach(wrapAmounts);
    }

    scan(document.body);

    new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === "characterData") {
                scan(mutation.target);
            } else {
                mutation.addedNodes.forEach(scan);
            }
        });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
