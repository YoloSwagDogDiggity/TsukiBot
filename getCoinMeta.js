const fs = require('fs');
const chalk = require('chalk');
const CoinGecko = require('coingecko-api');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
var S = require('string');
const CoinGeckoClient = new CoinGecko();
let meta = { "data": [] };
let skipped = [];
let count = 0;
let cgCoinsList = "";


async function collectMetadata(coin) {
  let resJSON = await CoinGeckoClient.coins.fetch(coin, {
    'localization': false, 'tickers': false,
    'market_data': false, 'developer_data': false
  });

  // Skip instances where the coin has no data on API side (this can happen if the API removed it while this process is running)
  if (resJSON.error) {
    skipped.push(coin);
    console.log(chalk.yellowBright(`SKIPPED COIN: ${chalk.cyan(coin)} due to missing data. Proceeding...`));
    return;
  }

  //
  // Starting with the hardest part, rebuilding the description string
  //
  let stringResponse = resJSON.data.description;
  stringResponse = resJSON.data.description.en;
  descDOM = new JSDOM(stringResponse);
  let convertedLinks = [];

  // Extract all of the html links, convert them to discord embed links, and then put them into an array
  let elements = descDOM.window.document.getElementsByTagName('a');
  for (let i = 0; i < elements.length; i++) {
    let element = elements[i];
    let url = element.href;
    let hyperlinkText = element.text;
    let discordHyperlink = `[${hyperlinkText}](${url})`;
    convertedLinks.push(discordHyperlink);
  }

  // Replace each html link in the description string its the corresponding converted link we created earlier
  for (let i = 0; i < convertedLinks.length; i++) {
    let locatedString = S(stringResponse).between("<a href=\"", "</a>").s;
    let lookupString = `<a href=\"${locatedString}</a>`;
    stringResponse = stringResponse.replace(lookupString, convertedLinks[i]);
  }

  // Clean up the newline formatting
  stringResponse = S(stringResponse).replaceAll('\r\n\r\n', '\n\n').s;
  stringResponse = S(stringResponse).replaceAll('\r\n\r', '\n\n').s;
  stringResponse = S(stringResponse).replaceAll('\r\n', '\n').s;
  stringResponse = S(stringResponse).replaceAll('\n\r', '\n').s;
  stringResponse = S(stringResponse).replaceAll('\n\r\n', '\n\n').s;
  stringResponse = S(stringResponse).replaceAll('\n\r\n\r', '\n\n').s;


  // Now we can build this coins entry with its data and description, then add it to our main meta json
  let coinMeta = {
    id: ++count,
    coin: resJSON.data.symbol.toUpperCase(),
    name: resJSON.data.name,
    slug: resJSON.data.id,
    logo: resJSON.data.image.large,
    description: stringResponse,
    links: resJSON.data.links
  };
  meta.data.push(coinMeta);
}

function writeToFile() {
  fs.writeFileSync("./common/metadata.json", JSON.stringify(meta), function (err) {
    if (err)
      return console.log(err);
  });
  if (skipped.length > 0) {
    console.log(chalk.yellow(`Warning: The following coins were skipped due to missing data on API at their call time: ${chalk.cyan(skipped.toString())}`));
  }
  console.log(chalk.greenBright("Caching operation completed successfully and file was written!"));
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function startup() {
  cgCoinsList = await CoinGeckoClient.coins.list();
  for (let i = 0; i < cgCoinsList.data.length; i++) {
    console.log(chalk.cyan(cgCoinsList.data[i].id) + chalk.green(` (${i + 1} of ${cgCoinsList.data.length})`));
    await collectMetadata(cgCoinsList.data[i].id);
    await sleep(1500); //rate limiting requests to not exceed api limits
  }
  writeToFile();
}

startup();

exports.run = startup;