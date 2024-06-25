import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import nunjucks from 'nunjucks';

const fetchURL = 'https://www.unpkg.com/web-features@0.8.6/index.json';
const outputDir = path.join(process.cwd(), 'out');
const dataDir = path.join(process.cwd(), 'src/data');
const stylesSrc = path.join(process.cwd(), 'src/styles.css');
const stylesDest = path.join(outputDir, 'styles.css');

// Initialize Nunjucks to use 'src/templates'
nunjucks.configure('src/templates', { autoescape: true });

async function generateData() {
  try {
    // 1. Fetch the URL
    const response = await fetch(fetchURL);
    if (!response.ok) {
      throw new Error('Network response was not ok ' + response.statusText);
    }

    // 2. Convert the URL to JSON
    const data = await response.json();

    // 3. Function to recursively process the data
    const baselineGroups = {};

    function processFeature(feature) {
      if (feature && typeof feature === 'object') {
        if (feature.status && feature.status.baseline) {
          const baselineStatus = feature.status.baseline || 'unknown';
          if (!baselineGroups[baselineStatus]) {
            baselineGroups[baselineStatus] = [];
          }
          baselineGroups[baselineStatus].push(feature);
        } else {
          for (const key in feature) {
            if (feature.hasOwnProperty(key)) {
              processFeature(feature[key]);
            }
          }
        }
      }
    }

    // Process the root object
    processFeature(data);

    // Ensure the data directory exists
    await fs.promises.mkdir(dataDir, { recursive: true });

    // 4. Create one file for each possible baseline status
    for (const baselineStatus in baselineGroups) {
      const filename = path.join(dataDir, `${baselineStatus}.json`);
      const fileContent = JSON.stringify(baselineGroups[baselineStatus], null, 2);

      // 5. Write the files to disk
      await fs.promises.writeFile(filename, fileContent, 'utf8');
      console.log(`File written: ${filename}`);
    }

    // Generate HTML pages
    await generateHTMLPages(baselineGroups);

    // Copy the styles.css file to the output directory
    await fs.promises.copyFile(stylesSrc, stylesDest);
    console.log(`Stylesheet copied to: ${stylesDest}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

async function generateHTMLPages(baselineGroups) {
  await fs.promises.mkdir(outputDir, { recursive: true });

  // Generate individual pages
  const statuses = ['high', 'low'];

  for (const baselineStatus of statuses) {
    if (baselineGroups[baselineStatus]) {
      const features = baselineGroups[baselineStatus];
      const title = baselineStatus === 'high' ? 'Widely Available Features' : 'Newly Available Features';
      const heading = baselineStatus === 'high' ? 'Widely Available Features' : 'Newly Available Features';
      const htmlContent = nunjucks.render('feature_template.njk', { features, title, heading });
      const outputFilePath = path.join(outputDir, `${baselineStatus}.html`);
      await fs.promises.writeFile(outputFilePath, htmlContent, 'utf8');
      console.log(`HTML file written: ${outputFilePath}`);
    }
  }

  // Generate index page
  const indexContent = nunjucks.render('index_template.njk', { statuses: statuses.filter(status => baselineGroups[status]) });
  const indexFilePath = path.join(outputDir, 'index.html');
  await fs.promises.writeFile(indexFilePath, indexContent, 'utf8');
  console.log(`Index HTML file written: ${indexFilePath}`);
}

// Run the script
generateData();
