let running = false;
let exportTab = null;

const $ = id => document.getElementById(id);
const log = (msg, className) => {
  const status = $('status');
  const line = document.createElement('div');
  line.textContent = msg;
  if (className) line.className = className;
  status.appendChild(line);
  status.scrollTop = status.scrollHeight;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseGedcom(content) {
  const treeMatch = content.match(/2 _TREE[\s\S]*?\n3 RIN (\d+)/);
  const treeId = treeMatch ? treeMatch[1] : null;
  const personIds = [...content.matchAll(/0 @I(\d+)@ INDI/g)].map(m => m[1]);
  return { treeId, personIds: [...new Set(personIds)] };
}

$('gedcomFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const { treeId, personIds } = parseGedcom(evt.target.result);
    if (treeId) $('treeId').value = treeId;
    if (personIds.length) $('personIds').value = personIds.join(',');
    log(`Loaded ${personIds.length} people from ${file.name}`, 'success');
  };
  reader.readAsText(file);
});

async function navigateAndWait(url) {
  if (exportTab) {
    await chrome.tabs.remove(exportTab).catch(() => {});
  }
  const tab = await chrome.tabs.create({ url, active: false });
  exportTab = tab.id;

  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      const t = await chrome.tabs.get(exportTab);
      if (t.status === 'complete') {
        await sleep(1000);
        return true;
      }
    } catch (e) {
      exportTab = null;
      return false;
    }
  }
  return false;
}

async function navigateAndWaitForGallery(url) {
  if (exportTab) {
    await chrome.tabs.remove(exportTab).catch(() => {});
  }
  const tab = await chrome.tabs.create({ url, active: false });
  exportTab = tab.id;

  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      const t = await chrome.tabs.get(exportTab);
      if (t.status === 'complete') break;
    } catch (e) {
      exportTab = null;
      return false;
    }
  }

  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: exportTab },
        func: () => {
          const spinner = document.querySelector('.galleryLoading');
          const items = document.querySelectorAll('[class*="media-item"], [class*="galleryItem"], .memoryCard');
          return !spinner || spinner.classList.contains('noDisplay') || items.length > 0;
        },
        world: 'MAIN'
      });
      if (results[0].result) {
        await sleep(1000);
        return true;
      }
    } catch (e) {}
  }
  return true;
}

// Extract person card JSON from facts page
async function extractPersonData() {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: exportTab },
      func: async () => {
        const resp = await fetch(window.location.href, { credentials: 'include' });
        const html = await resp.text();
        const match = html.match(/id="personCardUIdData"[^>]*>([\s\S]*?)<\/script>/);
        if (match && match[1]) {
          try {
            return JSON.parse(match[1].trim());
          } catch (e) {
            return null;
          }
        }
        return null;
      },
      world: 'MAIN'
    });
    return results[0].result;
  } catch (e) {
    return null;
  }
}

// Extract events and family from facts page
async function extractFactsData() {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: exportTab },
      func: () => {
        const events = [];
        document.querySelectorAll('li.LifeEventItem, li.FamilyEventItem').forEach(el => {
          const type = el.querySelector('.userCardTitle')?.textContent?.trim() || '';
          const date = el.querySelector('.factItemDate')?.textContent?.trim() || '';
          const place = el.querySelector('.factItemLocation')?.textContent?.trim() || '';
          const desc = el.querySelector('.userCardContent > p.textWrap')?.textContent?.trim() || '';
          if (type) events.push({ type, date, place, description: desc || null });
        });

        const family = { parents: [], spouses: [], children: [] };

        document.querySelectorAll('#researchListParents .researchListItem a[href*="/person/"]').forEach(el => {
          const href = el.getAttribute('href') || '';
          const match = href.match(/\/person\/(\d+)\//);
          if (match) {
            family.parents.push({
              id: match[1],
              name: el.querySelector('.userCardTitle')?.textContent?.trim() || '',
              lifespan: el.querySelector('.userCardSubTitle')?.textContent?.trim() || ''
            });
          }
        });

        document.querySelectorAll('.familySection .researchListItem a[href*="/person/"]').forEach(el => {
          const href = el.getAttribute('href') || '';
          const match = href.match(/\/person\/(\d+)\//);
          if (match) {
            const id = match[1];
            if (family.parents.find(p => p.id === id)) return;

            const name = el.querySelector('.userCardTitle')?.textContent?.trim() || '';
            const lifespan = el.querySelector('.userCardSubTitle')?.textContent?.trim() || '';
            const section = el.closest('ul')?.previousElementSibling?.textContent?.toLowerCase() || '';

            const entry = { id, name, lifespan };
            if (section.includes('spouse')) family.spouses.push(entry);
            else if (section.includes('child')) family.children.push(entry);
            else family.spouses.push(entry);
          }
        });

        return { events, family };
      },
      world: 'MAIN'
    });
    return results[0].result;
  } catch (e) {
    return { events: [], family: { parents: [], spouses: [], children: [] } };
  }
}

