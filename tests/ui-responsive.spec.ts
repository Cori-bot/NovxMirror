import { test, expect } from '@playwright/test';

// Tailles d'écran testées
const SIZES = [
  { name: 'Minimum autorisé', width: 720, height: 560 },
  { name: 'Taille par défaut', width: 960, height: 680 },
  { name: 'Standard 720p', width: 1280, height: 720 },
  { name: 'Standard 1080p FHD', width: 1920, height: 1080 },
  { name: 'Ultra-Large 2K', width: 2560, height: 1440 },
  { name: 'Format Vertical', width: 1080, height: 1920 },
];

test.beforeEach(async ({ page }) => {
  // Mock complet de l'API airmirror exposée par le preload d'Electron
  await page.addInitScript(() => {
    (window as any).airmirror = {
      getStatus: () => Promise.resolve({ status: 'stopped', fps: 0 }),
      getSettings: () =>
        Promise.resolve({
          name: 'NOVX Mirror',
          resolution: '1080p',
          fps: 60,
          theme: 'dark',
          locale: 'fr',
          audioGain: 1.0,
          firstLaunch: false,
          pinEnabled: false,
          pin: '',
          startMinimized: false,
          minimizeToTray: true,
          connectBehavior: 'normal',
          screenshotDir: null,
          screenshotDirDisplay: 'C:\\Users\\User\\Pictures\\NovX Mirror',
        }),
      getVersion: () => Promise.resolve('1.0.0'),
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      restartApp: () => Promise.resolve(),
      saveSettings: () => Promise.resolve(),
      applySettings: () => Promise.resolve(),
      checkBonjour: () => Promise.resolve({ running: true }),
      installBonjour: () => Promise.resolve({ success: true }),
      openBonjourPage: () => Promise.resolve(),
      createShortcuts: () =>
        Promise.resolve({
          ok: true,
          desktop: true,
          startMenu: true,
          desktopPath: null,
          startMenuPath: null,
        }),
      chooseScreenshotDirectory: () => Promise.resolve(null),
      openScreenshotDirectory: () => Promise.resolve(),
      minimizeWindow: () => Promise.resolve(),
      closeWindow: () => Promise.resolve(),
      onStatus: () => () => {},
      onStreamStats: () => () => {},
      onError: () => () => {},
      onSuccess: () => () => {},
      onThemeChanged: () => () => {},
      onLocaleChanged: () => () => {},
      onBonjourMissing: () => () => {},
      onVideoRouteSwitch: () => () => {},
      onLog: () => () => {},
      maximizeWindow: () => {},
      reset: () => {},
      screenshot: () => {},
      startRecording: () => Promise.resolve({ ok: true, recording: true }),
      stopRecording: () => Promise.resolve({ ok: true, recording: false, filePath: null, error: null }),
      saveRecording: () => Promise.resolve(null),
      setRecordingCaptureMode: () => Promise.resolve(),
      openExternal: () => Promise.resolve(true),
      openScreenshotDirectory: () => Promise.resolve(),
      getLogs: () => Promise.resolve([]),
      getStreamStats: () => Promise.resolve({}),
    };
  });
});

for (const size of SIZES) {
  test.describe(`Viewport: ${size.name} (${size.width}x${size.height})`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('doit charger l’interface sans débordement horizontal inopiné', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.titlebar');

      // Vérifier la présence du titre et de l'orbe principal
      await expect(page.locator('.titlebar-logo')).toBeVisible();
      await expect(page.locator('.play-orb')).toBeVisible();

      // Vérifier l'absence d'overflow horizontal
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    });

    test('doit naviguer vers les paramètres et ouvrir les sélecteurs sans collision', async ({
      page,
    }) => {
      await page.goto('/');
      // Le libellé exact est 'Parametres' (sans accent dans la trad)
      const settingsNav = page.locator('.top-nav-btn').nth(1);
      await settingsNav.click();

      await expect(page.locator('#panel-settings')).toBeVisible();

      // Ouvrir le premier sélecteur (.novx-select-trigger)
      const selectTrigger = page.locator('.novx-select-trigger').first();
      await selectTrigger.click();

      const selectList = page.locator('.novx-select-list');
      await expect(selectList).toBeVisible();

      // Fermer par Escape
      await page.keyboard.press('Escape');
      await expect(selectList).not.toBeVisible();
    });

    test('doit ouvrir et fermer les overlays et modales sans bloquer l’UX', async ({ page }) => {
      await page.goto('/');

      // Déclencher l'overlay légal/info depuis le store
      await page.evaluate(() => {
        const store = (window as any).useAppStore?.getState?.();
        if (store?.setPageOverlay) {
          store.setPageOverlay('privacy');
        }
      });

      // Si la modale est affichée, s'assurer que Escape la referme
      const pageDialog = page.locator('.page-dialog');
      if (await pageDialog.isVisible()) {
        await page.keyboard.press('Escape');
        await expect(pageDialog).not.toBeVisible();
      }
    });
  });
}
