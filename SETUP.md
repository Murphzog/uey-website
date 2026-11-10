# Connecting the forms to Google Sheets

The website has four forms. All of them send to one Google Apps Script web app, which checks the answers, adds each one as a row in a Google Sheet, and emails the team:

| Form | Page | Sheet tab | Email? |
|---|---|---|---|
| Express interest | volunteer.html | Volunteers | Yes |
| Request a visit | schools.html | Visit requests | Yes |
| Send a message | contact.html | Messages | Yes |
| Get visit updates (footer) | every page | Visit updates list | No |

The tabs are created automatically the first time each form is used. Until step 4 is done, every form shows "This preview form is not connected yet, so nothing was sent."

Everything below happens in your browser. Nothing needs installing.

## Before you start: pick the right Google account

The sheet, the script and the notification emails all belong to whichever Google account you're signed in to. Use an account the program will keep long term (an Urban Systems / UEY account), not a personal or school account that might close later.

## 1. Create the sheet

1. Go to [sheets.new](https://sheets.new) to create a blank Google Sheet.
2. Name it **UEY form submissions**.

## 2. Add the script

1. In the sheet, open **Extensions → Apps Script**.
2. Delete everything in the `Code.gs` file that opens.
3. Paste in everything from [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
4. Near the top, `NOTIFY_EMAIL` is set to `uey@urban-systems.org`. Change it if submissions should be emailed somewhere else (or set it to `''` for no emails).
5. Click the **Save** icon.

## 3. Deploy it as a web app

1. Click **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Fill in:
   - **Description:** `UEY website forms`
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**
4. Click **Deploy**.
5. Google asks you to authorize access. Choose your account. You'll see "Google hasn't verified this app": that's expected for your own script. Click **Advanced → Go to (project name) (unsafe)**, then **Allow**. The script asks to manage the sheet and send email as you.
6. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy.../exec`.

**Check it works:** open that URL in a new browser tab. You should see `{"ok":true,"message":"UEY form endpoint is running."}`.

"Who has access: Anyone" is required, because website visitors aren't signed in to Google. The script can only add rows; it never sends the sheet's contents back to anyone.

## 4. Connect the website

Paste the web app URL into [`js/config.js`](js/config.js):

```js
window.UEY_CONFIG = {
  FORMS_URL: 'https://script.google.com/macros/s/AKfy.../exec'
};
```

The URL is safe to publish in the website's code.

## 5. Test it

1. Start the site locally with Live Server (**Go Live** in VS Code, http://127.0.0.1:5501).
2. Submit each form once with test details. Each one should show its thank-you message after a second or two.
3. Check the sheet: a tab should appear for each form with your test row. Check the inbox for the notification emails.
4. Delete the test rows when you're done (keep the heading row).

If a form shows "That didn't go through", open the Apps Script editor and look under **Executions** (left sidebar) to see why.

## 6. Publish

Commit and push `js/config.js` (check `git whoami` first). Once GitHub Pages updates, the live forms at uey.urban-systems.org save to the sheet.

## Changing the script later

Saving the script doesn't update the live web app. After any change:

1. Click **Deploy → Manage deployments**.
2. Click the pencil (edit) icon on the existing deployment.
3. Set **Version** to **New version**, then click **Deploy**.

This keeps the same URL, so `js/config.js` doesn't change. (Using **New deployment** instead creates a new URL, which you'd then have to paste into `js/config.js` again.)

If you add or rename a field on a website form, update the matching form in `Code.gs` too. A tab's headings are only written when the tab is first created, so if you change a form's fields, update its heading row by hand (or delete the tab and let it be recreated).

## Good to know

- **Sharing:** share the sheet with the team like any Google Sheet. Anyone you share it with can see all submissions.
- **Spam:** each form has a hidden field that only bots fill in. Those submissions are quietly dropped.
- **Limits:** Google limits how many emails a script can send per day (about 100 on a regular Gmail account, more on Google Workspace). That's far more than these forms should need.
