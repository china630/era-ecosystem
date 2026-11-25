/* ERA CRM webchat widget. Embed:
 * <script src="/widget.js" data-public-id="CONNECTION_PUBLIC_ID" data-secret="WEBHOOK_SECRET" data-base=""></script>
 * URL must use IntegrationConnection.publicId (TZ), not a free-form formKey.
 * Captcha: fetches /challenge then prompts for a+b (P1-5).
 */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var base = s.getAttribute("data-base") || "";
  var publicId = s.getAttribute("data-public-id") || "";
  var secret = s.getAttribute("data-secret") || "";
  if (!publicId) {
    console.warn("[era-webchat] data-public-id required");
    return;
  }
  var hookBase =
    base +
    "/api/integrations/hooks/webchat/" +
    encodeURIComponent(publicId);

  var btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Chat";
  btn.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:9999;padding:10px 14px;border-radius:8px;";
  btn.onclick = function () {
    var text = window.prompt("Message");
    if (!text) return;
    fetch(hookBase + "/challenge", { method: "GET", credentials: "omit" })
      .then(function (r) {
        return r.json();
      })
      .then(function (ch) {
        if (!ch || typeof ch.a !== "number" || !ch.token) {
          throw new Error("challenge");
        }
        var ans = window.prompt("Captcha: " + ch.a + " + " + ch.b + " = ?");
        if (ans == null || ans === "") return;
        var headers = {
          "content-type": "application/json",
          "x-era-widget": "1",
        };
        if (secret) headers["x-webhook-secret"] = secret;
        return fetch(hookBase, {
          method: "POST",
          headers: headers,
          body: JSON.stringify({
            text: text,
            name: "webchat",
            chatId: "web-" + Date.now(),
            challengeToken: ch.token,
            challengeAnswer: Number(ans),
          }),
        });
      })
      .catch(function () {});
  };
  document.body.appendChild(btn);
})();
