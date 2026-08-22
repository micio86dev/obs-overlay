import { expect, test, type Locator } from "@playwright/test";

interface LayoutGeometry {
  chatBottom: number;
  chatHeight: number;
  chatIsLayeredAboveScreen: boolean;
  chatLeft: number;
  chatRight: number;
  chatTop: number;
  messagesFlex: string;
  screenBottom: number;
  screenLeft: number;
  screenRight: number;
  screenTop: number;
}

interface PlacementFrameStyles {
  backgroundColor: string;
  borderColor: string;
  borderStyle: string;
}

async function getPlacementFrameStyles(frame: Locator): Promise<PlacementFrameStyles> {
  return frame.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      borderColor: styles.borderColor,
      borderStyle: styles.borderStyle
    };
  });
}

async function expectTransparentDashedFrame(frame: Locator): Promise<void> {
  await expect(frame).toBeVisible();
  const styles = await getPlacementFrameStyles(frame);
  expect(styles.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(styles.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.borderStyle).toBe("dashed");
}

async function getLayoutGeometry(screen: Locator, liveChat: Locator): Promise<LayoutGeometry> {
  const messageLog = liveChat.getByRole("log");
  const [screenRect, chatRect, chatIsLayeredAboveScreen, messagesFlex] = await Promise.all([
    screen.boundingBox(),
    liveChat.boundingBox(),
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
    screenBottom: screenRect.y + screenRect.height,
    screenLeft: screenRect.x,
    screenRight: screenRect.x + screenRect.width,
    screenTop: screenRect.y
  };
}

test.describe("screen-camera layout", () => {
  test("keeps one dashed transparent screen frame visible beneath chat at desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?layout=screen-camera");
    const screenFrame = page.getByLabel("Screen capture placement");
    const logoFrame = page.getByRole("img", { name: "Logo placement" });
    const liveChat = page.getByLabel("Live chat");

    await expect(page.getByRole("main")).toHaveClass(/layout-screen-camera/);
    await expect(screenFrame).toContainText("SCREEN CAPTURE");
    await expect(page.getByLabel("Webcam placement")).toHaveCount(0);
    await expectTransparentDashedFrame(screenFrame);
    await expectTransparentDashedFrame(logoFrame);

    const geometry = await getLayoutGeometry(screenFrame, liveChat);
    expect(geometry.chatIsLayeredAboveScreen).toBe(true);
    expect(geometry.chatTop).toBe(geometry.screenTop);
    expect(geometry.chatBottom).toBe(geometry.screenBottom);
    expect(geometry.chatLeft).toBeGreaterThanOrEqual(geometry.screenLeft);
    expect(geometry.chatRight).toBeLessThanOrEqual(geometry.screenRight);
    expect(geometry.chatHeight).toBeGreaterThan(700);
    expect(geometry.messagesFlex).toBe("1");
    expect(geometry.screenRight - geometry.screenLeft).toBeGreaterThan(1_000);
  });

  test("keeps one large screen frame unobstructed by webcam reservations at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?layout=screen-camera");
    const screenFrame = page.getByLabel("Screen capture placement");
    const logoFrame = page.getByRole("img", { name: "Logo placement" });
    const liveChat = page.getByLabel("Live chat");

    await expect(screenFrame).toContainText("SCREEN CAPTURE");
    await expect(page.getByLabel("Webcam placement")).toHaveCount(0);
    await expectTransparentDashedFrame(screenFrame);
    await expectTransparentDashedFrame(logoFrame);

    const geometry = await getLayoutGeometry(screenFrame, liveChat);
    expect(geometry.chatIsLayeredAboveScreen).toBe(true);
    expect(geometry.chatTop).toBe(geometry.screenTop);
    expect(geometry.chatBottom).toBe(geometry.screenBottom);
    expect(geometry.chatLeft).toBeGreaterThanOrEqual(geometry.screenLeft);
    expect(geometry.chatRight).toBeLessThanOrEqual(geometry.screenRight);
    expect(geometry.chatHeight).toBeGreaterThan(600);
    expect(geometry.screenRight - geometry.screenLeft).toBeLessThanOrEqual(366);
  });
});

test("screen-webcam keeps dashed transparent screen, webcam, and logo frames in their intended columns", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?layout=screen-webcam");
  const screenFrame = page.getByLabel("Screen capture placement");
  const webcamFrame = page.getByLabel("Webcam placement");
  const logoFrame = page.getByRole("img", { name: "Logo placement" });

  await expect(page.getByRole("main")).toHaveClass(/layout-screen-webcam/);
  await expect(screenFrame).toContainText("SCREEN CAPTURE");
  await expect(webcamFrame).toContainText("WEBCAM");
  await expect(logoFrame).toContainText("LOGO");
  await Promise.all([
    expectTransparentDashedFrame(screenFrame),
    expectTransparentDashedFrame(webcamFrame),
    expectTransparentDashedFrame(logoFrame)
  ]);

  const [screenBox, webcamBox] = await Promise.all([screenFrame.boundingBox(), webcamFrame.boundingBox()]);
  if (screenBox == null || webcamBox == null) throw new Error("Expected screen and webcam placement frames");

  expect(screenBox.x + screenBox.width).toBeLessThan(webcamBox.x);
  expect(screenBox.width).toBeGreaterThan(webcamBox.width);
  expect(screenBox.height).toBeGreaterThan(webcamBox.height);
});
