/**
 * screenshot page with puppeteer
 */

const argv = require('minimist')(process.argv.slice(2));
const dir = argv.dir;
const puppeteer = require('puppeteer');

(async () => {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.setViewport({ width: 640, height: 360 });

	console.log(parseInt(dir));
	if (parseInt(dir) < 10) {
		await page.goto(`http://localhost:8200/docs/0${dir}/index.html?NoDebug/`);
		await page.screenshot({ path: `docs/0${dir}/thumbnail.png` });
	} else {
		await page.goto(`http://localhost:8200/docs/${dir}/index.html?NoDebug/`);
		await page.screenshot({ path: `docs/${dir}/thumbnail.png` });
	}

	await browser.close();
})();

function delay(delay) {
	return new Promise(function(fulfill) {
		setTimeout(fulfill, delay);
	});
}
