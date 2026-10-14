// Form backend settings. Fill these in after setting up Supabase (see SETUP.md, step 4).
// Both values are safe to publish: the anon key can only call the submit-form function,
// and the database tables are locked so nobody can read submissions from the browser.
window.UEY_CONFIG = {
  SUPABASE_URL: '',      // e.g. 'https://abcdefghijklmnop.supabase.co'
  SUPABASE_ANON_KEY: ''  // Project Settings → API Keys → anon / publishable key
};
