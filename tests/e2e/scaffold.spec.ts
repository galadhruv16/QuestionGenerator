import { expect, test } from '@playwright/test';
test('renders the GroundQ landing page', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'GroundQ' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: /Grounded knowledge\. Better questions\./,
    }),
  ).toBeVisible();
});

test('opens the visual sign-in route', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Continue with Google Workspace/ }),
  ).toBeVisible();
  await expect(page.getByLabel('Institutional Email')).toBeVisible();
  await expect(page.getByText('RESEARCH PORTAL', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText('PREVIEW STATE:', { exact: true })).toHaveCount(
    0,
  );
});

test('opens the Stitch account creation and recovery routes', async ({
  page,
}) => {
  await page.goto('/sign-up');
  await expect(
    page.getByRole('heading', { name: 'Create your account' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Create account/ }),
  ).toBeVisible();
  await expect(page.getByText('RESEARCH PORTAL', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText('PREVIEW STATE:', { exact: true })).toHaveCount(
    0,
  );

  await page.goto('/password-recovery');
  await expect(
    page.getByRole('heading', { name: 'Reset your password' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Send reset link/ }),
  ).toBeVisible();
  await expect(page.getByText('RESEARCH PORTAL', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText('PREVIEW STATE:', { exact: true })).toHaveCount(
    0,
  );
});
