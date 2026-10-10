import { test, expect } from '@playwright/test';
test('real FileList is snapshotted and reset; same file can be selected again in StrictMode', async ({ page }) => {
 await page.goto('/e2e/harness/phase2.html');
 const input=page.locator('input[type=file]');
 const photo={name:'same.png',mimeType:'image/png',buffer:Buffer.from([1,2,3])};
 await input.setInputFiles(photo);
 await expect(page.locator('output')).toHaveText('same.png');
 expect(await input.evaluate((el:HTMLInputElement)=>el.files?.length)).toBe(0);
 await input.setInputFiles(photo);
 await expect(page.locator('output')).toHaveText('same.png,same.png');
 await input.setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('no')});
 await expect(page.locator('[data-sonner-toast]')).toHaveCount(1);
 await expect(page.locator('[data-sonner-toast]')).toContainText('INVALID_TYPE');
 await expect(page.locator('output')).toHaveText('same.png,same.png');
});
