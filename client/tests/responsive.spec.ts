import { test, expect, Page } from '@playwright/test';
const longName = 'Cardiology' + 'LongName'.repeat(12);
const location = { id:'l', name:longName, address:'Address'.repeat(35), phone:'(555) 010-4200', hours:'Monday through Friday, 8:00 AM to 5:00 PM', services:[longName] };
const department = { id:'d', name:longName, description:'Department description '.repeat(12), icon:'heart-pulse', matchingServiceIds:[], locations:[location], services:[{id:'s',name:longName,description:'Service details',appointmentGuidance:[]}] };
async function fits(page: Page) {
  const overflow = await page.locator('button, input, textarea, select, article, .hero-actions a, .topbar .brand').evaluateAll(elements => elements.filter(el => {
    const r=el.getBoundingClientRect();
    return r.width>0 && r.height>0 && (r.left < -1 || r.right > innerWidth+1);
  }).map(el => el.tagName + ':' + el.className));
  expect(overflow).toEqual([]);
}
for (const width of [1440,1024,768,390,320]) {
  test(`public and admin layouts fit at ${width}px with long content`,async({page})=>{
    await page.setViewportSize({width,height:900});
    let admin=false;
    await page.route('**/api/**',route=>{
      const path=new URL(route.request().url()).pathname;
      const data=path.endsWith('/auth/me') ? {user:{id:'a',name:'Administrator',role:'admin'}} : path.includes('/admin/') ? path.endsWith('/summary') ? {departments:1} : {items:[department]} : path.includes('/departments') ? {departments:[department]} : path.endsWith('/locations') ? {locations:[location]} : {faqs:[{id:'f',question:longName,answer:'FAQ answer'}]};
      return route.fulfill({json:data});
    });
    await page.goto('/');
    await expect(page.locator('.department-card')).toBeVisible();
    await fits(page);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('button',{name:/New to HealthRoute/}).click();
    await fits(page);
    await page.keyboard.press('Escape');
    await page.evaluate(()=>localStorage.setItem('healthroute_token',`test.${btoa(JSON.stringify({exp:Date.now()/1000+3600}))}.test`));
    await page.reload();
    await expect(page.getByRole('heading',{name:'Directory workspace'})).toBeVisible();
    await fits(page);
    await page.getByRole('button',{name:'Add record',exact:true}).click();
    await fits(page);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.getByRole('button',{name:`Delete ${longName}`,exact:true}).click();
    await fits(page);
    await page.screenshot({path:`/private/tmp/healthroute-responsive-${width}.png`});
  });
}
