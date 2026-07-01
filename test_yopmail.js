const { getYopmailAlias } = require('./lib/yopmail');

(async () => {
    try {
        console.log("Starting test...");
        const url = "https://yopmail.com?trusty-funjrqhe-025x";
        const result = await getYopmailAlias(url, true, 3);
        console.log("Result:", result);
    } catch (e) {
        console.error("Error:", e.message);
    }
})();
