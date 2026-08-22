import { expect, test, type Locator } from "@playwright/test";

interface LayoutGeometry {
  chatBottom: number;
  chatHeight: number;
  chatIsLayeredAboveScreen: boolean;
  chatLeft: number;
  chatRight: number;
  chatTop: number;
  messagesFlex: string;
  screenBorderStyle: string;
  screenBottom: number;
  screenLeft: number;
  screenRight: number;
  screenTop: number;
}

async function getLayoutGeometry(screen: Locator, liveChat: Locator): Promise<LayoutGeometry> {
  const messageLog = liveChat.getByRole("log");
  const [screenRect, chatRect, screenBorderStyle, chatIsLayeredAboveScreen, messagesFlex] = await Promise.all([
    screen.boundingBox(),
    liveChat.boundingBox(),
    screen.evaluate((element) => getComputedStyle(element).borderStyle),
    liveChat.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const topElement = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return topElement != null && element.contains(topElement);
    }),
    messageLog.evaluate((element) => getComputedStyle(element).flexGrow)
  ]);

  if (screenRect == null || chatRect == null) throw new Error("Expected screen and chat elements");

  return {
    chatBottom: chatRect.y + chatRect.height,
    chatHeight: chatRect.height,
    chatIsLayeredAboveScreen,
    chatLeft: chatRect.x,
    chatRight: chatRect.x + chatRect.width,
    chatTop: chatRect.y,
    messagesFlex,
    screenBorderStyle,
    screenBottom: screenRect.y + screenRect.height,
    screenLeft: screenRect.x,
    screenRight: screenRect.x + screenRect.width,
    screenTop: screenRect.y
  };
}

test.describe("screen-camera layout", () => {
  test("layers a full-height chat panel over the dashed screen frame at desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?layout=screen-camera");
    const screenFrame = page.getByLabel("Screen capture placement");
    const liveChat = page.getByLabel("Live chat");

    await expect(page.getByRole("main")).toHaveClass(/layout-screen-camera/);
    await expect(screenFrame).toContainText("SCREEN CAPTURE");
    await expect(page.getByLabel("Webcam placement")).toHaveCount(0);

    const geometry = await getLayoutGeometry(screenFrame, liveChat);
    expect(geometry.screenBorderStyle).toBe("dashed");
    expect(geometry.chatIsLayeredAboveScreen).toBe(true);
    expect(geometry.chatTop).toBe(geometry.screenTop);
    expect(geometry.chatBottom).toBe(geometry.screenBottom);
    expect(geometry.chatLeft).toBeGreaterThanOrEqual(geometry.screenLeft);
    expect(geometry.chatRight).toBeLessThanOrEqual(geometry.screenRight);
    expect(geometry.chatHeight).toBeGreaterThan(700);
    expect(geometry.messagesFlex).toBe("1");
    expect(geometry.screenRight - geometry.screenLeft).toBeGreaterThan(1_000);
  });

  test("keeps the chat layered and within the frame at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?layout=screen-camera");
    const screenFrame = page.getByLabel("Screen capture placement");
    const liveChat = page.getByLabel("Live chat");

    await expect(screenFrame).toContainText("SCREEN CAPTURE");
    await expect(page.getByLabel("Webcam placement")).toHaveCount(0);

    const geometry = await getLayoutGeometry(screenFrame, liveChat);
    expect(geometry.screenBorderStyle).toBe("dashed");
    expect(geometry.chatIsLayeredAboveScreen).toBe(true);
    expect(geometry.chatTop).toBe(geometry.screenTop);
    expect(geometry.chatBottom).toBe(geometry.screenBottom);
    expect(geometry.chatLeft).toBeGreaterThanOrEqual(geometry.screenLeft);
    expect(geometry.chatRight).toBeLessThanOrEqual(geometry.screenRight);
    expect(geometry.chatHeight).toBeGreaterThan(700);
    expect(geometry.screenRight - geometry.screenLeft).toBeLessThanOrEqual(366);
  });
});
