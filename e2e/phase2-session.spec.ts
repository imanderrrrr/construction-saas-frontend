import {test,expect} from '@playwright/test';
import {installHermeticBase,json} from './support/mock-api';

async function prepare(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
 await installHermeticBase(page,{role:'WORKER',username:'tester'});
 await context.addCookies([{name:'ofjr_session',value:encodeURIComponent(JSON.stringify({role:'WORKER',username:'tester'})),url:'http://127.0.0.1:5198'},{name:'bt_tenant',value:'phase2-a',url:'http://127.0.0.1:5198'},{name:'XSRF-TOKEN',value:'phase2-csrf',url:'http://127.0.0.1:5198'}]);
 await page.route('**/api/v1/billing/access',json({tier:'FULL',enforced:false,fieldWorkAllowed:true}));
 await page.route('**/api/v1/settings/timezone',json({timezone:'America/Guatemala'}));
 await page.route('**/api/v1/worker/expenses/places*',json([]));
}

test('cold SPA refreshes expired access and keeps the direct destination and query',async({page,context})=>{
 await prepare(page,context);let me=0,refresh=0;
 await page.route('**/api/v1/auth/me',route=>route.fulfill({status:++me===1?401:200,contentType:'application/json',body:JSON.stringify(me===1?{code:'UNAUTHORIZED'}:{role:'WORKER',username:'tester'})}));
 await page.route('**/api/v1/auth/refresh',route=>{refresh++;return json({role:'WORKER',username:'tester'})(route);});
 await page.goto('/worker/gastos/nuevo?phase2=direct');
 await expect(page.getByRole('spinbutton').first()).toBeVisible();
 await expect(page).toHaveURL(/\/worker\/gastos\/nuevo\?phase2=direct$/);
 expect(refresh).toBe(1);expect(me).toBeGreaterThanOrEqual(2);
});

test('a transient refresh keeps the session and an unfinished expense form',async({page,context})=>{
 await prepare(page,context);
 await page.goto('/worker/gastos/nuevo?phase2=draft');
 const amount=page.getByRole('spinbutton').first();await amount.fill('25');
 await page.route('**/api/v1/phase2/session-check',json({code:'UNAUTHORIZED'},401));
 await page.route('**/api/v1/auth/refresh',json({code:'TEMPORARY_FAILURE'},503));
 const code=await page.evaluate(async()=>{const {api}=await import('/src/app/lib/api.ts');try{await api('/api/v1/phase2/session-check');}catch(e){return (e as {code?:string}).code;}});
 expect(code).toBe('NETWORK_ERROR');
 await expect(amount).toHaveValue('25');await expect(page).toHaveURL(/phase2=draft$/);
 expect((await context.cookies()).some(c=>c.name==='ofjr_session')).toBe(true);
});

test('a rejected refresh clears the session and returns to login with the full destination',async({page,context})=>{
 await prepare(page,context);await page.goto('/worker/gastos/nuevo?phase2=expired');
 await expect(page.getByRole('spinbutton').first()).toBeVisible();
 await page.route('**/api/v1/phase2/session-check',json({code:'UNAUTHORIZED'},401));
 await page.route('**/api/v1/auth/refresh',json({code:'REFRESH_REVOKED'},401));
 await page.evaluate(async()=>{const {api}=await import('/src/app/lib/api.ts');await api('/api/v1/phase2/session-check').catch(()=>{});});
 await expect(page).toHaveURL(/\/login\?.*session=expired/);
 const url=new URL(page.url());expect(url.searchParams.get('next')).toBe('/worker/gastos/nuevo?phase2=expired');
 expect((await context.cookies()).some(c=>c.name==='ofjr_session')).toBe(false);
});
