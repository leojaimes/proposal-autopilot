import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';
dotenv.config();

const token = process.env.APIFY_TOKEN;
console.log('Token prefix:', token ? token.slice(0, 15) : 'NONE');
const client = new ApifyClient({ token });

async function testActor() {
  try {
    const user = await client.user().get();
    console.log('Apify user:', user?.username, 'Plan:', user?.plan?.id);

    // Check actor info
    const act = await client.actor('flash_mage/upwork').get();
    console.log('Actor flash_mage/upwork exists:', !!act, 'Title:', act?.title);
  } catch (err: any) {
    console.error('Apify error:', err.message);
  }
}

testActor();