// Extract narrative and story events from story page
async function extractStoryData() {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: exportTab },
      func: () => {
        const summary = document.querySelector('[data-testid="narrative-text"] .conBody')?.textContent?.trim() || '';

        const storyEvents = [];
        document.querySelectorAll('.lifeStoryEvents .timelineItem').forEach(el => {
          const eventId = el.getAttribute('data-event-id') || '';
          const type = el.querySelector('.conTitle')?.textContent?.trim() || '';
          const narrative = el.querySelector('.conBody .text2xlrg')?.textContent?.trim() || '';
          const dateLine = el.querySelector('.conBody .bold:last-of-type')?.textContent?.trim() || '';

          const linkedEl = el.querySelector('a[href*="/person/"]');
          let linkedPerson = null;
          if (linkedEl) {
            const href = linkedEl.getAttribute('href') || '';
            const match = href.match(/\/person\/(\d+)/);
            if (match) {
              linkedPerson = {
                id: match[1],
                name: linkedEl.querySelector('.userCardTitle')?.textContent?.trim() || '',
                lifespan: linkedEl.querySelector('.userCardSubTitle')?.textContent?.trim() || ''
              };
            }
          }

          if (type) storyEvents.push({ eventId, type, narrative, dateLine, linkedPerson });
        });

        return { summary, storyEvents };
      },
      world: 'MAIN'
    });
    return results[0].result;
  } catch (e) {
    return { summary: '', storyEvents: [] };
  }
}

// Extract media from gallery page
async function extractMediaData() {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: exportTab },
      func: () => {
        const mediaItems = [];
        document.querySelectorAll('[data-media-data]').forEach(el => {
          try {
            const data = JSON.parse(el.dataset.mediaData);
            mediaItems.push({
              id: data.id || data.mid,
              title: data.title || '',
              thumbnailUrl: data.thumbnailUrl || '',
              downloadUrl: data.downloadUrl ? `https://www.ancestry.com${data.downloadUrl}` : '',
              width: data.width,
              height: data.height,
              ext: data.ext || 'jpg'
            });
          } catch (e) {}
        });

        document.querySelectorAll('[data-thumbnail-url]').forEach(el => {
          const thumbnailUrl = el.dataset.thumbnailUrl;
          const mediaId = el.dataset.mediaId;
          if (thumbnailUrl && mediaId && !mediaItems.find(m => m.id === mediaId)) {
            mediaItems.push({
              id: mediaId,
              title: el.title || el.dataset.mediaTitle || '',
              thumbnailUrl
            });
          }
        });

        return mediaItems;
      },
      world: 'MAIN'
    });
    return results[0].result || [];
  } catch (e) {
    return [];
  }
}

