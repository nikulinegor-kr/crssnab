import { expect, test } from 'bun:test';
import { organizationEntryRoute } from '../src/lib/mobileNavigation';
test('mobile default entry opens executive panel',()=>{
 expect(organizationEntryRoute(true)).toBe('/executive');
});
test('desktop default entry is unchanged',()=>{
 expect(organizationEntryRoute(false)).toBe('/requests');
});