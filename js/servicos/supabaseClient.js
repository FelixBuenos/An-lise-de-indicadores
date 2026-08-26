// js/servicos/supabaseClient.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://zhfisczfrmhxeegcvvto.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZmlzY3pmcm1oeGVlZ2N2dnRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NDQxMTcsImV4cCI6MjEwMjUyMDExN30.J69oPLr5E4laVAkbSIn0qA9pyIuccABb_m8YnMH-buc';

export const supabase = createClient(supabaseUrl, supabaseKey);