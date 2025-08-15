// http.ts
import { CookieJar } from "tough-cookie";
import fetchCookie from "fetch-cookie";
import { promises as fs } from "fs";
import path from "path";

// 1) Create a single shared jar
let jar = new CookieJar(undefined, { looseMode: true });
// 2) Wrap Bun's global fetch
export const fetch = fetchCookie(globalThis.fetch, jar);

/**
 * Seed the jar with your clal token on the SSO domain.
 * Call this once at startup (or after loading a saved jar).
 */
export async function initJar(clalToken: string) {
    // cookie-string, and domain URL
    await jar.setCookie(
        `clal=${clalToken}; Path=/; HttpOnly; Secure`,
        "https://lng-tgk-aime-gw.am-all.net",
        { loose: true }
    );
}

/**
 * Persist the jar to a JSON file.  Later you can load it with loadJar().
 */
export async function saveJar(filepath: string) {
    const json = await jar.serialize();
    await fs.writeFile(filepath, JSON.stringify(json, null, 2), "utf-8");
}

/**
 * Load a previously-saved jar from disk.
 * Must be called before any fetches if you want to reuse cookies.
 */
export async function loadJar(filepath: string) {
    const raw = await fs.readFile(filepath, "utf-8");
    const data = JSON.parse(raw);
    jar = await new Promise<CookieJar>((resolve, reject) => {
        CookieJar.deserialize(data, undefined, (err, restoredJar) => {
            if (err) {
                reject(err);
            } else {
                resolve(restoredJar!);
            }
        });
    });
    // re-wrap fetch so it uses the new jar
    (exports as any).fetch = fetchCookie(globalThis.fetch, jar);
}

/**
 * Fetch from the maimaidx-eng site, following redirects + cookies automatically.
 * @param endpoint The path on maimaidx-eng.com, e.g. "api/fetch/scores"
 */
export async function getGameData(endpoint: string): Promise<any> {
    const url = new URL(endpoint, "https://maimaidx-eng.com/").toString();
    const res = await fetch(url, {
        redirect: "follow",  // follows 302→SSO→302 back→etc
        headers: {
            "Accept": "application/json",
            // any other headers your game API needs
        },
    });

    if (!res.ok) {
        throw new Error(`GET ${url} → ${res.status}`);
    }
    return res.json();
}


async function main() {
    let jar = new CookieJar(undefined, { looseMode: true });
    await jar.setCookie(
        `clal=ckfnt1827ugwwt14bdmkvim8fjflnfb5kg74nbwico54mtc055oyuajyc328m9mi; Path=/; HttpOnly; Secure`,
        "https://lng-tgk-aime-gw.am-all.net",
        { loose: true }
    );
    const fetch = fetchCookie(globalThis.fetch, jar);

  
    const res = await fetch("https://maimaidx-eng.com/maimai-mobile/home/", {
        redirect: "follow",  // follows 302→SSO→302 back→etc
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0"
        }
    });

    if (!res.ok) {
        throw new Error(`GET ${"https://maimaidx-eng.com/maimai-mobile/home/"} → ${res.status}`);
    }
    const txt = await res.text()
    console.log(txt);
}

main();