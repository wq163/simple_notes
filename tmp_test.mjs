import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  
  console.log('Clicking new note...');
  await page.click('text="+ 新建笔记"');
  await page.waitForTimeout(1000);
  
  console.log('Focusing editor and typing...');
  // Click inside editor
  await page.mouse.click(500, 300);
  await page.keyboard.type('Hello ');
  
  console.log('Clicking Toolbar tasks...');
  // Find the custom top toolbar button for Checklist
  // <button class="toolbar-btn" @mousedown.prevent="toggleTaskList()" title="待办清单">☑ 清单</button>
  const checklistBtn = page.locator('.editor-toolbar > button[title="待办清单"]');
  console.log('Wait for checklist btn...', await checklistBtn.count());
  
  await checklistBtn.click({ force: true, button: 'left' }); // Click it with left mouse button (triggers mousedown)
  
  console.log('Typing Buy milk...');
  await page.keyboard.type('Buy milk');
  
  await page.waitForTimeout(500);
  
  const html = await page.content();
  console.log('Does HTML contain <ul> or <li>?', html.includes('<ul>'), html.includes('<li'));
  
  if (!html.includes('<ul>') && !html.includes('<li')) {
      console.log('FAILED to create task list!');
  } else {
      console.log('SUCCESSFUL task list creation!');
  }
  
  await page.screenshot({ path: 'C:\\Users\\wq163\\.gemini\\antigravity\\brain\\f12ebd42-b788-46ea-89ba-11359503c33f\\playwright_test.png' });
  
  await browser.close();
})();
