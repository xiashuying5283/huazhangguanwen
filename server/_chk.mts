import { getSupabaseClient } from './src/storage/database/supabase-client';
const c = getSupabaseClient();
const ids=['43f28bde-d180-449f-8b2e-83cef064cc08','e684259f-37c4-45e8-b564-6fd2e05146a2','96eb4b76-c025-48e8-8c0d-d23ff778a723','ed4a9957-1758-48e6-b1da-dfa3d2ac333f','f02d61ad-abc9-4a4c-9bdc-10f0019c84dd'];
const { data } = await c.from('collection_entries')
  .select('id,volume,sort_order,entry_title,poem_id').in('poem_id',ids).order('sort_order',{ascending:true});
console.log(JSON.stringify(data??[],null,1));
