import {describe,expect,it} from "vitest";
import {RMS_NAVIGATION_REGISTRY,RMS_NON_NAV_ROUTES} from "./navigation.registry";

describe("hydrant navigation contract",()=>{
 it("exposes water supply list and create routes",()=>{
  expect(RMS_NAVIGATION_REGISTRY).toEqual(expect.arrayContaining([
   expect.objectContaining({id:"hydrants",path:"/hydrants/",group:"water-supply",permission:"rms.masterdata.read"}),
   expect.objectContaining({id:"hydrants-new",path:"/hydrants/new/",group:"water-supply",permission:"rms.masterdata.manage"}),
  ]));
 });
 it("keeps hydrant detail as a deep-link workspace",()=>{
  expect(RMS_NON_NAV_ROUTES).toEqual(expect.arrayContaining([expect.objectContaining({id:"hydrant-detail",path:"/hydrants/[id]/"})]));
 });
});