async function exportPerson(treeId, personId, delay) {
  const baseUrl = `https://www.ancestry.com/family-tree/tree/${treeId}/person/${personId}`;
  let personData = null, factsData = null, storyData = null, mediaData = [];

  // Facts page - get person data and events/family
  log(`  Loading facts...`);
  if (await navigateAndWait(`${baseUrl}/facts`)) {
    personData = await extractPersonData();
    factsData = await extractFactsData();
    log(`    ${factsData.events.length} events, ${factsData.family.parents.length + factsData.family.spouses.length + factsData.family.children.length} family`);
  }
  if (!running) return null;
  await sleep(delay);

  // Story page - get narrative
  log(`  Loading story...`);
  if (await navigateAndWait(`${baseUrl}/story`)) {
    storyData = await extractStoryData();
    log(`    ${storyData.storyEvents.length} story events`);
  }
  if (!running) return null;
  await sleep(delay);

  // Gallery page - get media
  log(`  Loading gallery...`);
  if (await navigateAndWaitForGallery(`${baseUrl}/gallery`)) {
    mediaData = await extractMediaData();
    log(`    ${mediaData.length} media items`);
  }

  // Build final JSON
  const p = personData?.person || {};
  return {
    id: personId,
    treeId,
    name: {
      given: p.Given || '',
      surname: p.Surname || '',
      suffix: p.Suffix || '',
      full: [p.Given, p.Surname, p.Suffix].filter(Boolean).join(' ')
    },
    gender: p.Gender || '',
    living: p.IsLiving || false,
    relationship: p.RelationshipLabel || '',
    birth: { date: p.BirthDate || '', place: p.BirthPlace || '' },
    death: { date: p.DeathDate || '', place: p.DeathPlace || '' },
    summary: storyData?.summary || null,
    events: storyData?.storyEvents?.length > 0 ? storyData.storyEvents : (factsData?.events || []),
    family: factsData?.family || { parents: [], spouses: [], children: [] },
    media: mediaData,
    primaryImage: p.PrimaryImageUrl ? { id: p.PrimaryImageId, url: p.PrimaryImageUrl } : null
  };
}

function downloadJsonFile(filename, content) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: false });
}

async function startExport() {
  const treeId = $('treeId').value.trim();
  const personIds = $('personIds').value.split(',').map(s => s.trim()).filter(Boolean);
  const delay = parseInt($('delay').value) * 1000;

  if (!treeId || personIds.length === 0) {
    log('Please enter Tree ID and Person IDs', 'error');
    return;
  }

  running = true;
  exportTab = null;
  $('startBtn').disabled = true;
  $('stopBtn').disabled = false;
  $('status').innerHTML = '';

  try {
    log(`=== Starting export ===`);
    log(`Tree: ${treeId}`);
    log(`People: ${personIds.length}`);
    log(`Delay: ${delay/1000}s between pages`);
    log(``);

    for (let i = 0; i < personIds.length && running; i++) {
      const pid = personIds[i];
      log(`--- Person ${i+1}/${personIds.length}: ${pid} ---`);

      const data = await exportPerson(treeId, pid, delay);

      if (data) {
        const filename = `ancestry_export/${pid}.json`;
        downloadJsonFile(filename, JSON.stringify(data, null, 2));
        log(`Saved ${data.name.full || pid}`, 'success');
      }

      if (running && i < personIds.length - 1) {
        const waitTime = delay + Math.random() * 3000;
        log(`\nWaiting ${(waitTime/1000).toFixed(1)}s...\n`);
        await sleep(waitTime);
      }
    }
  } catch (e) {
    log(`ERROR: ${e.message}`, 'error');
    console.error('Export error:', e);
  }

  if (exportTab) {
    chrome.tabs.remove(exportTab).catch(() => {});
    exportTab = null;
  }

  running = false;
  $('startBtn').disabled = false;
  $('stopBtn').disabled = true;
  log(`\n=== Export complete ===`, 'success');
}

$('startBtn').addEventListener('click', startExport);
$('stopBtn').addEventListener('click', () => {
  running = false;
  log('\nStopping...', 'error');
  if (exportTab) {
    chrome.tabs.remove(exportTab).catch(() => {});
    exportTab = null;
  }
});

chrome.storage.local.get(['treeId', 'personIds'], (data) => {
  if (data.treeId) $('treeId').value = data.treeId;
  if (data.personIds) $('personIds').value = data.personIds;
});

$('treeId').addEventListener('change', () => {
  chrome.storage.local.set({ treeId: $('treeId').value });
});
$('personIds').addEventListener('change', () => {
  chrome.storage.local.set({ personIds: $('personIds').value });
});
