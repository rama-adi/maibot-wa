async function main() {
    const hasher = new Bun.CryptoHasher("md5")
    const hashedTitle = parseInt(
        hasher.update("Freedom dive").digest("hex").slice(0, 8),
        16
    );

    const titleHashSmall = hashedTitle % 100;
    const id = 1750455343 * 10_000 + 4 * 100 + titleHashSmall;

    console.log(id)
}

main();