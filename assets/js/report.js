import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.2.6/+esm';
import { firebaseConfig } from './firebase-config.js';

const form = document.getElementById('reportForm');
const detailsInput = document.getElementById('details');
const preview = document.getElementById('markdownPreview');
const submitButton = document.getElementById('submitButton');
const formStatus = document.getElementById('formStatus');
const setupNotice = document.getElementById('setupNotice');
const setupMessage = document.getElementById('setupMessage');
let reportsCollection;

marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown() {
  const markdown = detailsInput.value.trim();
  if (!markdown) {
    preview.innerHTML = '<span class="field-help">Your rendered report will appear here.</span>';
    return;
  }
  const rendered = marked.parse(markdown);
  preview.innerHTML = DOMPurify.sanitize(rendered, {
    FORBID_TAGS: ['img', 'iframe', 'video', 'audio', 'style'],
    FORBID_ATTR: ['style'],
  });
}

function setStatus(message, kind = '') {
  formStatus.textContent = message;
  formStatus.className = `form-status ${kind}`;
}

detailsInput.addEventListener('input', renderMarkdown);

const configValues = Object.values(firebaseConfig);
const firebaseConfigReady =
  configValues.length > 0 &&
  configValues.every((value) => typeof value === 'string' && value && !value.startsWith('YOUR_'));

if (firebaseConfigReady) {
  try {
    const app = initializeApp(firebaseConfig);
    reportsCollection = collection(getFirestore(app), 'vulnerabilityReports');
    submitButton.disabled = false;
  } catch (error) {
    console.error('Secure report setup failed:', error?.code || 'unknown');
    setupNotice.hidden = false;
    setupMessage.textContent = 'Secure report submission could not be initialized. Please try again later.';
    setStatus('Secure reporting could not be initialized. Please try again later.', 'error');
  }
} else {
  setupNotice.hidden = false;
  setupMessage.textContent = 'Report submission is temporarily unavailable because the site configuration is incomplete.';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!reportsCollection || !form.reportValidity()) return;

  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'Submitting...';
  setStatus('Sending your report securely...');

  const report = {
    title: form.elements.title.value.trim(),
    affectedAsset: form.elements.asset.value.trim(),
    weakness: form.elements.weakness.value,
    severity: form.elements.severity.value,
    contactEmail: form.elements.email.value.trim(),
    detailsMarkdown: detailsInput.value.trim(),
    status: 'new',
    createdAt: serverTimestamp(),
  };

  try {
    const savedReport = await addDoc(reportsCollection, report);
    setStatus(`Report submitted privately. Reference: ${savedReport.id}`, 'success');
    submitButton.querySelector('span').textContent = 'Report submitted';
  } catch (error) {
    console.error('Vulnerability report submission failed:', error?.code || 'unknown');
    setStatus('The report could not be submitted. Your text is still here; please try again later.', 'error');
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = 'Submit private report';
  }
});