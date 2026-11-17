import { expect, test } from 'bun:test';
import { organizationEntryRoute } from '../src/lib/mobileNavigation';
test('mobile default entry opens requests',()=>{
 expect(organizationEntryRoute(true)).toBe('/requests');
});
test('desktop default entry is unchanged',()=>{
 expect(organizationEntryRoute(false)).toBe('/requests');
});
