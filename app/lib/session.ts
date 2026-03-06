export async function getSessionToken() {
  if (typeof window === "undefined") return null;

  if (!window.shopify) {
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (window.shopify) {
          clearInterval(interval);
          resolve(true);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(interval);
        resolve(false);
      }, 2000);
    });
  }

  if (window.shopify) {
    try {
      if (window.shopify.idToken) {
        return await window.shopify.idToken();
      }
    } catch (e) {
      console.error("Failed to get session token:", e);
    }
  }
  return null;
}
