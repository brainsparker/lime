// Test-only: observe the installed Electron permission-check policy without
// reading clipboard content or replacing either native permission handler.
export async function runMainWindowClipboardPermissionQueryGate(page) {
  const facts = await page.evaluate(async () => {
    const query = async (target) => ({
      secureContext: target.isSecureContext === true,
      write: (
        await target.navigator.permissions.query({ name: "clipboard-write" })
      ).state,
      read: (
        await target.navigator.permissions.query({ name: "clipboard-read" })
      ).state,
    });
    const mainFrame = await query(window);
    const iframe = document.createElement("iframe");
    iframe.hidden = true;
    iframe.src = "about:blank";
    let childFrame;
    try {
      document.body.append(iframe);
      childFrame = await query(iframe.contentWindow);
    } finally {
      iframe.remove();
    }
    return {
      mode: "native-permissions-api-query",
      mainFrame,
      childFrame,
      childFrameRemoved: !iframe.isConnected,
    };
  });
  const valid =
    facts?.mode === "native-permissions-api-query" &&
    facts.mainFrame?.secureContext === true &&
    facts.mainFrame.write === "granted" &&
    facts.mainFrame.read === "denied" &&
    facts.childFrame?.secureContext === true &&
    facts.childFrame.write === "denied" &&
    facts.childFrame.read === "denied" &&
    facts.childFrameRemoved === true;
  if (!valid) {
    const state = (value) =>
      ["granted", "denied", "prompt"].includes(value) ? value : "unknown";
    throw new Error(
      `Installed clipboard check policy failed: main=${state(facts?.mainFrame?.write)}/${state(facts?.mainFrame?.read)} child=${state(facts?.childFrame?.write)}/${state(facts?.childFrame?.read)} secure=${facts?.mainFrame?.secureContext === true}/${facts?.childFrame?.secureContext === true} removed=${facts?.childFrameRemoved === true}`,
    );
  }
  return {
    mode: "native-permissions-api-query",
    mainFrame: { secureContext: true, write: "granted", read: "denied" },
    childFrame: { secureContext: true, write: "denied", read: "denied" },
    childFrameRemoved: true,
    requestPermissionClaim: false,
    clipboardContentRead: false,
  };
}
