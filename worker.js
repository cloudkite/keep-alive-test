import puppeteer from "@cloudflare/puppeteer";

async function getBrowser(env) {
  let browserWorker = env.BROWSER_WORKER;

  let retries = 3;
  while (retries) {
    try {
      let sessions = await puppeteer.sessions(browserWorker);
      let session = sessions.find((session) => !session.connectionId);
      if (session) {
        return await puppeteer.connect(browserWorker, session.sessionId);
      }

      if (sessions.length >= 2) {
        throw new Error("Reached browser session limit");
      }
      return await puppeteer.launch(browserWorker, {
        keep_alive: 60_000 * 10, // 10mins
      });
    } catch (error) {
      if (retries <= 0) throw error;
      console.log(`Retrying start browser instance. Error: ${error}`);
    } finally {
      retries--;
    }
  }

  throw new Error("Unable to start browser instance");
}

async function ingest(url, browser) {
  let page = null;
  try {
    page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });
    let html = await page.evaluate(() => document.querySelector("*")?.outerHTML);
    console.log(html);
  } finally {
    await page?.close();
  }
}

export default {
  async scheduled(_, env) {
    let browser = null;
    try {
      browser = await getBrowser(env);
      await ingest("https://example.com", browser);
    } catch (err) {
      console.error(`Error ingesting: ${err}`);
    } finally {
      browser?.disconnect();
    }
  }
}
