/**
 * UEY website forms → Google Sheet.
 *
 * Paste this whole file into the sheet's Apps Script editor (Extensions → Apps Script) and deploy it
 * as a web app. See SETUP.md in the website repo for the steps.
 *
 * Each form gets its own tab, created automatically on the first submission. A new row is added for
 * every submission, and an email goes to NOTIFY_EMAIL (except for newsletter sign-ups).
 *
 * The website (js/site.js) POSTs JSON like { form: 'volunteer', name: '...', email: '...', ... }.
 * The reply is { ok: true } or { error: '...' }. Errors starting with "Please" are shown to the visitor.
 */

// Who gets an email for each new submission. Set to '' to turn emails off.
var NOTIFY_EMAIL = 'uey@urban-systems.org';

var SHORT = 200;  // max characters for one-line fields
var LONG = 5000;  // max characters for message boxes
var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Each form: its tab, the email subject, and its fields in column order.
//   label: the column heading (and the line label in emails)
//   ask:   the message shown when a required field is empty
var FORMS = {
  volunteer: {
    tab: 'Volunteers', subject: 'New volunteer sign-up', notify: true,
    fields: [
      { key: 'name', label: 'Name', ask: 'Please enter your name.' },
      { key: 'email', label: 'Email', ask: 'Please enter your email.', email: true },
      { key: 'school', label: 'High school', ask: 'Please enter your high school.' },
      { key: 'grade', label: 'Grade' },
      { key: 'role', label: 'Wants to', ask: 'Please choose whether you want to lead or join a group.',
        oneOf: ['Group Lead', 'Volunteer'] },
      { key: 'friends', label: 'Group', max: LONG }
    ]
  },
  visit: {
    tab: 'Visit requests', subject: 'New classroom visit request', notify: true,
    fields: [
      { key: 'name', label: 'Name', ask: 'Please enter your name.' },
      { key: 'email', label: 'Email', ask: 'Please enter your email.', email: true },
      { key: 'school', label: 'School', ask: 'Please enter your school.' },
      { key: 'grade', label: 'Grade taught' },
      { key: 'notes', label: 'Notes', max: LONG }
    ]
  },
  contact: {
    tab: 'Messages', subject: 'New message from the website', notify: true,
    fields: [
      { key: 'name', label: 'Name', ask: 'Please enter your name.' },
      { key: 'email', label: 'Email', ask: 'Please enter your email.', email: true },
      { key: 'who', label: 'They are',
        oneOf: ['High school student', 'Teacher or school', 'Planner or partner', 'Other'] },
      { key: 'message', label: 'Message', ask: 'Please write a message.', max: LONG }
    ]
  },
  newsletter: {
    tab: 'Visit updates list', subject: 'New visit-updates sign-up', notify: false,
    unique: 'email', // signing up twice is fine: the second one is quietly ignored
    fields: [
      { key: 'email', label: 'Email', ask: 'Please enter your email.', email: true }
    ]
  }
};

function doPost(e) {
  var data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return reply({ error: 'Bad request' }); }
  if (!data || typeof data !== 'object') return reply({ error: 'Bad request' });

  // Spam trap: the hidden "website" field is invisible to people, so only bots fill it.
  // Pretend it worked so the bot moves on, but save nothing.
  if (typeof data.website === 'string' && data.website.trim()) return reply({ ok: true });

  var form = FORMS[data.form];
  if (!form) return reply({ error: 'Unknown form' });

  // Check every field and collect the cleaned-up values
  var row = {};
  for (var i = 0; i < form.fields.length; i++) {
    var f = form.fields[i];
    var value = typeof data[f.key] === 'string' ? data[f.key].trim() : '';
    if (!value) {
      if (f.ask) return reply({ error: f.ask });
      continue;
    }
    var max = f.max || SHORT;
    if (value.length > max) return reply({ error: 'Please keep your ' + f.label.toLowerCase() + ' under ' + max + ' characters.' });
    if (f.email && !EMAIL.test(value)) return reply({ error: 'Please enter a valid email address.' });
    if (f.oneOf && f.oneOf.indexOf(value) === -1) return reply({ error: 'Please choose one of the options.' });
    row[f.key] = f.email ? value.toLowerCase() : value;
  }

  // Only one submission writes at a time, so rows never overwrite each other
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return reply({ error: 'Busy' });
  }
  var added = false;
  try {
    var sheet = tabFor(form);
    if (!(form.unique && alreadyListed(sheet, form, row[form.unique]))) {
      sheet.appendRow([new Date()].concat(form.fields.map(function (f) { return safe(row[f.key] || ''); })));
      added = true;
    }
  } finally {
    lock.releaseLock();
  }

  if (added && form.notify && NOTIFY_EMAIL) notify(form, row);
  return reply({ ok: true });
}

// Opening the web app URL in a browser shows this, which is a quick way to check the deployment works
function doGet() {
  return reply({ ok: true, message: 'UEY form endpoint is running.' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// The form's tab, created with a bold, frozen heading row the first time it's needed
function tabFor(form) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(form.tab);
  if (!sheet) {
    sheet = book.insertSheet(form.tab);
    var headings = ['Submitted'].concat(form.fields.map(function (f) { return f.label; }));
    sheet.appendRow(headings);
    sheet.getRange(1, 1, 1, headings.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// For the newsletter: is this email already on the list?
function alreadyListed(sheet, form, value) {
  var col = 2 + form.fields.map(function (f) { return f.key; }).indexOf(form.unique); // column 1 is "Submitted"
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var existing = sheet.getRange(2, col, last - 1, 1).getValues();
  for (var i = 0; i < existing.length; i++) {
    if (String(existing[i][0]).replace(/^'/, '').toLowerCase() === value) return true;
  }
  return false;
}

// Stop text like "=SUM(...)" from running as a spreadsheet formula: store it as plain text instead
function safe(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function notify(form, row) {
  var lines = form.fields
    .filter(function (f) { return row[f.key]; })
    .map(function (f) { return f.label + ': ' + row[f.key]; });
  var mail = {
    to: NOTIFY_EMAIL,
    subject: 'UEY: ' + form.subject,
    body: lines.join('\n\n') + '\n\n---\nSaved in the "' + form.tab + '" tab of the UEY form submissions sheet.'
  };
  if (row.email) mail.replyTo = row.email; // hitting Reply in the email answers the person directly
  try {
    MailApp.sendEmail(mail);
  } catch (err) {
    // The submission is already saved; a failed email shouldn't make the visitor see an error
    console.error('UEY forms: email failed', err);
  }
}
