import { expect, test } from '@playwright/test';
test('renders the GroundQ scaffold', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('GroundQ')).toBeVisible();
  await expect(page.getByText('Scaffold initialized.')).toBeVisible();
});
